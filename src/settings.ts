import { z } from 'zod';

/**
 * Zod schema for Meilisearch plugin settings.
 * `apiKey` is intentionally excluded — it is read from env at call time and
 * never persisted or logged (security-devsecops rule: no secrets in config rows).
 */
export const meilisearchConfigSchema = z.object({
  host: z.string().min(1).default('http://localhost:7700'),
  indexPrefix: z.string().min(1).default('opoha'),
  enabled: z.boolean().default(true),
});

export type MeilisearchConfig = z.infer<typeof meilisearchConfigSchema>;

export const DEFAULT_MEILISEARCH_CONFIG: MeilisearchConfig = meilisearchConfigSchema.parse({});

let runtimeConfig: MeilisearchConfig = { ...DEFAULT_MEILISEARCH_CONFIG };

/** Read non-secret config from env (OPOHA_MEILISEARCH_*). Applied once at boot. */
export function meilisearchConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Partial<MeilisearchConfig> {
  const partial: Partial<MeilisearchConfig> = {};
  const host = env.OPOHA_MEILISEARCH_HOST?.trim();
  if (host) {
    partial.host = host;
  }
  const indexPrefix = env.OPOHA_MEILISEARCH_INDEX_PREFIX?.trim();
  if (indexPrefix) {
    partial.indexPrefix = indexPrefix;
  }
  const enabledRaw = env.OPOHA_MEILISEARCH_ENABLED;
  if (enabledRaw !== undefined && enabledRaw !== '') {
    const normalized = enabledRaw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      partial.enabled = true;
    } else if (['0', 'false', 'no', 'off'].includes(normalized)) {
      partial.enabled = false;
    } else {
      throw new Error(`OPOHA_MEILISEARCH_ENABLED must be a boolean-like value (got ${enabledRaw})`);
    }
  }
  return partial;
}

/** Secret API key read directly from env — never stored on the config object. */
export function meilisearchApiKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const apiKey = env.OPOHA_MEILISEARCH_API_KEY?.trim();
  return apiKey && apiKey.length > 0 ? apiKey : undefined;
}

export function getMeilisearchConfig(): MeilisearchConfig {
  return { ...runtimeConfig };
}

export function setMeilisearchConfig(input: Partial<MeilisearchConfig>): MeilisearchConfig {
  runtimeConfig = meilisearchConfigSchema.parse({
    ...runtimeConfig,
    ...input,
  });
  return getMeilisearchConfig();
}

/** Test helper — reset module state between Vitest cases. */
export function resetMeilisearchConfigForTests(): void {
  runtimeConfig = { ...DEFAULT_MEILISEARCH_CONFIG };
}

/** Resolve the prefixed index name for a search document type. */
export function meilisearchIndexUid(
  config: Pick<MeilisearchConfig, 'indexPrefix'>,
  type: string,
): string {
  return `${config.indexPrefix}_${type}s`;
}
