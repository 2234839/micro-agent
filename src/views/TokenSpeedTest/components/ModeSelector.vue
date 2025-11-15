<script setup lang="ts">
  /** 模式选择器组件 */
  interface Props {
    modelValue: 'single' | 'batch';
  }

  interface Emits {
    (e: 'update:modelValue', value: 'single' | 'batch'): void;
  }

  defineProps<Props>();
  defineEmits<Emits>();
</script>

<template>
  <div class="flex justify-center gap-4">
    <button
      @click="$emit('update:modelValue', 'single')"
      :class="[
        'px-6 py-2 rounded-lg font-medium transition-colors',
        modelValue === 'single'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      ]">
      单个测试
    </button>
    <button
      @click="$emit('update:modelValue', 'batch')"
      :class="[
        'px-6 py-2 rounded-lg font-medium transition-colors',
        modelValue === 'batch'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      ]">
      批量测试
    </button>
  </div>
</template>