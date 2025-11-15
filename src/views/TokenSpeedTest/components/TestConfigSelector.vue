<script setup lang="ts">
  /** 测试配置选择器组件 */
  import { computed } from 'vue';
  import BaseButton from '../../../components/BaseButton.vue';
  import { DEFAULT_TEST_SUITES } from '../../../config/test-cases';
  import type { TestCase, TestSuite, TestMode } from '../../../config/test-cases';
  import { getTestCaseById, getTestSuiteById } from '../../../config/test-cases';

  interface Props {
    availableTestCases: TestCase[];
    selectedTestCases: string[];
    selectedTestSuite: string;
    testMode: TestMode;
    isBatchLoading: boolean;
    enableMultiRound?: boolean;
    rounds?: number;
    interval?: number;
  }

  interface Emits {
    (e: 'update:selected-test-cases', ids: string[]): void;
    (e: 'update:selected-test-suite', id: string): void;
    (e: 'update:test-mode', mode: TestMode): void;
    (e: 'update:enable-multi-round', enabled: boolean): void;
    (e: 'update:rounds', rounds: number): void;
    (e: 'update:interval', interval: number): void;
    (e: 'start-batch-test'): void;
    (e: 'cancel-batch-test'): void;
    (e: 'select-all-test-cases'): void;
    (e: 'clear-all-test-cases'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const selectedSuite = computed(() => getTestSuiteById(props.selectedTestSuite));
  const selectedTestCaseObjects = computed(() =>
    props.selectedTestCases
      .map(id => getTestCaseById(id))
      .filter(Boolean) as TestCase[]
  );

  const handleTestCaseToggle = (testCaseId: string) => {
    const newSelection = props.selectedTestCases.includes(testCaseId)
      ? props.selectedTestCases.filter(id => id !== testCaseId)
      : [...props.selectedTestCases, testCaseId];
    emit('update:selected-test-cases', newSelection);
  };

  const handleTestSuiteChange = (suiteId: string) => {
    emit('update:selected-test-suite', suiteId);
    const suite = getTestSuiteById(suiteId);
    if (suite) {
      emit('update:selected-test-cases', suite.testCases);
    }
  };
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- 左侧：测试配置 -->
    <div class="space-y-4">
      <!-- 测试套件选择 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">测试套件</label>
        <select
          :value="selectedTestSuite"
          @change="handleTestSuiteChange(($event.target as HTMLSelectElement).value)"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option v-for="suite in DEFAULT_TEST_SUITES" :key="suite.id" :value="suite.id">
            {{ suite.name }} ({{ suite.testCases.length }} 个测试)
          </option>
        </select>
        <p v-if="selectedSuite" class="text-xs text-gray-500 mt-1">{{ selectedSuite.description }}</p>
      </div>

      <!-- 测试模式选择 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">测试模式</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            @click="$emit('update:test-mode', 'sequential')"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              testMode === 'sequential'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            ]">
            串行测试
          </button>
          <button
            @click="$emit('update:test-mode', 'parallel')"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              testMode === 'parallel'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            ]">
            并行测试
          </button>
        </div>
        <p class="text-xs text-gray-500 mt-1">
          {{ testMode === 'sequential' ? '按顺序执行，避免并发限制' : '并行执行，提高测试效率' }}
        </p>
      </div>

      <!-- 多轮测试配置 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">多轮测试设置</label>
        <div class="space-y-3">
          <!-- 启用多轮测试开关 -->
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">启用多轮测试</span>
            <button
              @click="$emit('update:enable-multi-round', !props.enableMultiRound)"
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                props.enableMultiRound ? 'bg-blue-600' : 'bg-gray-200'
              ]">
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  props.enableMultiRound ? 'translate-x-6' : 'translate-x-1'
                ]" />
            </button>
          </div>

          <!-- 多轮测试参数 -->
          <div v-if="props.enableMultiRound" class="grid grid-cols-2 gap-3 pl-4 border-l-2 border-blue-200">
            <div>
              <label class="block text-xs text-gray-600 mb-1">轮次</label>
              <input
                type="number"
                min="2"
                max="50"
                :value="props.rounds || 5"
                @input="$emit('update:rounds', parseInt(($event.target as HTMLInputElement).value) || 5)"
                class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">间隔(秒)</label>
              <input
                type="number"
                min="0"
                max="300"
                step="0.5"
                :value="props.interval || 2"
                @input="$emit('update:interval', parseFloat(($event.target as HTMLInputElement).value) || 2)"
                class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <p v-if="props.enableMultiRound" class="text-xs text-gray-500">
            将自动运行 {{ props.rounds || 5 }} 轮测试，每轮间隔 {{ props.interval || 2 }} 秒
          </p>
        </div>
      </div>

      <!-- 开始批量测试按钮 -->
      <div class="flex gap-2">
        <BaseButton
          variant="primary"
          @click="$emit('start-batch-test')"
          :disabled="isBatchLoading || selectedTestCaseObjects.length === 0"
          class="flex-1">
          {{ isBatchLoading ? '测试中...' :
     props.enableMultiRound ?
       `开始多轮测试 (${selectedTestCaseObjects.length} 个 × ${props.rounds || 5} 轮)` :
       `开始批量测试 (${selectedTestCaseObjects.length} 个)`
   }}
        </BaseButton>
        <BaseButton
          v-if="isBatchLoading"
          variant="outline"
          @click="$emit('cancel-batch-test')"
          class="px-4">
          取消
        </BaseButton>
      </div>
    </div>

    <!-- 右侧：测试用例列表 -->
    <div>
      <div class="flex justify-between items-center mb-2">
        <label class="block text-sm font-medium text-gray-700">
          测试用例 ({{ selectedTestCaseObjects.length }}/{{ availableTestCases.length }})
        </label>
        <div class="flex gap-2">
          <button
            @click="$emit('select-all-test-cases')"
            :disabled="isBatchLoading"
            class="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            全选
          </button>
          <button
            @click="$emit('clear-all-test-cases')"
            :disabled="isBatchLoading"
            class="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            清空
          </button>
        </div>
      </div>
      <div class="border border-gray-200 rounded-md max-h-96 overflow-y-auto">
        <div
          v-for="testCase in availableTestCases"
          :key="testCase.id"
          class="p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
          <div class="flex items-start gap-3">
            <input
              type="checkbox"
              :checked="selectedTestCases.includes(testCase.id)"
              @change="handleTestCaseToggle(testCase.id)"
              class="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-800">{{ testCase.name }}</div>
              <div class="text-sm text-gray-600 mb-1">{{ testCase.description }}</div>
              <div class="flex flex-wrap gap-1">
                <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {{ testCase.category }}
                </span>
                <span
                  v-for="tag in testCase.tags"
                  :key="tag"
                  class="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                  {{ tag }}
                </span>
                <span v-if="testCase.expectedTokens" class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                  ~{{ testCase.expectedTokens }} tokens
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>