<script setup lang="ts">
  import { ref, onMounted, nextTick } from 'vue';
  import { useRouter } from 'vue-router';
  import BaseButton from '../components/BaseButton.vue';
  import BaseInput from '../components/BaseInput.vue';
  import { MicroAgentService, type ChatMessage, type StreamResponse } from '../agent/micro-agent';
  import { Effect, Stream, Layer } from 'effect';
  import { OpenAIConfigService } from '../agent/config/openai-config';
  import { EnvConfigService } from '../agent/config/env-config';
  import { getOpenAIConfig } from '../utils/env';
  import { MarkdownRender } from 'vue-renderer-markdown';

  const router = useRouter();

  /** API配置状态 */
  const apiConfigured = ref(false);
  const apiKey = ref('');
  const model = ref('gpt-3.5-turbo');
  const baseUrl = ref('https://api.openai.com/v1');

  /** 测试相关状态 */
  const testPrompt = ref('你好，请介绍一下你自己');
  const testResponse = ref('');
  const reasoningContent = ref('');
  const enableReasoning = ref(false);
  const isLoading = ref(false);
  const error = ref('');

  /** 聊天历史 */
  const chatHistory = ref<
    Array<{
      role: string;
      content: string;
      reasoning_content?: string;
      timestamp: Date;
      enableReasoning?: boolean;
    }>
  >([]);

  /** 测试结果统计 */
  const testStats = ref({
    totalTests: 0,
    successTests: 0,
    failedTests: 0,
    averageResponseTime: 0,
  });

  /** API使用信息 */
  const usageInfo = ref({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    finishReason: '',
  });

  /** 返回主页 */
  const goHome = () => {
    router.push('/');
  };

  /** 检查API配置 */
  const checkApiConfig = () => {
    apiConfigured.value = !!(apiKey.value && model.value);
    return apiConfigured.value;
  };

  /** 保存API配置 */
  const saveApiConfig = () => {
    if (!validateConfig()) {
      return;
    }

    // 保存到localStorage
    localStorage.setItem('micro-agent-api-key', apiKey.value);
    localStorage.setItem('micro-agent-model', model.value);
    localStorage.setItem('micro-agent-base-url', baseUrl.value);
    localStorage.setItem('micro-agent-enable-reasoning', enableReasoning.value.toString());

    apiConfigured.value = true;
    error.value = '';
    showNotification('API配置已保存', 'success');
  };

  /** 加载已保存的配置 */
  const loadSavedConfig = () => {
    // 优先从环境变量加载默认配置
    const envConfig = getOpenAIConfig();

    // 设置默认值（环境变量）
    apiKey.value = envConfig.apiKey || '';
    model.value = envConfig.model || 'gpt-3.5-turbo';
    baseUrl.value = envConfig.baseUrl || 'https://api.openai.com/v1';
    enableReasoning.value = envConfig.showReasoningContent || false;

    // 允许 localStorage 中的配置覆盖环境变量
    const savedKey = localStorage.getItem('micro-agent-api-key');
    const savedModel = localStorage.getItem('micro-agent-model');
    const savedBaseUrl = localStorage.getItem('micro-agent-base-url');
    const savedShowReasoning = localStorage.getItem('micro-agent-enable-reasoning');

    // 如果 localStorage 中有配置，则覆盖环境变量
    if (savedKey) apiKey.value = savedKey;
    if (savedModel) model.value = savedModel;
    if (savedBaseUrl) baseUrl.value = savedBaseUrl;
    if (savedShowReasoning !== null) {
      enableReasoning.value = savedShowReasoning === 'true';
    }

    checkApiConfig();
  };

  /** 切换思考过程显示 */
  const toggleReasoning = () => {
    enableReasoning.value = !enableReasoning.value;
    // 自动保存思考过程设置
    localStorage.setItem('micro-agent-enable-reasoning', enableReasoning.value.toString());
  };

  /** 验证配置 */
  const validateConfig = () => {
    if (!apiKey.value.trim()) {
      error.value = '请输入有效的API密钥';
      return false;
    }
    if (!model.value.trim()) {
      error.value = '请输入有效的模型名称';
      return false;
    }
    return true;
  };

  /** 测试API连接 */
  const testApiConnection = async () => {
    if (!checkApiConfig()) {
      error.value = '请先配置API';
      return;
    }

    isLoading.value = true;
    error.value = '';
    testResponse.value = '';
    reasoningContent.value = '';

    try {
      const startTime = Date.now();

      // 构建消息列表
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: testPrompt.value,
          timestamp: new Date(),
        },
      ];

      // 使用 Effect 程序测试 API
      const testProgram = Effect.gen(function* () {
        const microAgentService = yield* MicroAgentService;

        // 创建流式对话
        const stream = yield* microAgentService.createStreamingChat(messages, {
          enableReasoning: enableReasoning.value,
          temperature: 0.7,
        });

        let finalResponse = '';
        let finishReason = '';

        // 处理流式响应
        yield* Stream.runForEach(stream, (response: StreamResponse) => {
          if (response.error) {
            throw new Error(response.error);
          }

          // 更新响应内容
          finalResponse = response.content;
          reasoningContent.value = response.reasoningContent || '';
          finishReason = response.finishReason;

          // 更新UI
          testResponse.value = finalResponse;

          // 更新使用统计
          if (response.usage) {
            usageInfo.value = {
              promptTokens: response.usage.promptTokens,
              completionTokens: response.usage.completionTokens,
              totalTokens: response.usage.totalTokens,
              finishReason: response.finishReason,
            };
          }

          return Effect.sync(() => {
            // 强制更新视图
            nextTick();
          });
        });

        return { finalResponse, finishReason };
      });

      // 使用环境配置创建测试程序的 Layer
      const testLayer = MicroAgentService.Default.pipe(
        Layer.provide(OpenAIConfigService.Default),
        Layer.provide(EnvConfigService.Default)
      );

      // 运行测试程序
      const result = await Effect.runPromise(testProgram.pipe(Effect.provide(testLayer)));

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // 更新统计信息
      testStats.value.totalTests++;
      testStats.value.successTests++;
      testStats.value.averageResponseTime =
        (testStats.value.averageResponseTime * (testStats.value.successTests - 1) + responseTime) /
        testStats.value.successTests;

      console.log(
        `流式响应完成，耗时: ${responseTime}ms, 内容长度: ${testResponse.value.length}, 思考过程长度: ${reasoningContent.value.length}`,
      );

      // 添加到聊天历史
      chatHistory.value.push({
        role: 'user',
        content: testPrompt.value,
        timestamp: new Date(),
      });

      const assistantMessage: any = {
        role: 'assistant',
        content: testResponse.value,
        timestamp: new Date(),
        enableReasoning: enableReasoning.value && !!reasoningContent.value,
      };

      if (reasoningContent.value) {
        assistantMessage.reasoning_content = reasoningContent.value;
      }

      chatHistory.value.push(assistantMessage);

      showNotification('API测试成功', 'success');
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      testStats.value.totalTests++;
      testStats.value.failedTests++;
      showNotification('API测试失败', 'error');
    } finally {
      isLoading.value = false;
    }
  };

  /** 清除聊天历史 */
  const clearHistory = () => {
    chatHistory.value = [];
    showNotification('聊天历史已清除', 'info');
  };

  /** 重置统计信息 */
  const resetStats = () => {
    testStats.value = {
      totalTests: 0,
      successTests: 0,
      failedTests: 0,
      averageResponseTime: 0,
    };
    showNotification('统计信息已重置', 'info');
  };

  /** 显示通知 */
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    // 简单的通知实现，可以后续替换为更复杂的toast组件
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white z-50 ${
      type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  };

  /** 预设测试用例 */
  const testCases = [
    { name: '基础对话', prompt: '你好，请简单介绍一下你自己' },
    { name: '代码生成', prompt: '请用JavaScript写一个计算斐波那契数列的函数' },
    { name: '文本分析', prompt: '请分析这段文字的情感倾向："今天天气真好，心情很愉快！"' },
    { name: '创意写作', prompt: '请写一首关于春天的短诗' },
    {
      name: '逻辑推理',
      prompt: '如果所有的猫都怕水，而小黑是一只猫，那么小黑怕水吗？请解释原因。',
    },
  ];

  /** 使用预设测试用例 */
  const useTestCase = (prompt: string) => {
    testPrompt.value = prompt;
  };

  // 页面加载时读取配置
  onMounted(() => {
    loadSavedConfig();
  });
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-6xl mx-auto px-4">
      <!-- 页面头部 -->
      <div class="mb-8">
        <div class="flex justify-between items-center mb-4">
          <h1 class="text-3xl font-bold text-gray-800">Micro Agent 测试页面</h1>
          <BaseButton variant="outline" @click="goHome"> ← 返回主页 </BaseButton>
        </div>
        <p class="text-gray-600">在这里测试您的 Micro Agent 功能和API连接</p>
      </div>

      <!-- 主要内容区域 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 左侧：API配置和测试 -->
        <div class="space-y-6">
          <!-- API配置 -->
          <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">API 配置</h2>

            <div class="space-y-4">
              <BaseInput
                v-model="apiKey"
                type="password"
                label="API Key"
                placeholder="输入您的OpenAI API Key"
                :disabled="isLoading" />

              <BaseInput
                v-model="model"
                label="模型"
                placeholder="gpt-3.5-turbo"
                :disabled="isLoading" />

              <BaseInput
                v-model="baseUrl"
                label="Base URL"
                placeholder="https://api.openai.com/v1"
                :disabled="isLoading" />

              <!-- 推理模式控制开关 -->
              <div class="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div>
                  <label class="text-sm font-medium text-gray-700">启用推理模式</label>
                  <p class="text-xs text-gray-500">
                    让模型进行更深入的思考和推理（支持具备推理能力的模型）
                  </p>
                </div>
                <button
                  @click="toggleReasoning"
                  :class="[
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
                    enableReasoning ? 'bg-purple-600' : 'bg-gray-200',
                  ]">
                  <span
                    :class="[
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      enableReasoning ? 'translate-x-6' : 'translate-x-1',
                    ]" />
                </button>
              </div>

              <div class="flex gap-2">
                <BaseButton variant="primary" @click="saveApiConfig" :disabled="isLoading">
                  保存配置
                </BaseButton>

                <div class="flex items-center">
                  <span
                    :class="[
                      'inline-block w-3 h-3 rounded-full mr-2',
                      apiConfigured ? 'bg-green-500' : 'bg-red-500',
                    ]"></span>
                  <span class="text-sm text-gray-600">
                    {{ apiConfigured ? '已配置' : '未配置' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <!-- 测试统计 -->
          <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-semibold text-gray-800">测试统计</h2>
              <BaseButton size="small" variant="outline" @click="resetStats"> 重置 </BaseButton>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="text-center p-3 bg-gray-50 rounded">
                <div class="text-2xl font-bold text-blue-600">{{ testStats.totalTests }}</div>
                <div class="text-sm text-gray-600">总测试次数</div>
              </div>
              <div class="text-center p-3 bg-gray-50 rounded">
                <div class="text-2xl font-bold text-green-600">{{ testStats.successTests }}</div>
                <div class="text-sm text-gray-600">成功次数</div>
              </div>
              <div class="text-center p-3 bg-gray-50 rounded">
                <div class="text-2xl font-bold text-red-600">{{ testStats.failedTests }}</div>
                <div class="text-sm text-gray-600">失败次数</div>
              </div>
              <div class="text-center p-3 bg-gray-50 rounded">
                <div class="text-2xl font-bold text-purple-600">
                  {{ testStats.averageResponseTime.toFixed(0) }}ms
                </div>
                <div class="text-sm text-gray-600">平均响应时间</div>
              </div>
            </div>
          </div>
          <!-- 测试输入 -->
          <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">测试输入</h2>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">预设测试用例</label>
                <div class="flex flex-wrap gap-2">
                  <BaseButton
                    v-for="testCase in testCases"
                    :key="testCase.name"
                    size="small"
                    variant="outline"
                    @click="useTestCase(testCase.prompt)">
                    {{ testCase.name }}
                  </BaseButton>
                </div>
              </div>

              <BaseInput
                v-model="testPrompt"
                label="测试提示"
                placeholder="输入您想测试的内容"
                :disabled="isLoading" />

              <BaseButton
                variant="primary"
                @click="testApiConnection"
                :disabled="isLoading || !apiConfigured"
                class="w-full">
                {{ isLoading ? '测试中...' : '发送测试' }}
              </BaseButton>
            </div>
          </div>
        </div>

        <!-- 右侧：响应和历史 -->
        <div class="space-y-6">
          <!-- API响应 -->
          <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">API 响应</h2>

            <div
              v-if="error"
              class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              <strong>错误：</strong>{{ error }}
            </div>

            <div v-else class="space-y-4">
              <!-- 思考过程 -->
              <div
                v-if="reasoningContent && enableReasoning"
                class="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                <div class="flex items-center justify-between mb-2">
                  <h3 class="text-sm font-semibold text-purple-800">🧠 思考过程</h3>
                  <button
                    @click="toggleReasoning"
                    class="text-xs text-purple-600 hover:text-purple-800 transition-colors">
                    {{ enableReasoning ? '隐藏' : '显示' }}
                  </button>
                </div>
                <div class="text-sm text-gray-700 markdown-content">
                  <MarkdownRender :content="reasoningContent" :code-block-stream="true" />
                </div>
              </div>

              <!-- 最终回复 - 流式渲染区域 -->
              <div class="bg-gray-50 p-4 rounded min-h-[200px]">
                <div class="flex items-center justify-between mb-2">
                  <h3 class="text-sm font-semibold text-gray-700">
                    💬 最终回复
                    <span v-if="isLoading && !testResponse" class="ml-2 text-xs text-blue-600">
                      <div class="inline-block animate-spin rounded-full h-3 w-3 border-b border-blue-600 mr-1"></div>
                      生成中...
                    </span>
                    <span v-else-if="isLoading && testResponse" class="ml-2 text-xs text-blue-600">
                      <div class="inline-block animate-pulse mr-1">▶</div>
                      继续生成...
                    </span>
                  </h3>
                  <div class="flex items-center gap-2">
                    <div
                      v-if="reasoningContent && !enableReasoning"
                      class="flex items-center gap-2">
                      <span class="text-xs text-gray-500">包含思考过程</span>
                      <button
                        @click="toggleReasoning"
                        class="text-xs text-purple-600 hover:text-purple-800 transition-colors">
                        {{ enableReasoning ? '隐藏' : '显示' }}
                      </button>
                    </div>
                    <div v-if="usageInfo.totalTokens > 0" class="text-xs text-gray-500">
                      {{ usageInfo.totalTokens }} tokens
                      <span v-if="usageInfo.finishReason" class="ml-1"
                        >({{ usageInfo.finishReason }})</span
                      >
                    </div>
                  </div>
                </div>
                <div class="markdown-content max-w-none">
                  <!-- 显示加载状态或流式内容 -->
                  <div v-if="!testResponse && !isLoading" class="text-center text-gray-500 py-8">
                    请发送测试请求查看响应结果
                  </div>
                  <MarkdownRender
                    v-else
                    :content="testResponse"
                    :code-block-stream="true"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 聊天历史 -->
          <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-semibold text-gray-800">聊天历史</h2>
              <BaseButton
                size="small"
                variant="outline"
                @click="clearHistory"
                :disabled="chatHistory.length === 0">
                清除
              </BaseButton>
            </div>

            <div class="space-y-3 max-h-96 overflow-y-auto">
              <div v-if="chatHistory.length === 0" class="text-center text-gray-500 py-8">
                暂无聊天记录
              </div>

              <div
                v-for="(message, index) in chatHistory"
                :key="index"
                :class="[
                  'p-3 rounded-lg',
                  message.role === 'user' ? 'bg-blue-50 ml-8' : 'bg-gray-100 mr-8',
                ]">
                <div class="flex justify-between items-start mb-1">
                  <span class="font-medium text-sm">
                    {{ message.role === 'user' ? '用户' : 'Assistant' }}
                  </span>
                  <span class="text-xs text-gray-500">
                    {{ message.timestamp.toLocaleTimeString() }}
                  </span>
                </div>
                <div class="markdown-content max-w-none">
                  <MarkdownRender :content="message.content" :code-block-stream="true" />
                </div>

                <!-- 思考过程显示 -->
                <div
                  v-if="message.role === 'assistant' && message.reasoning_content"
                  class="mt-3 pt-3 border-t border-gray-200">
                  <button
                    @click="message.enableReasoning = !message.enableReasoning"
                    class="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition-colors mb-2">
                    <span>🧠 思考过程</span>
                    <span>{{ message.enableReasoning ? '隐藏' : '显示' }}</span>
                  </button>
                  <div
                    v-if="message.enableReasoning"
                    class="text-xs text-gray-600 bg-purple-50 p-2 rounded markdown-content">
                    <MarkdownRender :content="message.reasoning_content" :code-block-stream="true" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  /* 自定义样式 */
  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Markdown 内容样式 */
  .markdown-content {
    font-family: system-ui, -apple-system, sans-serif;
    line-height: 1.6;
    color: #374151;
  }

  .markdown-content :deep(h1) {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 1rem 0 0.5rem 0;
    color: #111827;
  }

  .markdown-content :deep(h2) {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0.75rem 0 0.375rem 0;
    color: #1f2937;
  }

  .markdown-content :deep(h3) {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0.5rem 0 0.25rem 0;
    color: #374151;
  }

  .markdown-content :deep(p) {
    margin: 0.5rem 0;
  }

  .markdown-content :deep(ul) {
    list-style-type: disc;
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }

  .markdown-content :deep(ol) {
    list-style-type: decimal;
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }

  .markdown-content :deep(li) {
    margin: 0.25rem 0;
  }

  .markdown-content :deep(code) {
    background-color: #f3f4f6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    color: #d1d5db;
  }

  .markdown-content :deep(pre) {
    background-color: #1f2937;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 0.75rem 0;
  }

  .markdown-content :deep(pre code) {
    background-color: transparent;
    padding: 0;
    color: #f3f4f6;
  }

  .markdown-content :deep(blockquote) {
    border-left: 4px solid #e5e7eb;
    padding-left: 1rem;
    margin: 0.75rem 0;
    color: #6b7280;
    font-style: italic;
  }

  .markdown-content :deep(strong) {
    font-weight: 600;
    color: #111827;
  }

  .markdown-content :deep(em) {
    font-style: italic;
  }

  .markdown-content :deep(a) {
    color: #3b82f6;
    text-decoration: underline;
  }

  .markdown-content :deep(a:hover) {
    color: #2563eb;
  }

  .markdown-content :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 0.75rem 0;
  }

  .markdown-content :deep(th),
  .markdown-content :deep(td) {
    border: 1px solid #e5e7eb;
    padding: 0.5rem;
    text-align: left;
  }

  .markdown-content :deep(th) {
    background-color: #f9fafb;
    font-weight: 600;
  }

  .markdown-content :deep(hr) {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 1.5rem 0;
  }
</style>
