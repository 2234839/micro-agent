<script setup lang="ts">
  /** 批量测试进度卡片组件 */
  import { computed } from 'vue';
  import TestProgressCard from './TestProgressCard.vue';
  import type { TestMode } from '../../../config/test-cases';

  interface ProgressData {
    testId: string;
    testCaseId: string;
    testCaseName: string;
    status: 'running' | 'completed' | 'error';
    tokens: number;
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
    isBatchLoading: boolean;
    currentBatchProgress: {
      current: number;
      total: number;
      percentage: number;
    };
    realtimeTestProgress: ProgressData[];
    testMode: TestMode;
    isMultiRoundRunning?: boolean;
    multiRoundProgress?: {
      currentRound: number;
      totalRounds: number;
      currentTest: number;
      totalTests: number;
    };
  }

  defineProps<Props>();
</script>

<template>
  <div v-if="isBatchLoading || realtimeTestProgress.length > 0" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h2 class="text-lg font-semibold text-gray-800 mb-4">
    {{
      isMultiRoundRunning ?
        `多轮测试进度 (第 ${multiRoundProgress?.currentRound || 1}/${multiRoundProgress?.totalRounds || 1} 轮)` :
        (isBatchLoading ? '批量测试进度' : '测试结果详情')
    }}
  </h2>

    <!-- 总体进度条 -->
    <div class="mb-4">
      <div class="w-full bg-gray-200 rounded-full h-3">
        <div
          class="bg-green-600 h-3 rounded-full transition-all duration-300"
          :style="{
            width: isMultiRoundRunning ?
              `${Math.round((multiRoundProgress?.currentTest || 0) / (multiRoundProgress?.totalTests || 1) * 100)}%` :
              `${currentBatchProgress.percentage}%`
          }">
        </div>
      </div>
      <div class="text-center text-sm text-gray-600 mt-2">
        {{
          isMultiRoundRunning ?
            `${Math.round((multiRoundProgress?.currentTest || 0) / (multiRoundProgress?.totalTests || 1) * 100)}% 完成 (${multiRoundProgress?.currentTest || 0}/${multiRoundProgress?.totalTests || 1})` :
            `${currentBatchProgress.percentage}% 完成`
        }}
      </div>
    </div>

    <!-- 测试模式 -->
    <div class="text-center mb-4">
      <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
        {{ testMode === 'sequential' ? '串行' : '并行' }}测试
      </span>
    </div>

    <!-- 实时进度详情 -->
    <div v-if="realtimeTestProgress.length > 0" class="space-y-3">
      <!-- 串行测试：显示所有测试（包括已完成的） -->
      <div v-if="testMode === 'sequential'" class="space-y-3">
        <div v-if="isBatchLoading" class="text-center text-sm font-medium text-gray-700 mb-3">
          串行执行进度：显示所有测试状态
        </div>

        <!-- 每个测试的进度卡片 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TestProgressCard
            v-for="progress in realtimeTestProgress"
            :key="progress.testId"
            :progress="progress"
            :show-chart="true"
          />
        </div>
      </div>

      <!-- 并行测试：显示所有正在运行的测试 -->
      <div v-else-if="testMode === 'parallel'" class="space-y-3">
        <div v-if="isBatchLoading" class="text-center text-sm font-medium text-gray-700 mb-3">
          正在并行执行 {{ realtimeTestProgress.length }} 个测试
        </div>

        <!-- 每个测试的进度卡片 - 带自己的背景速度曲线图 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TestProgressCard
            v-for="progress in realtimeTestProgress"
            :key="progress.testId"
            :progress="progress"
            :show-chart="true"
          />
        </div>
      </div>

      <!-- 整体进度概览 -->
      <div class="border-t pt-3">
        <div class="grid grid-cols-3 gap-2 text-center text-sm">
          <div class="p-2 bg-blue-50 rounded">
            <div class="font-medium text-blue-700">{{ currentBatchProgress.current }}</div>
            <div class="text-xs text-blue-500">已完成</div>
          </div>
          <div class="p-2 bg-gray-50 rounded">
            <div class="font-medium">{{ currentBatchProgress.total - currentBatchProgress.current }}</div>
            <div class="text-xs text-gray-500">剩余</div>
          </div>
          <div class="p-2 bg-green-50 rounded">
            <div class="font-medium text-green-700">{{ currentBatchProgress.percentage }}%</div>
            <div class="text-xs text-green-500">总进度</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>