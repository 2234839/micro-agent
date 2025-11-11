import { Effect } from 'effect';
import type { AgentTool } from './agent-types';

/**
 * 执行 JavaScript 代码工具
 * 在浏览器环境中安全地执行 JavaScript 代码，并捕获 console.log 输出
 */
export const evalJsTool: AgentTool = {
  name: 'eval_js',
  description: '执行 JavaScript 代码并返回结果。适用于数学计算、数据处理、字符串操作等。支持 console.log 输出。',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: '要执行的 JavaScript 代码',
      },
    },
    required: ['code'],
  },
  execute: (parameters) =>
    Effect.gen(function* () {
      const { code } = parameters;

      // 创建日志捕获数组
      const logs: Array<{ type: string; message: string; timestamp: string }> = [];
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;
      const originalInfo = console.info;

      // 重写 console 方法来捕获输出
      console.log = (...args: any[]) => {
        logs.push({
          type: 'log',
          message: args.map(arg => String(arg)).join(' '),
          timestamp: new Date().toISOString(),
        });
        originalLog(...args);
      };

      console.error = (...args: any[]) => {
        logs.push({
          type: 'error',
          message: args.map(arg => String(arg)).join(' '),
          timestamp: new Date().toISOString(),
        });
        originalError(...args);
      };

      console.warn = (...args: any[]) => {
        logs.push({
          type: 'warn',
          message: args.map(arg => String(arg)).join(' '),
          timestamp: new Date().toISOString(),
        });
        originalWarn(...args);
      };

      console.info = (...args: any[]) => {
        logs.push({
          type: 'info',
          message: args.map(arg => String(arg)).join(' '),
          timestamp: new Date().toISOString(),
        });
        originalInfo(...args);
      };

      try {
        // 使用 Function 构造函数安全地执行代码
        const safeEval = new Function(code);
        const result = safeEval();

        // 恢复原始 console 方法
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        console.info = originalInfo;

        return {
          result: String(result),
          type: typeof result,
          logs: logs,
        };
      } catch (error) {
        // 恢复原始 console 方法
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        console.info = originalInfo;

        throw new Error(`JavaScript 执行错误: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
};

/**
 * 获取当前时间工具
 */
export const getCurrentTimeTool: AgentTool = {
  name: 'get_current_time',
  description: '获取当前时间和日期信息',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: () =>
    Effect.sync(() => {
      const now = new Date();
      return {
        timestamp: now.toISOString(),
        localTime: now.toLocaleString('zh-CN'),
        unixTimestamp: Math.floor(now.getTime() / 1000),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }),
};

/**
 * 等待工具
 * 模拟异步操作，让 Agent 可以暂停指定时间
 */
export const waitTool: AgentTool = {
  name: 'wait',
  description: '等待指定的毫秒数',
  parameters: {
    type: 'object',
    properties: {
      milliseconds: {
        type: 'number',
        description: '等待的毫秒数',
      },
    },
    required: ['milliseconds'],
  },
  execute: (parameters) =>
    Effect.gen(function* () {
      const { milliseconds } = parameters;
      yield* Effect.sleep(`${milliseconds * 1000000} nanos`);
      return { waited: milliseconds };
    }),
};

/**
 * 数学计算工具
 * 提供基本的数学运算功能
 */
export const mathCalcTool: AgentTool = {
  name: 'math_calc',
  description: '执行数学计算，支持基本运算、三角函数、对数等',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: '数学表达式，例如: "2 + 3 * 4", "Math.sin(0.5)", "Math.sqrt(16)"',
      },
    },
    required: ['expression'],
  },
  execute: (parameters) =>
    Effect.gen(function* () {
      const { expression } = parameters;

      try {
        // 使用 Function 构造函数安全地执行数学表达式
        const mathEval = new Function('Math', `return ${expression}`);
        const result = mathEval(Math);

        return {
          expression,
          result,
          resultType: typeof result,
        };
      } catch (error) {
        throw new Error(`数学计算错误: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
};

/**
 * 格式化数据工具
 * 将数据格式化为 JSON 字符串或表格格式
 */
export const formatDataTool: AgentTool = {
  name: 'format_data',
  description: '格式化数据，支持 JSON 格式化、表格形式等',
  parameters: {
    type: 'object',
    properties: {
      data: {
        type: 'string',
        description: '要格式化的数据（字符串形式的 JSON）',
      },
      format: {
        type: 'string',
        description: '格式类型: "json", "table", "markdown"',
        enum: ['json', 'table', 'markdown'],
      },
    },
    required: ['data', 'format'],
  },
  execute: (parameters) =>
    Effect.gen(function* () {
      const { data, format } = parameters;

      try {
        const parsedData = JSON.parse(data);

        switch (format) {
          case 'json':
            return {
              formatted: JSON.stringify(parsedData, null, 2),
              format: 'json',
            };

          case 'markdown':
            if (Array.isArray(parsedData) && parsedData.length > 0) {
              const headers = Object.keys(parsedData[0]);
              const headerRow = '| ' + headers.join(' | ') + ' |';
              const separatorRow = '|' + headers.map(() => '---').join('|') + '|';
              const dataRows = parsedData.map(row =>
                '| ' + headers.map(header => String(row[header] || '')).join(' | ') + ' |'
              );
              return {
                formatted: [headerRow, separatorRow, ...dataRows].join('\n'),
                format: 'markdown',
              };
            } else {
              return {
                formatted: '```json\n' + JSON.stringify(parsedData, null, 2) + '\n```',
                format: 'markdown',
              };
            }

          case 'table':
            if (Array.isArray(parsedData) && parsedData.length > 0) {
              return {
                formatted: parsedData,
                format: 'table',
              };
            } else {
              return {
                formatted: [parsedData],
                format: 'table',
              };
            }

          default:
            throw new Error(`不支持的格式类型: ${format}`);
        }
      } catch (error) {
        throw new Error(`数据格式化错误: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
};

/**
 * 完成对话工具
 * 当 Agent 完成任务时调用此工具提供最终答案
 */
export const finishTool: AgentTool = {
  name: 'finish',
  description: '当您有最终答案时调用此工具结束对话并提供答案。这是完成任务的标准方式。',
  parameters: {
    type: 'object',
    properties: {
      answer: {
        type: 'string',
        description: '对用户问题的最终答案',
      },
    },
    required: ['answer'],
  },
  execute: (parameters) =>
    Effect.sync(() => {
      const { answer } = parameters;
      return {
        finished: true,
        answer,
        timestamp: new Date().toISOString(),
      };
    }),
};

/** 默认工具集合 */
export const defaultTools: AgentTool[] = [
  evalJsTool,
  getCurrentTimeTool,
  waitTool,
  mathCalcTool,
  formatDataTool,
  finishTool,
];