import { reactive, ref, computed } from 'vue';
import { tokenSpeedTest, type TokenSpeedTestState } from './useTokenSpeedTest';

/**
 * 单轮测试结果接口
 */
export interface SingleRoundResult {
  /** 轮次编号 */
  round: number;
  /** 测试开始时间戳 */
  startTime: number;
  /** 测试结束时间戳 */
  endTime: number;
  /** 测试耗时（毫秒） */
  duration: number;
  /** 总 token 数 */
  totalTokens: number;
  /** 平均速度（tokens/秒） */
  averageSpeed: number;
  /** 峰值速度（tokens/秒） */
  peakSpeed: number;
  /** 首个 token 延迟（毫秒） */
  firstTokenDelay: number;
  /** 是否成功完成 */
  success: boolean;
  /** 错误信息 */
  error: string | null;
  /** 完整的测试状态数据（响应式引用） */
  fullState: TokenSpeedTestState;
}

/**
 * 多轮测试配置接口
 */
interface MultiRoundConfig {
  /** 测试轮数 */
  rounds: number;
  /** 测试间隔（毫秒） */
  interval: number;
  /** 测试消息 */
  message: string;
  /** AI 模型温度参数 */
  temperature?: number;
  /** 最大生成 token 数 */
  maxTokens?: number;
  /** 速度历史记录间隔（毫秒） */
  historyInterval?: number;
}

/**
 * 多轮测试状态接口
 */
export interface MultiRoundTestState {
  /** 当前配置 */
  config: MultiRoundConfig | null;
  /** 总轮数 */
  totalRounds: number;
  /** 当前轮次 */
  currentRound: number;
  /** 已完成的轮数 */
  completedRounds: number;
  /** 测试状态 */
  status: {
    /** 是否正在进行中 */
    isRunning: boolean;
    /** 是否已暂停 */
    isPaused: boolean;
    /** 是否已完成 */
    isCompleted: boolean;
    /** 错误信息 */
    error: string | null;
  };
  /** 所有测试结果 */
  results: SingleRoundResult[];
  /** 当前正在进行的测试实例列表 */
  runningTests: Array<{
    id: string;
    instance: {
      state: TokenSpeedTestState;
      stop: () => void;
      reset: () => void;
      speed: { value: number } | { value: number };
      isTestActive: { value: boolean } | { value: boolean };
      programRun: Promise<void>;
    };
  }>;
  /** 下次测试时间戳 */
  nextTestTime: number | null;
}

/**
 * 多轮测试 Composable Hook
 */
export function useMultiRoundTest() {
  /** 响应式状态 */
  const state = reactive<MultiRoundTestState>({
    config: null,
    totalRounds: 0,
    currentRound: 0,
    completedRounds: 0,
    status: {
      isRunning: false,
      isPaused: false,
      isCompleted: false,
      error: null,
    },
    results: [],
    runningTests: [],
    nextTestTime: null,
  });

  /** 定时器引用 */
  let intervalTimer: NodeJS.Timeout | null = null;
  let nextTestTimeout: NodeJS.Timeout | null = null;

  /**
   * 开始多轮测试
   */
  const startMultiRoundTest = (config: MultiRoundConfig) => {
    // 清理之前的测试
    stopMultiRoundTest();

    // 重置状态
    state.config = config;
    state.totalRounds = config.rounds;
    state.currentRound = 0;
    state.completedRounds = 0;
    state.status = {
      isRunning: true,
      isPaused: false,
      isCompleted: false,
      error: null,
    };
    state.results = [];
    state.runningTests = [];
    state.nextTestTime = null;

    // 开始第一轮测试
    scheduleNextRound(0);
  };

  /**
   * 安排下一轮测试
   */
  const scheduleNextRound = (roundIndex: number) => {
    if (roundIndex >= state.totalRounds) {
      // 所有测试完成
      completeMultiRoundTest();
      return;
    }

    state.currentRound = roundIndex + 1;

    // 如果不是第一轮，设置延迟
    if (roundIndex > 0 && state.config) {
      state.nextTestTime = Date.now() + state.config.interval;

      nextTestTimeout = setTimeout(() => {
        executeRound(roundIndex);
      }, state.config.interval);
    } else {
      // 第一轮立即执行
      executeRound(roundIndex);
    }
  };

  /**
   * 执行单轮测试
   */
  const executeRound = async (roundIndex: number) => {
    if (!state.config) return;

    const startTime = Date.now();

    // 生成唯一 ID
    const testId = `test-${roundIndex + 1}-${Date.now()}`;

    try {
      // 创建新的测试实例
      const testInstance = tokenSpeedTest(state.config.message, {
        temperature: state.config.temperature,
        maxTokens: state.config.maxTokens,
        historyInterval: state.config.historyInterval,
      });

      // 添加到运行中的测试列表
      state.runningTests.push({
        id: testId,
        instance: testInstance,
      });

      state.nextTestTime = null;

      // 等待测试完成
      await testInstance.programRun;

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 保存测试结果
      const result: SingleRoundResult = {
        round: roundIndex + 1,
        startTime,
        endTime,
        duration,
        totalTokens: testInstance.tokens.value,
        averageSpeed: testInstance.averageSpeed.value,
        peakSpeed: testInstance.peakSpeed.value,
        firstTokenDelay: testInstance.firstTokenDelay.value,
        success: testInstance.state.status.done && !testInstance.state.status.failed,
        error: testInstance.state.status.error,
        fullState: testInstance.state, // 直接保存响应式引用
      };

      state.results.push(result);
      state.completedRounds++;

      // 从运行列表中移除已完成的测试
      const testIndex = state.runningTests.findIndex(test => test.id === testId);
      if (testIndex !== -1) {
        state.runningTests.splice(testIndex, 1);
      }

      // 安排下一轮测试
      scheduleNextRound(roundIndex + 1);

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 保存失败结果
      const result: SingleRoundResult = {
        round: roundIndex + 1,
        startTime,
        endTime,
        duration,
        totalTokens: 0,
        averageSpeed: 0,
        peakSpeed: 0,
        firstTokenDelay: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fullState: {} as TokenSpeedTestState,
      };

      state.results.push(result);
      state.completedRounds++;

      // 从运行列表中移除失败的测试
      const testIndex = state.runningTests.findIndex(test => test.id === testId);
      if (testIndex !== -1) {
        state.runningTests.splice(testIndex, 1);
      }

      // 如果测试出错，可以选择继续或停止
      state.status.error = result.error;

      // 继续下一轮测试
      scheduleNextRound(roundIndex + 1);
    }
  };

  /**
   * 完成多轮测试
   */
  const completeMultiRoundTest = () => {
    state.status.isRunning = false;
    state.status.isCompleted = true;
    state.runningTests = [];
    state.nextTestTime = null;

    // 清理定时器
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
    if (nextTestTimeout) {
      clearTimeout(nextTestTimeout);
      nextTestTimeout = null;
    }
  };

  /**
   * 停止多轮测试
   */
  const stopMultiRoundTest = () => {
    // 停止所有正在运行的测试
    state.runningTests.forEach(test => {
      test.instance.stop();
    });
    state.runningTests = [];

    // 清理定时器
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
    if (nextTestTimeout) {
      clearTimeout(nextTestTimeout);
      nextTestTimeout = null;
    }

    // 更新状态
    state.status.isRunning = false;
    state.status.isPaused = false;
    state.nextTestTime = null;
  };

  /**
   * 暂停多轮测试
   */
  const pauseMultiRoundTest = () => {
    if (state.status.isRunning) {
      state.status.isPaused = true;

      // 清理下次测试的定时器
      if (nextTestTimeout) {
        clearTimeout(nextTestTimeout);
        nextTestTimeout = null;
      }

      // 暂停所有正在运行的测试
      state.runningTests.forEach(test => {
        test.instance.stop();
      });
    }
  };

  /**
   * 恢复多轮测试
   */
  const resumeMultiRoundTest = () => {
    if (state.status.isPaused && state.config) {
      state.status.isPaused = false;

      // 从当前轮次重新开始
      scheduleNextRound(state.completedRounds);
    }
  };

  /**
   * 重置多轮测试状态
   */
  const resetMultiRoundTest = () => {
    stopMultiRoundTest();

    state.config = null;
    state.totalRounds = 0;
    state.currentRound = 0;
    state.completedRounds = 0;
    state.status = {
      isRunning: false,
      isPaused: false,
      isCompleted: false,
      error: null,
    };
    state.results = [];
    state.runningTests = [];
    state.nextTestTime = null;
  };

  // 计算属性
  const progressPercentage = computed(() => {
    return state.totalRounds > 0 ? (state.completedRounds / state.totalRounds) * 100 : 0;
  });

  const successfulRounds = computed(() => {
    return state.results.filter(result => result.success).length;
  });

  const failedRounds = computed(() => {
    return state.results.filter(result => !result.success).length;
  });

  const overallAverageSpeed = computed(() => {
    if (state.results.length === 0) return 0;
    const totalSpeed = state.results.reduce((sum, result) => sum + result.averageSpeed, 0);
    return Math.round((totalSpeed / state.results.length) * 10) / 10;
  });

  const overallPeakSpeed = computed(() => {
    if (state.results.length === 0) return 0;
    return Math.max(...state.results.map(result => result.peakSpeed));
  });

  const overallAverageTokens = computed(() => {
    if (state.results.length === 0) return 0;
    const totalTokens = state.results.reduce((sum, result) => sum + result.totalTokens, 0);
    return Math.round(totalTokens / state.results.length);
  });

  const timeUntilNextTest = computed(() => {
    if (!state.nextTestTime || !state.status.isRunning || state.status.isPaused) return null;
    return Math.max(0, state.nextTestTime - Date.now());
  });

  return {
    /** 响应式状态 */
    state,

    /** 方法 */
    startMultiRoundTest,
    stopMultiRoundTest,
    pauseMultiRoundTest,
    resumeMultiRoundTest,
    resetMultiRoundTest,

    /** 计算属性 */
    progressPercentage,
    successfulRounds,
    failedRounds,
    overallAverageSpeed,
    overallPeakSpeed,
    overallAverageTokens,
    timeUntilNextTest,
  };
}