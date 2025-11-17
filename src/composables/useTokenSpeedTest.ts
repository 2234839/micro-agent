import { ref } from 'vue';
import { Effect, Stream, Layer } from 'effect';
import { OpenAIConfigService } from '../agent/config/openai-config';
import { EnvConfigService } from '../agent/config/env-config';
import { OpenAIClientService } from '../agent/services/openai-client';

/** Token 速度测试配置接口 */
export interface TokenTestConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

/**
 * Token 速度测试 Composable Hook
 * 极简版本的 token 速度测试功能
 */
export function useTokenSpeedTest() {
  const isLoading = ref(false);
  const error = ref('');
  const currentTokens = ref(0);
  const currentSpeed = ref(0);
  const currentElapsedTime = ref(0);
  let startTime = 0;

  /** 速度更新定时器 */
  let updateTimer: NodeJS.Timeout | null = null;

  /** 启动速度更新 */
  const startSpeedUpdate = () => {
    updateTimer = setInterval(() => {
      currentElapsedTime.value = Date.now() - startTime;
      if (currentTokens.value > 0 && currentElapsedTime.value > 0) {
        currentSpeed.value = Math.round((currentTokens.value * 1000) / currentElapsedTime.value * 10) / 10;
      }
    }, 100);
  };

  /** 停止速度更新 */
  const stopSpeedUpdate = () => {
    if (updateTimer) {
      clearInterval(updateTimer);
      updateTimer = null;
    }
  };

  /** 简单的 token 估算 */
  const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4); // 简单估算：4个字符约等于1个token
  };

  /** 开始 token 速度测试 */
  const startTokenSpeedTest = async (message: string, config: TokenTestConfig): Promise<void> => {
    if (!message.trim() || isLoading.value) return;

    if (!config.apiKey || !config.model) {
      error.value = '请先配置 API Key 和模型';
      return;
    }

    isLoading.value = true;
    error.value = '';
    currentTokens.value = 0;
    currentSpeed.value = 0;
    startTime = Date.now();

    const testId = Date.now().toString();
    let firstTokenTime: number | undefined;
    let totalTokens = 0;

    startSpeedUpdate();

    try {
      const chatLayer = OpenAIClientService.Default.pipe(
        Layer.provide(OpenAIConfigService.Default),
        Layer.provide(EnvConfigService.Default),
      );

      const messages = [{ role: 'user' as const, content: message.trim() }];

      const chatProgram = Effect.gen(function* () {
        const openAIClientService = yield* OpenAIClientService;
        const stream = yield* openAIClientService.createStreamChatCompletion(messages, {
          temperature: 0.7,
          maxTokens: 500,
        });

        yield* Stream.runForEach(stream, (chunk) => {
          return Effect.sync(() => {
            const content = chunk.choices[0]?.delta?.content || '';

            if (content) {
              if (!firstTokenTime) {
                firstTokenTime = Date.now() - startTime;
              }

              const tokenCount = estimateTokens(content);
              totalTokens += tokenCount;
              currentTokens.value = totalTokens;

              // 使用 API 返回的准确 token 数据（如果有的话）
              if (chunk.usage?.completion_tokens) {
                currentTokens.value = chunk.usage.completion_tokens;
                totalTokens = chunk.usage.completion_tokens;
              }
            }
          });
        });
      });

      await Effect.runPromise(chatProgram.pipe(Effect.provide(chatLayer)));

      const endTime = Date.now();

    } catch (err) {
      console.error('Token speed test error:', err);
      error.value = err instanceof Error ? err.message : '测试失败';
    } finally {
      isLoading.value = false;
      stopSpeedUpdate();
    }
  };

  
  /** 格式化时间显示 */
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  /** 格式化速度显示 */
  const formatSpeed = (tokensPerSecond: number): string => {
    if (tokensPerSecond < 1000) return `${tokensPerSecond.toFixed(0)}/s`;
    return `${(tokensPerSecond / 1000).toFixed(1)}k/s`;
  };

  return {
    // 状态
    isLoading,
    error,
    currentTokens,
    currentSpeed,
    currentElapsedTime,

    // 方法
    startTokenSpeedTest,
    formatDuration,
    formatSpeed,
    estimateTokens,
  };
}