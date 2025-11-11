<script setup lang="ts">
  import { ref, onMounted, nextTick } from 'vue';
  import { useRouter } from 'vue-router';
  import BaseButton from '../components/BaseButton.vue';
  import { MicroAgentService, type ChatMessage } from '../agent/micro-agent';
  import type { StreamChunk } from '../agent/services/streaming-chat';
  import { Effect, Stream, Layer } from 'effect';
  import { OpenAIConfigService } from '../agent/config/openai-config';
  import { EnvConfigService } from '../agent/config/env-config';
  import { getOpenAIConfig } from '../utils/env';
  import { MarkdownRender, setDefaultMathOptions } from 'vue-renderer-markdown';
  import 'vue-renderer-markdown/index.css';
  import 'katex/dist/katex.min.css';

  /** 配置数学公式渲染选项 */
  setDefaultMathOptions({
    commands: ['infty', 'perp', 'alpha'],
    escapeExclamation: true,
  });
  const router = useRouter();

  /** 对话消息列表 */
  const messages = ref<Array<ChatMessage>>([]);
  const currentMessage = ref('');
  const isLoading = ref(false);
  const error = ref('');

  /** 滚动容器引用 */
  const chatContainer = ref<HTMLElement>();

  /** 配置设置对话框 */
  const showSettings = ref(false);
  const apiKey = ref('');
  const model = ref('gpt-3.5-turbo');
  const baseUrl = ref('https://api.openai.com/v1');
  const enableSystemPrompt = ref(false);
  const systemPromptContent = ref(`你的回答支持丰富的 Markdown 渲染：
- 代码块：\`\`\`language 语法高亮，支持 Monaco 编辑器
- 数学公式：$行内公式$ 和 $$块级公式$$ (KaTeX)
- 图表：\`\`\`mermaid 流程图、时序图等
- 完整 Markdown：表格、列表、任务列表、引用等

请充分利用这些格式化功能让内容更清晰。`);

  /** 返回主页 */
  const goHome = () => {
    router.push('/');
  };

  /** 加载配置 */
  const loadConfig = () => {
    const envConfig = getOpenAIConfig();
    apiKey.value = envConfig.apiKey || localStorage.getItem('micro-agent-api-key') || '';
    model.value = envConfig.model || localStorage.getItem('micro-agent-model') || 'gpt-3.5-turbo';
    baseUrl.value =
      envConfig.baseUrl ||
      localStorage.getItem('micro-agent-base-url') ||
      'https://api.openai.com/v1';
    enableSystemPrompt.value = localStorage.getItem('micro-agent-enable-system-prompt') === 'true';
  };

  /** 保存配置 */
  const saveConfig = () => {
    localStorage.setItem('micro-agent-api-key', apiKey.value);
    localStorage.setItem('micro-agent-model', model.value);
    localStorage.setItem('micro-agent-base-url', baseUrl.value);
    localStorage.setItem('micro-agent-enable-system-prompt', enableSystemPrompt.value.toString());
    showSettings.value = false;
  };

  /** 检查配置 */
  const hasConfig = () => {
    return !!(apiKey.value && model.value);
  };

  /** 滚动到底部 */
  const scrollToBottom = () => {
    nextTick(() => {
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
      }
    });
  };

  /** 发送消息 */
  const sendMessage = async () => {
    if (!currentMessage.value.trim() || isLoading.value) return;

    if (!hasConfig()) {
      showSettings.value = true;
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: currentMessage.value.trim(),
      timestamp: new Date(),
    };

    messages.value.push(userMessage);
    currentMessage.value = '';
    error.value = '';
    isLoading.value = true;

    // 创建临时助手消息用于流式显示
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    messages.value.push(assistantMessage);

    scrollToBottom();

    try {
      let chatMessages: ChatMessage[] = messages.value.slice(0, -1); // 排除刚创建的空助手消息

      // 如果启用了系统提示词，注入系统消息
      if (enableSystemPrompt.value) {
        const systemMessage: ChatMessage = {
          role: 'system',
          content: systemPromptContent.value,
          timestamp: new Date(),
        };
        // 将系统消息插入到对话开头
        chatMessages = [systemMessage, ...chatMessages];
      }

      const chatProgram = Effect.gen(function* () {
        const microAgentService = yield* MicroAgentService;
        const stream = yield* microAgentService.createStreamingChat(chatMessages, {
          temperature: 0.7,
        });

        let fullResponse = '';

        yield* Stream.runForEach(stream, (chunk: StreamChunk) => {
          if (chunk.error) {
            throw new Error(chunk.error);
          }

          // 直接处理每个 chunk，立即显示
          if (chunk.content) {
            const lastMessage = messages.value[messages.value.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              // 累积并立即更新显示
              const updatedContent = lastMessage.content + chunk.content;
              messages.value[messages.value.length - 1] = {
                ...lastMessage,
                content: updatedContent,
              };
              // 强制触发 Vue 的响应式更新
              messages.value = [...messages.value];
              scrollToBottom();
            }
          }

          return Effect.void;
        });

        return fullResponse;
      });

      const chatLayer = MicroAgentService.Default.pipe(
        Layer.provide(OpenAIConfigService.Default),
        Layer.provide(EnvConfigService.Default),
      );

      await Effect.runPromise(chatProgram.pipe(Effect.provide(chatLayer)));
    } catch (err) {
      error.value = err instanceof Error ? err.message : '发送失败';
      // 移除失败的助手消息
      const index = messages.value.indexOf(assistantMessage);
      if (index > -1) {
        messages.value.splice(index, 1);
      }
    } finally {
      isLoading.value = false;
      scrollToBottom();
    }
  };

  /** 处理回车发送 */
  const handleKeyPress = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  /** 清空对话 */
  const clearChat = () => {
    messages.value = [];
    error.value = '';
  };

  onMounted(() => {
    loadConfig();
  });
</script>

<template>
  <div class="flex flex-col h-screen bg-white">
    <!-- 顶部导航栏 -->
    <header class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
      <div class="flex items-center gap-3">
        <BaseButton variant="outline" size="small" @click="goHome"> ← 返回 </BaseButton>
        <h1 class="text-lg font-semibold text-gray-800">Micro Agent Chat</h1>
      </div>
      <div class="flex items-center gap-2">
        <BaseButton variant="outline" size="small" @click="clearChat"> 清空对话 </BaseButton>
        <BaseButton variant="outline" size="small" @click="showSettings = true">
          ⚙️ 设置
        </BaseButton>
      </div>
    </header>

    <!-- 主要聊天区域 -->
    <div ref="chatContainer" class="flex-1 overflow-y-auto px-4 py-6">
      <!-- 欢迎消息 -->
      <div v-if="messages.length === 0" class="text-center py-12">
        <div class="text-4xl mb-4">👋</div>
        <h2 class="text-2xl font-semibold text-gray-800 mb-2">欢迎使用 Micro Agent</h2>
        <p class="text-gray-600 mb-6">有什么我可以帮助您的吗？</p>

        <!-- 快捷提示 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
          <button
            v-for="prompt in [
              '写一个Python函数来计算斐波那契数列',
              '解释什么是机器学习',
              '帮我写一封邮件',
              '推荐一些学习编程的资源',
            ]"
            :key="prompt"
            @click="currentMessage = prompt"
            class="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors">
            <div class="font-medium text-gray-800">{{ prompt }}</div>
          </button>
        </div>
      </div>

      <!-- 错误提示 -->
      <div
        v-if="error"
        class="max-w-3xl mx-auto mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
        {{ error }}
      </div>

      <!-- 消息列表 -->
      <div class="max-w-3xl mx-auto space-y-6">
        <div
          v-for="(message, index) in messages"
          :key="index"
          class="flex"
          :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
          <div
            class="max-w-[80%] px-4 py-3 rounded-lg"
            :class="
              message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800 border border-gray-200'
            ">
            <div class="flex items-center gap-2 mb-1">
              <div class="font-medium text-sm">
                {{ message.role === 'user' ? '👤 您' : '🤖 Micro Agent' }}
              </div>
              <div class="text-xs opacity-70">
                {{ message.timestamp.toLocaleTimeString() }}
              </div>
            </div>

            <!-- 消息内容 -->
            <div
              class="prose prose-sm max-w-none"
              :class="message.role === 'user' ? 'prose-invert' : ''">
              <MarkdownRender
                v-if="message.content"
                :content="message.content"
                :code-block-stream="true"
                :viewport-priority="true"
                custom-id="micro-agent-chat" />
              <div v-else class="text-gray-500 italic">无内容</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="border-t border-gray-200 bg-white px-4 py-4">
      <div class="max-w-3xl mx-auto">
        <div class="flex gap-3">
          <input
            v-model="currentMessage"
            @keypress="handleKeyPress"
            :disabled="isLoading"
            :placeholder="!hasConfig() ? '请先配置 API 设置...' : '输入您的消息...'"
            class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows="1" />
          <BaseButton
            variant="primary"
            @click="sendMessage"
            :disabled="isLoading || !currentMessage.trim() || !hasConfig()"
            class="px-6">
            {{ isLoading ? '发送中...' : '发送' }}
          </BaseButton>
        </div>
        <div class="text-xs text-gray-500 mt-2 text-center">按 Enter 发送，Shift+Enter 换行</div>
      </div>
    </div>

    <!-- 设置对话框 -->
    <div
      v-if="showSettings"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="showSettings = false">
      <div class="bg-white rounded-lg p-6 w-full max-w-md" @click.stop>
        <h3 class="text-lg font-semibold mb-4">API 设置</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              v-model="apiKey"
              type="password"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入您的 API Key" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">模型</label>
            <input
              v-model="model"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="gpt-3.5-turbo" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
            <input
              v-model="baseUrl"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://api.openai.com/v1" />
          </div>

          <div>
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                v-model="enableSystemPrompt"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span class="text-sm font-medium text-gray-700">启用渲染功能提示</span>
            </label>
            <p class="text-xs text-gray-500 mt-1">
              启用后会告诉 AI 当前环境支持丰富的 Markdown 渲染功能
            </p>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <BaseButton variant="outline" @click="showSettings = false"> 取消 </BaseButton>
          <BaseButton variant="primary" @click="saveConfig"> 保存 </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
