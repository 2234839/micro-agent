<template>
  <div class="space-y-4">
    <!-- Agent 执行步骤 -->
    <div v-if="agentSteps.length > 0" class="space-y-3">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-lg">🤖</span>
        <h3 class="text-sm font-medium text-blue-800">Agent 执行步骤</h3>
      </div>

      <div
        v-for="(step, index) in agentSteps"
        :key="index"
        class="border rounded-lg overflow-hidden"
        :class="{
          'border-green-200 bg-green-50': step.isDone && !step.error,
          'border-red-200 bg-red-50': step.error,
          'border-blue-200 bg-blue-50': !step.isDone && !step.error,
        }">
        <!-- 步骤头部 -->
        <div
          class="flex items-center gap-2 px-3 py-2 border-b"
          :class="{
            'border-green-300 bg-green-100': step.isDone && !step.error,
            'border-red-300 bg-red-100': step.error,
            'border-blue-300 bg-blue-100': !step.isDone && !step.error,
          }">
          <div
            class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
            :class="{
              'bg-green-600 text-white': step.isDone && !step.error,
              'bg-red-600 text-white': step.error,
              'bg-blue-600 text-white': !step.isDone,
            }">
            {{ step.step || index + 1 }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium">
              <span v-if="step.isDone && !step.error">✅ 步骤完成</span>
              <span v-else-if="step.error">❌ 步骤失败</span>
              <span v-else>💭 思考中...</span>
            </div>
          </div>
          <div v-if="step.timestamp" class="text-xs opacity-70">
            {{ new Date(step.timestamp).toLocaleTimeString() }}
          </div>
        </div>

        <!-- 步骤内容 -->
        <div class="p-3 space-y-3">
          <!-- 思考过程（流式 Markdown 渲染） -->
          <div v-if="step.content" class="space-y-2">
            <div class="text-sm font-medium text-gray-700">
              {{ step.isDone ? '思考完成：' : '正在思考：' }}
            </div>
            <div class="prose prose-sm max-w-none bg-white rounded p-3 border border-gray-100">
              <MarkdownRender
                        :content="step.content"
                :code-block-stream="true"
                :viewport-priority="true"
                custom-id="agent-step" />
            </div>
          </div>

          <!-- 工具调用 -->
          <div v-if="step.toolCall" class="space-y-2">
            <!-- 工具调用头部（可点击展开/折叠） -->
            <div
              class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
              @click="toggleToolCall(index)">
              <span class="text-sm font-medium text-gray-700">工具调用：</span>
              <code class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-mono">
                {{ step.toolCall.name }}
              </code>

              <!-- 展开/折叠图标 -->
              <div class="ml-auto flex items-center gap-1">
                <div v-if="step.toolCall.result" class="flex items-center gap-1">
                  <div
                    class="w-2 h-2 rounded-full"
                    :class="{
                      'bg-green-500': step.toolCall.result.success,
                      'bg-red-500': !step.toolCall.result.success,
                    }">
                  </div>
                  <span class="text-xs text-gray-500">
                    {{ step.toolCall.result.success ? '成功' : '失败' }}
                  </span>
                </div>
                <svg
                  class="w-4 h-4 text-gray-400 transition-transform"
                  :class="{ 'rotate-90': isToolCallExpanded(index) }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            <!-- 工具详情（折叠内容） -->
            <div v-show="isToolCallExpanded(index)" class="space-y-2 pl-2 border-l-2 border-gray-200">
              <!-- 工具参数 -->
              <div class="space-y-1">
                <div class="text-sm font-medium text-gray-600">参数：</div>
                <div class="bg-gray-50 rounded p-2 max-h-32 overflow-y-auto">
                  <pre class="text-xs text-gray-700 whitespace-pre-wrap">{{ JSON.stringify(step.toolCall.parameters, null, 2) }}</pre>
                </div>
              </div>

              <!-- 工具结果 -->
              <div v-if="step.toolCall.result" class="space-y-1">
                <div class="text-sm font-medium text-gray-600">执行结果：</div>
                <div
                  class="rounded p-2 max-h-48 overflow-y-auto text-xs"
                  :class="{
                    'bg-green-50 text-green-800': step.toolCall.result.success,
                    'bg-red-50 text-red-800': !step.toolCall.result.success,
                  }">
                  <pre class="whitespace-pre-wrap">{{ JSON.stringify(step.toolCall.result, null, 2) }}</pre>
                </div>
              </div>
            </div>
          </div>

          <!-- 错误信息 -->
          <div v-if="step.error" class="space-y-1">
            <div class="text-sm font-medium text-red-600">错误信息：</div>
            <div class="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
              {{ step.error }}
            </div>
          </div>
        </div>
      </div>
    </div>

    </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import type { AgentStepChunk } from '../agent/micro-agent';
  import { MarkdownRender } from 'vue-renderer-markdown';

  /** 工具调用展开状态管理 */
  const toolCallExpanded = ref<Record<string, boolean>>({});

  /** 切换工具调用展开状态 */
  const toggleToolCall = (stepIndex: number) => {
    const key = `step-${stepIndex}`;
    toolCallExpanded.value[key] = !toolCallExpanded.value[key];
  };

  /** 检查工具调用是否展开 */
  const isToolCallExpanded = (stepIndex: number) => {
    const key = `step-${stepIndex}`;
    return toolCallExpanded.value[key] || false;
  };

  interface Props {
    content: string;
  }

  const props = defineProps<Props>();

  /** 解析 Agent 消息内容，提取步骤和最终答案 */
  const agentSteps = computed(() => {
    const steps: AgentStepChunk[] = [];

    // 使用正则表达式解析步骤
    const stepRegex = /### 步骤 (\d+)\n\n([\s\S]*?)(?=### 步骤 \d+|$)/g;
    const finalAnswerRegex = /## 📝 最终答案\n\n([\s\S]*)$/;

    let match;
    while ((match = stepRegex.exec(props.content)) !== null) {
      const stepNumber = parseInt(match[1] || '1');
      const stepContent = match[2] || '';

      const step: AgentStepChunk = {
        step: stepNumber,
        content: '',
        isDone: false,
        timestamp: Date.now(),
      };

      // 解析思考过程
      const thinkMatch = stepContent.match(/\*\*思考过程：\*\*\n([\s\S]*?)(?=\*\*|$)/);
      if (thinkMatch && thinkMatch[1]) {
        step.content = thinkMatch[1].trim();
      }

      // 解析工具调用
      const toolCallMatch = stepContent.match(/\*\*工具调用：\*\* `([^`]+)`/);
      if (toolCallMatch) {
        step.toolCall = {
          name: toolCallMatch[1] || 'unknown',
          parameters: {},
          result: null,
        };

        // 解析参数
        const paramMatch = stepContent.match(/\*\*参数：\*\* \n```json\n([\s\S]*?)\n```/);
        if (paramMatch && paramMatch[1]) {
          try {
            step.toolCall.parameters = JSON.parse(paramMatch[1]);
          } catch (e) {
            console.error('Failed to parse tool parameters:', e);
          }
        }

        // 解析结果
        const resultMatch = stepContent.match(/\*\*结果：\*\* \n```json\n([\s\S]*?)\n```/);
        if (resultMatch && resultMatch[1]) {
          try {
            step.toolCall.result = JSON.parse(resultMatch[1]);
          } catch (e) {
            console.error('Failed to parse tool result:', e);
          }
        }
      }

      // 解析错误
      const errorMatch = stepContent.match(/\*\*错误：\*\* ([\s\S]*?)(?=\n|$)/);
      if (errorMatch && errorMatch[1]) {
        step.error = errorMatch[1].trim();
      }

      // 检查是否完成
      if (stepContent.includes('✅ 步骤完成')) {
        step.isDone = true;
      }

      steps.push(step);
    }

    return steps;
  });

  </script>

<style scoped>
  .prose {
    max-width: none;
  }

  .prose pre {
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>