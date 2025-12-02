<script setup lang="ts">
  import { computed } from 'vue';
  import { use } from 'echarts/core';
  import { LineChart, BarChart } from 'echarts/charts';
  import {
    TitleComponent,
    TooltipComponent,
    LegendComponent,
    GridComponent,
    DataZoomComponent,
  } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';
  import VChart from 'vue-echarts';
  import type { SingleRoundResult } from '../../composables/useMultiRoundTest';

  // 注册 ECharts 组件
  use([
    LineChart,
    BarChart,
    TitleComponent,
    TooltipComponent,
    LegendComponent,
    GridComponent,
    DataZoomComponent,
    CanvasRenderer,
  ]);

  interface Props {
    /** 测试结果数据 */
    results: SingleRoundResult[];
    /** 是否显示详细信息 */
    showDetails?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    showDetails: true,
  });

  // 计算图表数据
  const chartData = computed(() => {
    if (props.results.length === 0) return null;

    const labels = props.results.map(result => `第${result.round}轮`);
    const averageSpeeds = props.results.map(result => result.averageSpeed);
    const peakSpeeds = props.results.map(result => result.peakSpeed);
    const tokenCounts = props.results.map(result => result.totalTokens);
    const durations = props.results.map(result => result.duration / 1000); // 转换为秒

    return { labels, averageSpeeds, peakSpeeds, tokenCounts, durations };
  });

  
  
  // 综合对比图配置
  const comparisonChartOption = computed(() => {
    if (!chartData.value) return {};

    return {
      title: {
        text: '速度与耗时对比',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
      },
      legend: {
        top: 30,
        data: ['平均速度', '耗时'],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: chartData.value.labels,
        name: '测试轮次',
        nameLocation: 'middle',
        nameGap: 30,
      },
      yAxis: [
        {
          type: 'value',
          name: '速度 (tokens/秒)',
          nameLocation: 'middle',
          nameGap: 50,
          position: 'left',
        },
        {
          type: 'value',
          name: '耗时 (秒)',
          nameLocation: 'middle',
          nameGap: 50,
          position: 'right',
        },
      ],
      series: [
        {
          name: '平均速度',
          type: 'line',
          yAxisIndex: 0,
          smooth: true,
          data: chartData.value.averageSpeeds,
          itemStyle: {
            color: '#3b82f6',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
              ],
            },
          },
        },
        {
          name: '耗时',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          data: chartData.value.durations,
          itemStyle: {
            color: '#f97316',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(249, 115, 22, 0.3)' },
                { offset: 1, color: 'rgba(249, 115, 22, 0.05)' },
              ],
            },
          },
        },
      ],
    };
  });
</script>

<template>
  <div class="space-y-6">

    <!-- 无数据提示 -->
    <div v-if="!chartData" class="bg-gray-50 rounded-lg p-8 text-center">
      <div class="text-gray-500">暂无测试数据</div>
    </div>

    <div v-else class="space-y-6">
      <!-- 综合对比图 -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="h-80">
          <VChart :option="comparisonChartOption" autoresize />
        </div>
      </div>

      <!-- 详细结果表格 -->
      <div v-if="showDetails" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">详细结果</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">轮次</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token 数</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">平均速度 (t/s)</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">峰值速度 (t/s)</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">首字延迟 (ms)</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="result in results" :key="result.round" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">第{{ result.round }}轮</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    :class="[
                      'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                      result.success
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    ]"
                  >
                    {{ result.success ? '成功' : '失败' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ result.totalTokens }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ result.averageSpeed.toFixed(1) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ result.peakSpeed.toFixed(1) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ result.firstTokenDelay }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>