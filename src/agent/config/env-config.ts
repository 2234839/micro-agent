import { Config, Effect } from 'effect';

/** OpenAI 配置接口 */
export interface OpenAIConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
}

/** 环境变量配置接口 */
export interface EnvConfig {
  readonly openai: OpenAIConfig;
}

/** 环境变量服务 */
export class EnvConfigService extends Effect.Service<EnvConfigService>()(
  'EnvConfigService',
  {
    effect: Effect.gen(function* () {
      // OpenAI 相关环境变量
      const openaiApiKey = yield* Config.string('VITE_OPENAI_API_KEY').pipe(
        Config.withDefault(import.meta.env.VITE_OPENAI_API_KEY || ''),
      );

      const openaiBaseUrl = yield* Config.string('VITE_OPENAI_BASE_URL').pipe(
        Config.withDefault(import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'),
      );

      const openaiModel = yield* Config.string('VITE_OPENAI_MODEL').pipe(
        Config.withDefault(import.meta.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo'),
      );

      const openaiTemperature = yield* Config.number('VITE_OPENAI_TEMPERATURE').pipe(
        Config.withDefault(0.7),
      );

      const openaiMaxTokens = yield* Config.number('VITE_OPENAI_MAX_TOKENS').pipe(
        Config.withDefault(2000),
      );

      const reasoningEffort = yield* Config.string('VITE_REASONING_EFFORT').pipe(
        Config.withDefault('medium'),
        Config.map((effort): 'minimal' | 'low' | 'medium' | 'high' => {
          const validEfforts = ['minimal', 'low', 'medium', 'high'];
          if (validEfforts.includes(effort)) {
            return effort as 'minimal' | 'low' | 'medium' | 'high';
          }
          return 'medium';
        }),
      );

      const config: EnvConfig = {
        openai: {
          apiKey: openaiApiKey,
          baseUrl: openaiBaseUrl,
          model: openaiModel,
          temperature: openaiTemperature,
          maxTokens: openaiMaxTokens,
          reasoningEffort,
        },
      };

      return config;
    }),
  },
) {}