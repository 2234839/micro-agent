import { Effect } from 'effect';
import { EnvConfigService, type OpenAIConfig } from './env-config';

/** OpenAI 配置服务 */
export class OpenAIConfigService extends Effect.Service<OpenAIConfigService>()(
  'OpenAIConfigService',
  {
    dependencies: [EnvConfigService.Default],
    effect: Effect.gen(function* () {
      const envConfig = yield* EnvConfigService;
      return envConfig.openai;
    }),
  },
) {}

/** 重新导出 OpenAIConfig 类型 */
export type { OpenAIConfig };

