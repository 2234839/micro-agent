<script setup lang="ts">
  /** 多轮测试总图表组件 - 展示跨轮次的累计性能数据 */
  import { computed, ref, onMounted, onUnmounted, watch, nextTick, shallowRef } from 'vue';
  import * as echarts from 'echarts';
  import type { TokenTestResult } from '../../../composables/useTokenSpeedTest';

  interface ChartDataPoint {
    round: number;
    time: number; // 从测试开始的总时间（毫秒）
    totalSpeed: number;
    outputSpeed: number;
    testCaseName: string;
    testCaseId: string;
  }

  interface Props {
    multiRoundResults: Array<{ round: number; results: TokenTestResult[] }>;
    width?: number;
    height?: number;
  }

  const props = withDefaults(defineProps<Props>(), {
    width: 800,
    height: 400
  });

  // 图表 DOM 引用
  const chartRef = ref<HTMLElement>();
  let chartInstance: echarts.ECharts | null = null;
  let resizeObserver: ResizeObserver | null = null;

  // 使用防抖来避免频繁更新
  let updateTimer: NodeJS.Timeout | null = null;

  // 格式化速度显示
  const formatSpeed = (speed: number): string => {
    if (speed < 1000) {
      return `${speed.toFixed(1)} token/s`;
    } else {
      return `${(speed / 1000).toFixed(2)}k/s`;
    }
  };

  // 格式化时间显示
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // 使用shallowRef缓存计算结果
  const cachedChartData = shallowRef<ChartDataPoint[]>([]);
  const cachedTestCases = shallowRef<Array<[string, string]>>([]);

  // 处理多轮测试数据，生成图表数据（优化版本）
  const processData = () => {
    if (!props.multiRoundResults || props.multiRoundResults.length === 0) {
      cachedChartData.value = [];
      cachedTestCases.value = [];
      return;
    }

    const allDataPoints: ChartDataPoint[] = [];
    const testCaseMap = new Map<string, string>();
    let globalTimeOffset = 0; // 全局时间偏移，确保多轮测试的时间连续性

    props.multiRoundResults.forEach((roundData, roundIndex) => {
      const { round, results } = roundData;

      results.forEach(result => {
        if (result.status === 'completed') {
          // 直接使用最终结果，避免处理chunks数据
          allDataPoints.push({
            round,
            time: globalTimeOffset + result.duration,
            totalSpeed: result.tokensPerSecond || 0,
            outputSpeed: result.outputSpeed || 0,
            testCaseName: result.testCaseName,
            testCaseId: result.testCaseId
          });

          // 收集测试用例信息
          if (!testCaseMap.has(result.testCaseId)) {
            testCaseMap.set(result.testCaseId, result.testCaseName);
          }
        }
      });

      // 更新全局时间偏移，为下一轮测试预留间隔时间
      if (roundIndex < props.multiRoundResults.length - 1) {
        globalTimeOffset += 2000; // 2秒间隔
      }
    });

    cachedChartData.value = allDataPoints.sort((a, b) => a.time - b.time);
    cachedTestCases.value = Array.from(testCaseMap.entries());
  };

  // 计算属性
  const chartData = computed(() => cachedChartData.value);
  const uniqueTestCases = computed(() => cachedTestCases.value);

  // 为每个测试用例生成不同的颜色
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ];

  // 计算图表配置（简化版本）
  const chartOption = computed(() => {
    if (chartData.value.length === 0) {
      return {
        title: {
          text: '暂无数据',
          left: 'center',
          top: 'center',
          textStyle: { color: '#999', fontSize: 14 }
        }
      };
    }

    const speeds = chartData.value.map(d => d.totalSpeed);
    const maxSpeed = Math.max(...speeds, 100) * 1.2;

    // 为每个测试用例生成系列数据
    const series = uniqueTestCases.value.map(([testCaseId, testCaseName], index) => {
      const testCaseData = chartData.value.filter(d => d.testCaseId === testCaseId);
      const color = colors[index % colors.length];

      return {
        name: testCaseName,
        type: 'line',
        data: testCaseData.map(d => [d.time, d.totalSpeed]),
        smooth: true,
        symbol: 'none', // 移除符号点以提高性能
        lineStyle: {
          color,
          width: 2
        },
        emphasis: {
          disabled: true // 禁用hover效果以提高性能
        }
      };
    });

    return {
      animation: false, // 禁用动画以提高性能
      title: {
        text: `多轮测试性能趋势 (${props.multiRoundResults.length} 轮)`,
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
          color: '#1f2937'
        }
      },
      grid: {
        left: 60,
        right: 20,
        top: 60,
        bottom: 60,
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return '';
          const data = params[0];
          const timePoint = data.axisValue;
          const dataPoint = chartData.value.find(d => Math.abs(d.time - timePoint) < 100);
          if (!dataPoint) return '';
          return `${dataPoint.testCaseName} (轮次${dataPoint.round}): ${formatSpeed(dataPoint.totalSpeed)}`;
        }
      },
      legend: {
        data: uniqueTestCases.value.map(([_, name]) => name),
        top: 30,
        textStyle: { fontSize: 12, color: '#666' }
      },
      xAxis: {
        type: 'value',
        name: '时间',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: '#666', fontSize: 12 },
        axisLabel: {
          fontSize: 11,
          color: '#999',
          formatter: (value: number) => formatTime(value)
        }
      },
      yAxis: {
        type: 'value',
        name: '速度',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { color: '#666', fontSize: 12 },
        min: 0,
        max: maxSpeed,
        axisLabel: {
          fontSize: 11,
          color: '#999',
          formatter: (value: number) => formatSpeed(value)
        }
      },
      series
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

    // 创建新实例
    chartInstance = echarts.init(chartRef.value, 'light', {
      renderer: 'canvas',
      useDirtyRect: false
    });

    // 设置图表配置
    chartInstance.setOption(chartOption.value);

    // 响应式更新（使用防抖）
    let resizeTimer: NodeJS.Timeout | null = null;
    resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(() => {
        if (chartInstance) {
          chartInstance.resize();
        }
      }, 100);
    });
    resizeObserver.observe(chartRef.value);
  };

  // 防抖更新图表数据
  const debouncedUpdateChart = () => {
    if (updateTimer) {
      clearTimeout(updateTimer);
    }
    updateTimer = setTimeout(() => {
      processData();
      if (chartInstance) {
        chartInstance.setOption(chartOption.value, true);
      }
    }, 200); // 200ms防抖
  };

  onMounted(() => {
    initChart();
    processData(); // 初始化时处理数据
  });

  onUnmounted(() => {
    if (updateTimer) {
      clearTimeout(updateTimer);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (chartInstance) {
      chartInstance.dispose();
    }
  });

  // 监听数据变化（使用防抖）
  watch(() => props.multiRoundResults, debouncedUpdateChart, { deep: true });

  // 监听图表尺寸变化（使用防抖）
  watch(() => [props.width, props.height], () => {
    if (chartInstance) {
      chartInstance.resize();
    }
  }, { flush: 'post' });
</script>

<template>
  <div class="multi-round-chart">
    <div v-if="multiRoundResults.length > 0" class="mb-3">
      <div class="flex justify-between items-center text-sm text-gray-600">
        <span>总测试数: {{ multiRoundResults.reduce((sum, round) => sum + round.results.length, 0) }}</span>
        <span>图表数据点: {{ chartData.length }}</span>
      </div>
    </div>

    <!-- ECharts 图表容器 -->
    <div
      ref="chartRef"
      :style="{
        width: width + 'px',
        height: height + 'px'
      }"
      class="border border-gray-200 rounded-lg bg-white"
    />

    <div v-if="multiRoundResults.length === 0" class="text-center py-8 text-gray-500">
      <div class="text-lg mb-2">📊</div>
      <div>完成多轮测试后将显示性能趋势图表</div>
    </div>
  </div>
</template>

<style scoped>
.multi-round-chart {
  font-family: ui-sans-serif, system-ui, sans-serif;
}
</style>