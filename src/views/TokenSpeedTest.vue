<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import BaseButton from '../components/BaseButton.vue';
  import { useTokenSpeedTest } from '../composables/useTokenSpeedTest';
  import { useOpenAIConfig } from '../composables/useOpenAIConfig';

  // 使用 Token 速度测试 hook
  const {
    isLoading,
    error,
    testResults,
    currentTokens,
    currentSpeed,
    currentElapsedTime,
    startTokenSpeedTest,
    clearResults,
    formatDuration,
    formatSpeed,
  } = useTokenSpeedTest();

  // 使用 OpenAI 配置 hook
  const {
    apiKey,
    model,
    baseUrl,
    showSettings,
    loadConfig,
    saveConfig,
    hasValidConfig,
    getConfig,
  } = useOpenAIConfig();

  /** 测试消息 */
  const testMessage = ref('请生成一段大约200字的关于人工智能发展的文本。');

  
  /** 开始token速度测试 */
  const handleStartTest = async () => {
    if (!testMessage.value.trim() || isLoading.value) {
      return;
    }

    if (!hasValidConfig()) {
      showSettings.value = true;
      return;
    }

    await startTokenSpeedTest(testMessage.value, getConfig(), {
      temperature: 0.7,
      maxTokens: 2000,
    });
  };

  onMounted(() => {
    loadConfig();
  });
</script>

<template>
  <!-- 主要内容区域 -->
  <div class="flex-1 overflow-y-auto px-4 py-6 h-full">
      <div class="max-w-4xl mx-auto space-y-6">
        <!-- 测试配置卡片 -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">测试配置</h2>

          <div class="space-y-4">
            <!-- 测试消息输入 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">测试消息</label>
              <textarea
                v-model="testMessage"
                :disabled="isLoading"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="输入要发送给AI的消息..." />
            </div>

            <!-- 开始测试按钮 -->
            <div class="flex justify-center">
              <BaseButton
                variant="primary"
                @click="handleStartTest"
                :disabled="isLoading || !testMessage.trim() || !hasValidConfig()"
                size="large"
                class="px-8">
                {{ isLoading ? '测试中...' : '开始测试' }}
              </BaseButton>
            </div>
          </div>
        </div>

        <!-- 实时状态卡片 -->
        <div v-if="isLoading || currentTokens > 0" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">实时状态</h2>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="text-center p-4 bg-blue-50 rounded-lg">
              <div class="text-2xl font-bold text-blue-600">{{ currentTokens }}</div>
              <div class="text-sm text-blue-600">接收 Tokens</div>
            </div>
            <div class="text-center p-4 bg-green-50 rounded-lg">
              <div class="text-2xl font-bold text-green-600">{{ formatSpeed(currentSpeed) }}</div>
              <div class="text-sm text-green-600">当前速度</div>
            </div>
            <div class="text-center p-4 bg-purple-50 rounded-lg">
              <div class="text-2xl font-bold text-purple-600">{{ formatDuration(currentElapsedTime) }}</div>
              <div class="text-sm text-purple-600">已用时间</div>
            </div>
          </div>

          <!-- 进度条 -->
          <div v-if="isLoading" class="mt-4">
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-blue-600 h-2 rounded-full transition-all duration-200"
                :style="{ width: '100%' }">
              </div>
            </div>
            <div class="text-center text-sm text-gray-600 mt-2">正在接收流式响应...</div>
          </div>
        </div>

        <!-- 错误提示 -->
        <div
          v-if="error"
          class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {{ error }}
        </div>

        <!-- 测试结果 -->
        <div v-if="testResults.length > 0" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">
            测试结果 ({{ testResults.length }})
          </h2>

          <div class="space-y-4">
            <div
              v-for="result in testResults"
              :key="result.id"
              class="border border-gray-200 rounded-lg p-4">
              <!-- 结果头部 -->
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div
                    class="w-3 h-3 rounded-full"
                    :class="{
                      'bg-yellow-500': result.status === 'running',
                      'bg-green-500': result.status === 'completed',
                      'bg-red-500': result.status === 'error',
                    }"></div>
                  <span class="font-medium text-gray-800">
                    {{ result.status === 'running' ? '测试中' :
                       result.status === 'completed' ? '已完成' : '失败' }}
                  </span>
                  <span class="text-sm text-gray-500">
                    {{ result.timestamp.toLocaleTimeString() }}
                  </span>
                </div>

                <div v-if="result.status !== 'running'" class="text-right">
                  <div class="text-lg font-semibold text-blue-600">
                    {{ formatSpeed(result.tokensPerSecond) }}
                  </div>
                  <div class="text-sm text-gray-500">平均速度</div>
                </div>
              </div>

              <!-- 测试消息 -->
              <div class="mb-3">
                <div class="text-sm font-medium text-gray-700 mb-1">测试消息:</div>
                <div class="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  {{ result.message }}
                </div>
              </div>

              <!-- 统计信息 -->
              <div v-if="result.status !== 'running'">
                <!-- Token 统计 -->
                <div v-if="result.actualTokens" class="grid grid-cols-1 gap-2 mb-3">
                  <div class="p-3 bg-blue-50 rounded border border-blue-200">
                    <div class="text-sm font-medium text-blue-800 mb-1">准确 Token 统计 (OpenAI API)</div>
                    <div class="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div class="text-lg font-semibold text-blue-700">{{ result.actualTokens.promptTokens || '-' }}</div>
                        <div class="text-xs text-blue-600">Prompt</div>
                      </div>
                      <div>
                        <div class="text-lg font-semibold text-blue-700">{{ result.actualTokens.completionTokens || '-' }}</div>
                        <div class="text-xs text-blue-600">Completion</div>
                      </div>
                      <div>
                        <div class="text-lg font-semibold text-blue-700">{{ result.actualTokens.totalTokens || '-' }}</div>
                        <div class="text-xs text-blue-600">Total</div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Token 数量和时间统计 -->
                <div class="grid grid-cols-3 gap-4 text-center mb-3">
                  <div class="p-2 bg-gray-50 rounded">
                    <div class="text-lg font-semibold text-gray-800">
                      {{ result.tokens }}
                      <span v-if="result.actualTokens" class="text-xs text-gray-500 ml-1">
                        (估算: {{ Math.round((result.tokens / (result.actualTokens.completionTokens || 1)) * 100) }}%)
                      </span>
                    </div>
                    <div class="text-sm text-gray-600">
                      {{ result.actualTokens ? 'Completion Tokens' : '估算 Tokens' }}
                    </div>
                  </div>
                  <div class="p-2 bg-green-50 rounded border border-green-200">
                    <div class="text-lg font-semibold text-green-700">
                      {{ result.firstTokenTime ? formatDuration(result.firstTokenTime) : '-' }}
                    </div>
                    <div class="text-sm text-green-600">首次响应时间</div>
                  </div>
                  <div class="p-2 bg-gray-50 rounded">
                    <div class="text-lg font-semibold text-gray-800">{{ formatDuration(result.duration) }}</div>
                    <div class="text-sm text-gray-600">总耗时</div>
                  </div>
                </div>

                <!-- 速度对比统计 -->
                <div class="grid grid-cols-2 gap-4 text-center mb-3">
                  <div class="p-3 bg-blue-50 rounded border border-blue-200">
                    <div class="text-lg font-semibold text-blue-700">
                      {{ formatSpeed(result.tokensPerSecond) }}
                    </div>
                    <div class="text-sm text-blue-600">总速度 (含延迟)</div>
                    <div class="text-xs text-blue-500 mt-1">
                      包含首次响应时间的完整速度
                    </div>
                  </div>
                  <div class="p-3 bg-purple-50 rounded border border-purple-200">
                    <div class="text-lg font-semibold text-purple-700">
                      {{ result.outputSpeed ? formatSpeed(result.outputSpeed) : '-' }}
                    </div>
                    <div class="text-sm text-purple-600">纯输出速度</div>
                    <div class="text-xs text-purple-500 mt-1">
                      去除首次响应时间的输出速度
                    </div>
                    <div v-if="result.outputSpeed && result.tokensPerSecond" class="text-xs text-purple-500 mt-1">
                      提升 {{ Math.round(((result.outputSpeed - result.tokensPerSecond) / result.tokensPerSecond) * 100) }}%
                    </div>
                  </div>
                </div>

                <!-- 其他统计 -->
                <div class="grid grid-cols-1 gap-4 text-center">
                  <div class="p-2 bg-gray-50 rounded">
                    <div class="text-lg font-semibold text-gray-800">{{ result.chunks.length }}</div>
                    <div class="text-sm text-gray-600">Chunk 数</div>
                  </div>
                </div>
              </div>

              <!-- Chunk 详情（仅对完成的测试显示） -->
              <div v-if="result.status === 'completed' && result.chunks.length > 0" class="mt-3">
                <details class="text-sm">
                  <summary class="cursor-pointer text-blue-600 hover:text-blue-800">
                    查看详细 Chunk 数据 ({{ result.chunks.length }} 个)
                  </summary>
                  <div class="mt-2 max-h-48 overflow-y-auto bg-gray-50 rounded p-2">
                    <div
                      v-for="(chunk, index) in result.chunks"
                      :key="index"
                      class="mb-2 pb-2 border-b border-gray-200 last:border-b-0">
                      <div class="flex justify-between items-center">
                        <span class="font-medium">Chunk {{ index + 1 }}:</span>
                        <span class="text-xs text-gray-500">{{ chunk.timestamp }}ms</span>
                      </div>
                      <div class="text-xs text-gray-600 mt-1">
                        内容: "{{ chunk.content }}" ({{ chunk.tokenCount }} tokens)
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>

        <!-- 使用说明 -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 class="font-semibold text-blue-800 mb-2">💡 使用说明</h3>
          <ul class="text-sm text-blue-700 space-y-1">
            <li>• 本测试用于测量 AI 返回 token 的速度和延迟</li>
            <li>• <strong>总速度 (含延迟)</strong>：总输出量 ÷ 总时间，包含首次响应延迟，反映用户体验</li>
            <li>• <strong>纯输出速度</strong>：总输出量 ÷ (总时间 - 首次响应时间)，反映 AI 真实的生成速度</li>
            <li>• 首次响应时间：从发送请求到收到第一个 token 的时间，是重要的性能指标</li>
            <li>• 支持 OpenAI API 的准确 token 统计，包括 Prompt、Completion 和 Total tokens</li>
            <li>• 当没有 API token 数据时，使用字符数估算（中文字符1个token，英文单词平均1.3个token）</li>
            <li>• 测试会显示实时的接收速度和详细的时间分析</li>
            <li>• 可以查看每个 chunk 的详细接收时间和内容</li>
            <li>• 建议运行多次测试以获得平均速度</li>
            <li>• 完整的流式响应会在最后 chunk 中包含准确的 usage 统计信息</li>
          </ul>
        </div>
      </div>
    </div>
</template>

<style scoped>
/* 自定义动画 */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>