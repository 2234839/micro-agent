<script setup lang="ts">
  import { ref, onMounted, nextTick, reactive } from 'vue';
  import { useRouter } from 'vue-router';
  import BaseButton from '../components/BaseButton.vue';
  import { MicroAgentService, type AgentStepChunk } from '../agent/micro-agent';
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

  /** 工具调用展开状态管理 */
  const toolCallExpanded = ref<Record<string, boolean>>({});

  /** 对话消息列表 */
  const messages = reactive<
    Array<{
      type: 'user' | 'ai' | 'agent';
      content: string;
      timestamp: Date;
      agentData?: {
        steps: Array<{
          aiOutput: string;
          toolCall?: any;
          error?: string;
        }>;
      };
    }>
  >([]);
  const currentMessage = ref('');
  const isLoading = ref(false);
  const error = ref('');

  /** Agent 模式状态 */
  const isAgentMode = ref(false);

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

    const userMessage = {
      type: 'user' as const,
      content: currentMessage.value.trim(),
      timestamp: new Date(),
    };

    messages.push(userMessage);
    currentMessage.value = '';
    error.value = '';
    isLoading.value = true;

    scrollToBottom();

    try {
      const chatLayer = MicroAgentService.Default.pipe(
        Layer.provide(OpenAIConfigService.Default),
        Layer.provide(EnvConfigService.Default),
      );

      if (isAgentMode.value) {
        // Agent 模式 - 创建响应式的步骤列表
        const agentMessage = {
          type: 'agent' as const,
          content: '',
          timestamp: new Date(),
          agentData: reactive({
            steps: [] as Array<{
              aiOutput: string;
              toolCall?: any;
              error?: string;
            }>,
          }),
        };

        messages.push(agentMessage);

        let isFirstChunk = true; // 标记是否为第一个 chunk

        const chatProgram = Effect.gen(function* () {
          const microAgentService = yield* MicroAgentService;
          const stream = yield* microAgentService.createAgentChat(userMessage.content, {
            mode: 'default',
            temperature: 0.7,
          });

          // 使用 runForEach 实现流式处理
          yield* Stream.runForEach(stream, (chunk: AgentStepChunk) => {
            return Effect.sync(() => {
              // 第一个 chunk 到达时停止 loading
              if (isFirstChunk) {
                isLoading.value = false;
                isFirstChunk = false;
              }

              if (chunk.error && !chunk.isDone) {
                // 非致命错误，继续执行
                console.error('Agent step error:', chunk.error);
              }

              // 确保步骤数组有足够的长度
              while (agentMessage.agentData.steps.length < chunk.step) {
                agentMessage.agentData.steps.push({
                  aiOutput: '',
                  toolCall: undefined,
                  error: undefined,
                });
              }

              // 获取当前步骤数据（使用 step-1 作为索引，因为 step 从 1 开始）
              const currentStepIndex = chunk.step - 1;
              const currentStepData = agentMessage.agentData.steps[currentStepIndex];

              if (currentStepData) {
                // 处理AI输出内容（直接累积，不做重复检查）
                if (chunk.content && chunk.content.trim()) {
                  currentStepData.aiOutput += chunk.content;
                }

                // 处理工具调用（排除finish工具）
                if (chunk.toolCall && chunk.toolCall.name !== 'finish' && chunk.toolCall.name) {
                  currentStepData.toolCall = chunk.toolCall;
                } else if (!chunk.toolCall) {
                  // 如果没有工具调用，确保不保留旧的工具调用数据
                  delete currentStepData.toolCall;
                }

                // 处理错误
                if (chunk.error) {
                  currentStepData.error = chunk.error;
                } else if (!chunk.error) {
                  // 如果没有错误，确保不保留旧的错误数据
                  delete currentStepData.error;
                }
              }

              // 自动滚动到底部
              scrollToBottom();
            });
          });

          return ''; // Agent的答案会在步骤中渲染
        });

        // 立即开始流式处理，不等待完成
        Effect.runPromise(chatProgram.pipe(Effect.provide(chatLayer)))
          .catch((err) => {
            console.error('Agent execution error:', err);
            error.value = err instanceof Error ? err.message : '发送失败';
            isLoading.value = false; // 确保出错时也停止 loading
          })
          .finally(() => {
            isLoading.value = false; // 确保最终停止 loading
          });
      } else {
        // 普通聊天模式
        const aiMessage = {
          type: 'ai' as const,
          content: '',
          timestamp: new Date(),
        };

        messages.push(aiMessage);

        // 构建API消息历史
        const apiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

        // 添加系统提示（如果启用）
        if (enableSystemPrompt.value) {
          apiMessages.push({
            role: 'system',
            content: systemPromptContent.value,
          });
        }

        // 添加历史对话（只添加用户和AI消息）
        for (const msg of messages) {
          if (msg.type === 'user') {
            apiMessages.push({
              role: 'user',
              content: msg.content,
            });
          } else if (msg.type === 'ai' && msg.content) {
            apiMessages.push({
              role: 'assistant',
              content: msg.content,
            });
          }
        }

        const chatProgram = Effect.gen(function* () {
          const microAgentService = yield* MicroAgentService;
          const stream = yield* microAgentService.createStreamingChat(apiMessages, {
            temperature: 0.7,
          });

          yield* Stream.runForEach(stream, (chunk: StreamChunk) => {
            if (chunk.error) {
              throw new Error(chunk.error);
            }

            // 直接处理每个 chunk，立即显示
            if (chunk.content) {
              const lastMessage = messages[messages.length - 1];
              if (lastMessage && lastMessage.type === 'ai') {
                // 累积并立即更新显示
                lastMessage.content += chunk.content;
                scrollToBottom();
              }
            }

            return Effect.void;
          });
        });

        await Effect.runPromise(chatProgram.pipe(Effect.provide(chatLayer)));
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '发送失败';
    } finally {
      isLoading.value = false;
      scrollToBottom();
    }
  };

  /** 切换工具调用展开状态 */
  const toggleToolCall = (stepIndex: number) => {
    const key = `step-${stepIndex}`;
    toolCallExpanded.value[key] = !toolCallExpanded.value[key];
  };

  /** 检查工具调用是否展开 */
  const isToolCallExpanded = (stepIndex: number) => {
    const key = `step-${stepIndex}`;
    return toolCallExpanded.value[key] || false;
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
    messages.length = 0;
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

        <!-- 模式切换 -->
        <div class="mb-8 max-w-xs mx-auto">
          <label class="block text-sm font-medium text-gray-700 mb-2">选择模式</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              @click="isAgentMode = false"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                !isAgentMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              ]">
              普通聊天
            </button>
            <button
              @click="isAgentMode = true"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                isAgentMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              ]">
              智能 Agent
            </button>
          </div>
        </div>

        <!-- 快捷提示 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
          <button
            v-for="prompt in [
              isAgentMode ? '计算 1+1*2-3/4 的结果' : '写一个Python函数来计算斐波那契数列',
              isAgentMode ? '获取当前时间并转换为时间戳' : '解释什么是机器学习',
              isAgentMode ? '帮我格式化这个JSON数据' : '帮我写一封邮件',
              isAgentMode ? '执行 JavaScript 代码测试' : '推荐一些学习编程的资源',
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
        <template v-for="(message, index) in messages" :key="index">
          <!-- 用户消息 -->
          <div v-if="message.type === 'user'" class="flex justify-end">
            <div class="max-w-[80%] px-4 py-3 rounded-lg bg-blue-600 text-white">
              <div class="flex items-center gap-2 mb-1">
                <div class="font-medium text-sm">👤 您</div>
                <div class="text-xs opacity-70">{{ message.timestamp.toLocaleTimeString() }}</div>
              </div>
              <div class="prose prose-sm max-w-none prose-invert">
                <MarkdownRender
                  v-if="message.content"
                  :content="message.content"
                  :code-block-stream="true"
                  :viewport-priority="true"
                  custom-id="user-chat" />
                <div v-else class="text-gray-300 italic">无内容</div>
              </div>
            </div>
          </div>

          <!-- AI 消息 -->
          <div v-else-if="message.type === 'ai'" class="flex justify-start">
            <div
              class="w-full max-w-none px-4 py-3 rounded-lg bg-gray-100 text-gray-800 border border-gray-200">
              <div class="flex items-center gap-2 mb-1">
                <div class="font-medium text-sm">🤖 Micro Agent</div>
                <div class="text-xs opacity-70">{{ message.timestamp.toLocaleTimeString() }}</div>
              </div>

              <!-- AI 消息直接渲染 Markdown -->
              <div class="prose prose-sm max-w-none">
                <MarkdownRender
                  v-if="message.content"
                  :content="message.content"
                  :code-block-stream="true"
                  :viewport-priority="true"
                  custom-id="ai-chat" />
                <div v-else class="text-gray-400 italic">正在思考...</div>
              </div>
            </div>
          </div>

          <!-- Agent 消息 -->
          <div v-else-if="message.type === 'agent'" class="flex justify-start">
            <div
              class="w-full max-w-none px-4 py-3 rounded-lg bg-gray-100 text-gray-800 border border-gray-200">
              <div class="flex items-center gap-2 mb-1">
                <div class="font-medium text-sm">🤖 Smart Agent</div>
                <div class="text-xs opacity-70">{{ message.timestamp.toLocaleTimeString() }}</div>
              </div>

              <!-- Agent 消息渲染步骤列表 -->
              <div class="agent-message">
                <!-- 渲染所有步骤 -->
                <template v-if="message.agentData">
                  <template v-for="(step, stepIndex) in message.agentData.steps" :key="stepIndex">
                    <!-- AI 输出内容（流式 Markdown 渲染） -->
                    <div v-if="step.aiOutput" class="ai-output-block">
                      <MarkdownRender
                        :content="step.aiOutput"
                        :code-block-stream="true"
                        :viewport-priority="true"
                        :custom-id="`agent-step-${stepIndex}-ai-output`" />
                    </div>

                    <!-- 工具调用（特殊渲染） -->
                    <div v-if="step.toolCall" >
                      <div
                        class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                        @click="toggleToolCall(stepIndex)">
                        <span class="text-sm font-medium text-gray-700">🛠️ 调用工具:</span>
                        <code class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-mono">
                          {{ step.toolCall.name }}
                        </code>

                        <!-- 展开/折叠图标 -->
                        <div class="ml-auto flex items-center gap-1">
                          <div v-if="step.toolCall.result" class="flex items-center gap-1">
                            <div
                              class="w-2 h-2 rounded-full"
                              :class="{
                                'bg-green-500': step.toolCall.result.success !== false,
                                'bg-red-500': step.toolCall.result.success === false,
                              }"></div>
                            <span class="text-xs text-gray-500">
                              {{ step.toolCall.result.success !== false ? '成功' : '失败' }}
                            </span>
                          </div>
                          <svg
                            class="w-4 h-4 text-gray-400 transition-transform"
                            :class="{ 'rotate-90': isToolCallExpanded(stepIndex) }"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>

                      <!-- 工具详情（折叠内容） -->
                      <div
                        v-show="isToolCallExpanded(stepIndex)"
                        class="mt-2 space-y-2 pl-2 border-l-2 border-gray-200">
                        <!-- 工具参数 -->
                        <div
                          v-if="Object.keys(step.toolCall.parameters).length > 0"
                          class="space-y-1">
                          <div class="text-sm font-medium text-gray-600">参数:</div>
                          <div class="bg-gray-50 rounded p-2 max-h-32 overflow-y-auto">
                            <pre class="text-xs text-gray-700 whitespace-pre-wrap">{{
                              JSON.stringify(step.toolCall.parameters, null, 2)
                            }}</pre>
                          </div>
                        </div>

                        <!-- 工具结果 -->
                        <div v-if="step.toolCall.result" class="space-y-1">
                          <div class="text-sm font-medium text-gray-600">执行结果:</div>
                          <div
                            class="rounded p-2 max-h-48 overflow-y-auto text-xs"
                            :class="{
                              'bg-green-50 text-green-800': step.toolCall.result.success !== false,
                              'bg-red-50 text-red-800': step.toolCall.result.success === false,
                            }">
                            <pre class="whitespace-pre-wrap">{{
                              JSON.stringify(step.toolCall.result, null, 2)
                            }}</pre>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 错误信息 -->
                    <div v-if="step.error" class="error-block">
                      <div class="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                        <div class="font-medium text-red-800 mb-1">❌ 错误:</div>
                        <div>{{ step.error }}</div>
                      </div>
                    </div>
                  </template>
                </template>
              </div>
            </div>
          </div>
        </template>
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

<style scoped></style>
