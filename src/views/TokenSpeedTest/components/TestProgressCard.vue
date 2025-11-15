<script setup lang="ts">
  /** 测试进度卡片组件 - 带背景速度曲线图 */
  import { computed, useTemplateRef } from 'vue';
  import SpeedChart from './SpeedChart.vue';

  interface ProgressData {
    testId: string;
    testCaseId: string;
    testCaseName: string;
    status: 'running' | 'completed' | 'error';
    tokens: number; // 估算的 token 数
    actualTokens?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    }; // API返回的实际token数量
    totalSpeed: number;
    currentSpeed: number;
    outputSpeed: number;
    firstTokenTime?: number;
    startTime: number;
    duration: number; // 总耗时（毫秒），与BatchResults保持一致
    // 添加历史数据
    historyData: Array<{
      time: number;
      totalSpeed: number;
      currentSpeed: number;
      outputSpeed: number;
    }>;
  }

  interface Props {
    progress: ProgressData;
    showChart?: boolean;
  }

  const props = defineProps<Props>();

  // 获取卡片尺寸
  const cardElement = useTemplateRef<HTMLElement>('cardRef');

  // 监听卡片尺寸变化
  const chartSize = computed(() => {
    if (!cardElement.value) {
      return { width: 400, height: 200 };
    }

    const rect = cardElement.value.getBoundingClientRect();
    return {
      width: Math.max(rect.width || 400, 400),
      height: Math.max(rect.height || 200, 200)
    };
  });

  // 直接使用历史数据
  const chartData = computed(() => props.progress.historyData);

  // 格式化时间
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // 格式化速度
  const formatSpeed = (speed: number): string => {
    if (speed < 1000) return `${speed.toFixed(0)}/s`;
    return `${(speed / 1000).toFixed(1)}k/s`;
  };
</script>

<template>
  <div ref="cardRef" class="test-progress-card relative bg-white rounded-lg border border-gray-200 overflow-hidden">
    <!-- 背景速度曲线图 -->
    <div class="absolute inset-0 opacity-15 overflow-hidden">
      <SpeedChart
        v-if="showChart && chartData.length > 0"
        :data="chartData"
        :width="chartSize.width"
        :height="chartSize.height"
        :show-legend="false"
      />
    </div>

    <!-- 内容层 -->
    <div class="relative p-4 space-y-3">
      <!-- 测试名称和状态 -->
      <div class="flex justify-between items-start">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-gray-900 truncate">{{ progress.testCaseName }}</div>
          <div class="text-xs text-gray-500">
            运行时间: {{ formatTime(progress.duration) }}
          </div>
        </div>
        <span
          :class="[
            'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
            progress.status === 'running'
              ? 'bg-blue-100 text-blue-800 border border-blue-200'
              : progress.status === 'completed'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          ]">
          <span
            :class="[
              'w-2 h-2 rounded-full',
              progress.status === 'running'
                ? 'bg-blue-600 animate-pulse'
                : progress.status === 'completed'
                ? 'bg-green-600'
                : 'bg-red-600'
            ]"></span>
          {{ progress.status === 'running' ? '运行中' :
             progress.status === 'completed' ? '✅ 完成' : '❌ 失败' }}
        </span>
      </div>

      <!-- 指标网格 -->
      <div class="grid grid-cols-3 gap-3 text-center">
        <!-- Token 数量 -->
        <div class="space-y-1">
          <div
            :class="[
              'text-xl font-bold transition-colors',
              progress.status === 'running' ? 'text-yellow-600' :
              progress.status === 'completed' ? 'text-green-600' :
              'text-red-600'
            ]"
            :title="progress.status === 'running' ?
              '运行中的completion token数量为预估值' :
              progress.status === 'completed' ? '测试完成，显示实际接口返回的completion token数量' :
              '测试失败，token数量可能不完整'"
          >
            {{ (progress.actualTokens?.completionTokens || progress.tokens || 0).toLocaleString() }}
          </div>
          <div class="text-xs text-gray-600">Completion Tokens</div>
        </div>

        <!-- 总速度 -->
        <div class="space-y-1">
          <div class="text-xl font-bold text-green-600">
            {{ formatSpeed(progress.totalSpeed) }}
          </div>
          <div class="text-xs text-gray-600">总速度</div>
        </div>

        <!-- 输出速度 -->
        <div class="space-y-1">
          <div class="text-xl font-bold text-purple-600">
            {{ formatSpeed(progress.outputSpeed) }}
          </div>
          <div class="text-xs text-gray-600">输出速度</div>
        </div>
      </div>

      <!-- 底部指标条 - 参考 BatchResults 显示 -->
      <div class="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
        <!-- 总耗时 -->
        <div class="flex justify-between items-center">
          <span class="text-xs text-gray-500">总耗时</span>
          <span class="text-xs font-medium text-gray-900">
            {{ formatTime(progress.duration) }}
          </span>
        </div>

        <!-- 首次响应时间 -->
        <div class="flex justify-between items-center">
          <span class="text-xs text-gray-500">首次响应</span>
          <span class="text-xs font-medium text-gray-900">
            {{ progress.firstTokenTime ? Math.round(progress.firstTokenTime) + 'ms' : '-' }}
          </span>
        </div>
      </div>

      <!-- 完成状态详情 -->
      <div v-if="progress.status === 'completed'" class="pt-2 border-t border-gray-100">
        <div class="flex justify-between items-center text-xs">
          <span class="text-green-600">✅ 测试成功完成</span>
          <span class="text-gray-500">
            处理了 {{ progress.tokens }} 个 tokens
          </span>
        </div>
      </div>

      <!-- 错误状态详情 -->
      <div v-else-if="progress.status === 'error'" class="pt-2 border-t border-gray-100">
        <div class="text-xs text-red-600">
          ❌ 测试执行失败
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
/* 确保内容在背景之上 */
.relative > .absolute + * {
  position: relative;
  z-index: 10;
}
</style>