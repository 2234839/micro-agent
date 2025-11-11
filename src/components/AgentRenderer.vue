<template>
  <div class="agent-renderer space-y-4">
    <!-- 渲染所有步骤 -->
    <template v-for="(step, stepIndex) in agentData.steps" :key="stepIndex">
      <!-- AI 输出内容（流式 Markdown 渲染） -->
      <div v-if="step.aiOutput" class="ai-output-block">
        <MarkdownRender
          :content="step.aiOutput"
          :code-block-stream="true"
          :viewport-priority="true"
          :custom-id="`agent-step-${stepIndex}-ai-output`"
          :key="`agent-step-${stepIndex}`" />
      </div>

      <!-- 工具调用（特殊渲染） -->
      <div v-if="step.toolCall" class="tool-call-block">
        <div
          class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
          @click="toggleToolCall(stepIndex)">
          <span class="text-sm font-medium text-gray-700">🛠️ 调用工具:</span>
          <code class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-mono">
            {{ step.toolCall.name }}
          </code>

          <!-- 展开/折叠图标 -->
          <div class="ml-auto flex items-center gap-1">
            <div v-if="step.toolCall.result" class="flex items-center gap-1">
              <div
                class="w-2 h-2 rounded-full"
                :class="{
                  'bg-green-500': step.toolCall.result.success !== false,
                  'bg-red-500': step.toolCall.result.success === false,
                }">
              </div>
              <span class="text-xs text-gray-500">
                {{ step.toolCall.result.success !== false ? '成功' : '失败' }}
              </span>
            </div>
            <svg
              class="w-4 h-4 text-gray-400 transition-transform"
              :class="{ 'rotate-90': isToolCallExpanded(stepIndex) }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <!-- 工具详情（折叠内容） -->
        <div v-show="isToolCallExpanded(stepIndex)" class="mt-2 space-y-2 pl-2 border-l-2 border-gray-200">
          <!-- 工具参数 -->
          <div v-if="Object.keys(step.toolCall.parameters).length > 0" class="space-y-1">
            <div class="text-sm font-medium text-gray-600">参数:</div>
            <div class="bg-gray-50 rounded p-2 max-h-32 overflow-y-auto">
              <pre class="text-xs text-gray-700 whitespace-pre-wrap">{{ JSON.stringify(step.toolCall.parameters, null, 2) }}</pre>
            </div>
          </div>

          <!-- 工具结果 -->
          <div v-if="step.toolCall.result" class="space-y-1">
            <div class="text-sm font-medium text-gray-600">执行结果:</div>
            <div
              class="rounded p-2 max-h-48 overflow-y-auto text-xs"
              :class="{
                'bg-green-50 text-green-800': step.toolCall.result.success !== false,
                'bg-red-50 text-red-800': step.toolCall.result.success === false,
              }">
              <pre class="whitespace-pre-wrap">{{ JSON.stringify(step.toolCall.result, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- 错误信息 -->
      <div v-if="step.error" class="error-block">
        <div class="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          <div class="font-medium text-red-800 mb-1">❌ 错误:</div>
          <div>{{ step.error }}</div>
        </div>
      </div>
    </template>

    </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { MarkdownRender } from 'vue-renderer-markdown';

  /** 工具调用展开状态管理 */
  const toolCallExpanded = ref<Record<string, boolean>>({});

  interface ToolCall {
    name: string;
    parameters: Record<string, any>;
    result: any;
  }

  interface Step {
    aiOutput: string;
    toolCall?: ToolCall;
    error?: string;
  }

  interface AgentData {
    steps: Step[];
  }

  const props = defineProps<{
    content: string; // JSON string of AgentData
  }>();

  /** 解析Agent数据 */
  const agentData = ref<AgentData>({ steps: [] });

  // 监听内容变化，解析JSON数据
  import { watch } from 'vue';
  watch(() => props.content, (newContent) => {
    try {
      agentData.value = JSON.parse(newContent);
    } catch (e) {
      console.error('Failed to parse agent data:', e);
      agentData.value = { steps: [] };
    }
  }, { immediate: true });

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
</script>

<style scoped>
  .agent-renderer {
    max-width: none;
  }

  .ai-output-block {
    margin-bottom: 1rem;
  }

  .tool-call-block {
    margin-bottom: 1rem;
  }

  .error-block {
    margin-bottom: 1rem;
  }

  .final-answer-block {
    margin-top: 1rem;
  }

  .prose {
    max-width: none;
  }

  .prose pre {
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>