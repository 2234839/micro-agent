import { Effect, Stream } from 'effect';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { DEFAULT_AGENT_CONFIG, SIMPLE_AGENT_CONFIG } from './agent/agent-config';
import { defaultTools } from './agent/agent-tools';
import { OpenAIClientService } from './services/openai-client';
import { StreamingChatService } from './services/streaming-chat';
import type { AgentTool } from './agent/agent-types';

/** UI聊天消息接口 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AgentMessageData; // 支持字符串或Agent数据结构
  timestamp: Date;
  reasoning_content?: string;
}

/** API聊天消息接口（用于OpenAI API） */
export interface ApiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

/** Agent消息数据结构 */
export interface AgentMessageData {
  steps: Array<{
    aiOutput: string;
    toolCall?: {
      name: string;
      parameters: Record<string, any>;
      result: any;
    };
    error?: string;
  }>;
  isAgent: boolean;
}

/** Agent 执行步骤数据块 */
export interface AgentStepChunk {
  /** 步骤内容 */
  content: string;
  /** 当前步骤数 */
  step: number;
  /** 工具调用信息 */
  toolCall?: {
    name: string;
    parameters: Record<string, any>;
    result: any;
  };
  /** 是否完成 */
  isDone: boolean;
  /** 错误信息 */
  error?: string;
  /** 时间戳 */
  timestamp: number;
}

/** Micro Agent 服务 */
export class MicroAgentService extends Effect.Service<MicroAgentService>()('MicroAgentService', {
  dependencies: [StreamingChatService.Default, OpenAIClientService.Default],
  effect: Effect.gen(function* () {
    const streamingService = yield* StreamingChatService;
    const openAIClient = yield* OpenAIClientService;

    /** 将工具转换为 OpenAI 格式 */
    const convertToolsToOpenAI = (tools: AgentTool[]) => {
      return tools.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    };

    return {
      /**
       * 创建普通流式聊天对话
       */
      createStreamingChat: (
        messages: Array<ApiChatMessage>,
        options?: {
          enableReasoning?: boolean;
          temperature?: number;
          maxTokens?: number;
        },
      ) =>
        Effect.gen(function* () {
          // 将 ChatMessage 转换为 OpenAI 格式
          const openaiMessages = messages.map((msg) => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content,
          }));

          // 创建流式对话
          const stream = yield* streamingService.createStreamingChat(openaiMessages, {
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
            reasoningEffort: options?.enableReasoning ? 'medium' : undefined,
          });

          // 直接返回 StreamChunk 流，接口更简洁
          return stream;
        }),

      
      /**
       * 创建 Agent 智能对话流
       * 实现思考-行动-观察的完整循环
       */
      createAgentChat: (
        userMessage: string,
        options?: {
          mode?: 'default' | 'simple' | 'developer';
          maxSteps?: number;
          temperature?: number;
          tools?: any[];
          enableReasoning?: boolean;
        },
      ) =>
        Effect.gen(function* () {
          // 选择配置
          const mode = options?.mode || 'default';
          const config = mode === 'simple' ? SIMPLE_AGENT_CONFIG : DEFAULT_AGENT_CONFIG;
          const tools = options?.tools || defaultTools;
          const maxSteps = options?.maxSteps || config.maxSteps || 10;
          const temperature = options?.temperature ?? config.temperature ?? 0.7;

          // 转换工具为 OpenAI 格式
          const openaiTools = convertToolsToOpenAI(tools);

          // 初始化消息
          const messages: ChatCompletionMessageParam[] = [
            { role: 'system', content: config.systemPrompt },
            { role: 'user', content: userMessage },
          ];

          /** Agent 核心循环生成器 */
          const agentLoopGenerator = async function* () {
            let step = 0;
            let isCompleted = false;

            console.log('🤖 [AGENT DEBUG] Agent 开始执行', {
              用户输入: userMessage,
              最大步数: maxSteps,
              温度参数: temperature,
              可用工具: openaiTools.map((t) => t.function.name),
              工具总数: openaiTools.length,
            });

            try {
              while (step < maxSteps && !isCompleted) {
                step++;

                // 流式调用 OpenAI API
                console.log(`📡 [AGENT DEBUG] 第${step}步 - 发送API请求`, {
                  消息历史: messages.map(
                    (m) =>
                      `${m.role}: ${(m.content || '').slice(0, 50)}${
                        (m.content || '').length > 50 ? '...' : ''
                      }`,
                  ),
                  工具数量: openaiTools.length,
                  温度: temperature,
                });

                // 使用 OpenAIClientService 的流式聊天方法，支持 enableReasoning 参数和工具调用
                const response = await Effect.runPromise(
                  openAIClient.createStreamChatCompletion(messages, {
                    temperature,
                    enableReasoning: options?.enableReasoning,
                    tools: openaiTools,
                    toolChoice: 'auto' as const,
                  })
                );

                let assistantContent = '';
                const toolCallMap = new Map<number, any>();

                // 收集流式响应
                for await (const chunk of response) {
                  const delta = chunk.choices[0]?.delta;
                  if (delta?.content) {
                    assistantContent += delta.content;
                    // 实时输出增量思考内容给用户（流式）
                    yield {
                      content: delta.content, // 输出增量内容，不是累积内容
                      step,
                      isDone: false,
                      timestamp: Date.now(),
                    } as AgentStepChunk;
                  }
                  if (delta?.tool_calls) {
                    console.log('🔧 [AGENT DEBUG] 工具调用决策:', {
                      工具数量: delta.tool_calls.length,
                      工具详情: delta.tool_calls.map((tc) => ({
                        名称: tc.function?.name || 'unknown',
                        参数预览: tc.function?.arguments
                          ? tc.function.arguments.slice(0, 100) +
                            (tc.function.arguments.length > 100 ? '...' : '')
                          : 'none',
                      })),
                    });
                    // 处理流式工具调用数据
                    for (const toolCallDelta of delta.tool_calls) {
                      const index = toolCallDelta.index;
                      if (!toolCallMap.has(index)) {
                        toolCallMap.set(index, {
                          id: toolCallDelta.id,
                          type: toolCallDelta.type || 'function',
                          function: {
                            name: '',
                            arguments: '',
                          },
                        });
                      }

                      const toolCall = toolCallMap.get(index);
                      if (toolCallDelta.function?.name) {
                        toolCall.function.name += toolCallDelta.function.name;
                      }
                      if (toolCallDelta.function?.arguments) {
                        toolCall.function.arguments += toolCallDelta.function.arguments;
                      }
                    }
                  }
                  if (chunk.choices[0]?.finish_reason) {
                    console.log(`🏁 [AGENT DEBUG] 第${step}步 - API响应结束`, {
                      结束原因: chunk.choices[0]?.finish_reason,
                      总思考长度: assistantContent.length,
                      工具调用数量: toolCallMap.size,
                    });
                    break;
                  }
                }

                // 思考完成后，一次性输出完整的思考内容日志
                console.log('💭 [AGENT DEBUG] 思考过程完成:', {
                  总长度: assistantContent.length,
                  思考内容: assistantContent.length > 500
                    ? assistantContent.slice(0, 250) + '...' + assistantContent.slice(-250)
                    : assistantContent,
                });

                // 构建完整的助手消息
                const toolCalls = Array.from(toolCallMap.values());
                console.log(`🔨 [AGENT DEBUG] 第${step}步 - 助手响应分析`, {
                  思考内容:
                    assistantContent.slice(0, 200) + (assistantContent.length > 200 ? '...' : ''),
                  内容长度: assistantContent.length,
                  决定调用工具: toolCalls.length > 0,
                  工具调用: toolCalls.map((tc) => {
                    try {
                      return {
                        工具: tc.function?.name || 'unknown',
                        参数: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {},
                      };
                    } catch {
                      return {
                        工具: tc.function?.name || 'unknown',
                        参数: tc.function?.arguments || 'invalid_json',
                      };
                    }
                  }),
                });

                const assistantMessage = {
                  content: assistantContent,
                  tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
                };

                // 添加助手消息到历史
                const assistantMessageForHistory: ChatCompletionMessageParam = {
                  role: 'assistant',
                  content: assistantMessage.content || '',
                };

                // 只有在有工具调用时才添加 tool_calls 字段
                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                  assistantMessageForHistory.tool_calls = assistantMessage.tool_calls.map((tc) => ({
                    id: tc.id,
                    type: tc.type,
                    function: {
                      name: tc.function.name,
                      arguments: tc.function.arguments,
                    },
                  }));
                }

                messages.push(assistantMessageForHistory);

                // 处理工具调用
                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                  for (const toolCall of assistantMessage.tool_calls) {
                    // 处理流式工具调用格式
                    let toolName: string;
                    let toolArgs: string;

                    if (toolCall.function) {
                      toolName = toolCall.function.name;
                      toolArgs = toolCall.function.arguments;
                    } else {
                      // 不支持的工具类型，添加错误结果到消息历史
                      const unsupportedToolError = {
                        success: false,
                        error: `不支持的工具类型: ${toolCall.type || 'unknown'}`,
                        toolName: toolCall.type || 'unknown',
                        parameters: {},
                      };

                      messages.push({
                        role: 'tool',
                        content: JSON.stringify(unsupportedToolError),
                        tool_call_id: toolCall.id || `tool_${step}_${Date.now()}`,
                      });

                      // 输出工具不支持错误
                      yield {
                        content: '',
                        step,
                        toolCall: {
                          name: toolCall.type || 'unknown',
                          parameters: {},
                          result: { success: false, error: `不支持的工具类型: ${toolCall.type || 'unknown'}` }
                        },
                        isDone: false,
                        error: `不支持的工具类型: ${toolCall.type || 'unknown'}`,
                        timestamp: Date.now(),
                      } as AgentStepChunk;
                      continue;
                    }

                    const parameters = JSON.parse(toolArgs || '{}');

                    console.log(`🛠️ [AGENT DEBUG] 第${step}步 - 执行工具`, {
                      工具名称: toolName,
                      参数: parameters,
                      参数类型: typeof parameters,
                    });

                    // 流式输出工具调用信息（不包含AI思考内容）
                    yield {
                      content: '', // 工具调用不包含AI内容，避免重复
                      step,
                      toolCall: {
                        name: toolName,
                        parameters,
                        result: null,
                      },
                      isDone: false,
                      timestamp: Date.now(),
                    } as AgentStepChunk;

                    // 执行工具
                    const tool = tools.find((t: any) => t.name === toolName);
                    if (!tool) {
                      yield {
                        content: '',
                        step,
                        toolCall: {
                          name: toolName,
                          parameters,
                          result: { success: false, error: `未找到工具: ${toolName}` }
                        },
                        isDone: false,
                        error: `未找到工具: ${toolName}`,
                        timestamp: Date.now(),
                      } as AgentStepChunk;
                      continue;
                    }

                    try {
                      const startTime = Date.now();

                      // 直接执行工具，避免复杂的 Effect 类型问题
                      const toolResult = await Effect.runPromise(tool.execute(parameters));
                      const executionTime = Date.now() - startTime;

                      console.log(`✅ [AGENT DEBUG] 第${step}步 - 工具执行成功`, {
                        工具: toolName,
                        执行时间: `${executionTime}ms`,
                        结果类型: typeof toolResult,
                        结果预览:
                          JSON.stringify(toolResult).slice(0, 200) +
                          (JSON.stringify(toolResult).length > 200 ? '...' : ''),
                      });

                      // 为成功结果添加成功标识
                      const successResult = {
                        success: true,
                        data: toolResult,
                        toolName,
                        parameters,
                      };

                      // 将标准化结果添加到消息
                      messages.push({
                        role: 'tool',
                        content: JSON.stringify(successResult),
                        tool_call_id: toolCall.id || `tool_${step}_${Date.now()}`,
                      });

                      // 流式输出工具执行结果
                      yield {
                        content: '',
                        step,
                        toolCall: {
                          name: toolName,
                          parameters,
                          result: successResult,
                        },
                        isDone: false,
                        timestamp: Date.now(),
                      } as AgentStepChunk;

                      // 检查是否调用了 finish 工具
                      if (
                        toolName === 'finish' &&
                        toolResult &&
                        typeof toolResult === 'object' &&
                        'finished' in toolResult &&
                        toolResult.finished
                      ) {
                        isCompleted = true;
                        // 输出最终答案作为当前步骤的内容（不创建新步骤）
                        const answer = (toolResult as any).answer;
                        yield {
                          content: answer,
                          step,
                          toolCall: {
                            name: toolName,
                            parameters,
                            result: {
                              success: true,
                              data: toolResult,
                              toolName,
                              parameters,
                            },
                          },
                          isDone: true,
                          timestamp: Date.now(),
                        } as AgentStepChunk;
                        break;
                      }
                    } catch (error) {
                      const errorMessage = error instanceof Error ? error.message : String(error);
                      console.log(`❌ [AGENT DEBUG] 第${step}步 - 工具执行失败`, {
                        工具: toolName,
                        错误类型: error?.constructor?.name,
                        错误信息: errorMessage,
                        原始参数: parameters,
                      });

                      const errorResult = {
                        success: false,
                        error: errorMessage,
                        toolName,
                        parameters,
                      };

                      // 将错误结果添加到消息历史，让AI能够看到错误信息
                      messages.push({
                        role: 'tool',
                        content: JSON.stringify(errorResult),
                        tool_call_id: toolCall.id || `tool_${step}_${Date.now()}`,
                      });

                      // 流式输出工具执行错误
                      yield {
                        content: '',
                        step,
                        toolCall: {
                          name: toolName,
                          parameters,
                          result: errorResult,
                        },
                        isDone: false,
                        error: errorMessage,
                        timestamp: Date.now(),
                      } as AgentStepChunk;
                    }
                  }
                } else {
                  // 没有工具调用，任务完成
                  console.log(`🎯 [AGENT DEBUG] 第${step}步 - 直接完成任务`, {
                    思考内容:
                      assistantContent.slice(0, 100) + (assistantContent.length > 100 ? '...' : ''),
                    无工具调用: true,
                  });
                  isCompleted = true;
                }

                if (isCompleted) {
                  console.log(`🎉 [AGENT DEBUG] 第${step}步 - 任务完成`, {
                    总步数: step,
                    完成方式: toolCalls.length > 0 ? '工具调用' : '直接回答',
                  });
                  break;
                }
              }

              // 处理超时情况
              if (step >= maxSteps && !isCompleted) {
                console.log(`⏰ [AGENT DEBUG] 达到最大步数限制`, {
                  最大步数: maxSteps,
                  实际执行步数: step,
                  状态: '未完成',
                });
                yield {
                  content: `达到最大步数限制 (${maxSteps})，任务可能未完成。`,
                  step,
                  isDone: true,
                  error: '最大步数限制',
                  timestamp: Date.now(),
                } as AgentStepChunk;
              }

              console.log('✨ [AGENT DEBUG] Agent 执行完成', {
                总步数: step,
                是否完成: isCompleted,
              });
            } catch (error) {
              console.log('💥 [AGENT DEBUG] Agent 循环异常:', {
                error: error instanceof Error ? error.message : String(error),
                errorType: error?.constructor?.name,
              });
              yield {
                content: '',
                step,
                isDone: true,
                error: error instanceof Error ? error.message : String(error),
                timestamp: Date.now(),
              } as AgentStepChunk;
            }
          };

          // 创建异步可迭代对象
          const asyncIterable = async function* () {
            const generator = agentLoopGenerator();
            for await (const chunk of generator) {
              yield chunk;
            }
          };

          // 转换为 Effect Stream
          return Stream.fromAsyncIterable(
            asyncIterable(),
            (error) => new Error(`Agent stream failed: ${error}`),
          );
        }),
    };
  }),
}) {}
