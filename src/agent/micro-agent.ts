import { Effect, Stream } from 'effect';
import { StreamingChatService } from './services/streaming-chat';

/** 聊天消息接口 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  reasoning_content?: string;
}

/** 流式响应数据接口 */
export interface StreamResponse {
  content: string;
  reasoningContent?: string;
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

/** Micro Agent 服务 */
export class MicroAgentService extends Effect.Service<MicroAgentService>()(
  'MicroAgentService',
  {
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
          }
        ) =>
          Effect.gen(function* () {
            // 将 ChatMessage 转换为 OpenAI 格式
            const openaiMessages = messages.map(msg => ({
              role: msg.role as 'system' | 'user' | 'assistant',
              content: msg.content
            }));

            // 创建流式对话
            const stream = yield* streamingService.createStreamingChat(openaiMessages, {
              temperature: options?.temperature,
              maxTokens: options?.maxTokens
            });

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
          }
        ) =>
          Effect.gen(function* () {
            const stream = yield* createStreamingChat(messages, options);
            const accumulatorStream = Stream.map(stream, (response) => response.content);
            const results = yield* Stream.runCollect(accumulatorStream);
            const resultArray = Array.from(results);
            return resultArray[resultArray.length - 1] || '';
          }),

        /**
         * 处理流式对话并提供回调
         */
        processStreamingChat: (
          messages: Array<ChatMessage>,
          callbacks: {
            onChunk?: (response: StreamResponse) => void;
            onComplete?: (finalResponse: string) => void;
            onError?: (error: string) => void;
          },
          options?: {
            enableReasoning?: boolean;
            temperature?: number;
            maxTokens?: number;
          }
        ) =>
          Effect.gen(function* () {
            const stream = yield* createStreamingChat(messages, options);
            let fullContent = '';

            yield* Stream.runForEach(stream, (response) => {
              if (response.error) {
                callbacks.onError?.(response.error);
              }

              if (response.content) {
                fullContent = response.content;
                callbacks.onChunk?.(response);
              }

              if (response.finishReason === 'stop') {
                callbacks.onComplete?.(fullContent);
              }

              return Effect.void;
            });
          }),
      };

      function createStreamingChat(
        messages: Array<ChatMessage>,
        options?: {
          enableReasoning?: boolean;
          temperature?: number;
          maxTokens?: number;
        }
      ) {
        return Effect.gen(function* () {
          // 将 ChatMessage 转换为 OpenAI 格式
          const openaiMessages = messages.map(msg => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content
          }));

          // 创建流式对话
          const stream = yield* streamingService.createStreamingChat(openaiMessages, {
            temperature: options?.temperature,
            maxTokens: options?.maxTokens
          });

          // 将流转换为响应格式
          const responseStream = Stream.map(stream, (chunk) => {
            return {
              content: chunk.content,
              reasoningContent: options?.enableReasoning ? '' : undefined,
              finishReason: chunk.isDone ? 'stop' : 'in_progress',
              usage: {
                promptTokens: 0, // 简化实现
                completionTokens: chunk.content.length,
                totalTokens: chunk.content.length
              },
              error: chunk.error,
              isDone: chunk.isDone
            } as StreamResponse & { error?: string; isDone: boolean };
          });

          return responseStream;
        });
      }
    }),
  },
) {}