import { ref } from 'vue';
import { useIntervalFn, whenever } from '@vueuse/core';
import { Effect, Stream, Layer } from 'effect';
import { OpenAIConfigService } from '../agent/config/openai-config';
import { EnvConfigService } from '../agent/config/env-config';
import { OpenAIClientService } from '../agent/services/openai-client';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';

/** Token 速度测试结果接口 */
export interface TokenTestResult {
  id: string;
  timestamp: Date;
  status: 'running' | 'completed' | 'error';
  message: string;
  tokens: number; // 估算的 token 数
  actualTokens?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  firstTokenTime?: number; // 首次响应时间（毫秒）
  duration: number; // 总耗时（毫秒）
  tokensPerSecond: number; // 总速度 tokens/s (包括首次响应时间)
  outputSpeed?: number; // 纯输出速度 tokens/s (不包括首次响应时间)
  chunks: Array<{
    timestamp: number;
    content: string;
    tokenCount: number;
  }>;
}

/** Token 速度测试配置接口 */
export interface TokenTestConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

/** Token 速度测试选项 */
export interface TokenTestOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * Token 速度测试 Composable Hook
 * 提供完整的 token 速度测试功能，包括实时速度监控和准确 token 统计
 */
export function useTokenSpeedTest() {
  /** 测试状态管理 */
  const isLoading = ref(false);
  const error = ref('');
  const testResults = ref<TokenTestResult[]>([]);

  /** 实时数据 */
  const currentTokens = ref(0);
  const currentSpeed = ref(0);
  const currentElapsedTime = ref(0);
  const currentTestStartTime = ref(0);

  /** 使用 VueUse 的 useIntervalFn 创建速度更新定时器 */
  const { pause: pauseSpeedUpdate, resume: resumeSpeedUpdate } = useIntervalFn(() => {
    if (currentTestStartTime.value > 0) {
      currentElapsedTime.value = Date.now() - currentTestStartTime.value;
      if (currentTokens.value > 0 && currentElapsedTime.value > 0) {
        currentSpeed.value = Math.round((currentTokens.value * 1000) / currentElapsedTime.value * 10) / 10;
      }
    }
  }, 100, { immediate: false });

  /**
   * 计算字符数（简单估算为token数）
   * @param text 要估算的文本
   * @returns 估算的 token 数量
   */
  const estimateTokenCount = (text: string): number => {
    // 简单的token估算：中文字符1个token，英文单词平均1.3个token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = text.replace(/[\u4e00-\u9fff]/g, '').trim().split(/\s+/).filter(word => word.length > 0).length;
    return Math.ceil(chineseChars + englishWords * 1.3);
  };

  /**
   * 开始 token 速度测试
   * @param message 测试消息
   * @param config API 配置
   * @param options 测试选项
   */
  const startTokenSpeedTest = async (
    message: string,
    config: TokenTestConfig,
    options: TokenTestOptions = {}
  ): Promise<void> => {
    if (!message.trim() || isLoading.value) {
      return;
    }

    // 验证配置
    if (!config.apiKey || !config.model) {
      error.value = '请先配置 API Key 和模型';
      return;
    }

    isLoading.value = true;
    error.value = '';

    // 重置实时数据
    currentTokens.value = 0;
    currentSpeed.value = 0;
    currentElapsedTime.value = 0;
    currentTestStartTime.value = Date.now();

    // 启动实时速度更新
    resumeSpeedUpdate();

    const testId = Date.now().toString();
    const startTime = Date.now();

    const newTest: TokenTestResult = {
      id: testId,
      timestamp: new Date(),
      status: 'running',
      message: message.trim(),
      tokens: 0,
      actualTokens: undefined,
      firstTokenTime: undefined,
      duration: 0,
      tokensPerSecond: 0,
      outputSpeed: undefined,
      chunks: [],
    };

    testResults.value.unshift(newTest);

    try {
      const chatLayer = OpenAIClientService.Default.pipe(
        Layer.provide(OpenAIConfigService.Default),
        Layer.provide(EnvConfigService.Default),
      );

      const apiMessages: Array<{ role: 'user'; content: string }> = [
        { role: 'user', content: message.trim() }
      ];

      const chatProgram = Effect.gen(function* () {
        const openAIClientService = yield* OpenAIClientService;
        const stream = yield* openAIClientService.createStreamChatCompletion(apiMessages, {
          temperature: options.temperature ?? 0.7,
          maxTokens: options.maxTokens,
        });

        let totalTokens = 0;
        let accumulatedContent = '';
        let firstTokenReceived = false;

        // 使用 Stream.runForEach 处理流式响应
        yield* Stream.runForEach(stream, (chunk: ChatCompletionChunk) => {
          return Effect.sync(() => {
            const content = chunk.choices[0]?.delta?.content || '';

            // 处理 usage 数据（通常在最后一个 chunk 中）
            if (chunk.usage) {
              newTest.actualTokens = {
                promptTokens: chunk.usage.prompt_tokens,
                completionTokens: chunk.usage.completion_tokens,
                totalTokens: chunk.usage.total_tokens,
              };

              // 如果有准确的 token 数据，使用它来更新显示
              if (chunk.usage.completion_tokens) {
                currentTokens.value = chunk.usage.completion_tokens;
                newTest.tokens = chunk.usage.completion_tokens;

                const currentDuration = Date.now() - startTime;
                newTest.duration = currentDuration;
                if (chunk.usage.completion_tokens > 0 && currentDuration > 0) {
                  newTest.tokensPerSecond = Math.round((chunk.usage.completion_tokens * 1000) / currentDuration * 10) / 10;
                }
              }
            }

            if (content) {
              // 记录首次响应时间
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                newTest.firstTokenTime = Date.now() - startTime;
              }

              accumulatedContent += content;
              const tokenCount = estimateTokenCount(content);

              // 只有在没有准确 token 数据时才使用估算值
              if (!newTest.actualTokens) {
                totalTokens += tokenCount;

                // 更新实时数据
                currentTokens.value = totalTokens;

                // 记录chunk数据
                newTest.chunks.push({
                  timestamp: Date.now() - startTime,
                  content: content,
                  tokenCount: tokenCount,
                });

                // 更新测试结果
                newTest.tokens = totalTokens;
                const currentDuration = Date.now() - startTime;
                newTest.duration = currentDuration;
                if (totalTokens > 0 && currentDuration > 0) {
                  newTest.tokensPerSecond = Math.round((totalTokens * 1000) / currentDuration * 10) / 10;
                }
              } else {
                // 即使有准确 token 数据，也记录 chunk 内容用于分析
                newTest.chunks.push({
                  timestamp: Date.now() - startTime,
                  content: content,
                  tokenCount: tokenCount, // 保留估算值用于对比
                });
              }
            }
          });
        });

        return totalTokens;
      });

      const finalTokens = await Effect.runPromise(chatProgram.pipe(Effect.provide(chatLayer)));

      // 完成测试
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      newTest.status = 'completed';
      newTest.duration = totalDuration;
      newTest.tokens = finalTokens;

      // 计算总速度（包括首次响应时间）
      newTest.tokensPerSecond = finalTokens > 0 ? Math.round((finalTokens * 1000) / totalDuration * 10) / 10 : 0;

      // 计算纯输出速度（不包括首次响应时间）
      if (newTest.firstTokenTime && finalTokens > 0) {
        const outputDuration = totalDuration - newTest.firstTokenTime;
        newTest.outputSpeed = outputDuration > 0 ? Math.round((finalTokens * 1000) / outputDuration * 10) / 10 : 0;
      }

    } catch (err) {
      console.error('Token speed test error:', err);
      error.value = err instanceof Error ? err.message : '测试失败';
      newTest.status = 'error';
      newTest.duration = Date.now() - startTime;
    } finally {
      isLoading.value = false;

      // 停止实时速度更新
      pauseSpeedUpdate();
    }
  };

  /**
   * 清空测试结果
   */
  const clearResults = (): void => {
    testResults.value = [];
    error.value = '';
    currentTokens.value = 0;
    currentSpeed.value = 0;
    currentElapsedTime.value = 0;
    currentTestStartTime.value = 0;
  };

  /**
   * 格式化时间显示
   * @param ms 毫秒数
   * @returns 格式化的时间字符串
   */
  const formatDuration = (ms: number): string => {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      return `${(ms / 60000).toFixed(1)}m`;
    }
  };

  /**
   * 格式化速度显示
   * @param tokensPerSecond 每秒 token 数
   * @returns 格式化的速度字符串
   */
  const formatSpeed = (tokensPerSecond: number): string => {
    if (tokensPerSecond < 1000) {
      return `${tokensPerSecond.toFixed(1)} token/s`;
    } else {
      return `${(tokensPerSecond / 1000).toFixed(2)}k token/s`;
    }
  };

  return {
    // 状态
    isLoading,
    error,
    testResults,
    currentTokens,
    currentSpeed,
    currentElapsedTime,

    // 方法
    startTokenSpeedTest,
    clearResults,
    formatDuration,
    formatSpeed,

    // 工具方法
    estimateTokenCount,
  };
}