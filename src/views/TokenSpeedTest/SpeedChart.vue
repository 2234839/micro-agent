<script setup lang="ts">
  import { computed } from 'vue';
  import { use } from "echarts/core";
  import { CanvasRenderer } from "echarts/renderers";
  import { LineChart } from "echarts/charts";
  import {
    TitleComponent,
    TooltipComponent,
    LegendComponent,
    GridComponent,
  } from "echarts/components";
  import VChart from "vue-echarts";
  import type { TokenSpeedTestState } from '../../composables/useTokenSpeedTest';

  // 注册 ECharts 组件
  use([
    CanvasRenderer,
    LineChart,
    TitleComponent,
    TooltipComponent,
    LegendComponent,
    GridComponent,
  ]);

  /** 组件属性 */
  const props = defineProps<{
    /** token 速度测试的响应式状态对象 */
    state: TokenSpeedTestState;
  }>();

  /** 处理历史数据，转换为 ECharts 格式 */
  const chartData = computed(() => {
    const historyLength = props.state.speedHistory.length;

    if (historyLength === 0) {
      return {
        speedData: [] as number[][],
        averageSpeedData: [] as number[][],
        delayData: [] as number[][],
      };
    }

    const xAxisData = props.state.speedHistory.map(item => item.offset / 1000); // 转换为秒
    const speedData = props.state.speedHistory.map(item => item.speed);
    const averageSpeedData = props.state.speedHistory.map(item => item.averageSpeed);
    const delayData = props.state.speedHistory.map(item => item.realTimeDelay / 1000); // 转换为秒

    // X轴基于数据的实际范围，确保最后一个数据点在右边界
    const xMin = xAxisData.length > 0 ? xAxisData[0] : 0;
    const xMax = xAxisData.length > 0 ? Math.max(...xAxisData) : 10;

    // Y轴最大值计算 - 向上取整到合适的值
    const allSpeeds = [...speedData, ...averageSpeedData];
    const rawSpeedMax = allSpeeds.length > 0 ? Math.max(...allSpeeds, 50) : 50;
    const speedMax = Math.ceil(rawSpeedMax * 1.1 / 10) * 10; // 向上取整到10的倍数

    const rawDelayMax = delayData.length > 0 ? Math.max(...delayData, 0.5) : 0.5;
    const delayMax = Math.ceil(rawDelayMax * 1.1 * 10) / 10; // 向上取整到0.1的精度

    // 准备速度、平均速度和延迟数据点
    const speedPoints = xAxisData.map((x, i) => [x, speedData[i]]);
    const averageSpeedPoints = xAxisData.map((x, i) => [x, averageSpeedData[i]]);
    const delayPoints = xAxisData.map((x, i) => [x, delayData[i]]);

    return {
      speedPoints,
      averageSpeedPoints,
      delayPoints,
      xMin,
      xMax,
      speedMax,
      delayMax,
    };
  });

  /** ECharts 配置选项 */
  const chartOption = computed(() => {
    const data = chartData.value;

    return {
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
        min: data.xMin,
        max: data.xMax,
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
          },
          min: 0,
          max: data.speedMax,
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
          },
          min: 0,
          max: data.delayMax,
        },
      ],
      tooltip: {
        show: true,
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
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
          data: data.speedPoints,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: 'rgba(34, 197, 94, 0.6)', // green-500 with opacity
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [{
                offset: 0,
                color: 'rgba(34, 197, 94, 0.1)'
              }, {
                offset: 1,
                color: 'rgba(34, 197, 94, 0.01)'
              }]
            },
          },
        },
        {
          name: '平均速度',
          type: 'line',
          yAxisIndex: 0,
          data: data.averageSpeedPoints,
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
          data: data.delayPoints,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: 'rgba(59, 130, 246, 0.6)', // blue-500 with opacity
          },
        },
      ],
    };
  });

  /** 自定义 tooltip 内容 */
  const tooltipFormatter = (params: any) => {
    if (!params || !params[0] || !params[0].value || params[0].value[0] == null) {
      return '';
    }

    const time = params[0].value[0].toFixed(1);
    let result = `时间: ${time}s<br>`;

    params.forEach((param: any) => {
      if (!param || !param.value || param.value[1] == null) return;
      const name = param.seriesName;
      const value = param.value[1].toFixed(2);
      const unit = name === '速度' ? ' tokens/s' : 's';
      result += `${name}: ${value}${unit}<br>`;
    });

    return result;
  };
</script>

<template>
  <div class="w-full h-full">
    <!-- ECharts 图表 -->
    <VChart
      :option="chartOption"
      class="w-full h-full"
      :autoresize="true"
    >
      <!-- 自定义 tooltip -->
      <template #tooltip="params">
        <div v-html="tooltipFormatter(params)"></div>
      </template>
    </VChart>
  </div>
</template>