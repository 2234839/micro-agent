<script setup lang="ts">
  /** 测试结果卡片组件 */
  import BaseButton from '../../../components/BaseButton.vue';
  import type { TokenTestResult } from '../../../composables/useTokenSpeedTest';

  interface Props {
    result: TokenTestResult;
    index?: number;
    total?: number;
  }

  interface Emits {
    (e: 'delete-result', id: string): void;
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
  <div class="border border-gray-200 rounded-lg p-4">
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
        <span class="text-xs text-gray-500" v-if="total !== undefined">
          {{ (index || 0) + 1 }}/{{ total }}
        </span>
        <BaseButton
          variant="outline"
          size="small"
          @click="$emit('delete-result', result.id)"
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
</template>