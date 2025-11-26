import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import VueDevTools from 'vite-plugin-vue-devtools'
import monacoEditorPlugin from 'vite-plugin-monaco-editor-esm'
import { ViteMcp } from 'vite-plugin-mcp'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VueDevTools(),
    monacoEditorPlugin({
      languageWorkers: [
        'editorWorkerService',
        'typescript',
        'css',
        'html',
        'json',
      ],
      customDistPath(_root, buildOutDir, _base) {
        return path.resolve(buildOutDir, 'monacoeditorwork')
      },
    }),
    ViteMcp({
      // 为 Claude Code 更新配置
      updateConfig: 'claude-code',
      // 自定义服务器名称
      updateConfigServerName: 'micro-agent-dev',
      // 打印 URL 以便调试
      printUrl: true,
    }),
  ],
  worker: {
    format: 'es',
  },
})
