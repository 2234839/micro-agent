<script setup lang="ts">
  /** 实时状态卡片组件 */
  interface Props {
    tokens: number;
    speed: number;
    elapsedTime: number;
    isLoading: boolean;
  }

  defineProps<Props>();
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h2 class="text-lg font-semibold text-gray-800 mb-4">实时状态</h2>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Token 数量 -->
      <div class="text-center p-4 bg-blue-50 rounded-lg">
        <div class="text-2xl font-bold text-blue-600">{{ tokens }}</div>
        <div class="text-sm text-blue-600">接收 Tokens</div>
      </div>

      <!-- 当前速度 -->
      <div class="text-center p-4 bg-green-50 rounded-lg">
        <div class="text-2xl font-bold text-green-600">{{ speed }}</div>
        <div class="text-sm text-green-600">当前速度</div>
      </div>

      <!-- 运行时间 -->
      <div class="text-center p-4 bg-purple-50 rounded-lg">
        <div class="text-2xl font-bold text-purple-600">{{ (elapsedTime / 1000).toFixed(1) }}s</div>
        <div class="text-sm text-purple-600">运行时间</div>
      </div>
    </div>
  </div>
</template>