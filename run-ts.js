#!/usr/bin/env node

/**
 * 使用 Vite ModuleRunner 运行 TypeScript 文件
 */

import { createServer } from 'vite'

/**
 * 使用 Vite 运行 TypeScript 文件
 */
async function runTypeScriptFile(filePath) {
  // 创建 Vite 服务器
  const server = await createServer({
    server: { hmr: false },
    logLevel: 'silent',
  })

  try {
    // 使用 Vite 的 SSR 功能加载并执行模块
    await server.ssrLoadModule(filePath)
  } finally {
    // 清理资源
    await server.close()
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    process.exit(1)
  }

  const filePath = args[0]

  try {
    await runTypeScriptFile(filePath)
  } catch (error) {
    process.exit(1)
  }
}

// 运行主函数
main().catch(() => {})