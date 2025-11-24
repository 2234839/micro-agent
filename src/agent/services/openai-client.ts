import { Effect, Stream } from 'effect';
import { OpenAI } from 'openai';
import type {
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';
import { OpenAIConfigService } from '../config/openai-config';

/** OpenAI 客户端服务 */
export class OpenAIClientService extends Effect.Service<OpenAIClientService>()(
  'OpenAIClientService',
  {
    dependencies: [OpenAIConfigService.Default],
    effect: Effect.gen(function* () {
      const config = yield* OpenAIConfigService;

      const openAI = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        // TODO 仅用于开发环境！生产环境应该使用后端代理
        dangerouslyAllowBrowser: true,
      });

      return {
        client: openAI,
        config: config,
        /** 创建流式聊天完成请求，返回 Effect Stream */
        createStreamChatCompletion: (
          messages: Array<ChatCompletionMessageParam>,
          options?: {
            model?: string;
            temperature?: number;
            maxTokens?: number;
            reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
            enableReasoning?: boolean;
            tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }>;
            toolChoice?: 'auto' | 'none';
            signal?: AbortSignal;
          },
        ): Effect.Effect<Stream.Stream<ChatCompletionChunk, Error>, Error, never> =>
          Effect.gen(function* () {
            const params: ChatCompletionCreateParams & { stream: true } = {
              model: (options?.model || config.model) as ChatCompletionCreateParams['model'],
              messages,
              temperature: options?.temperature ?? config.temperature,
              max_tokens: options?.maxTokens ?? config.maxTokens,
              stream: true,
              // @ts-ignore glm 模型的专属配置参数
              thinking: {
                type: options?.enableReasoning ? ('enabled' as const) : ('disabled' as const),
              },
            };

            // 添加工具支持
            if (options?.tools && options.tools.length > 0) {
              params.tools = options.tools;
              params.tool_choice = options?.toolChoice || 'auto';
            }

            // 某些 API（如 OpenAI 的 reasoning 模型）支持 reasoning_effort 参数
            const modelToCheck = options?.model || config.model;
            const reasoningEffort = options?.reasoningEffort ?? config.reasoningEffort;
            if (
              reasoningEffort &&
              ['o1-preview', 'o1-mini'].some((model) => modelToCheck.includes(model))
            ) {
              // 使用类型断言来处理 OpenAI API 的扩展参数
              (params as { reasoning_effort?: string }).reasoning_effort = reasoningEffort;
            }

            // 获取原生流响应，支持中断
            const streamResponse = yield* Effect.tryPromise({
              try: () => {
                // OpenAI 的 create 方法支持在第二个参数中传递 signal
                return openAI.chat.completions.create(params, {
                  signal: options?.signal,
                });
              },
              catch: (error) => {
                // 检查是否是用户主动取消
                if (error instanceof Error && error.name === 'AbortError') {
                  return new Error('Stream was aborted');
                }
                return new Error(`OpenAI API Error: ${error}`);
              },
            });

            // 创建异步可迭代生成器，支持中断
            async function* asyncIterable() {
              try {
                for await (const chunk of streamResponse) {
                  yield chunk;
                }
              } catch (error: unknown) {
                // 如果是中断错误，直接重新抛出让 Effect 处理
                if (error instanceof Error && error.name === 'AbortError') {
                  throw new Error('Stream was aborted');
                }
                throw error;
              }
            }

            // 使用 Stream.fromAsyncIterable 创建 Effect Stream
            const stream = Stream.fromAsyncIterable(
              asyncIterable(),
              (error: unknown) => new Error(`Stream processing failed: ${String(error)}`),
            );

            return stream;
          }),
      };
    }),
  },
) {}
