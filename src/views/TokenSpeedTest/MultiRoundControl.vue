<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { useMultiRoundTest } from '../../composables/useMultiRoundTest';
  import { useOpenAIConfig } from '../../composables/useOpenAIConfig';
  import MultiRoundChart from './MultiRoundChart.vue';
  import RealTimeStatus from './RealTimeStatus.vue';

  // 使用多轮测试 hook
  const {
    state: multiRoundState,
    startMultiRoundTest,
    stopMultiRoundTest,
    pauseMultiRoundTest,
    resumeMultiRoundTest,
    resetMultiRoundTest,
    progressPercentage,
    successfulRounds,
    failedRounds,
    overallAverageSpeed,
    overallPeakSpeed,
    timeUntilNextTest,
  } = useMultiRoundTest();

  // 使用 OpenAI 配置 hook
  const { loadConfig, hasValidConfig } = useOpenAIConfig();

  /** 测试配置 */
  const testConfig = ref({
    rounds: 5,
    interval: 5000, // 5秒
    message: '请写一篇关于人工智能发展的简短文章，大约500字。',
    temperature: 0.7,
    maxTokens: 1000,
    historyInterval: 500,
  });

  /** 显示高级选项 */
  const showAdvancedOptions = ref(false);

  /** 表单验证 */
  const isConfigValid = computed(() => {
    return (
      testConfig.value.rounds > 0 &&
      testConfig.value.rounds <= 100 &&
      testConfig.value.interval >= 1000 &&
      testConfig.value.message.trim().length > 0 &&
      testConfig.value.temperature >= 0 &&
      testConfig.value.temperature <= 2 &&
      testConfig.value.maxTokens > 0 &&
      testConfig.value.maxTokens <= 32000 &&
      testConfig.value.historyInterval >= 100
    );
  });

  /** 开始多轮测试 */
  const handleStartTest = () => {
    if (!isConfigValid.value || !hasValidConfig()) return;

    startMultiRoundTest({
      rounds: testConfig.value.rounds,
      interval: testConfig.value.interval,
      message: testConfig.value.message.trim(),
      temperature: testConfig.value.temperature,
      maxTokens: testConfig.value.maxTokens,
      historyInterval: testConfig.value.historyInterval,
    });
  };

  /** 停止测试 */
  const handleStopTest = () => {
    stopMultiRoundTest();
  };

  /** 暂停测试 */
  const handlePauseTest = () => {
    pauseMultiRoundTest();
  };

  /** 恢复测试 */
  const handleResumeTest = () => {
    resumeMultiRoundTest();
  };

  /** 重置测试 */
  const handleResetTest = () => {
    resetMultiRoundTest();
  };

  /** 倒计时显示 */
  const countdownDisplay = computed(() => {
    if (!timeUntilNextTest.value) return '';
    const seconds = Math.ceil(timeUntilNextTest.value / 1000);
    return `${seconds}秒后开始下一轮`;
  });

  // 初始化
  loadConfig();
</script>

<template>
  <div class="space-y-6">
    <!-- 测试配置 -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">多轮测试配置</h2>

      <div class="space-y-4">
        <!-- 基础配置 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"> 测试轮数 </label>
            <input
              v-model.number="testConfig.rounds"
              type="number"
              min="1"
              max="100"
              :disabled="multiRoundState.status.isRunning"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"> 测试间隔 (毫秒) </label>
            <input
              v-model.number="testConfig.interval"
              type="number"
              min="1000"
              step="1000"
              :disabled="multiRoundState.status.isRunning"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100" />
            <div class="text-xs text-gray-500 mt-1">建议至少5秒间隔</div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2"> 测试消息 </label>
          <textarea
            v-model="testConfig.message"
            :disabled="multiRoundState.status.isRunning"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            rows="3"
            placeholder="输入要测试的消息..." />
        </div>

        <!-- 高级选项 -->
        <div>
          <button
            @click="showAdvancedOptions = !showAdvancedOptions"
            class="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center space-x-1">
            <span>高级选项</span>
            <svg
              :class="[
                'w-4 h-4 transform transition-transform',
                showAdvancedOptions ? 'rotate-180' : '',
              ]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div v-show="showAdvancedOptions" class="mt-4 space-y-4 border-t border-gray-200 pt-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"> 温度 (0-2) </label>
                <input
                  v-model.number="testConfig.temperature"
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  :disabled="multiRoundState.status.isRunning"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"> 最大 Token 数 </label>
                <input
                  v-model.number="testConfig.maxTokens"
                  type="number"
                  min="1"
                  max="32000"
                  :disabled="multiRoundState.status.isRunning"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                历史记录间隔 (毫秒)
              </label>
              <input
                v-model.number="testConfig.historyInterval"
                type="number"
                min="100"
                step="100"
                :disabled="multiRoundState.status.isRunning"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100" />
            </div>
          </div>
        </div>

        <!-- 控制按钮 -->
        <div class="flex flex-wrap gap-2">
          <button
            v-if="!multiRoundState.status.isRunning"
            @click="handleStartTest"
            :disabled="!isConfigValid || !hasValidConfig()"
            class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
            开始多轮测试
          </button>

          <button
            v-if="multiRoundState.status.isRunning && !multiRoundState.status.isPaused"
            @click="handlePauseTest"
            class="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors">
            暂停
          </button>

          <button
            v-if="multiRoundState.status.isPaused"
            @click="handleResumeTest"
            class="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors">
            恢复
          </button>

          <button
            v-if="multiRoundState.status.isRunning"
            @click="handleStopTest"
            class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">
            停止
          </button>

          <button
            v-if="
              multiRoundState.status.isCompleted ||
              (multiRoundState.status.isPaused && multiRoundState.completedRounds > 0)
            "
            @click="handleResetTest"
            class="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors">
            重置
          </button>
        </div>

        <!-- 配置错误提示 -->
        <div
          v-if="!isConfigValid"
          class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          请检查配置参数是否有效
        </div>

        <!-- OpenAI 配置提醒 -->
        <div
          v-if="!hasValidConfig()"
          class="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 text-sm">
          请先配置 OpenAI API Key 和模型
        </div>
      </div>
    </div>

    <!-- 测试状态 -->
    <div
      v-if="multiRoundState.status.isRunning || multiRoundState.status.isCompleted"
      class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">测试状态</h3>

      <div class="space-y-4">
        <!-- 当前测试状态 - 优先显示正在运行的测试 -->
        <div class="space-y-4">
          <!-- 实时测试状态 -->
          <div v-if="multiRoundState.runningTests.length > 0" class="space-y-4">
            <h4 class="text-sm font-medium text-gray-700">正在运行的测试实例</h4>
            <div v-for="test in multiRoundState.runningTests" :key="test.id" class="space-y-2">
              <div class="text-xs text-gray-500 font-medium">测试实例: {{ test.id }}</div>
              <RealTimeStatus :state="test.instance.state" />
            </div>
          </div>

          <!-- 已完成的测试实例 -->
          <div v-if="multiRoundState.results.length > 0" class="space-y-4">
            <div class="space-y-3">
              <div
                v-for="result in multiRoundState.results.slice().reverse().slice(0, 3)"
                :key="result.round"
                class="space-y-2">
                <div class="text-xs text-gray-500 font-medium">
                  第 {{ result.round }} 轮测试 - {{ result.success ? '成功' : '失败' }}
                </div>
                <RealTimeStatus :state="result.fullState" />
              </div>
              <!-- 显示更多结果的提示 -->
              <div v-if="multiRoundState.results.length > 3" class="text-center">
                <button class="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  查看全部 {{ multiRoundState.results.length }} 个已完成的测试
                </button>
              </div>
            </div>
          </div>

          <!-- 简化的进度和控制信息 -->
          <div
            v-if="multiRoundState.completedRounds > 0 || multiRoundState.runningTests.length > 0"
            class="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-lg">
            <div class="text-center">
              <div class="text-lg font-bold text-blue-600">
                {{ multiRoundState.currentRound }}/{{ multiRoundState.totalRounds }}
              </div>
              <div class="text-xs text-gray-600">轮次</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-green-600">{{ successfulRounds }}</div>
              <div class="text-xs text-gray-600">成功</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-red-600">{{ failedRounds }}</div>
              <div class="text-xs text-gray-600">失败</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-orange-600">
                {{ overallAverageSpeed.toFixed(1) }}
              </div>
              <div class="text-xs text-gray-600">平均速度</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-purple-600">{{ overallPeakSpeed.toFixed(1) }}</div>
              <div class="text-xs text-gray-600">峰值速度</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-teal-600">
                {{ progressPercentage.toFixed(1) }}%
              </div>
              <div class="text-xs text-gray-600">进度</div>
            </div>
          </div>

          <!-- 进度条 -->
          <div class="w-full bg-gray-200 rounded-full h-3">
            <div
              class="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
              :style="{ width: `${progressPercentage}%` }" />
          </div>

          <!-- 下次测试倒计时 -->
          <div v-if="countdownDisplay" class="text-center">
            <span
              class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
              {{ countdownDisplay }}
            </span>
          </div>
        </div>

        <!-- 错误信息 -->
        <div
          v-if="multiRoundState.status.error"
          class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          <div class="font-medium">错误信息:</div>
          <div>{{ multiRoundState.status.error }}</div>
        </div>
      </div>
    </div>

    <!-- 测试结果图表 -->
    <MultiRoundChart
      v-if="multiRoundState.results.length > 0"
      :results="multiRoundState.results"
      :show-details="true" />
  </div>
</template>
