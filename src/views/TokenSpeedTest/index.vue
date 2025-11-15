<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue';
  import BaseButton from '../../components/BaseButton.vue';
  import { useTokenSpeedTest } from '../../composables/useTokenSpeedTest';
  import { useOpenAIConfig } from '../../composables/useOpenAIConfig';
  import {
    DEFAULT_TEST_CASES,
    DEFAULT_TEST_SUITES,
    type TestCase,
    type TestSuite,
    getTestCaseById,
    getTestSuiteById,
    getAllCategories,
    getAllTags,
    type TestMode
  } from '../../config/test-cases';

  // 导入子组件
  import ModeSelector from './components/ModeSelector.vue';
  import SingleTestForm from './components/SingleTestForm.vue';
  import RealtimeStatusCard from './components/RealtimeStatusCard.vue';
  import TestResultCard from './components/TestResultCard.vue';
  import TestConfigSelector from './components/TestConfigSelector.vue';
  import BatchProgressCard from './components/BatchProgressCard.vue';
import TestProgressCard from './components/TestProgressCard.vue'

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
    // 批量测试
    isBatchLoading,
    batchError,
    batchResults,
    currentBatchTest,
    startBatchTest,
    cancelBatchTest,
    clearBatchResults,
    // 实时进度数据
    activeTests
  } = useTokenSpeedTest();

  // 使用 OpenAI 配置 hook
  const {
    showSettings,
    loadConfig,
    hasValidConfig,
    getConfig,
  } = useOpenAIConfig();

  /** 页面模式 */
  const pageMode = ref<'single' | 'batch'>('batch');

  /** 批量测试相关 */
  const selectedTestSuite = ref<string>('quick-test');
  const selectedTestCases = ref<string[]>(['short-text']);
  const testMode = ref<TestMode>('sequential');
  const batchProgress = ref({ current: 0, total: 0 });
  const currentRunningTest = ref<string>('');

  // 计算属性
  const allCategories = computed(() => getAllCategories());
  const allTags = computed(() => getAllTags());

  const selectedSuite = computed(() =>
    getTestSuiteById(selectedTestSuite.value)
  );

  const availableTestCases = computed(() => DEFAULT_TEST_CASES);

  const selectedTestCaseObjects = computed(() =>
    selectedTestCases.value
      .map(id => getTestCaseById(id))
      .filter(Boolean) as TestCase[]
  );

  const currentBatchProgress = computed(() =>
    currentBatchTest.value
      ? {
          current: currentBatchTest.value.results.length,
          total: currentBatchTest.value.summary?.totalTests || selectedTestCaseObjects.value.length,
          percentage: Math.round(
            (currentBatchTest.value.results.length / (currentBatchTest.value.summary?.totalTests || selectedTestCaseObjects.value.length)) * 100
          )
        }
      : { current: 0, total: 0, percentage: 0 }
  );

  /** 实时进度数据 - 转换为数组方便渲染，添加性能优化 */
  const realtimeTestProgress = computed(() => {
    // 如果没有活跃测试，直接返回空数组
    if (activeTests.value.size === 0) return [];

    const now = Date.now();
    const result = [];

    // 使用 for 循环而不是 map 来提高性能
    for (const [testId, data] of activeTests.value.entries()) {
      // 确保实际持续时间始终有值
      if (!data.actualDuration) {
        data.actualDuration = now - data.startTime;
      }

      // 计算总速度（包含首次响应时间）- 使用completionTokens，因为总速度指的也是输出速度
      const outputTokens = data.actualTokens?.completionTokens || data.tokens;
      const calculatedTotalSpeed = data.actualDuration > 0 ? (outputTokens * 1000) / data.actualDuration : 0;

      // 计算纯输出速度（不包含首次响应时间）- 使用completionTokens
      const outputElapsedTime = data.firstTokenTime ? (data.actualDuration - data.firstTokenTime) : 0;
      const outputSpeed = outputElapsedTime > 0 && outputTokens > 0 ? (outputTokens * 1000) / outputElapsedTime : 0;

      // 对于已完成测试，使用重新计算的精确速度；对于运行中的测试，使用实时更新的速度
      const finalTotalSpeed = data.status === 'completed' ? calculatedTotalSpeed : (data.speed || calculatedTotalSpeed);
      const finalCurrentSpeed = data.status === 'completed' ? finalTotalSpeed : (data.currentSpeed || finalTotalSpeed);

      result.push({
        testId,
        testCaseId: data.testCaseId,
        testCaseName: data.testCaseName, // 直接使用存储的测试用例名称
        status: data.status,
        tokens: data.tokens,
        actualTokens: data.actualTokens, // API返回的实际token数据
        totalSpeed: finalTotalSpeed, // 使用修正后的总速度
        currentSpeed: finalCurrentSpeed, // 使用修正后的当前速度
        outputSpeed, // 纯输出速度
        firstTokenTime: data.firstTokenTime,
        startTime: data.startTime,
        duration: data.actualDuration, // 与BatchResults保持一致，使用duration字段
        // 添加历史数据供图表使用
        historyData: data.historyData || []
      });
    }

    return result;
  });

  /** 开始单个token速度测试 */
  const handleStartTest = async (message: string) => {
    if (!message.trim() || isLoading.value) {
      return;
    }

    await startTokenSpeedTest(message.trim(), getConfig());
  };

  /** 取消单个测试 */
  const handleCancelTest = () => {
    // TODO: 实现取消单个测试的逻辑
  };

  /** 清空测试结果 */
  const handleClearResults = () => {
    clearResults();
  };

  /** 删除单个测试结果 */
  const handleDeleteResult = (id: string) => {
    const index = testResults.value.findIndex(result => result.id === id);
    if (index !== -1) {
      testResults.value.splice(index, 1);
    }
  };

  /** 开始批量测试 */
  const handleStartBatchTest = async () => {
    if (selectedTestCaseObjects.value.length === 0 || !hasValidConfig()) {
      return;
    }

    currentRunningTest.value = '';

    await startBatchTest(
      selectedTestCaseObjects.value,
      testMode.value,
      getConfig(),
      selectedTestSuite.value,
      (current, total, result) => {
        batchProgress.value = { current, total };
        // 更新当前运行的测试
        const testCase = getTestCaseById(result.testCaseId || result.id.split('-')[0] || '');
        currentRunningTest.value = testCase?.name || '未知测试';
      },
      // 实时更新回调
      (testId, data) => {
        // activeTests 会自动更新，这里可以添加额外的逻辑
        // 实时数据已经通过 reactive 更新了
      }
    );

    // 测试完成后清空当前运行测试
    currentRunningTest.value = '';
  };

  /** 取消批量测试 */
  const handleCancelBatchTest = () => {
    cancelBatchTest();
  };

  /** 测试套件变更 */
  const handleTestSuiteChange = (suiteId: string) => {
    selectedTestSuite.value = suiteId;
    const suite = getTestSuiteById(suiteId);
    if (suite) {
      selectedTestCases.value = suite.testCases;
    }
  };

  /** 测试用例切换 */
  const handleTestCaseToggle = (testCaseId: string) => {
    const newSelection = selectedTestCases.value.includes(testCaseId)
      ? selectedTestCases.value.filter(id => id !== testCaseId)
      : [...selectedTestCases.value, testCaseId];
    selectedTestCases.value = newSelection;
  };

  /** 全选测试用例 */
  const handleSelectAllTestCases = () => {
    selectedTestCases.value = availableTestCases.value.map(tc => tc.id);
  };

  /** 清空测试用例 */
  const handleClearAllTestCases = () => {
    selectedTestCases.value = [];
  };

  /** 删除整个批量测试结果 */
  const handleDeleteBatch = (batchId: string) => {
    const index = batchResults.value.findIndex(b => b.suiteId === batchId);
    if (index !== -1) {
      batchResults.value.splice(index, 1);
    }
  };

  onMounted(() => {
    loadConfig();
  });
</script>

<template>
  <!-- 主要内容区域 -->
  <div class="flex-1 overflow-y-auto px-4 py-6 h-full">
    <div class="max-w-6xl mx-auto space-y-6">
      <!-- 模式选择 -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <ModeSelector v-model="pageMode" />
      </div>

      <!-- 单个测试模式 -->
      <div v-if="pageMode === 'single'" class="space-y-6">
        <!-- 测试表单 -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">单个测试</h2>
          <SingleTestForm
            :is-loading="isLoading"
            :disabled="!hasValidConfig()"
            @start-test="handleStartTest"
            @clear-test="handleClearResults"
          />
        </div>

        <!-- 实时状态卡片 -->
        <RealtimeStatusCard
          v-if="isLoading || currentTokens > 0"
          :tokens="currentTokens"
          :speed="currentSpeed"
          :elapsed-time="currentElapsedTime"
          :is-loading="isLoading"
        />

        <!-- 错误提示 -->
        <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {{ error }}
        </div>

        <!-- 测试结果 -->
        <div v-if="testResults.length > 0" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-semibold text-gray-800">测试结果</h2>
            <BaseButton variant="outline" @click="handleClearResults">
              清空结果
            </BaseButton>
          </div>

          <div class="space-y-4">
            <TestResultCard
              v-for="result in testResults"
              :key="result.id"
              :result="result"
              :index="testResults.indexOf(result)"
              :total="testResults.length"
              @delete-result="handleDeleteResult"
            />
          </div>
        </div>
      </div>

      <!-- 批量测试模式 -->
      <div v-if="pageMode === 'batch'" class="space-y-6">
        <!-- 测试配置 -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">批量测试配置</h2>
          <TestConfigSelector
            :available-test-cases="availableTestCases"
            :selected-test-cases="selectedTestCases"
            :selected-test-suite="selectedTestSuite"
            :test-mode="testMode"
            :is-batch-loading="isBatchLoading"
            @update:selected-test-cases="selectedTestCases = $event"
            @update:selected-test-suite="handleTestSuiteChange"
            @update:test-mode="testMode = $event"
            @start-batch-test="handleStartBatchTest"
            @cancel-batch-test="handleCancelBatchTest"
            @select-all-test-cases="handleSelectAllTestCases"
            @clear-all-test-cases="handleClearAllTestCases"
          />
        </div>

        <!-- 批量测试进度 -->
        <BatchProgressCard
          :is-batch-loading="isBatchLoading"
          :current-batch-progress="currentBatchProgress"
          :realtime-test-progress="realtimeTestProgress"
          :test-mode="testMode"
        />

        <!-- 批量测试错误提示 -->
        <div v-if="batchError" class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {{ batchError }}
        </div>

        <!-- 批量测试结果 - 使用TestProgressCard显示 -->
        <div v-if="batchResults.length > 0" class="space-y-4">
          <div v-for="batch in batchResults" :key="batch.suiteId" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-semibold text-gray-800">
                {{ getTestSuiteById(batch.suiteId)?.name || '批量测试' }} 结果
              </h2>
              <BaseButton variant="outline" @click="handleDeleteBatch(batch.suiteId)">
                删除批次
              </BaseButton>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TestProgressCard
                v-for="result in batch.results"
                :key="result.id"
                :progress="{
                  testId: result.id,
                  testCaseId: result.testCaseId,
                  testCaseName: result.testCaseName,
                  status: result.status,
                  tokens: result.tokens,
                  actualTokens: result.actualTokens,
                  totalSpeed: result.tokensPerSecond,
                  currentSpeed: result.tokensPerSecond,
                  outputSpeed: result.outputSpeed || 0,
                  firstTokenTime: result.firstTokenTime,
                  startTime: result.timestamp.getTime(),
                  duration: result.duration,
                  historyData: []
                }"
                :show-chart="false"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 确保布局正确 */
main {
  display: flex;
  flex-direction: column;
}
</style>