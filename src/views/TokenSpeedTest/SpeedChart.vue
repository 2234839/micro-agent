<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
  import * as echarts from 'echarts';
  import type { TokenSpeedTestState } from '../../composables/useTokenSpeedTest';

  /** 组件属性 */
  const props = defineProps<{
    /** token 速度测试的响应式状态对象 */
    state: TokenSpeedTestState;
  }>();

  /** 图表容器引用 */
  const chartContainer = ref<HTMLElement>();
  /** 图表实例 */
  let chartInstance: echarts.ECharts | null = null;

  
  /** 处理历史数据，转换为 ECharts 格式 */
  const chartData = computed(() => {
    const historyLength = props.state.speedHistory.length;

    if (historyLength === 0) {
      return {
        xAxisData: [] as number[],
        speedData: [] as number[],
        averageSpeedData: [] as number[],
        delayData: [] as number[],
        completedPoints: [] as boolean[],
      };
    }

    return {
      xAxisData: props.state.speedHistory.map(item => item.offset / 1000), // 转换为秒
      speedData: props.state.speedHistory.map(item => item.speed),
      averageSpeedData: props.state.speedHistory.map(item => item.averageSpeed),
      delayData: props.state.speedHistory.map(item => item.realTimeDelay / 1000), // 转换为秒
      completedPoints: props.state.speedHistory.map(item => item.isCompleted),
    };
  });

  /** 初始化图表 */
  const initChart = () => {
    if (!chartContainer.value) {
      return;
    }

    chartInstance = echarts.init(chartContainer.value);

    const option = {
      animation: false,
      backgroundColor: 'transparent',
      grid: {
        left: '0%',
        right: '0%',
        top: '15%',
        bottom: '0%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        show: false,
        min: 0,
        boundaryGap: false,
      },
      yAxis: [
        {
          type: 'value',
          show: true,
          name: '速度',
          nameTextStyle: { color: 'rgba(34, 197, 94, 0.8)' },
          axisLine: {
            show: true,
            lineStyle: {
              color: 'rgba(34, 197, 94, 0.6)'
            }
          },
          axisLabel: {
            show: true,
            color: 'rgba(34, 197, 94, 0.8)',
            fontSize: 10
          },
          splitLine: {
            show: false
          }
        },
        {
          type: 'value',
          show: true,
          name: '延迟',
          nameTextStyle: { color: 'rgba(59, 130, 246, 0.8)' },
          axisLine: {
            show: true,
            lineStyle: {
              color: 'rgba(59, 130, 246, 0.6)'
            }
          },
          axisLabel: {
            show: true,
            color: 'rgba(59, 130, 246, 0.8)',
            fontSize: 10
          },
          splitLine: {
            show: false
          }
        },
      ],
      tooltip: {
        show: true,
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        formatter: (params: any) => {
          const time = params[0].value[0].toFixed(1);
          let result = `时间: ${time}s<br>`;
          params.forEach((param: any) => {
            const name = param.seriesName;
            const value = param.value[1].toFixed(2);
            const unit = name === '速度' ? ' tokens/s' : 's';
            result += `${name}: ${value}${unit}<br>`;
          });
          return result;
        },
      },
      legend: {
        show: true,
        top: 'top',
        left: 'right',
        textStyle: {
          fontSize: 12,
          color: '#666',
        },
        itemWidth: 20,
        itemHeight: 10,
        data: ['速度', '平均速度', '延迟'],
      },
      series: [
        {
          name: '速度',
          type: 'line',
          yAxisIndex: 0,
          data: [],
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: 'rgba(34, 197, 94, 0.6)', // green-500 with opacity
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              {
                offset: 0,
                color: 'rgba(34, 197, 94, 0.1)',
              },
              {
                offset: 1,
                color: 'rgba(34, 197, 94, 0.01)',
              },
            ]),
          },
        },
        {
          name: '平均速度',
          type: 'line',
          yAxisIndex: 0,
          data: [],
          smooth: true,
          lineStyle: {
            width: 3,
            color: 'rgba(251, 146, 60, 0.9)', // orange-400 with opacity
          },
          symbol: 'none',
        },
        {
          name: '延迟',
          type: 'line',
          yAxisIndex: 1,
          data: [],
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: 'rgba(59, 130, 246, 0.6)', // blue-500 with opacity
          },
        },
      ],
    };

    chartInstance.setOption(option);

    // 确保图表适应容器大小
    nextTick(() => {
      chartInstance?.resize();
    });
  };

  /** 更新图表数据 */
  const updateChart = () => {
    if (!chartInstance) {
      return;
    }

    const data = chartData.value;

    // 检查是否有数据
    if (data.xAxisData.length === 0) {
      return;
    }

    // 准备速度、平均速度和延迟数据点
    const speedPoints = data.xAxisData.map((x, i) => [x, data.speedData[i]]);
    const averageSpeedPoints = data.xAxisData.map((x, i) => [x, data.averageSpeedData[i]]);
    const delayPoints = data.xAxisData.map((x, i) => [x, data.delayData[i]]);

    // X轴基于数据的实际范围，确保最后一个数据点在右边界
    const xMax = data.xAxisData.length > 0 ? Math.max(...data.xAxisData) : 10;

    // Y轴最大值计算
    const allSpeeds = [...data.speedData, ...data.averageSpeedData];
    const speedMax = allSpeeds.length > 0 ? Math.max(...allSpeeds, 50) * 1.2 : 60;
    const delayMax = data.delayData.length > 0 ? Math.max(...data.delayData, 0.5) * 1.2 : 1;

    chartInstance.setOption({
      xAxis: {
        min: data.xAxisData.length > 0 ? data.xAxisData[0] : 0,
        max: xMax,
        boundaryGap: false,
      },
      yAxis: [
        {
          min: 0,
          max: speedMax,
        },
        {
          min: 0,
          max: delayMax,
        },
      ],
      series: [
        {
          data: speedPoints,
        },
        {
          data: averageSpeedPoints,
        },
        {
          data: delayPoints,
        },
      ],
    });
  };

  /** 监听窗口大小变化 */
  const handleResize = () => {
    chartInstance?.resize();
  };

  onMounted(() => {
    nextTick(() => {
      setTimeout(() => {
        initChart();
        updateChart();
        window.addEventListener('resize', handleResize);
      }, 100);
    });
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    chartInstance?.dispose();
  });

  /** 监听数据变化 */
  watch(() => props.state.speedHistory, () => {
    updateChart();
  }, { deep: true });
</script>

<template>
  <div class="absolute inset-0">
    <!-- 调试信息 -->
    <div v-if="chartData.xAxisData.length === 0" class="absolute top-2 left-2 text-gray-600 text-xs z-10">
      等待速度数据... ({{ state.speedHistory.length }} 条记录)
    </div>

    <!-- 图表容器 -->
    <div ref="chartContainer" class="w-full h-full"></div>
  </div>
</template>