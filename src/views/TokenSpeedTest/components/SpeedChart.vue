<script setup lang="ts">
  /** 速度曲线图组件 - 使用 ECharts 渲染 */
  import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
  import * as echarts from 'echarts';

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

  // 图表 DOM 引用
  const chartRef = ref<HTMLElement>();
  let chartInstance: echarts.ECharts | null = null;
  let resizeObserver: ResizeObserver | null = null;

  // 存储历史数据点
  const historyData = ref<SpeedDataPoint[]>([]);

  // 最大数据点数量（避免无限增长）
  const MAX_DATA_POINTS = 100;

  // 格式化速度显示
  const formatSpeed = (speed: number): string => {
    if (speed < 1000) {
      return `${speed.toFixed(0)} token/s`;
    } else {
      return `${(speed / 1000).toFixed(1)}k/s`;
    }
  };

  // 格式化时间显示
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // 计算图表配置
  const chartOption = computed(() => {
    if (historyData.value.length === 0) {
      return {
        grid: { show: false },
        xAxis: { show: false },
        yAxis: { show: false }
      };
    }

    const times = historyData.value.map(d => d.time);
    const speeds = historyData.value.flatMap(d => [d.totalSpeed, d.currentSpeed, d.outputSpeed]);
    const maxSpeed = Math.max(...speeds, 100) * 1.2; // 添加 20% 的顶部边距

    return {
      grid: {
        left: props.showLegend ? 40 : 10,
        right: 10,
        top: props.showLegend ? 30 : 10,
        bottom: props.showLegend ? 30 : 10,
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        textStyle: { color: '#1f2937', fontSize: 12 },
        padding: [8, 12],
        borderRadius: 8,
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        shadowBlur: 10,
        shadowOffsetX: 0,
        shadowOffsetY: 2,
        formatter: (params: any[]) => {
          const data = params[0];
          if (!data || historyData.value.length === 0) return '';

          const index = data.dataIndex;
          const point = historyData.value[index];
          if (!point) return '';

          return `
            <div style="padding: 4px 0;">
              <div style="font-weight: 600; margin-bottom: 6px; color: #1f2937; font-size: 13px;">
                ⏱️ ${formatTime(point.time)}
              </div>
              <div style="display: flex; align-items: center; margin-bottom: 3px;">
                <span style="display: inline-block; width: 8px; height: 2px; background: #3b82f6; margin-right: 8px; border-radius: 1px;"></span>
                <span style="color: #3b82f6; font-weight: 500;">总速度:</span>
                <span style="color: #6b7280; margin-left: 4px;">${formatSpeed(point.totalSpeed)}</span>
              </div>
              <div style="display: flex; align-items: center; margin-bottom: 3px;">
                <span style="display: inline-block; width: 8px; height: 2px; background: #10b981; margin-right: 8px; border-radius: 1px;"></span>
                <span style="color: #10b981; font-weight: 500;">瞬时速度:</span>
                <span style="color: #6b7280; margin-left: 4px;">${formatSpeed(point.currentSpeed)}</span>
              </div>
              <div style="display: flex; align-items: center;">
                <span style="display: inline-block; width: 8px; height: 2px; background: #a855f7; margin-right: 8px; border-radius: 1px;"></span>
                <span style="color: #a855f7; font-weight: 500;">纯输出速度:</span>
                <span style="color: #6b7280; margin-left: 4px;">${formatSpeed(point.outputSpeed)}</span>
              </div>
            </div>
          `;
        }
      },
      legend: {
        show: props.showLegend,
        data: ['总速度', '瞬时速度', '纯输出速度'],
        textStyle: { fontSize: 11, color: '#666' },
        itemWidth: 15,
        itemHeight: 8,
        top: 5
      },
      xAxis: {
        type: 'category',
        data: times.map(t => formatTime(t)),
        show: props.showLegend,
        axisLine: { show: props.showLegend, lineStyle: { color: '#e5e7eb' } },
        axisTick: { show: false },
        axisLabel: {
          show: props.showLegend,
          fontSize: 10,
          color: '#999',
          interval: Math.floor(times.length / 5) // 最多显示5个标签
        }
      },
      yAxis: {
        type: 'value',
        show: props.showLegend,
        min: 0,
        max: maxSpeed,
        axisLine: { show: props.showLegend, lineStyle: { color: '#e5e7eb' } },
        axisTick: { show: false },
        axisLabel: {
          show: props.showLegend,
          fontSize: 10,
          color: '#999',
          formatter: (value: number) => formatSpeed(value)
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: props.showLegend ? '#f3f4f6' : 'transparent',
            type: 'dashed'
          }
        }
      },
      series: [
        {
          name: '总速度',
          type: 'line',
          data: historyData.value.map(d => d.totalSpeed),
          smooth: true,
          smoothMonotone: 'x', // 确保 X 轴单调性
          symbol: props.showLegend ? 'circle' : 'none',
          symbolSize: props.showLegend ? 4 : 0,
          lineStyle: {
            color: '#3b82f6',
            width: 2.5,
            opacity: props.showLegend ? 0.9 : 0.7,
            shadowColor: 'rgba(59, 130, 246, 0.3)',
            shadowBlur: props.showLegend ? 4 : 0
          },
          itemStyle: {
            color: '#3b82f6',
            borderColor: '#fff',
            borderWidth: 1
          },
          emphasis: {
            disabled: !props.showLegend,
            scale: props.showLegend ? 1.5 : 1,
            lineStyle: { width: 3 }
          },
          animation: false,
          animationDuration: 0
        },
        {
          name: '瞬时速度',
          type: 'line',
          data: historyData.value.map(d => d.currentSpeed),
          smooth: true,
          smoothMonotone: 'x',
          symbol: props.showLegend ? 'circle' : 'none',
          symbolSize: props.showLegend ? 4 : 0,
          lineStyle: {
            color: '#10b981',
            width: 2.5,
            opacity: props.showLegend ? 0.9 : 0.7,
            shadowColor: 'rgba(16, 185, 129, 0.3)',
            shadowBlur: props.showLegend ? 4 : 0
          },
          itemStyle: {
            color: '#10b981',
            borderColor: '#fff',
            borderWidth: 1
          },
          emphasis: {
            disabled: !props.showLegend,
            scale: props.showLegend ? 1.5 : 1,
            lineStyle: { width: 3 }
          },
          animation: false,
          animationDuration: 0
        },
        {
          name: '纯输出速度',
          type: 'line',
          data: historyData.value.map(d => d.outputSpeed),
          smooth: true,
          smoothMonotone: 'x',
          symbol: props.showLegend ? 'circle' : 'none',
          symbolSize: props.showLegend ? 4 : 0,
          lineStyle: {
            color: '#a855f7',
            width: 2.5,
            opacity: props.showLegend ? 0.9 : 0.7,
            shadowColor: 'rgba(168, 85, 247, 0.3)',
            shadowBlur: props.showLegend ? 4 : 0
          },
          itemStyle: {
            color: '#a855f7',
            borderColor: '#fff',
            borderWidth: 1
          },
          emphasis: {
            disabled: !props.showLegend,
            scale: props.showLegend ? 1.5 : 1,
            lineStyle: { width: 3 }
          },
          animation: false,
          animationDuration: 0
        }
      ]
    };
  });

  // 初始化图表
  const initChart = async () => {
    if (!chartRef.value) return;

    await nextTick();

    // 销毁已有实例
    if (chartInstance) {
      chartInstance.dispose();
    }

    // 创建新实例 - 使用更现代的主题配置
    chartInstance = echarts.init(chartRef.value, 'light', {
      renderer: 'canvas', // 使用 canvas 渲染器，性能更好
      useDirtyRect: false // 禁用脏矩形优化，提高质量
    });

    // 设置图表配置
    chartInstance.setOption(chartOption.value);

    // 响应式更新
    resizeObserver = new ResizeObserver(() => {
      if (chartInstance && !chartInstance.isDisposed()) {
        chartInstance.resize();
      }
    });
    resizeObserver.observe(chartRef.value);

    // 背景模式下禁用交互
    if (!props.showLegend) {
      chartInstance.setOption({
        tooltip: { show: false },
        legend: { show: false }
      });
    }
  };

  // 更新图表数据
  const updateChart = () => {
    if (chartInstance && !chartInstance.isDisposed()) {
      chartInstance.setOption(chartOption.value, true);
    }
  };

  onMounted(() => {
    initChart();
  });

  onUnmounted(() => {
    // 清理 ResizeObserver
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    // 清理图表实例
    if (chartInstance && !chartInstance.isDisposed()) {
      chartInstance.dispose();
      chartInstance = null;
    }
  });

  // 监听数据变化
  watch(() => props.data, (newData) => {
    if (newData && newData.length > 0) {
      // 直接使用传入的数据，不进行任何修改或限制
      historyData.value = [...newData];
      updateChart();
    }
  }, { deep: true, immediate: true });

  // 监听图表尺寸变化
  watch(() => [props.width, props.height], () => {
    if (chartInstance && !chartInstance.isDisposed()) {
      chartInstance.resize();
    }
  }, { flush: 'post' });
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

    <!-- ECharts 图表容器 -->
    <div
      ref="chartRef"
      :style="{
        width: width + 'px',
        height: height + 'px',
        opacity: showLegend ? 1 : 0.6
      }"
      :class="{ 'absolute inset-0': !showLegend }"
    />
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

/* ECharts 容器样式 */
.speed-chart div[ref="chartRef"] {
  display: block;
}

.speed-chart--background div[ref="chartRef"] {
  display: block;
  margin: 0;
  padding: 0;
}
</style>