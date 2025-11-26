# micro agent

> 一个微小而完备，可以方便嵌入到任何地方帮您干活的强大 agent 

- 禁止执行 dev 进行测试，可以使用 tsc 检测类型问题
- tailwindcss 不要使用 @apply ，组件化永远是更优选择
- 请使用 Effect ts 这个库来实现所有能用他实现的功能
- 运行 `pnpm tsc` 来确保编写的程序不存在显而易见的bug
- 运行 `pnpm tse ts文件路径.ts` 来执行单个ts文件
- 绝对禁止 runnable as Effect.Effect<void, never, never> 这种 as 类型写法，这是在掩耳盗铃的破坏程序类型安全

- 使用 mcp vite-vue-dev 访问运行时的 vue 的相关状态 