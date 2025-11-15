<script setup lang="ts">
  import { computed } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import BaseButton from '../components/BaseButton.vue';
  import { useOpenAIConfig } from '../composables/useOpenAIConfig';

  const route = useRoute();
  const router = useRouter();

  // 使用 OpenAI 配置 hook
  const {
    apiKey,
    model,
    baseUrl,
    showSettings,
    saveConfig,
    hasValidConfig
  } = useOpenAIConfig();

  /** 计算页面标题 */
  const pageTitle = computed(() => {
    return route.meta?.title as string || 'Micro Agent';
  });

  /** 计算是否显示返回按钮 */
  const showBackButton = computed(() => {
    return route.meta?.showBackButton as boolean || false;
  });

  /** 计算是否显示设置按钮 */
  const showSettingsButton = computed(() => {
    return route.meta?.showSettingsButton as boolean || false;
  });

  /** 计算是否显示清空按钮 */
  const showClearButton = computed(() => {
    return route.meta?.showClearButton as boolean || false;
  });

  /** 处理返回按钮点击 */
  const handleBackClick = () => {
    if (window.history.length > 1) {
      router.go(-1);
    } else {
      router.push('/');
    }
  };

  /** 处理清空按钮点击 */
  const handleClearClick = () => {
    // 触发路由事件的清空操作
    // 通过全局事件总线或者路由 params 传递
    const currentComponent = route.meta?.component;
    if (currentComponent && typeof (currentComponent as any).clear === 'function') {
      (currentComponent as any).clear();
    }
  };

  /** 处理设置按钮点击 */
  const handleSettingsClick = () => {
    showSettings.value = true;
  };
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-50">
    <!-- 顶部导航栏 -->
    <header class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
      <div class="flex items-center gap-3">
        <!-- 返回按钮 -->
        <BaseButton
          v-if="showBackButton"
          variant="outline"
          size="small"
          @click="handleBackClick">
          ← 返回
        </BaseButton>
        <h1 class="text-lg font-semibold text-gray-800">{{ pageTitle }}</h1>
      </div>

      <!-- 右侧按钮组 -->
      <div class="flex items-center gap-2">
        <!-- 清空按钮 -->
        <BaseButton
          v-if="showClearButton"
          variant="outline"
          size="small"
          @click="handleClearClick">
          清空
        </BaseButton>

        <!-- 设置按钮 -->
        <BaseButton
          v-if="showSettingsButton"
          variant="outline"
          size="small"
          @click="handleSettingsClick">
          ⚙️ 设置
        </BaseButton>
      </div>
    </header>

    <!-- 主要内容区域 - 路由视图 -->
    <main class="flex-1 overflow-hidden">
      <router-view />
    </main>

    <!-- 设置对话框 - 全局共享 -->
    <div
      v-if="showSettings"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="showSettings = false">
      <div class="bg-white rounded-lg p-6 w-full max-w-md" @click.stop>
        <h3 class="text-lg font-semibold mb-4">API 设置</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              v-model="apiKey"
              type="password"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入您的 API Key" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">模型</label>
            <input
              v-model="model"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="gpt-3.5-turbo" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
            <input
              v-model="baseUrl"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://api.openai.com/v1" />
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <BaseButton variant="outline" @click="showSettings = false"> 取消 </BaseButton>
          <BaseButton variant="primary" @click="saveConfig"> 保存 </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 确保布局正确 */
main {
  display: flex;
  flex-direction: column;
}
</style>