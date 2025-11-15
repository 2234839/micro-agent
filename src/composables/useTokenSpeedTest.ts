import { ref, reactive } from 'vue';
import { useIntervalFn, whenever } from '@vueuse/core';
import { Effect, Stream, Layer } from 'effect';
import { OpenAIConfigService } from '../agent/config/openai-config';
import { EnvConfigService } from '../agent/config/env-config';
import { OpenAIClientService } from '../agent/services/openai-client';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import type { TestCase, TestMode } from '../config/test-cases';

/** Token 速度测试结果接口 */
export interface TokenTestResult {
  id: string;
  testCaseId: string; // 测试用例 ID
  testCaseName: string; // 测试用例名称
  testCaseDescription: string; // 测试用例描述
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

/** 批量测试结果接口 */
export interface BatchTestResult {
  suiteId: string;
  testMode: TestMode;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  results: TokenTestResult[];
  summary?: {
    totalTests: number;
    completedTests: number;
    failedTests: number;
    avgFirstTokenTime?: number;
    avgTotalSpeed?: number;
    avgOutputSpeed?: number;
    totalDuration?: number;
  };
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

  /** 批量测试状态管理 */
  const isBatchLoading = ref(false);
  const batchError = ref('');
  const batchResults = ref<BatchTestResult[]>([]);
  const currentBatchTest = ref<BatchTestResult | null>(null);

  /** 实时测试状态跟踪 */
  const activeTests = ref<
    Map<
      string,
      {
        testCaseId: string;
        testCaseName: string; // 直接存储测试用例名称
        status: 'running' | 'completed' | 'error';
        tokens: number; // 估算的 token 数
        actualTokens?: {
          promptTokens?: number;
          completionTokens?: number;
          totalTokens?: number;
        }; // API返回的实际token数量
        speed: number;
        firstTokenTime?: number;
        startTime: number;
        currentSpeed: number;
        actualDuration: number; // 实际测试持续时间，未完成时为当前运行时间
        historyData: Array<{
          time: number;
          totalSpeed: number;
          currentSpeed: number;
          outputSpeed: number;
        }>;
      }
    >
  >(new Map());

  /** 实时数据 */
  const currentTokens = ref(0);
  const currentSpeed = ref(0);
  const currentElapsedTime = ref(0);
  const currentTestStartTime = ref(0);

  /** 使用 VueUse 的 useIntervalFn 创建速度更新定时器 */
  const { pause: pauseSpeedUpdate, resume: resumeSpeedUpdate } = useIntervalFn(
    () => {
      if (currentTestStartTime.value > 0) {
        currentElapsedTime.value = Date.now() - currentTestStartTime.value;
        if (currentTokens.value > 0 && currentElapsedTime.value > 0) {
          currentSpeed.value =
            Math.round(((currentTokens.value * 1000) / currentElapsedTime.value) * 10) / 10;
        }
      }
    },
    100,
    { immediate: false },
  );

  /**
   * 计算字符数（简单估算为token数）
   * @param text 要估算的文本
   * @returns 估算的 token 数量
   */
  const estimateTokenCount = (text: string): number => {
    // 更精确的token估算：中文字符0.7个token，英文单词平均1.3个token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = text
      .replace(/[\u4e00-\u9fff]/g, '')
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    return Math.ceil(chineseChars * 0.7 + englishWords * 1.3);
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
    options: TokenTestOptions = {},
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
      testCaseId: 'custom',
      testCaseName: '自定义测试',
      testCaseDescription: message.trim(),
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
        { role: 'user', content: message.trim() },
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
                // 确保持续时间至少为1ms，避免除零错误
                const safeCurrentDuration = Math.max(currentDuration, 1);
                if (chunk.usage.completion_tokens > 0) {
                  newTest.tokensPerSecond =
                    Math.round(((chunk.usage.completion_tokens * 1000) / safeCurrentDuration) * 10) / 10;
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
                // 确保持续时间至少为1ms，避免除零错误
                const safeCurrentDuration = Math.max(currentDuration, 1);
                if (totalTokens > 0) {
                  newTest.tokensPerSecond =
                    Math.round(((totalTokens * 1000) / safeCurrentDuration) * 10) / 10;
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

      // 使用 completionTokens 计算总速度（包括首次响应时间），如果没有则回退到计算的 tokens
      const tokensForSpeed = newTest.actualTokens?.completionTokens || finalTokens || 0;
      newTest.tokensPerSecond =
        tokensForSpeed > 0
          ? Math.round(((tokensForSpeed * 1000) / totalDuration) * 10) / 10
          : 0;

      // 计算纯输出速度（不包括首次响应时间）
      const outputTokens = tokensForSpeed;
      if (newTest.firstTokenTime && outputTokens > 0) {
        const outputDuration = totalDuration - newTest.firstTokenTime;
        // 确保输出时间至少为1ms，避免除零错误
        const safeOutputDuration = Math.max(outputDuration, 1);
        newTest.outputSpeed = Math.round(((outputTokens * 1000) / safeOutputDuration) * 10) / 10;
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
   * 运行单个测试用例
   * @param testCase 测试用例
   * @param config API 配置
   * @param onRealTimeUpdate 实时更新回调
   * @returns 测试结果 Promise
   */
  const runSingleTest = async (
    testCase: TestCase,
    config: TokenTestConfig,
    onRealTimeUpdate?: (
      testId: string,
      data: {
        tokens: number;
        speed: number;
        firstTokenTime?: number;
        status?: 'running' | 'completed' | 'error';
      },
    ) => void,
  ): Promise<TokenTestResult> => {
    const testId = `${testCase.id}-${Date.now()}`;
    const startTime = Date.now();

    // 初始化实时状态 - 使用 reactive
    const realtimeData = reactive({
      testCaseId: testCase.id,
      testCaseName: testCase.name, // 直接存储测试用例名称
      status: 'running' as 'running' | 'completed' | 'error',
      tokens: 0, // 估算的 token 数
      actualTokens: undefined as
        | {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
          }
        | undefined, // API返回的实际token数量
      speed: 0,
      firstTokenTime: undefined as number | undefined,
      startTime,
      currentSpeed: 0,
      actualDuration: 0, // 实际测试持续时间，未完成时为当前运行时间
      historyData: [] as Array<{
        time: number;
        totalSpeed: number;
        currentSpeed: number;
        outputSpeed: number;
      }>,
      endTime: undefined as number | undefined,
    });
    activeTests.value.set(testId, realtimeData);

    // 节流控制：限制实时更新频率
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL_MS = 100; // 每100ms最多更新一次UI

    const testResult: TokenTestResult = {
      id: testId,
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      testCaseDescription: testCase.description,
      timestamp: new Date(),
      status: 'running',
      message: testCase.prompt,
      tokens: 0,
      actualTokens: undefined,
      firstTokenTime: undefined,
      duration: 0,
      tokensPerSecond: 0,
      outputSpeed: undefined,
      chunks: [],
    };

    try {
      const chatLayer = OpenAIClientService.Default.pipe(
        Layer.provide(OpenAIConfigService.Default),
        Layer.provide(EnvConfigService.Default),
      );

      const apiMessages: Array<{ role: 'user'; content: string }> = [
        { role: 'user', content: testCase.prompt.trim() },
      ];

      const chatProgram = Effect.gen(function* () {
        const openAIClientService = yield* OpenAIClientService;
        const stream = yield* openAIClientService.createStreamChatCompletion(apiMessages, {
          temperature: testCase.temperature ?? 0.7,
          maxTokens: testCase.maxTokens ?? 500,
        });

        let totalTokens = 0;
        let firstTokenReceived = false;

        yield* Stream.runForEach(stream, (chunk: ChatCompletionChunk) => {
          return Effect.sync(() => {
            const content = chunk.choices[0]?.delta?.content || '';
            const currentTime = Date.now() - startTime;

            if (chunk.usage) {
              console.log('[chunk]',chunk);
              testResult.actualTokens = {
                promptTokens: chunk.usage.prompt_tokens,
                completionTokens: chunk.usage.completion_tokens,
                totalTokens: chunk.usage.total_tokens,
              };

              if (chunk.usage.completion_tokens) {
                testResult.tokens = chunk.usage.completion_tokens;
                realtimeData.tokens = chunk.usage.completion_tokens;
              }
            }

            if (content) {
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                const firstTokenTime = currentTime;
                testResult.firstTokenTime = firstTokenTime;
                realtimeData.firstTokenTime = firstTokenTime;
              }

              const tokenCount = estimateTokenCount(content);

              if (!testResult.actualTokens) {
                totalTokens += tokenCount;
                testResult.tokens = totalTokens;
                testResult.chunks.push({
                  timestamp: currentTime,
                  content: content,
                  tokenCount: tokenCount,
                });

                // 更新实时状态
                realtimeData.tokens = totalTokens;
              } else {
                testResult.chunks.push({
                  timestamp: currentTime,
                  content: content,
                  tokenCount: tokenCount,
                });

                // 更新实时状态
                realtimeData.tokens = testResult.tokens;
              }

              // 计算实时速度 - 使用 reactive 自动响应
              // 确保时间至少为1ms，避免除零错误
              const safeCurrentTime = Math.max(currentTime, 1);
              if (realtimeData.tokens > 0) {
                const instantSpeed =
                  Math.round(((realtimeData.tokens * 1000) / safeCurrentTime) * 10) / 10;
                realtimeData.currentSpeed = instantSpeed;
                realtimeData.speed = instantSpeed;
              } else {
                // 即使没有 tokens，也更新状态确保响应式
                realtimeData.currentSpeed = 0;
                realtimeData.speed = 0;
              }

              // 节流的实时更新回调
              const now = Date.now();
              if (onRealTimeUpdate && now - lastUpdateTime >= UPDATE_INTERVAL_MS) {
                lastUpdateTime = now;

                // 实时速度计算：始终使用累积的估算tokens来计算实时速度
                const currentDuration = now - startTime;
                // 使用当前累积的tokens来计算实时速度（测试过程中始终有值）
                const currentTokens = realtimeData.tokens || 0;

                // 实时更新实际持续时间
                realtimeData.actualDuration = currentDuration;

                // 确保总持续时间至少为1ms，避免除零错误
                const safeCurrentDuration = Math.max(currentDuration, 1);
                const totalSpeed =
                  currentTokens > 0 ? Math.round(((currentTokens * 1000) / safeCurrentDuration) * 10) / 10 : 0;

                const outputDuration = realtimeData.firstTokenTime
                  ? currentDuration - realtimeData.firstTokenTime
                  : 0;
                // 确保输出时间至少为1ms，避免除零错误
                const safeOutputDuration = Math.max(outputDuration, 1);
                const outputSpeed =
                  currentTokens > 0 ? Math.round(((currentTokens * 1000) / safeOutputDuration) * 10) / 10 : 0;

                // 添加历史数据点
                const historyPoint = {
                  time: currentDuration,
                  totalSpeed,
                  currentSpeed: realtimeData.speed,
                  outputSpeed,
                };
                realtimeData.historyData.push(historyPoint);

                onRealTimeUpdate(testId, {
                  tokens: realtimeData.tokens,
                  speed: realtimeData.speed,
                  firstTokenTime: realtimeData.firstTokenTime,
                  status: 'running',
                });
              }
            }
          });
        });

        return totalTokens;
      });

      const finalTokens = await Effect.runPromise(chatProgram.pipe(Effect.provide(chatLayer)));

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      testResult.status = 'completed';
      testResult.duration = totalDuration;
      testResult.tokens = finalTokens;

      // 计算总速度（包括首次响应时间）
      testResult.tokensPerSecond =
        finalTokens > 0 ? Math.round(((finalTokens * 1000) / totalDuration) * 10) / 10 : 0;

      // 计算纯输出速度（不包括首次响应时间）
      if (testResult.firstTokenTime && finalTokens > 0) {
        const outputDuration = totalDuration - testResult.firstTokenTime;
        // 确保输出时间至少为1ms，避免除零错误
        const safeOutputDuration = Math.max(outputDuration, 1);
        testResult.outputSpeed = Math.round(((finalTokens * 1000) / safeOutputDuration) * 10) / 10;
      }

      // 更新实时状态为完成，记录实际的结束时间和持续时间
      realtimeData.status = 'completed';
      realtimeData.speed = testResult.tokensPerSecond;
      realtimeData.currentSpeed = testResult.tokensPerSecond; // 确保当前速度也更新
      realtimeData.endTime = endTime;
      realtimeData.actualDuration = totalDuration;

      // 添加最终的历史数据点
      const finalHistoryPoint = {
        time: totalDuration, // 使用总持续时间作为最终时间点
        totalSpeed: testResult.tokensPerSecond,
        currentSpeed: testResult.tokensPerSecond,
        outputSpeed: testResult.outputSpeed || 0,
      };
      realtimeData.historyData.push(finalHistoryPoint);

      // 强制触发响应性更新
      const updatedData = { ...realtimeData };
      activeTests.value.set(testId, updatedData);

      // 触发最终实时更新
      if (onRealTimeUpdate) {
        onRealTimeUpdate(testId, {
          tokens: realtimeData.tokens,
          speed: realtimeData.speed,
          firstTokenTime: realtimeData.firstTokenTime,
          status: 'completed',
        });
      }

      return testResult;
    } catch (err) {
      console.error('Single test error:', err);
      testResult.status = 'error';
      testResult.duration = Date.now() - startTime;

      // 更新实时状态为错误，记录实际的结束时间和持续时间
      const errorEndTime = Date.now();
      const errorDuration = errorEndTime - startTime;

      realtimeData.status = 'error';
      realtimeData.endTime = errorEndTime;
      realtimeData.actualDuration = errorDuration;

      // 添加错误时点的历史数据
      const errorHistoryPoint = {
        time: errorDuration,
        totalSpeed: realtimeData.speed,
        currentSpeed: realtimeData.currentSpeed,
        outputSpeed: 0,
      };
      realtimeData.historyData.push(errorHistoryPoint);

      // 强制触发响应性更新
      const updatedData = { ...realtimeData };
      activeTests.value.set(testId, updatedData);

      // 触发错误实时更新
      if (onRealTimeUpdate) {
        onRealTimeUpdate(testId, {
          tokens: realtimeData.tokens,
          speed: realtimeData.speed,
          firstTokenTime: realtimeData.firstTokenTime,
          status: 'error',
        });
      }

      return testResult;
    } finally {
      // 不清理实时状态，保留最终结果供UI显示
      // 可以通过手动调用来清理，或者设置超时清理
      // setTimeout(() => {
      //   activeTests.value.delete(testId);
      // }, 10000); // 10秒后清理
    }
  };

  /**
   * 串行测试
   * @param testCases 测试用例数组
   * @param config API 配置
   * @param onProgress 进度回调
   * @param onRealTimeUpdate 实时更新回调
   @returns 测试结果数组
   */
  const runSequentialTests = async (
    testCases: TestCase[],
    config: TokenTestConfig,
    onProgress?: (current: number, total: number, result: TokenTestResult) => void,
    onRealTimeUpdate?: (
      testId: string,
      data: {
        tokens: number;
        speed: number;
        firstTokenTime?: number;
        status?: 'running' | 'completed' | 'error';
      },
    ) => void,
  ): Promise<TokenTestResult[]> => {
    const results: TokenTestResult[] = [];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      if (!testCase) continue;

      const result = await runSingleTest(testCase, config, onRealTimeUpdate);
      results.push(result);

      if (onProgress) {
        onProgress(i + 1, testCases.length, result);
      }

      // 如果测试失败，可以选择继续或停止
      if (result.status === 'error') {
        console.warn(`Test ${testCase.name} failed, continuing with next test`);
      }
    }

    return results;
  };

  /**
   * 并行测试
   * @param testCases 测试用例数组
   * @param config API 配置
   * @param onProgress 进度回调
   * @param onRealTimeUpdate 实时更新回调
   * @returns 测试结果数组
   */
  const runParallelTests = async (
    testCases: TestCase[],
    config: TokenTestConfig,
    onProgress?: (current: number, total: number, result: TokenTestResult) => void,
    onRealTimeUpdate?: (
      testId: string,
      data: {
        tokens: number;
        speed: number;
        firstTokenTime?: number;
        status?: 'running' | 'completed' | 'error';
      },
    ) => void,
  ): Promise<TokenTestResult[]> => {
    const maxConcurrent = 5; // 限制并发数量
    const results: TokenTestResult[] = [];
    let completedCount = 0;

    // 分批处理
    for (let i = 0; i < testCases.length; i += maxConcurrent) {
      const batch = testCases.slice(i, i + maxConcurrent);

      const batchPromises = batch.map(async (testCase) => {
        const result = await runSingleTest(testCase, config, onRealTimeUpdate);
        completedCount++;

        if (onProgress) {
          onProgress(completedCount, testCases.length, result);
        }

        return result;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  };

  /**
   * 开始批量测试
   * @param testCases 测试用例数组
   * @param testMode 测试模式
   * @param config API 配置
   * @param suiteId 测试套件ID
   * @param onProgress 进度回调
   * @param onRealTimeUpdate 实时更新回调
   */
  const startBatchTest = async (
    testCases: TestCase[],
    testMode: TestMode,
    config: TokenTestConfig,
    suiteId: string = 'custom',
    onProgress?: (current: number, total: number, result: TokenTestResult) => void,
    onRealTimeUpdate?: (
      testId: string,
      data: {
        tokens: number;
        speed: number;
        firstTokenTime?: number;
        status?: 'running' | 'completed' | 'error';
      },
    ) => void,
  ): Promise<void> => {
    if (testCases.length === 0) {
      batchError.value = '请选择至少一个测试用例';
      return;
    }

    if (!config.apiKey || !config.model) {
      batchError.value = '请先配置 API Key 和模型';
      return;
    }

    isBatchLoading.value = true;
    batchError.value = '';

    // 清空之前的实时状态
    activeTests.value.clear();

    const batchTest: BatchTestResult = {
      suiteId,
      testMode,
      startTime: new Date(),
      status: 'running',
      results: [],
    };

    currentBatchTest.value = batchTest;
    batchResults.value.unshift(batchTest);

    try {
      let results: TokenTestResult[];

      if (testMode === 'sequential') {
        results = await runSequentialTests(testCases, config, onProgress, onRealTimeUpdate);
      } else {
        results = await runParallelTests(testCases, config, onProgress, onRealTimeUpdate);
      }

      // 计算汇总统计
      const completedTests = results.filter((r) => r.status === 'completed');
      const failedTests = results.filter((r) => r.status === 'error');

      const summary = {
        totalTests: testCases.length,
        completedTests: completedTests.length,
        failedTests: failedTests.length,
        avgFirstTokenTime:
          completedTests.length > 0
            ? Math.round(
                completedTests.reduce((sum, r) => sum + (r.firstTokenTime || 0), 0) /
                  completedTests.length,
              )
            : undefined,
        avgTotalSpeed:
          completedTests.length > 0
            ? Math.round(
                (completedTests.reduce((sum, r) => sum + r.tokensPerSecond, 0) /
                  completedTests.length) *
                  10,
              ) / 10
            : undefined,
        avgOutputSpeed:
          completedTests.filter((r) => r.outputSpeed).length > 0
            ? Math.round(
                (completedTests
                  .filter((r) => r.outputSpeed)
                  .reduce((sum, r) => sum + (r.outputSpeed || 0), 0) /
                  completedTests.filter((r) => r.outputSpeed).length) *
                  10,
              ) / 10
            : undefined,
        totalDuration: Date.now() - batchTest.startTime.getTime(),
      };

      // 更新状态
      batchTest.status = 'completed';
      batchTest.endTime = new Date();
      batchTest.results = results;
      batchTest.summary = summary;

      // 强制触发响应性更新
      const index = batchResults.value.findIndex((b) => b.suiteId === batchTest.suiteId);
      if (index !== -1) {
        batchResults.value[index] = { ...batchTest };
      }
      currentBatchTest.value = { ...batchTest };
    } catch (err) {
      console.error('Batch test error:', err);
      batchError.value = err instanceof Error ? err.message : '批量测试失败';
      batchTest.status = 'error';
      batchTest.endTime = new Date();

      // 强制触发响应性更新
      const index = batchResults.value.findIndex((b) => b.suiteId === batchTest.suiteId);
      if (index !== -1) {
        batchResults.value[index] = { ...batchTest };
      }
      currentBatchTest.value = { ...batchTest };
    } finally {
      isBatchLoading.value = false;
    }
  };

  /**
   * 取消当前批量测试
   */
  const cancelBatchTest = (): void => {
    if (currentBatchTest.value && currentBatchTest.value.status === 'running') {
      currentBatchTest.value.status = 'cancelled';
      currentBatchTest.value.endTime = new Date();
      isBatchLoading.value = false;
    }
  };

  /**
   * 清空批量测试结果
   */
  const clearBatchResults = (): void => {
    batchResults.value = [];
    batchError.value = '';
    currentBatchTest.value = null;
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
      return `${tokensPerSecond.toFixed(0)}/s`;
    } else {
      return `${(tokensPerSecond / 1000).toFixed(1)}k/s`;
    }
  };

  return {
    // 单个测试状态
    isLoading,
    error,
    testResults,
    currentTokens,
    currentSpeed,
    currentElapsedTime,

    // 批量测试状态
    isBatchLoading,
    batchError,
    batchResults,
    currentBatchTest,

    // 实时状态
    activeTests,

    // 单个测试方法
    startTokenSpeedTest,
    clearResults,
    runSingleTest,

    // 批量测试方法
    startBatchTest,
    cancelBatchTest,
    clearBatchResults,
    runSequentialTests,
    runParallelTests,

    // 工具方法
    formatDuration,
    formatSpeed,
    estimateTokenCount,
  };
}
