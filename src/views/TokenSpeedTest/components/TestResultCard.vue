<script setup lang="ts">
  /** 测试结果卡片组件 - 与TestProgressCard保持一致的数据格式 */
  import BaseButton from '../../../components/BaseButton.vue';
  import TestProgressCard from './TestProgressCard.vue';
  import type { TokenTestResult } from '../../../composables/useTokenSpeedTest';

  interface Props {
    result: TokenTestResult;
    index?: number;
    total?: number;
  }

  interface Emits {
    (e: 'delete-result', id: string): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  /** 格式化速度显示 */
  const formatSpeed = (speed: number): string => {
    if (speed < 1000) {
      return `${speed.toFixed(1)} token/s`;
    } else {
      return `${(speed / 1000).toFixed(2)}k/s`;
    }
  };

  /** 格式化时间显示 */
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  /** 计算单个测试结果的数据（与批量测试进度保持一致） */
  const calculateSingleTestData = (result: TokenTestResult) => {
    // 使用与批量测试进度完全相同的数据计算逻辑
    const duration = result.duration;

    // 使用 completionTokens 计算速度，如果没有则回退到计算的 tokens
    const tokensForSpeed = result.actualTokens?.completionTokens || result.tokens || 0;
    const calculatedTotalSpeed = duration > 0 ? (tokensForSpeed * 1000) / duration : 0;

    // 计算纯输出速度（不包含首次响应时间）
    const outputElapsedTime = result.firstTokenTime ? (duration - result.firstTokenTime) : 0;
    const outputSpeed = outputElapsedTime > 0 && tokensForSpeed > 0 ? (tokensForSpeed * 1000) / outputElapsedTime : 0;

    return {
      testId: result.id,
      testCaseId: result.testCaseId,
      testCaseName: result.testCaseName,
      status: result.status,
      tokens: result.tokens,
      actualTokens: result.actualTokens,
      totalSpeed: calculatedTotalSpeed,
      currentSpeed: calculatedTotalSpeed,
      outputSpeed: outputSpeed,
      firstTokenTime: result.firstTokenTime,
      startTime: result.timestamp.getTime(),
      duration: result.duration,
      historyData: result.chunks ? result.chunks.map(chunk => ({
        time: chunk.timestamp,
        totalSpeed: result.tokensPerSecond || 0,
        currentSpeed: result.tokensPerSecond || 0,
        outputSpeed: result.outputSpeed || 0
      })) : []
    };
  };
</script>

<template>
  <div class="border border-gray-200 rounded-lg p-4">
    <!-- 标题和删除按钮 -->
    <div class="flex justify-between items-center mb-4">
      <div class="flex items-center gap-3">
        <div
          class="w-3 h-3 rounded-full"
          :class="{
            'bg-green-500': props.result.status === 'completed',
            'bg-red-500': props.result.status === 'error',
            'bg-yellow-500': props.result.status === 'running'
          }"></div>
        <div>
          <div class="font-medium text-gray-800">
            {{ props.result.testCaseName }}
          </div>
          <div class="text-xs text-gray-500">
            {{ props.result.testCaseDescription }}
          </div>
          <span class="text-xs text-gray-400" v-if="props.total !== undefined">
            {{ (props.index || 0) + 1 }}/{{ props.total }}
          </span>
        </div>
      </div>
      <BaseButton
        variant="outline"
        size="small"
        @click="$emit('delete-result', props.result.id)">
        删除
      </BaseButton>
    </div>

    <!-- 使用 TestProgressCard 显示测试数据和图表 -->
    <TestProgressCard
      :progress="calculateSingleTestData(props.result)"
      :show-chart="true"
    />

    <!-- 错误信息（如果有） -->
    <div v-if="props.result.status === 'error'" class="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
      <div class="text-sm text-red-700">{{ props.result.message }}</div>
    </div>
  </div>
</template>