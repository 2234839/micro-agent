<script setup lang="ts">
  import { useNow } from '@vueuse/core';
  import { computed, ref } from 'vue';
  import { formatDuration, formatSpeed } from '../../utils/format';
  import type { TokenSpeedTestState } from '../../composables/useTokenSpeedTest';
  import SpeedChart from './SpeedChart.vue';

  /** 组件属性 */
  const props = defineProps<{
    /** token 速度测试的响应式状态对象 */
    state: TokenSpeedTestState;
  }>();

  /** 获取响应式的当前时间 */
  const currentTime = useNow();

  /** 是否显示详情弹窗 */
  const showDetails = ref(false);

  /** 是否正在显示实时状态 */
  const shouldShow = computed(() => {
    return props.state.status.isLoading || props.state.totalTokens > 0;
  });

  /** 计算当前耗时 */
  const elapsedTime = computed(() => {
    return props.state.time.end !== null
      ? props.state.time.end - props.state.time.start
      : currentTime.value.getTime() - props.state.time.start;
  });

  /** 直接获取当前瞬时速度 - 避免重复计算 */
  const instantaneousSpeed = computed(() => {
    return props.state.instantaneousSpeed;
  });

  /** 直接获取当前平均速度 - 避免重复计算 */
  const averageSpeed = computed(() => {
    return props.state.averageSpeed;
  });

  /** 计算首个 token 延迟 */
  const firstTokenDelay = computed(() => {
    if (props.state.time.firstToken === null) {
      return currentTime.value.getTime() - props.state.time.start;
    }
    return props.state.time.firstToken - props.state.time.start;
  });

  /** 当前 token 数 */
  const tokens = computed(() => {
    return props.state.totalTokens;
  });

  /** 获取状态文本 */
  const statusText = computed(() => {
    if (props.state.status.isLoading) return '测试中';
    if (props.state.status.done) return '已完成';
    if (props.state.status.failed) return '失败';
    if (props.state.status.aborted) return '已中止';
    return '未知';
  });

  /** 获取状态样式 */
  const statusClass = computed(() => {
    return {
      'bg-yellow-100 text-yellow-800': props.state.status.isLoading,
      'bg-green-100 text-green-800': props.state.status.done,
      'bg-red-100 text-red-800': props.state.status.failed,
      'bg-gray-100 text-gray-800': props.state.status.aborted,
    };
  });
</script>

<template>
  <div v-if="shouldShow" class="relative bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <!-- 背景图表层 -->
    <div class="absolute inset-0 opacity-30">
      <div class="w-full h-full">
        <SpeedChart :state="state" />
      </div>
    </div>

    <!-- 内容层 -->
    <div class="relative z-10 p-6">
      <!-- 标题和控制区域 -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-gray-900">测试状态</h2>
        <div class="flex items-center space-x-3">
          <!-- 状态指示器 -->
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
            :class="statusClass"
          >
            {{ statusText }}
          </span>

          <!-- 详情按钮 -->
          <button
            @click="showDetails = true"
            class="text-blue-600 hover:text-blue-800 font-medium text-sm"
          >
            查看详情
          </button>
        </div>
      </div>

      <!-- 实时指标 -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-6 mb-6">
        <div class="text-center">
          <div class="text-3xl font-bold text-gray-900 mb-1">{{ tokens }}</div>
          <div class="text-sm text-gray-600">Token 数</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-green-600 mb-1">{{ formatSpeed(averageSpeed) }}</div>
          <div class="text-sm text-gray-600">平均速度</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-red-600 mb-1">{{ formatSpeed(instantaneousSpeed) }}</div>
          <div class="text-sm text-gray-600">瞬时速度</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-purple-600 mb-1">{{ formatDuration(elapsedTime) }}</div>
          <div class="text-sm text-gray-600">总耗时</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-orange-600 mb-1">{{ formatDuration(firstTokenDelay) }}</div>
          <div class="text-sm text-gray-600">首Token延迟</div>
        </div>
      </div>

      <!-- 配置信息 -->
      <div class="flex items-center space-x-6 text-sm text-gray-600">
        <span>温度: {{ state.config.temperature }}</span>
        <span>最大Token: {{ state.config.maxTokens }}</span>
        <span>历史间隔: {{ state.config.historyInterval }}ms</span>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div
      v-if="showDetails"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="showDetails = false"
    >
      <div
        class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-auto"
        @click.stop
      >
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-gray-800">测试详情</h3>
            <button
              @click="showDetails = false"
              class="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <!-- 测试消息 -->
          <div class="mb-6">
            <h4 class="text-sm font-medium text-gray-700 mb-2">测试消息</h4>
            <div class="bg-blue-50 rounded-md p-3 text-sm text-gray-800">{{ state.message }}</div>
          </div>

          <!-- 生成内容 -->
          <div v-if="state.content" class="mb-6">
            <h4 class="text-sm font-medium text-gray-700 mb-2">生成内容</h4>
            <div class="bg-gray-50 rounded-md p-3 text-sm text-gray-800 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {{ state.content }}
            </div>
            <div class="mt-2 text-xs text-gray-500">
              内容长度: {{ state.content.length }} 字符 | 估算 Token: {{ Math.ceil(state.content.length / 4) }}
            </div>
          </div>

          <!-- 历史记录统计 -->
          <div v-if="state.speedHistory.length > 0" class="mb-6">
            <h4 class="text-sm font-medium text-gray-700 mb-2">速度统计</h4>
            <div class="grid grid-cols-4 gap-4 text-center">
              <div class="bg-gray-50 rounded p-3">
                <div class="text-lg font-bold text-indigo-600">
                  {{ Math.round(state.speedHistory.reduce((sum, item) => sum + item.averageSpeed, 0) / state.speedHistory.length * 10) / 10 }}
                </div>
                <div class="text-xs text-gray-600">平均速度 (tokens/s)</div>
              </div>
              <div class="bg-gray-50 rounded p-3">
                <div class="text-lg font-bold text-red-600">
                  {{ Math.max(...state.speedHistory.map(item => item.speed)) }}
                </div>
                <div class="text-xs text-gray-600">峰值速度 (tokens/s)</div>
              </div>
              <div class="bg-gray-50 rounded p-3">
                <div class="text-lg font-bold text-green-600">
                  {{ Math.min(...state.speedHistory.map(item => item.speed)) }}
                </div>
                <div class="text-xs text-gray-600">最低速度 (tokens/s)</div>
              </div>
              <div class="bg-gray-50 rounded p-3">
                <div class="text-lg font-bold text-blue-600">{{ state.speedHistory.length }}</div>
                <div class="text-xs text-gray-600">历史记录数</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>