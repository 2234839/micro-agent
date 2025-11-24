<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue';
  import { tokenSpeedTest } from '../../composables/useTokenSpeedTest';
  import { useOpenAIConfig } from '../../composables/useOpenAIConfig';
  import RealTimeStatus from './RealTimeStatus.vue';

  // 使用 OpenAI 配置 hook
  const {
    loadConfig,
    hasValidConfig,
  } = useOpenAIConfig();

  /** 测试消息输入 */
  const testMessage = ref('');

  /** 当前测试状态 */
  const currentTest = ref<ReturnType<typeof tokenSpeedTest> | null>(null);

  /** 错误信息 */
  const errorMessage = computed(() => {
    return currentTest.value?.state.status.error || '';
  });

  /** 开始 token 速度测试 */
  const handleStartTest = async () => {
    if (!testMessage.value.trim() || currentTest.value?.state.status.isLoading || !hasValidConfig()) {
      return;
    }

    // 如果有正在进行的测试，先停止它
    if (currentTest.value?.state.status.isLoading) {
      currentTest.value.stop();
    }

    try {
      // 创建新的测试实例
      currentTest.value = tokenSpeedTest(testMessage.value.trim(), {
        temperature: 0.7,
        maxTokens: 131072,
        historyInterval:100
      });
      testMessage.value = '';

      // 监听程序完成
      currentTest.value?.programRun.catch((err) => {
        console.error('Token speed test error:', err);
      });

    } catch (err) {
      console.error('Token speed test error:', err);
    }
  };

  /** 停止测试 */
  const handleStopTest = () => {
    if (currentTest.value?.state.status.isLoading) {
      currentTest.value.stop();
    }
  };

  /** 重置测试 */
  const handleResetTest = () => {
    if (currentTest.value) {
      currentTest.value.reset();
    }
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
              :disabled="currentTest?.state.status.isLoading"
              @keydown.enter.prevent="handleStartTest"
            />
          </div>

          <div class="flex space-x-2">
            <button
              @click="handleStartTest"
              :disabled="currentTest?.state.status.isLoading || !testMessage.trim() || !hasValidConfig()"
              class="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {{ currentTest?.state.status.isLoading ? '测试中...' : '开始测试' }}
            </button>

            <button
              v-if="currentTest?.state.status.isLoading"
              @click="handleStopTest"
              class="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
            >
              停止
            </button>

            <button
              v-if="currentTest && !currentTest.state.status.isLoading"
              @click="handleResetTest"
              class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      <!-- 测试历史入口 -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-800">测试历史</h3>
          <router-link
            to="/token-speed-test/history"
            class="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            查看历史记录
          </router-link>
        </div>
        <p class="text-gray-600 text-sm mt-2">查看之前的 Token 速度测试结果和统计分析</p>
      </div>

      <!-- 实时状态 -->
      <RealTimeStatus
        v-if="currentTest"
        :state="currentTest.state"
      />

      <!-- 错误提示 -->
      <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
        <div class="flex items-center space-x-2">
          <span class="font-medium">错误:</span>
          <span>{{ errorMessage }}</span>
        </div>
      </div>

      <!-- 配置提醒 -->
      <div v-if="!hasValidConfig()" class="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4">
        请先配置 OpenAI API Key 和模型
      </div>
    </div>
  </div>
</template>

