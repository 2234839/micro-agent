import { Effect, Stream } from 'effect';
import { StreamingChatService } from './services/streaming-chat';
import type { StreamChunk } from './services/streaming-chat';

/** 聊天消息接口 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  reasoning_content?: string;
}

/** Micro Agent 服务 */
export class MicroAgentService extends Effect.Service<MicroAgentService>()('MicroAgentService', {
  dependencies: [StreamingChatService.Default],
  effect: Effect.gen(function* () {
    const streamingService = yield* StreamingChatService;

    return {
      /**
       * 创建流式聊天对话
       */
      createStreamingChat: (
        messages: Array<ChatMessage>,
        options?: {
          enableReasoning?: boolean;
          temperature?: number;
          maxTokens?: number;
        },
      ) =>
        Effect.gen(function* () {
          // 将 ChatMessage 转换为 OpenAI 格式
          const openaiMessages = messages.map((msg) => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content,
          }));

          // 创建流式对话
          const stream = yield* streamingService.createStreamingChat(openaiMessages, {
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
          });

          // 直接返回 StreamChunk 流，接口更简洁
          return stream;
        }),

      /**
       * 创建完整响应聊天（收集所有流数据）
       */
      createCompleteChat: (
        messages: Array<ChatMessage>,
        options?: {
          enableReasoning?: boolean;
          temperature?: number;
          maxTokens?: number;
        },
      ) =>
        Effect.gen(function* () {
          const self = yield* MicroAgentService;
          const stream = yield* self.createStreamingChat(messages, options);
          const accumulatorStream = Stream.map(stream, (chunk) => chunk.content);
          const results = yield* Stream.runCollect(accumulatorStream);
          const resultArray = Array.from(results);
          return resultArray[resultArray.length - 1] || '';
        }),
    };
  }),
}) {}
