import { ref } from 'vue';
import { getOpenAIConfig } from '../utils/env';

/** OpenAI 配置接口 */
export interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

/**
 * OpenAI 配置管理 Composable Hook
 * 提供配置的加载、保存和验证功能
 */
export function useOpenAIConfig() {
  /** 配置状态 */
  const apiKey = ref('');
  const model = ref('gpt-3.5-turbo');
  const baseUrl = ref('https://api.openai.com/v1');
  const showSettings = ref(false);

  /**
   * 从环境变量和本地存储加载配置
   */
  const loadConfig = (): void => {
    const envConfig = getOpenAIConfig();
    apiKey.value = envConfig.apiKey || localStorage.getItem('micro-agent-api-key') || '';
    model.value = envConfig.model || localStorage.getItem('micro-agent-model') || 'gpt-3.5-turbo';
    baseUrl.value =
      envConfig.baseUrl ||
      localStorage.getItem('micro-agent-base-url') ||
      'https://api.openai.com/v1';
  };

  /**
   * 保存配置到本地存储
   */
  const saveConfig = (): void => {
    localStorage.setItem('micro-agent-api-key', apiKey.value);
    localStorage.setItem('micro-agent-model', model.value);
    localStorage.setItem('micro-agent-base-url', baseUrl.value);
    showSettings.value = false;
  };

  /**
   * 检查配置是否完整
   * @returns 配置是否有效
   */
  const hasValidConfig = (): boolean => {
    return !!(apiKey.value && model.value);
  };

  /**
   * 获取当前配置对象
   * @returns OpenAI 配置对象
   */
  const getConfig = (): OpenAIConfig => ({
    apiKey: apiKey.value,
    model: model.value,
    baseUrl: baseUrl.value,
  });

  /**
   * 重置配置为默认值
   */
  const resetConfig = (): void => {
    apiKey.value = '';
    model.value = 'gpt-3.5-turbo';
    baseUrl.value = 'https://api.openai.com/v1';
  };

  /**
   * 从环境变量加载配置（覆盖本地配置）
   */
  const loadFromEnv = (): void => {
    const envConfig = getOpenAIConfig();
    if (envConfig.apiKey) apiKey.value = envConfig.apiKey;
    if (envConfig.model) model.value = envConfig.model;
    if (envConfig.baseUrl) baseUrl.value = envConfig.baseUrl;
  };

  return {
    // 配置状态
    apiKey,
    model,
    baseUrl,
    showSettings,

    // 方法
    loadConfig,
    saveConfig,
    hasValidConfig,
    getConfig,
    resetConfig,
    loadFromEnv,
  };
}