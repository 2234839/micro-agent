<script setup lang="ts">
  /** 单个测试表单组件 */
  import { ref } from 'vue';
  import BaseButton from '../../../components/BaseButton.vue';

  interface Props {
    isLoading: boolean;
    disabled?: boolean;
  }

  interface Emits {
    (e: 'start-test', message: string): void;
    (e: 'clear-test'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const testMessage = ref('');

  const handleStartTest = () => {
    if (testMessage.value.trim() && !props.isLoading) {
      emit('start-test', testMessage.value);
    }
  };

  const handleClearTest = () => {
    testMessage.value = '';
    emit('clear-test');
  };
</script>

<template>
  <div class="space-y-4">
    <!-- 测试消息输入 -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">测试消息</label>
      <textarea
        v-model="testMessage"
        :disabled="isLoading || disabled"
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
        rows="6"
        placeholder="输入您想要测试的消息内容..." />
      <div class="mt-1 text-xs text-gray-500 text-right">
        {{ testMessage.length }} 字符
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="flex gap-3">
      <BaseButton
        variant="primary"
        @click="handleStartTest"
        :disabled="isLoading || !testMessage.trim() || disabled"
        class="flex-1">
        {{ isLoading ? '测试中...' : '开始测试' }}
      </BaseButton>

      <BaseButton
        variant="outline"
        @click="handleClearTest"
        :disabled="isLoading"
        class="px-6">
        清空
      </BaseButton>
    </div>
  </div>
</template>