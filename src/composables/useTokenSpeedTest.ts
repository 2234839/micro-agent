import { reactive, ref, computed } from 'vue';
import { Effect, Stream, Layer } from 'effect';
import { useNow } from '@vueuse/core';
import { OpenAIConfigService } from '../agent/config/openai-config';
import { EnvConfigService } from '../agent/config/env-config';
import { OpenAIClientService } from '../agent/services/openai-client';
import { formatDuration, formatSpeed, estimateTokens } from '../utils/format';

/**
 * 速度历史记录项接口
 */
interface SpeedHistoryItem {
  /** 时间戳（毫秒） */
  timestamp: number;
  /** 相对于开始时间的偏移（毫秒） */
  offset: number;
  /** 瞬时速度（tokens/秒）- 基于当前时间间隔的计算 */
  speed: number;
  /** 累计平均速度（tokens/秒）- 到当前时间点为止的平均速度 */
  averageSpeed: number;
  /** 累计 token 数 - 优先使用 API 返回的准确数据 */
  totalTokens: number;
  /** 当前内容长度 */
  contentLength: number;
  /** 是否已完成 */
  isCompleted: boolean;
  /** 实时延迟（毫秒）- 上次历史记录到当前记录的时间差 */
  realTimeDelay: number;
}

/**
 * Token 速度测试状态接口
 * 包含测试过程中的所有状态数据
 */
export interface TokenSpeedTestState {
  /** 时间相关数据 */
  time: {
    /** 测试开始时间戳（毫秒） */
    start: number;
    /** 首个 token 到达时间戳（毫秒），null 表示还未收到 */
    firstToken: null | number;
    /** 测试结束时间戳（毫秒），null 表示测试进行中 */
    end: null | number;
    /** 上次更新时间戳（毫秒），用于跟踪状态变化 */
    oldUpdateTime: number;
    /** 上次记录速度历史的时间戳（毫秒） */
    lastHistoryRecordTime: number;
  };
  /** 估算的累计 token 总数 */
  totalTokens: number;
  /** 当前批次收到的 token 数 */
  currentTokens: number;
  /** API 返回的官方 completion token 数，null 表示 API 未返回 */
  completion_tokens: null | number;
  /** 当前瞬时速度（tokens/秒）- 避免重复计算 */
  instantaneousSpeed: number;
  /** 当前平均速度（tokens/秒）- 避免重复计算 */
  averageSpeed: number;
    /** 测试状态信息 */
  status: {
    /** 测试是否已完成 */
    done: boolean;
    /** 测试是否失败 */
    failed: boolean;
    /** 测试是否正在进行中 */
    isLoading: boolean;
    /** 错误信息，null 表示无错误 */
    error: string | null;
    /** 测试是否被用户中止 */
    aborted: boolean;
  };
  /** AI 生成的文本内容 */
  content: string;
  /** 用户输入的测试消息 */
  message: string;
  /** 速度变化历史记录数组 */
  speedHistory: SpeedHistoryItem[];
  /** 测试配置参数 */
  config: {
    /** AI 模型温度参数，控制生成随机性 */
    temperature: number;
    /** 最大生成 token 数限制 */
    maxTokens: number;
    /** 速度历史记录间隔（毫秒） */
    historyInterval: number;
  };
}

/** Token 速度测试实例类型 */
export type TokenSpeedTestInstance = ReturnType<typeof tokenSpeedTest>;

/**
 * Token 速度测试 Composable Hook
 * 提供完整的 token 速度测试功能和状态管理
 */
export function tokenSpeedTest(message: string, options?: {
  temperature?: number;
  maxTokens?: number;
  historyInterval?: number;
}) {
  /** 配置选项 */
  const config = {
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? 500,
    historyInterval: options?.historyInterval ?? 500,
  };

  /** 创建 AbortController 用于中断流式请求 */
  const abortController = new AbortController();

  /** 获取响应式的当前时间 */
  const currentTime = useNow();

  /** 创建响应式状态 */
  const state = reactive<TokenSpeedTestState>({
    time: {
      start: Date.now(),
      firstToken: null as null | number,
      end: null as null | number,
      oldUpdateTime: currentTime.value.getTime(),
      lastHistoryRecordTime: currentTime.value.getTime(),
    },
    totalTokens: 0,
    currentTokens: 0,
    completion_tokens: null as null | number,
    instantaneousSpeed: 0,
    averageSpeed: 0,
    status: {
      done: false,
      failed: false,
      isLoading: true,
      error: null as string | null,
      aborted: false,
    },
    content: '',
    message: message.trim(),
    speedHistory: [],
    config,
  });

  /** 记录速度历史的函数 */
  const recordSpeedHistory = (isCompleted: boolean = false) => {
    const now = currentTime.value.getTime();
    const elapsed = now - state.time.start;

    // 优先使用 API 返回的准确 token 数据
    const currentTokens = state.completion_tokens || state.totalTokens;

    // 计算实时延迟：上次历史记录到当前记录的时间差
    const realTimeDelay = state.speedHistory.length > 0
      ? now - state.time.lastHistoryRecordTime
      : 0;

    // 计算瞬时速度：基于当前时间间隔的 token 生成速率
    let instantaneousSpeed = 0;
    if (state.speedHistory.length > 0 && realTimeDelay > 0) {
      const lastRecord = state.speedHistory[state.speedHistory.length - 1];
      if (lastRecord) {
        const lastTokens = lastRecord.totalTokens;
        const tokenDiff = currentTokens - lastTokens;
        // 只有当 token 增加时才计算瞬时速度，避免负数
        if (tokenDiff > 0) {
          instantaneousSpeed = Math.round((tokenDiff * 1000) / realTimeDelay * 10) / 10;
        } else {
          // 如果 token 没有增加或减少了，瞬时速度为 0
          instantaneousSpeed = 0;
        }
      }
    } else if (elapsed > 0) {
      // 第一次记录时，使用累计速度作为瞬时速度
      instantaneousSpeed = Math.round((currentTokens * 1000) / elapsed * 10) / 10;
    }

    // 计算累积平均速度：总 token 数除以总时间
    const averageSpeed = elapsed > 0
      ? Math.round((currentTokens * 1000) / elapsed * 10) / 10
      : 0;

    // 更新 state 中的速度值，避免重复计算
    state.instantaneousSpeed = instantaneousSpeed;
    state.averageSpeed = averageSpeed;

    const historyItem: SpeedHistoryItem = {
      timestamp: now,
      offset: elapsed,
      speed: instantaneousSpeed,
      averageSpeed,
      totalTokens: currentTokens,
      contentLength: state.content.length,
      isCompleted,
      realTimeDelay,
    };

    state.speedHistory.push(historyItem);
    state.time.lastHistoryRecordTime = now; // 更新上次记录历史的时间
  };

  /** 创建 Effect 层 */
  const chatLayer = OpenAIClientService.Default.pipe(
    Layer.provide(OpenAIConfigService.Default),
    Layer.provide(EnvConfigService.Default),
  );

  const messages = [{ role: 'user' as const, content: message.trim() }];

  /** 创建可中断的 Effect 程序 */
  const chatProgram = Effect.gen(function* () {
    // 在开始请求前记录一次初始数据
    recordSpeedHistory(false);

    const openAIClientService = yield* OpenAIClientService;
    const stream = yield* openAIClientService.createStreamChatCompletion(messages, {
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      signal: abortController.signal,
    });

    yield* stream.pipe(
      Stream.runFold(state, (acc, chunk) => {
        const curTime = currentTime.value.getTime();
        if (acc.time.firstToken === null) {
          acc.time.firstToken = curTime;
        }

        const content = chunk.choices[0]?.delta?.content || '';
        acc.content += content;

        const tokens = estimateTokens(content);
        acc.totalTokens += tokens;
        acc.currentTokens = tokens;

        if (chunk.usage?.completion_tokens) {
          acc.completion_tokens = chunk.usage.completion_tokens;
        }

        // 根据配置的时间间隔记录速度历史
        if ((curTime - acc.time.lastHistoryRecordTime) >= config.historyInterval) {
          recordSpeedHistory(false);
        }

        return acc;
      }),
    );

    // 正常完成
    state.status.done = true;
    state.status.isLoading = false;
    state.time.end = Date.now();

    // 记录完成时的速度历史
    recordSpeedHistory(true);
  }).pipe(
    Effect.catchAll((error) => {
      // 处理错误 - 使用 Effect 的错误处理机制
      state.status.failed = true;
      state.status.isLoading = false;
      state.status.error = error instanceof Error ? error.message : 'Unknown error';
      state.time.end = Date.now();

      // 记录错误时的速度历史
      recordSpeedHistory(true);

      return Effect.void;
    })
  );

  /** 运行程序 */
  const programRun = Effect.runPromise(chatProgram.pipe(Effect.provide(chatLayer)));

  /** 停止测试的方法 */
  const stop = () => {
    abortController.abort();
    state.status.aborted = true;
    state.status.isLoading = false;
    state.time.end = Date.now();
  };

  /** 重置状态的方法 */
  const reset = () => {
    // 创建新的 AbortController
    abortController.abort(); // 取消当前请求
    // 注意：这里需要重新创建 AbortController，但为了简化，我们只能标记状态

    state.time = {
      start: Date.now(),
      firstToken: null as null | number,
      end: null as null | number,
      oldUpdateTime: currentTime.value.getTime(),
      lastHistoryRecordTime: currentTime.value.getTime(),
    };
    state.totalTokens = 0;
    state.currentTokens = 0;
    state.completion_tokens = null as null | number;
    state.instantaneousSpeed = 0;
    state.averageSpeed = 0;
    state.status = {
      done: false,
      failed: false,
      isLoading: true,
      error: null as string | null,
      aborted: false,
    };
    state.content = '';
    state.message = message.trim();
    state.speedHistory = [];
  };

  /** 计算属性 */
  const speed = computed(() => {
    // 直接返回 state 中的瞬时速度，避免重复计算
    return state.instantaneousSpeed;
  });

  const elapsedTime = computed(() => {
    // 如果测试已完成（有结束时间），使用结束时间；否则使用响应式当前时间
    return state.time.end !== null
      ? state.time.end - state.time.start
      : currentTime.value.getTime() - state.time.start;
  });

  const firstTokenDelay = computed(() => {
    // 如果还没有收到第一个 token，实时显示等待时间
    if (state.time.firstToken === null) {
      return currentTime.value.getTime() - state.time.start;
    }
    // 如果已经收到第一个 token，显示实际的延迟
    return state.time.firstToken - state.time.start;
  });

  const tokens = computed(() => {
    return state.completion_tokens || state.totalTokens;
  });

  const isTestActive = computed(() => {
    return state.status.isLoading;
  });

  const canStartTest = computed(() => {
    return !state.status.isLoading && message.trim().length > 0;
  });

  /** 获取速度历史数据的计算属性 */
  const speedHistoryData = computed(() => {
    return state.speedHistory.map(item => ({
      x: item.offset / 1000, // 转换为秒
      y: item.speed,
      timestamp: item.timestamp,
      totalTokens: item.totalTokens,
      contentLength: item.contentLength,
      isCompleted: item.isCompleted,
    }));
  });

  /** 获取最新的速度记录 */
  const latestSpeedRecord = computed(() => {
    return state.speedHistory.length > 0
      ? state.speedHistory[state.speedHistory.length - 1]
      : null;
  });

  /** 获取平均速度 */
  const averageSpeed = computed(() => {
    if (state.speedHistory.length === 0) return 0;
    const totalSpeed = state.speedHistory.reduce((sum, item) => sum + item.speed, 0);
    return Math.round((totalSpeed / state.speedHistory.length) * 10) / 10;
  });

  /** 获取峰值速度 */
  const peakSpeed = computed(() => {
    if (state.speedHistory.length === 0) return 0;
    return Math.max(...state.speedHistory.map(item => item.speed));
  });

  return {
    /** 响应式状态 */
    state,

    /** 方法 */
    stop,
    reset,

    /** 计算属性 */
    speed,
    elapsedTime,
    firstTokenDelay,
    tokens,
    isTestActive,
    canStartTest,

    /** 速度历史相关 */
    speedHistoryData,
    latestSpeedRecord,
    averageSpeed,
    peakSpeed,

    /** Promise */
    programRun,
  };
}
