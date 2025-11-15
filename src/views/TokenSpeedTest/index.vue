<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue';
  import BaseButton from '../../components/BaseButton.vue';
  import { useTokenSpeedTest, type TokenTestResult } from '../../composables/useTokenSpeedTest';
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
  import type { ProgressData, RealtimeTestData, HistoryChunk, HistoryDataPoint } from '../../types/test-progress';

  // 导入子组件
  import ModeSelector from './components/ModeSelector.vue';
  import SingleTestForm from './components/SingleTestForm.vue';
  import RealtimeStatusCard from './components/RealtimeStatusCard.vue';
  import TestResultCard from './components/TestResultCard.vue';
  import TestConfigSelector from './components/TestConfigSelector.vue';
  import BatchProgressCard from './components/BatchProgressCard.vue';
  import TestProgressCard from './components/TestProgressCard.vue';
  import MultiRoundChart from './components/MultiRoundChart.vue';

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

  /** 多轮测试相关 */
  const enableMultiRound = ref(false);
  const rounds = ref(5);
  const interval = ref(2);
  const multiRoundProgress = ref({ currentRound: 1, totalRounds: 1, currentTest: 0, totalTests: 0 });
  const multiRoundResults = ref<Array<{ round: number; results: TokenTestResult[] }>>([]);
  const isMultiRoundRunning = ref(false);
  const accumulatedHistoryData = ref<Map<string, HistoryDataPoint[]>>(new Map());

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

  /** 统一的数据转换函数 - 单一数据源处理逻辑 */
  const transformTestData = (rawData: TokenTestResult | RealtimeTestData & { testId?: string }): ProgressData => {
    // 获取累计的历史数据
    const accumulatedHistoryPoints = accumulatedHistoryData.value.get(rawData.testCaseId) || [];

    // 处理不同数据源的历史数据，统一转换为 HistoryDataPoint 格式
    let combinedHistoryData: HistoryDataPoint[] = [];

    if ('chunks' in rawData && rawData.chunks) {
      // TokenTestResult 的 chunks 数据转换为 HistoryDataPoint
      const chunksHistoryData: HistoryDataPoint[] = rawData.chunks.map(chunk => ({
        time: chunk.timestamp,
        totalSpeed: rawData.tokensPerSecond || 0,
        currentSpeed: rawData.tokensPerSecond || 0,
        outputSpeed: rawData.outputSpeed || 0
      }));

      combinedHistoryData = enableMultiRound.value ?
        [...accumulatedHistoryPoints, ...chunksHistoryData] :
        chunksHistoryData;
    } else if ('historyData' in rawData && rawData.historyData) {
      // RealtimeTestData 的 historyData 数据已经是 HistoryDataPoint 格式
      combinedHistoryData = enableMultiRound.value ?
        [...accumulatedHistoryPoints, ...rawData.historyData] :
        rawData.historyData;
    }

    // 处理不同数据源的速度字段
    const isTestResult = 'tokensPerSecond' in rawData;
    const isRealtimeData = 'speed' in rawData;

    const totalSpeed = isTestResult ? rawData.tokensPerSecond : (isRealtimeData ? rawData.speed : 0);
    const currentSpeed = isTestResult ? rawData.tokensPerSecond : (isRealtimeData ? rawData.currentSpeed : 0);
    const startTime = isTestResult ? rawData.timestamp.getTime() : rawData.startTime;
    const testId = isTestResult ? rawData.id : (rawData.testId || '');

    // 处理 duration 字段
    const duration = isTestResult ? rawData.duration : (isRealtimeData ? rawData.actualDuration : 0);
    const outputSpeed = (isTestResult ? rawData.outputSpeed : (isRealtimeData ? rawData.outputSpeed : 0)) || 0;

    return {
      testId: testId,
      testCaseId: rawData.testCaseId,
      testCaseName: rawData.testCaseName,
      status: rawData.status,
      tokens: rawData.tokens,
      actualTokens: rawData.actualTokens,
      totalSpeed, // 统一的总速度字段
      currentSpeed, // 统一当前速度字段
      outputSpeed, // 统一输出速度字段
      firstTokenTime: rawData.firstTokenTime,
      startTime: startTime || 0,
      duration, // 统一持续时间字段
      historyData: combinedHistoryData // 已经是 HistoryDataPoint 格式
    };
  };

  /** 实时进度数据 - 使用统一的数据转换函数 */
  const realtimeTestProgress = computed(() => {
    // 如果没有活跃测试，直接返回空数组
    if (activeTests.value.size === 0) return [];

    const result = [];
    const now = Date.now();

    // 使用统一的数据转换函数
    for (const [testId, data] of activeTests.value.entries()) {
      // 确保运行中的测试有最新的持续时间
      const rawData: RealtimeTestData & { testId: string } = {
        ...data,
        testId,
        actualDuration: data.actualDuration || (data.status === 'running' ? now - data.startTime : data.actualDuration)
      };

      result.push(transformTestData(rawData));
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

    if (enableMultiRound.value) {
      // 多轮测试逻辑
      await runMultiRoundTest();
    } else {
      // 单次批量测试逻辑
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
    }

    // 测试完成后清空当前运行测试
    currentRunningTest.value = '';
  };

  /** 取消批量测试 */
  const handleCancelBatchTest = () => {
    cancelBatchTest();
    isMultiRoundRunning.value = false;
  };

  /** 运行多轮测试 */
  const runMultiRoundTest = async () => {
    isMultiRoundRunning.value = true;
    multiRoundResults.value = [];
    // 清理之前的累计历史数据
    accumulatedHistoryData.value.clear();

    const totalTests = selectedTestCaseObjects.value.length;
    const totalTestsAllRounds = totalTests * rounds.value;

    multiRoundProgress.value = {
      currentRound: 1,
      totalRounds: rounds.value,
      currentTest: 0,
      totalTests: totalTestsAllRounds
    };

    try {
      for (let round = 1; round <= rounds.value; round++) {
        multiRoundProgress.value.currentRound = round;

        // 运行单轮测试
        const roundResults = await runSingleRound(round);
        multiRoundResults.value.push({ round, results: roundResults });

        // 累计历史数据用于图表显示
        roundResults.forEach(result => {
          const existingData = accumulatedHistoryData.value.get(result.testCaseId) || [];
          const newHistoryData: HistoryDataPoint[] = result.chunks.map(chunk => ({
            time: chunk.timestamp,
            totalSpeed: result.tokensPerSecond,
            currentSpeed: result.tokensPerSecond,
            outputSpeed: result.outputSpeed || 0
          }));

          accumulatedHistoryData.value.set(result.testCaseId, [
            ...existingData,
            ...newHistoryData
          ]);
        });

        // 如果不是最后一轮，等待间隔时间
        if (round < rounds.value && interval.value > 0) {
          await new Promise(resolve => setTimeout(resolve, interval.value * 1000));
        }
      }
    } catch (error) {
      console.error('Multi-round test error:', error);
    } finally {
      isMultiRoundRunning.value = false;
    }
  };

  /** 运行单轮测试 */
  const runSingleRound = async (round: number): Promise<TokenTestResult[]> => {
    const roundResults: TokenTestResult[] = [];

    await startBatchTest(
      selectedTestCaseObjects.value,
      testMode.value,
      getConfig(),
      `${selectedTestSuite.value}-round-${round}`,
      (current, total, result) => {
        multiRoundProgress.value.currentTest = (round - 1) * selectedTestCaseObjects.value.length + current;

        // 更新当前运行的测试
        const testCase = getTestCaseById(result.testCaseId || result.id.split('-')[0] || '');
        currentRunningTest.value = `第${round}轮 - ${testCase?.name || '未知测试'}`;

        roundResults.push(result);
      },
      // 实时更新回调
      (testId, data) => {
        // activeTests 会自动更新
      }
    );

    return roundResults;
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

  /** 计算完成测试的数据（用于显示结果）- 使用统一的数据转换函数 */
  const calculateCompletedTestData = (result: TokenTestResult) => {
    // 使用统一的数据转换函数，确保单一数据源
    return transformTestData(result);
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
            :is-batch-loading="isBatchLoading || isMultiRoundRunning"
            :enable-multi-round="enableMultiRound"
            :rounds="rounds"
            :interval="interval"
            @update:selected-test-cases="selectedTestCases = $event"
            @update:selected-test-suite="handleTestSuiteChange"
            @update:test-mode="testMode = $event"
            @update:enable-multi-round="enableMultiRound = $event"
            @update:rounds="rounds = $event"
            @update:interval="interval = $event"
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
          :is-multi-round-running="isMultiRoundRunning"
          :multi-round-progress="multiRoundProgress"
        />

        <!-- 多轮测试总图表 -->
        <div v-if="enableMultiRound && (isMultiRoundRunning || multiRoundResults.length > 0)" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">多轮测试性能趋势</h2>
          <div class="flex justify-center">
            <MultiRoundChart
              :multi-round-results="multiRoundResults"
              :width="800"
              :height="400"
            />
          </div>
        </div>

        <!-- 批量测试错误提示 -->
        <div v-if="batchError" class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {{ batchError }}
        </div>

        <!-- 批量测试结果 - 使用TestProgressCard显示 -->
        <div v-if="batchResults.length > 0 || multiRoundResults.length > 0" class="space-y-4">
          <!-- 普通批量测试结果 -->
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
                :progress="calculateCompletedTestData(result)"
                :show-chart="true"
              />
            </div>
          </div>

          <!-- 多轮测试结果 -->
          <div v-for="roundData in multiRoundResults" :key="roundData.round" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-semibold text-gray-800">
                {{ getTestSuiteById(selectedTestSuite)?.name || '测试' }} - 第{{ roundData.round }}轮结果
              </h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TestProgressCard
                v-for="result in roundData.results"
                :key="result.id"
                :progress="calculateCompletedTestData(result)"
                :show-chart="true"
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