<script setup lang="ts">
  /** 速度曲线图组件 */
  import { computed, ref, onMounted, onUnmounted, watch } from 'vue';

  interface SpeedDataPoint {
    time: number;
    totalSpeed: number;
    currentSpeed: number;
    outputSpeed: number;
  }

  interface Props {
    data: SpeedDataPoint[];
    width?: number;
    height?: number;
    showLegend?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    width: 400,
    height: 120,
    showLegend: true
  });

  // 存储历史数据点
  const historyData = ref<SpeedDataPoint[]>([]);

  // 最大数据点数量（避免无限增长）
  const MAX_DATA_POINTS = 100;

  // 添加新数据点
  const addDataPoint = (point: SpeedDataPoint) => {
    historyData.value.push(point);
    if (historyData.value.length > MAX_DATA_POINTS) {
      historyData.value.shift();
    }
  };

  // 计算坐标轴范围
  const scales = computed(() => {
    if (historyData.value.length === 0) {
      return {
        xMin: 0,
        xMax: 1,
        yMin: 0,
        yMax: 100
      };
    }

    const times = historyData.value.map(d => d.time);
    const speeds = historyData.value.flatMap(d => [d.totalSpeed, d.currentSpeed, d.outputSpeed]);

    const xMin = Math.min(...times);
    const xMax = Math.max(...times);
    const yMin = 0;
    const yMax = Math.max(...speeds, 100) * 1.1; // 添加 10% 的顶部边距

    return { xMin, xMax, yMin, yMax };
  });

  // 坐标转换函数
  const xScale = (time: number) => {
    if (scales.value.xMax === scales.value.xMin) return 0;
    return ((time - scales.value.xMin) / (scales.value.xMax - scales.value.xMin)) * props.width;
  };

  const yScale = (speed: number) => {
    if (scales.value.yMax === scales.value.yMin) return props.height;
    return props.height - ((speed - scales.value.yMin) / (scales.value.yMax - scales.value.yMin)) * props.height;
  };

  // 生成 SVG 路径
  const createPath = (points: number[][]) => {
    if (points.length === 0) return '';

    let path = `M ${points[0]![0]} ${points[0]![1]}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i]![0]} ${points[i]![1]}`;
    }
    return path;
  };

  // 计算路径
  const totalSpeedPath = computed(() => {
    const points = historyData.value.map(d => [xScale(d.time), yScale(d.totalSpeed)]);
    return createPath(points);
  });

  const currentSpeedPath = computed(() => {
    const points = historyData.value.map(d => [xScale(d.time), yScale(d.currentSpeed)]);
    return createPath(points);
  });

  const outputSpeedPath = computed(() => {
    const points = historyData.value.map(d => [xScale(d.time), yScale(d.outputSpeed)]);
    return createPath(points);
  });

  // 监听父组件传入的数据变化
  const updateData = () => {
    if (props.data.length > 0) {
      const latestData = props.data[props.data.length - 1];
      if (latestData) {
        addDataPoint(latestData);
      }
    }
  };

  // 定时更新数据
  let updateInterval: number;

  onMounted(() => {
    // 初始化数据
    updateData();

    // 定期同步数据
    updateInterval = setInterval(updateData, 100) as any;
  });

  onUnmounted(() => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });

  // 监听 props.data 变化 - 立即同步所有数据点
  watch(() => props.data, (newData) => {
    if (newData && newData.length > 0) {
      // 清空历史数据，重新同步所有数据点
      historyData.value = [...newData];
      // 限制数据点数量
      if (historyData.value.length > MAX_DATA_POINTS) {
        historyData.value = historyData.value.slice(-MAX_DATA_POINTS);
      }
    }
  }, { deep: true, immediate: true });

  // 格式化速度显示
  const formatSpeed = (speed: number): string => {
    if (speed < 1000) {
      return `${speed.toFixed(0)} token/s`;
    } else {
      return `${(speed / 1000).toFixed(1)}k/s`;
    }
  };
</script>

<template>
  <div class="speed-chart" :class="{ 'speed-chart--background': !showLegend }">
    <div v-if="showLegend" class="flex justify-between items-center mb-2 text-xs">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-1">
          <div class="w-3 h-0.5 bg-blue-500"></div>
          <span class="text-gray-600">总速度</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-3 h-0.5 bg-green-500"></div>
          <span class="text-gray-600">瞬时速度</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-3 h-0.5 bg-purple-500"></div>
          <span class="text-gray-600">纯输出速度</span>
        </div>
      </div>
      <div class="text-gray-500">
        最新: {{ formatSpeed(historyData[historyData.length - 1]?.totalSpeed || 0) }}
      </div>
    </div>

    <div class="relative bg-transparent" :style="{ width: width + 'px', height: height + 'px' }">
      <svg :width="width" :height="height" class="overflow-visible" :class="{ 'absolute inset-0': !showLegend }">
        <!-- 背景模式下简化网格线 -->
        <defs v-if="!showLegend">
          <pattern id="grid-bg" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#f3f4f6" stroke-width="0.5"/>
          </pattern>
        </defs>
        <defs v-else>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" stroke-width="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" :fill="!showLegend ? 'url(#grid-bg)' : 'url(#grid)'" />

        <!-- 背景模式下隐藏坐标轴 -->
        <template v-if="showLegend">
          <line :x1="0" :y1="height" :x2="width" :y2="height" stroke="#9ca3af" stroke-width="1"/>
          <line :x1="0" :y1="0" :x2="0" :y2="height" stroke="#9ca3af" stroke-width="1"/>
        </template>

        <!-- 速度曲线 -->
        <!-- 总速度曲线 -->
        <path
          v-if="totalSpeedPath"
          :d="totalSpeedPath"
          fill="none"
          stroke="#3b82f6"
          :stroke-width="showLegend ? 2 : 1.5"
          :opacity="showLegend ? 0.8 : 0.6"
        />

        <!-- 瞬时速度曲线 -->
        <path
          v-if="currentSpeedPath"
          :d="currentSpeedPath"
          fill="none"
          stroke="#10b981"
          :stroke-width="showLegend ? 2 : 1.5"
          :opacity="showLegend ? 0.8 : 0.6"
        />

        <!-- 纯输出速度曲线 -->
        <path
          v-if="outputSpeedPath"
          :d="outputSpeedPath"
          fill="none"
          stroke="#a855f7"
          :stroke-width="showLegend ? 2 : 1.5"
          :opacity="showLegend ? 0.8 : 0.6"
        />

        <!-- 当前数据点 - 背景模式下隐藏 -->
        <g v-if="historyData.length > 0 && showLegend">
          <!-- 总速度点 -->
          <circle
            :cx="xScale(historyData[historyData.length - 1]!.time)"
            :cy="yScale(historyData[historyData.length - 1]!.totalSpeed)"
            r="3"
            fill="#3b82f6"
          />
          <!-- 瞬时速度点 -->
          <circle
            :cx="xScale(historyData[historyData.length - 1]!.time)"
            :cy="yScale(historyData[historyData.length - 1]!.currentSpeed)"
            r="3"
            fill="#10b981"
          />
          <!-- 纯输出速度点 -->
          <circle
            :cx="xScale(historyData[historyData.length - 1]!.time)"
            :cy="yScale(historyData[historyData.length - 1]!.outputSpeed)"
            r="3"
            fill="#a855f7"
          />
        </g>

        <!-- Y轴标签 - 背景模式下隐藏 -->
        <g v-if="showLegend" class="text-xs fill-gray-500">
          <text x="-5" y="15" text-anchor="end" dominant-baseline="middle">{{ Math.round(scales.yMax) }}</text>
          <text x="-5" :y="height / 2" text-anchor="end" dominant-baseline="middle">{{ Math.round(scales.yMax / 2) }}</text>
          <text x="-5" :y="height - 5" text-anchor="end" dominant-baseline="middle">0</text>
        </g>
      </svg>

      <!-- 无数据提示 -->
      <div v-if="historyData.length === 0" class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
        等待数据...
      </div>
    </div>
  </div>
</template>

<style scoped>
.speed-chart {
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.speed-chart--background {
  margin: 0;
  padding: 0;
  line-height: 0;
}

svg {
  display: block;
}

.speed-chart--background svg {
  display: block;
  margin: 0;
  padding: 0;
}
</style>