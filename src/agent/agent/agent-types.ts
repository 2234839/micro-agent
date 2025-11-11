import { Effect } from 'effect';

/** Agent 工具调用参数 */
export interface AgentToolCall {
  /** 工具名称 */
  name: string;
  /** 工具参数 */
  parameters: Record<string, any>;
}

/** Agent 工具执行结果 */
export interface AgentToolResult {
  /** 工具名称 */
  toolName: string;
  /** 执行结果 */
  result: any;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（如果有） */
  error?: string;
}

/** Agent 工具定义 */
export interface AgentTool {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** JSON Schema 参数定义 */
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
  /** 工具执行函数 */
  execute: (parameters: Record<string, any>) => Effect.Effect<any, Error, never>;
}

/** Agent 循环状态 */
export interface AgentLoopState {
  /** 消息历史 */
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> }>;
  /** 当前步骤 */
  currentStep: number;
  /** 最大步数 */
  maxSteps: number;
  /** 是否完成 */
  isCompleted: boolean;
  /** 最终答案 */
  finalAnswer?: string;
}

/** Agent 配置 */
export interface AgentConfig {
  /** 系统提示词 */
  systemPrompt: string;
  /** 最大循环步数 */
  maxSteps?: number;
  /** 温度参数 */
  temperature?: number;
  /** 模型名称 */
  model?: string;
}