import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import VueDevTools from 'vite-plugin-vue-devtools'
import monacoEditorPlugin from 'vite-plugin-monaco-editor-esm'
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
  ],
  worker: {
    format: 'es',
  },
})
