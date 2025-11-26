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

  // 速度趋势图配置
  const speedChartOption = computed(() => {
    if (!chartData.value) return {};

    return {
      title: {
        text: '速度变化趋势',
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
        formatter: (params: any) => {
          let result = `${params[0].axisValueLabel}<br/>`;
          params.forEach((param: any) => {
            result += `${param.marker}${param.seriesName}: ${param.value.toFixed(1)} tokens/s<br/>`;
          });
          return result;
        },
      },
      legend: {
        top: 30,
        data: ['平均速度', '峰值速度'],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: chartData.value.labels,
        name: '测试轮次',
        nameLocation: 'middle',
        nameGap: 30,
      },
      yAxis: {
        type: 'value',
        name: '速度 (tokens/秒)',
        nameLocation: 'middle',
        nameGap: 50,
      },
      series: [
        {
          name: '平均速度',
          type: 'line',
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
          name: '峰值速度',
          type: 'line',
          smooth: true,
          data: chartData.value.peakSpeeds,
          itemStyle: {
            color: '#10b981',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.05)' },
              ],
            },
          },
        },
      ],
    };
  });

  // Token 数量柱状图配置
  const tokenChartOption = computed(() => {
    if (!chartData.value) return {};

    const colors = props.results.map(result => result.success ? '#22c55e' : '#ef4444');

    return {
      title: {
        text: 'Token 生成数量',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
        },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const data = params[0];
          const result = props.results[data.dataIndex];
          if (!result) return `${data.axisValueLabel}<br/>${data.marker}Token 数: ${data.value}`;

          return `${data.axisValueLabel}<br/>
                  ${data.marker}Token 数: ${data.value}<br/>
                  状态: ${result.success ? '成功' : '失败'}<br/>
                  耗时: ${(result.duration / 1000).toFixed(1)}s`;
        },
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
      yAxis: {
        type: 'value',
        name: 'Token 数量',
        nameLocation: 'middle',
        nameGap: 50,
      },
      series: [
        {
          type: 'bar',
          data: chartData.value.tokenCounts.map((value, index) => ({
            value,
            itemStyle: { color: colors[index] },
          })),
          barWidth: '60%',
        },
      ],
    };
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

  // 统计数据
  const statistics = computed(() => {
    if (props.results.length === 0) return null;

    const successfulResults = props.results.filter(result => result.success);
    const averageSpeeds = successfulResults.map(result => result.averageSpeed);
    const peakSpeeds = successfulResults.map(result => result.peakSpeed);
    const tokenCounts = successfulResults.map(result => result.totalTokens);
    const durations = successfulResults.map(result => result.duration);

    return {
      totalRounds: props.results.length,
      successfulRounds: successfulResults.length,
      successRate: (successfulResults.length / props.results.length) * 100,
      averageSpeed: averageSpeeds.length > 0
        ? Math.round((averageSpeeds.reduce((sum, speed) => sum + speed, 0) / averageSpeeds.length) * 10) / 10
        : 0,
      maxPeakSpeed: peakSpeeds.length > 0 ? Math.max(...peakSpeeds) : 0,
      averageTokens: tokenCounts.length > 0
        ? Math.round(tokenCounts.reduce((sum, tokens) => sum + tokens, 0) / tokenCounts.length)
        : 0,
      averageDuration: durations.length > 0
        ? Math.round((durations.reduce((sum, duration) => sum + duration, 0) / durations.length) / 100) / 10
        : 0,
    };
  });
</script>

<template>
  <div class="space-y-6">
    <!-- 统计信息 -->
    <div v-if="statistics" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div class="bg-blue-50 rounded-lg p-4">
        <div class="text-2xl font-bold text-blue-600">{{ statistics.totalRounds }}</div>
        <div class="text-sm text-gray-600">总轮数</div>
      </div>
      <div class="bg-green-50 rounded-lg p-4">
        <div class="text-2xl font-bold text-green-600">{{ statistics.successfulRounds }}</div>
        <div class="text-sm text-gray-600">成功轮数</div>
      </div>
      <div class="bg-purple-50 rounded-lg p-4">
        <div class="text-2xl font-bold text-purple-600">{{ (statistics?.successRate ?? 0).toFixed(1) }}%</div>
        <div class="text-sm text-gray-600">成功率</div>
      </div>
      <div class="bg-orange-50 rounded-lg p-4">
        <div class="text-2xl font-bold text-orange-600">{{ statistics.averageSpeed }}</div>
        <div class="text-sm text-gray-600">平均速度 (t/s)</div>
      </div>
      <div class="bg-red-50 rounded-lg p-4">
        <div class="text-2xl font-bold text-red-600">{{ statistics.maxPeakSpeed }}</div>
        <div class="text-sm text-gray-600">峰值速度 (t/s)</div>
      </div>
      <div class="bg-teal-50 rounded-lg p-4">
        <div class="text-2xl font-bold text-teal-600">{{ statistics.averageTokens }}</div>
        <div class="text-sm text-gray-600">平均 Token 数</div>
      </div>
    </div>

    <!-- 无数据提示 -->
    <div v-if="!chartData" class="bg-gray-50 rounded-lg p-8 text-center">
      <div class="text-gray-500">暂无测试数据</div>
    </div>

    <div v-else class="space-y-6">
      <!-- 速度趋势图 -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="h-80">
          <VChart :option="speedChartOption" autoresize />
        </div>
      </div>

      <!-- Token 数量柱状图 -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="h-64">
          <VChart :option="tokenChartOption" autoresize />
        </div>
      </div>

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
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">耗时 (s)</th>
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
                  {{ (result.duration / 1000).toFixed(2) }}
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