<script setup lang="ts">
// 主页组件
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50">
    <!-- 主要内容区域 -->
    <main class="flex-1 py-3 px-4">
      <div class="max-w-7xl mx-auto">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-gray-800 mb-4">欢迎使用 Micro Agent</h1>
          <p class="text-gray-600 mb-6">一个基于 Vue 3 的轻量级组件库</p>

          <div class="flex justify-center gap-4 mb-8">
            <router-link
              to="/demo"
              class="inline-flex items-center gap-2 text-blue-600 no-underline py-2 px-4 border border-blue-600 rounded-lg transition-all duration-300 bg-blue-600/10 hover:bg-blue-600 hover:text-white hover:-translate-y-0.5 hover:shadow-lg">
              📦 查看组件库演示
            </router-link>
            <router-link
              to="/test"
              class="inline-flex items-center gap-2 text-green-600 no-underline py-2 px-4 border border-green-600 rounded-lg transition-all duration-300 bg-green-600/10 hover:bg-green-600 hover:text-white hover:-translate-y-0.5 hover:shadow-lg">
              🧪 测试 Micro Agent
            </router-link>
          </div>
        </div>

        <!-- 特性介绍 -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800 mb-2">🎨 现代化设计</h3>
            <p class="text-gray-600">基于 Tailwind CSS 的现代化组件设计，支持响应式布局</p>
          </div>

          <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800 mb-2">⚡ TypeScript 支持</h3>
            <p class="text-gray-600">完整的 TypeScript 类型定义，提供更好的开发体验</p>
          </div>

          <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800 mb-2">🔧 易于使用</h3>
            <p class="text-gray-600">简洁的 API 设计，支持按需导入和全局注册</p>
          </div>
        </div>
      </div>
    </main>

    <!-- 底部 -->
    <footer class="bg-gray-800 text-white py-6 px-4 mt-auto">
      <div class="max-w-6xl mx-auto text-center">
        <p class="text-sm opacity-80">
          Micro Agent © 2024 |
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener"
            class="text-blue-400 hover:text-blue-300 transition-colors">
            GitHub
          </a>
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
  /* 滚动条样式 */
  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: #f3f4f6;
  }

  ::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 9999px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>