/**
 * 环境变量配置工具
 */

/**
 * OpenAI API 配置接口
 */
export interface OpenAIConfig {
  /** API 密钥 */
  apiKey: string;
  /** API 基础URL */
  baseUrl: string;
  /** 默认模型 */
  model: string;
  /** 是否显示思考过程 */
  showReasoningContent: boolean;
  /** 思考过程程度 */
  reasoningEffort: string;
}

/**
 * 获取 OpenAI 配置
 */
export function getOpenAIConfig(): OpenAIConfig {
  return {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
    baseUrl: import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo',
    showReasoningContent: import.meta.env.VITE_SHOW_REASONING_CONTENT === 'true',
    reasoningEffort: import.meta.env.VITE_REASONING_EFFORT || 'medium'
  };
}

/**
 * 检查 OpenAI 配置是否完整
 */
export function isOpenAIConfigured(): boolean {
  const config = getOpenAIConfig();
  return !!(config.apiKey && config.baseUrl && config.model);
}

/**
 * 验证 OpenAI 配置
 * @returns 验证结果和错误信息
 */
export function validateOpenAIConfig(): { isValid: boolean; errors: string[] } {
  const config = getOpenAIConfig();
  const errors: string[] = [];

  if (!config.apiKey) {
    errors.push('API 密钥未配置');
  } else if (!config.apiKey.startsWith('sk-')) {
    errors.push('API 密钥格式不正确');
  }

  if (!config.baseUrl) {
    errors.push('Base URL 未配置');
  } else {
    try {
      new URL(config.baseUrl);
    } catch {
      errors.push('Base URL 格式不正确');
    }
  }

  if (!config.model) {
    errors.push('模型未配置');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}