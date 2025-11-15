<script setup lang="ts">
  /** 批量测试结果组件 */
  import BaseButton from '../../../components/BaseButton.vue';
  import { getTestSuiteById } from '../../../config/test-cases';
  import type { BatchTestResult, TokenTestResult } from '../../../composables/useTokenSpeedTest';

  interface Props {
    batchResults: BatchTestResult[];
  }

  interface Emits {
    (e: 'clear-all'): void;
    (e: 'delete-result', batchId: string, resultId: string): void;
    (e: 'delete-batch', batchId: string): void;
  }

  defineProps<Props>();
  const emit = defineEmits<Emits>();

  const formatSpeed = (tokensPerSecond: number): string => {
    if (tokensPerSecond < 1000) {
      return `${tokensPerSecond.toFixed(1)} token/s`;
    } else {
      return `${(tokensPerSecond / 1000).toFixed(2)}k token/s`;
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      return `${(ms / 60000).toFixed(1)}m`;
    }
  };
</script>

<template>
  <div class="space-y-6">
    <!-- 操作按钮 -->
    <div class="flex justify-between items-center">
      <h2 class="text-lg font-semibold text-gray-800">
        批量测试结果 ({{ batchResults.length }} 组)
      </h2>
      <BaseButton variant="outline" @click="$emit('clear-all')" v-if="batchResults.length > 0">
        清空所有结果
      </BaseButton>
    </div>

    <!-- 批量测试结果列表 -->
    <div class="space-y-6">
      <div
        v-for="batchResult in batchResults"
        :key="batchResult.suiteId"
        class="border border-gray-200 rounded-lg p-6">

        <!-- 批量测试概览 -->
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="text-md font-semibold text-gray-800">
              {{ getTestSuiteById(batchResult.suiteId)?.name || '自定义测试' }}
              <span class="text-sm text-gray-500 font-normal">
                ({{ new Date(batchResult.startTime).toLocaleString() }})
              </span>
            </h3>
            <p v-if="getTestSuiteById(batchResult.suiteId)?.description" class="text-sm text-gray-600">
              {{ getTestSuiteById(batchResult.suiteId)?.description }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span
              :class="[
                'px-3 py-1 rounded-full text-sm font-medium',
                batchResult.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : batchResult.status === 'error'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              ]">
              {{ batchResult.status === 'completed' ? '已完成' :
                 batchResult.status === 'error' ? '有错误' : '进行中' }}
            </span>
            <BaseButton
              variant="outline"
              size="small"
              @click="$emit('delete-batch', batchResult.suiteId)">
              删除
            </BaseButton>
          </div>
        </div>

        <!-- 汇总统计 -->
        <div v-if="batchResult.summary" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
          <div class="text-center">
            <div class="text-lg font-bold text-blue-600">
              {{ batchResult.summary.totalTests }}
            </div>
            <div class="text-xs text-gray-500">总测试数</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-green-600">
              {{ batchResult.summary.completedTests }}
            </div>
            <div class="text-xs text-gray-500">已完成</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-purple-600">
              {{ formatSpeed(batchResult.summary.avgTotalSpeed || 0) }}
            </div>
            <div class="text-xs text-gray-500">平均速度</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-orange-600">
              {{ formatDuration(batchResult.summary.totalDuration || 0) }}
            </div>
            <div class="text-xs text-gray-500">总耗时</div>
          </div>
        </div>

        <!-- 详细结果列表 -->
        <div class="space-y-3">
          <h4 class="text-sm font-medium text-gray-700">详细结果</h4>
          <div class="space-y-2">
            <div
              v-for="(result, index) in batchResult.results"
              :key="result.id"
              class="border border-gray-200 rounded-lg p-4">
              <!-- 测试标题和状态 -->
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                  <div
                    class="w-3 h-3 rounded-full"
                    :class="{
                      'bg-green-500': result.status === 'completed',
                      'bg-red-500': result.status === 'error',
                      'bg-yellow-500': result.status === 'running'
                    }"></div>
                  <div>
                    <div class="font-medium text-gray-800">
                      {{ result.testCaseName }}
                    </div>
                    <div class="text-xs text-gray-500">
                      {{ result.testCaseDescription }}
                    </div>
                  </div>
                </div>
                <div class="text-right">
                  <span class="text-xs text-gray-500">{{ index + 1 }}/{{ batchResult.results.length }}</span>
                  <BaseButton
                    variant="outline"
                    size="small"
                    @click="$emit('delete-result', batchResult.suiteId, result.id)"
                    class="ml-2">
                    删除
                  </BaseButton>
                </div>
              </div>

              <!-- 速度和统计信息 -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="text-center">
                  <div class="text-lg font-semibold text-blue-600">
                    {{ result.tokens.toLocaleString() }}
                  </div>
                  <div class="text-xs text-gray-500">Tokens</div>
                </div>

                <div class="text-center">
                  <div class="text-lg font-semibold text-green-600">
                    {{ formatSpeed(result.tokensPerSecond) }}
                  </div>
                  <div class="text-xs text-gray-500">总速度</div>
                </div>

                <div v-if="result.outputSpeed" class="text-center">
                  <div class="text-lg font-semibold text-purple-600">
                    {{ formatSpeed(result.outputSpeed) }}
                  </div>
                  <div class="text-xs text-gray-500">输出速度</div>
                </div>

                <div class="text-center">
                  <div class="text-lg font-semibold text-orange-600">
                    {{ formatDuration(result.duration) }}
                  </div>
                  <div class="text-xs text-gray-500">总耗时</div>
                </div>
              </div>

              <!-- 首次响应时间 -->
              <div v-if="result.firstTokenTime" class="mt-3 pt-3 border-t border-gray-100">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600">首次响应时间：</span>
                  <span class="font-medium text-gray-900">{{ result.firstTokenTime }}ms</span>
                </div>
              </div>

              <!-- 错误信息 -->
              <div v-if="result.status === 'error'" class="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <div class="text-sm text-red-700">{{ result.message }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>