<script setup lang="ts">
  /** 多轮测试总图表组件 - 展示跨轮次的累计性能数据 */
  import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
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

  // 处理多轮测试数据，生成图表数据
  const chartData = computed(() => {
    if (!props.multiRoundResults || props.multiRoundResults.length === 0) {
      return [];
    }

    const allDataPoints: ChartDataPoint[] = [];
    let globalTimeOffset = 0; // 全局时间偏移，确保多轮测试的时间连续性

    props.multiRoundResults.forEach((roundData, roundIndex) => {
      const { round, results } = roundData;

      results.forEach(result => {
        if (result.status === 'completed' && result.chunks.length > 0) {
          // 为每个测试用例创建数据点
          result.chunks.forEach((chunk, chunkIndex) => {
            allDataPoints.push({
              round,
              time: globalTimeOffset + chunk.timestamp, // 使用全局时间偏移
              totalSpeed: result.tokensPerSecond || 0,
              outputSpeed: result.outputSpeed || 0,
              testCaseName: result.testCaseName,
              testCaseId: result.testCaseId
            });
          });

          // 添加最终完成点
          allDataPoints.push({
            round,
            time: globalTimeOffset + result.duration,
            totalSpeed: result.tokensPerSecond || 0,
            outputSpeed: result.outputSpeed || 0,
            testCaseName: result.testCaseName,
            testCaseId: result.testCaseId
          });
        }
      });

      // 更新全局时间偏移，为下一轮测试预留间隔时间
      if (roundIndex < props.multiRoundResults.length - 1) {
        // 估算轮次间隔时间，这里假设2秒间隔
        globalTimeOffset += 2000;
      }
    });

    return allDataPoints.sort((a, b) => a.time - b.time);
  });

  // 获取所有唯一的测试用例
  const uniqueTestCases = computed(() => {
    const testCaseMap = new Map<string, string>();
    chartData.value.forEach(point => {
      if (!testCaseMap.has(point.testCaseId)) {
        testCaseMap.set(point.testCaseId, point.testCaseName);
      }
    });
    return Array.from(testCaseMap.entries());
  });

  // 为每个测试用例生成不同的颜色
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ];

  // 计算图表配置
  const chartOption = computed(() => {
    if (chartData.value.length === 0) {
      return {
        grid: { show: false },
        xAxis: { show: false },
        yAxis: { show: false },
        title: {
          text: '暂无数据',
          left: 'center',
          top: 'center',
          textStyle: { color: '#999', fontSize: 14 }
        }
      };
    }

    const times = chartData.value.map(d => d.time);
    const speeds = chartData.value.flatMap(d => [d.totalSpeed, d.outputSpeed]);
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
        smoothMonotone: 'x',
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: {
          color,
          width: 2.5,
          opacity: 0.8
        },
        itemStyle: {
          color,
          borderColor: '#fff',
          borderWidth: 1
        },
        emphasis: {
          scale: 1.5,
          lineStyle: { width: 3 }
        }
      };
    });

    // 准备轮次分隔线数据
    let markLineData: any[] = [];

    // 找到每轮测试的开始时间
    const roundStartTimes = new Set<number>();
    chartData.value.forEach(point => {
      if (!roundStartTimes.has(point.time)) {
        roundStartTimes.add(point.time);
      }
    });

    Array.from(roundStartTimes).slice(1).forEach(time => {
      markLineData.push({
        xAxis: time,
        lineStyle: {
          color: '#e5e7eb',
          type: 'dashed',
          width: 1
        },
        label: {
          show: true,
          position: 'start',
          formatter: `轮次 ${chartData.value.find(d => d.time === time)?.round}`,
          color: '#6b7280',
          fontSize: 11
        }
      });
    });

    // 为每个系列添加markLine
    const seriesWithMarkLines = series.map((serie, index) => ({
      ...serie,
      markLine: {
        data: markLineData,
        silent: true
      }
    }));

    return {
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
        bottom: 80,
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        textStyle: { color: '#1f2937', fontSize: 12 },
        padding: [10, 14],
        borderRadius: 8,
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        shadowBlur: 10,
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return '';

          const data = params[0];
          const timePoint = data.axisValue;
          const dataPoint = chartData.value.find(d => Math.abs(d.time - timePoint) < 100);

          if (!dataPoint) return '';

          return `
            <div style="padding: 4px 0;">
              <div style="font-weight: 600; margin-bottom: 8px; color: #1f2937; font-size: 13px;">
                🔄 轮次 ${dataPoint.round} - ${dataPoint.testCaseName}
              </div>
              <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="display: inline-block; width: 8px; height: 2px; background: ${data.color}; margin-right: 8px; border-radius: 1px;"></span>
                <span style="color: #3b82f6; font-weight: 500;">总速度:</span>
                <span style="color: #6b7280; margin-left: 4px;">${formatSpeed(dataPoint.totalSpeed)}</span>
              </div>
              <div style="display: flex; align-items: center;">
                <span style="color: #10b981; font-weight: 500;">输出速度:</span>
                <span style="color: #6b7280; margin-left: 4px;">${formatSpeed(dataPoint.outputSpeed)}</span>
              </div>
              <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #f3f4f6; font-size: 11px; color: #9ca3af;">
                ⏱️ ${formatTime(dataPoint.time)}
              </div>
            </div>
          `;
        }
      },
      legend: {
        data: uniqueTestCases.value.map(([_, name]) => name),
        top: 30,
        textStyle: { fontSize: 12, color: '#666' },
        itemWidth: 20,
        itemHeight: 10,
        type: 'scroll'
      },
      xAxis: {
        type: 'value',
        name: '时间',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: '#666', fontSize: 12 },
        data: times,
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 11,
          color: '#999',
          formatter: (value: number) => formatTime(value)
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f3f4f6',
            type: 'dashed'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '速度 (token/s)',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { color: '#666', fontSize: 12 },
        min: 0,
        max: maxSpeed,
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 11,
          color: '#999',
          formatter: (value: number) => formatSpeed(value)
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f3f4f6',
            type: 'dashed'
          }
        }
      },
      series: seriesWithMarkLines
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

    // 响应式更新
    const resizeObserver = new ResizeObserver(() => {
      if (chartInstance) {
        chartInstance.resize();
      }
    });
    resizeObserver.observe(chartRef.value);
  };

  // 更新图表数据
  const updateChart = () => {
    if (chartInstance) {
      chartInstance.setOption(chartOption.value, true);
    }
  };

  onMounted(() => {
    initChart();
  });

  onUnmounted(() => {
    if (chartInstance) {
      chartInstance.dispose();
    }
  });

  // 监听数据变化
  watch(() => props.multiRoundResults, () => {
    updateChart();
  }, { deep: true });

  // 监听图表尺寸变化
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