<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useTokenSpeedTest } from '../../composables/useTokenSpeedTest';
  import { useOpenAIConfig } from '../../composables/useOpenAIConfig';

  // 使用 Token 速度测试 hook
  const {
    isLoading,
    error,
    currentTokens,
    currentSpeed,
    currentElapsedTime,
    startTokenSpeedTest,
    formatDuration,
    formatSpeed
  } = useTokenSpeedTest();

  // 使用 OpenAI 配置 hook
  const {
    loadConfig,
    hasValidConfig,
    getConfig,
  } = useOpenAIConfig();

  /** 测试消息输入 */
  const testMessage = ref('');

  /** 开始 token 速度测试 */
  const handleStartTest = async () => {
    if (!testMessage.value.trim() || isLoading.value || !hasValidConfig()) {
      return;
    }

    await startTokenSpeedTest(testMessage.value.trim(), getConfig());
    testMessage.value = '';
  };

  
  onMounted(() => {
    loadConfig();
  });
</script>

<template>
  <div class="flex-1 overflow-y-auto px-4 py-6 h-full">
    <div class="max-w-2xl mx-auto space-y-6">
      <!-- 标题 -->
      <div class="text-center">
        <h1 class="text-2xl font-bold text-gray-800 mb-2">Token 速度测试</h1>
        <p class="text-gray-600">测试 AI 模型的响应速度和 token 生成速度</p>
      </div>

      <!-- 测试输入 -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              测试消息
            </label>
            <textarea
              v-model="testMessage"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="3"
              placeholder="输入要测试的消息..."
              :disabled="isLoading"
              @keydown.enter.prevent="handleStartTest"
            />
          </div>

          <button
            @click="handleStartTest"
            :disabled="isLoading || !testMessage.trim() || !hasValidConfig()"
            class="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {{ isLoading ? '测试中...' : '开始测试' }}
          </button>
        </div>
      </div>

      <!-- 实时状态 -->
      <div v-if="isLoading || currentTokens > 0" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">测试状态</h2>
        <div class="grid grid-cols-3 gap-4 text-center">
          <div>
            <div class="text-2xl font-bold text-blue-600">{{ currentTokens }}</div>
            <div class="text-sm text-gray-600">Token 数</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-green-600">{{ formatSpeed(currentSpeed) }}</div>
            <div class="text-sm text-gray-600">速度</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-purple-600">{{ formatDuration(currentElapsedTime) }}</div>
            <div class="text-sm text-gray-600">耗时</div>
          </div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
        {{ error }}
      </div>

      <!-- 配置提醒 -->
      <div v-if="!hasValidConfig()" class="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4">
        请先配置 OpenAI API Key 和模型
      </div>
    </div>
  </div>
</template>

