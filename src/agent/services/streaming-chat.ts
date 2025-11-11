import { Effect, Stream } from 'effect';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { OpenAIClientService } from './openai-client';

/** 流式对话数据块 */
export interface StreamChunk {
  /** 内容片段 */
  content: string;
  /** 是否为完成标记 */
  isDone: boolean;
  /** 错误信息（如果有） */
  error?: string;
  /** 时间戳 */
  timestamp: number;
}

/** 流式对话服务 */
export class StreamingChatService extends Effect.Service<StreamingChatService>()(
  'StreamingChatService',
  {
    dependencies: [OpenAIClientService.Default],
    effect: Effect.gen(function* () {
      const openAIClient = yield* OpenAIClientService;

      return {
        /**
         * 创建流式对话，返回 Effect Stream
         * @param messages 对话消息列表
         * @param options 可选参数
         */
        createStreamingChat: (
          messages: Array<ChatCompletionMessageParam>,
          options?: {
            model?: string;
            temperature?: number;
            maxTokens?: number;
            reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
            enableReasoning?: boolean;
          },
        ) =>
          Effect.gen(function* () {
            // 获取流式响应
            const streamResponse = yield* openAIClient.createStreamChatCompletion(
              messages,
              options,
            );

            // 创建异步可迭代生成器
            const asyncIterable = async function* () {
              let hasContent = false;

              try {
                for await (const chunk of streamResponse) {
                  const content = chunk.choices[0]?.delta?.content || '';
                  if (content) {
                    hasContent = true;
                    yield {
                      content,
                      isDone: false,
                      timestamp: Date.now(),
                    } as StreamChunk;
                  }

                  // 检查是否完成
                  if (chunk.choices[0]?.finish_reason) {
                    // 如果没有内容，至少返回一个完成标记
                    if (!hasContent) {
                      yield {
                        content: '',
                        isDone: true,
                        timestamp: Date.now(),
                      } as StreamChunk;
                    }
                    break;
                  }
                }
              } catch (error) {
                yield {
                  content: '',
                  isDone: true,
                  error: error instanceof Error ? error.message : String(error),
                  timestamp: Date.now(),
                } as StreamChunk;
              }
            };

            // 使用 Stream.fromAsyncIterable 创建流
            const stream = Stream.fromAsyncIterable(
              asyncIterable(),
              (error) => new Error(`Stream processing failed: ${error}`),
            );

            return stream;
          }),

        /**
         * 将流转换为累加器，逐步构建完整响应
         */
        streamToAccumulator: (stream: Stream.Stream<StreamChunk, never, never>) => {
          return Stream.scan(stream, '', (acc, chunk) => {
            if (chunk.error) {
              return acc;
            }
            return acc + chunk.content;
          });
        },
      };
    }),
  },
) {}
