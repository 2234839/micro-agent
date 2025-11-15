/** 速度测试相关的共享类型定义 */

/** 历史数据点接口 */
export interface HistoryDataPoint {
  time: number;
  totalSpeed: number;
  currentSpeed: number;
  outputSpeed: number;
}

/** 基础测试数据接口 */
export interface BaseTestData {
  testCaseId: string;
  testCaseName: string;
  status: 'running' | 'completed' | 'error';
  tokens: number;
  actualTokens?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  firstTokenTime?: number;
  startTime: number;
  historyData: HistoryDataPoint[];
}

/** 实时测试状态数据接口 */
export interface RealtimeTestData extends BaseTestData {
  speed: number; // 总速度
  currentSpeed: number;
  actualDuration: number;
  endTime?: number;
  outputSpeed?: number;
}

/** UI显示用的进度数据接口 */
export interface ProgressData extends BaseTestData {
  testId: string;
  totalSpeed: number; // 统一的总速度字段
  currentSpeed: number;
  outputSpeed: number;
  duration: number; // 持续时间
}

/** 历史数据块接口 */
export interface HistoryChunk {
  timestamp?: number;
  time?: number;
  content?: string;
  tokenCount?: number;
}