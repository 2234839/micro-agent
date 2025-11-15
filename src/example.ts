import { Effect, Layer, Stream } from 'effect';
import { EnvConfigService } from './agent/config/env-config';
import { OpenAIConfigService } from './agent/config/openai-config';
import { MicroAgentService, type ApiChatMessage } from './agent/micro-agent';
import { OpenAIClientService } from './agent/services/openai-client';

/**
 * MicroAgent 实时流式输出示例
 */
const microAgentStreamingExample = Effect.gen(function* () {
  const microAgentService = yield* MicroAgentService;

  const messages: ApiChatMessage[] = [
    {
      role: 'system',
      content: '你是一个有帮助的助手，请用中文简洁地回答问题。',
      timestamp: new Date(),
    },
    { role: 'user', content: '请解释什么是人工智能？', timestamp: new Date() },
  ];

  // 创建流式对话
  const stream = yield* microAgentService.createStreamingChat(messages, {
    temperature: 0.7,
    maxTokens: 200,
  });

  // 实时流式输出
  yield* Stream.runForEach(stream, (chunk) => {
    const content = chunk.choices[0]?.delta?.content || '';
    process.stdout.write(content);
    return Effect.void;
  });
});

/**
 * 主程序：运行所有示例
 */
const program = Effect.gen(function* () {
  yield* microAgentStreamingExample;
});

/** 组合所有需要的 Layer */
const AppLive = Layer.mergeAll(
  MicroAgentService.Default,
  OpenAIClientService.Default,
  OpenAIConfigService.Default,
  EnvConfigService.Default,
);

const runnable = program.pipe(Effect.provide(AppLive));

// 运行示例
Effect.runPromise(runnable);
