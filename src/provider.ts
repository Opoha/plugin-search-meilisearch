import type {
  SearchDeleteInput,
  SearchDocument,
  SearchProvider,
  SearchQueryInput,
  SearchQueryResult,
} from '@opoha/plugin-sdk';

import { MeilisearchClient } from './client.js';
import {
  getMeilisearchConfig,
  meilisearchApiKeyFromEnv,
  meilisearchConfigSchema,
  meilisearchIndexUid,
} from './settings.js';

function toMeilisearchDocument(document: SearchDocument): Record<string, unknown> {
  return {
    id: document.id,
    title: document.title,
    slug: document.slug,
    description: document.description ?? null,
    ...document.metadata,
  };
}

function fromMeilisearchHit(
  hit: Record<string, unknown>,
  type: string,
): SearchQueryResult['hits'][number] {
  const formatted = hit._formatted as Record<string, unknown> | undefined;
  return {
    id: String(hit.id),
    type,
    score: typeof hit._rankingScore === 'number' ? hit._rankingScore : undefined,
    title: typeof hit.title === 'string' ? hit.title : undefined,
    slug: typeof hit.slug === 'string' ? hit.slug : undefined,
    highlight: typeof formatted?.description === 'string' ? formatted.description : undefined,
  };
}

/**
 * Build the Meilisearch SearchProvider. A fresh `MeilisearchClient` is created
 * per call from current config/env so admin settings changes take effect
 * without a restart (mirrors flat-rate shipping's env-first + runtime config).
 */
export function createMeilisearchProvider(
  clientFactory: (host: string, apiKey?: string) => MeilisearchClient = (host, apiKey) =>
    new MeilisearchClient({ host, apiKey }),
): SearchProvider {
  return {
    code: 'meilisearch',
    displayName: 'Meilisearch',
    configSchema: meilisearchConfigSchema,

    async indexDocument(document: SearchDocument): Promise<void> {
      const config = getMeilisearchConfig();
      if (!config.enabled) {
        return;
      }
      const client = clientFactory(config.host, meilisearchApiKeyFromEnv());
      const indexUid = meilisearchIndexUid(config, document.type);
      await client.addOrUpdateDocuments(indexUid, [toMeilisearchDocument(document)]);
    },

    async deleteDocument(input: SearchDeleteInput): Promise<void> {
      const config = getMeilisearchConfig();
      if (!config.enabled) {
        return;
      }
      const client = clientFactory(config.host, meilisearchApiKeyFromEnv());
      const indexUid = meilisearchIndexUid(config, input.type ?? 'product');
      await client.deleteDocument(indexUid, input.id);
    },

    async search(input: SearchQueryInput): Promise<SearchQueryResult> {
      const config = getMeilisearchConfig();
      const type = input.type ?? 'product';
      if (!config.enabled) {
        return {
          query: input.query,
          hits: [],
          total: 0,
          providerCode: 'meilisearch',
          limit: input.limit,
          offset: input.offset,
        };
      }
      const client = clientFactory(config.host, meilisearchApiKeyFromEnv());
      const indexUid = meilisearchIndexUid(config, type);
      const result = await client.search(indexUid, input.query, {
        limit: input.limit,
        offset: input.offset,
      });
      return {
        query: result.query ?? input.query,
        hits: result.hits.map((hit) => fromMeilisearchHit(hit, type)),
        total: result.estimatedTotalHits ?? result.hits.length,
        providerCode: 'meilisearch',
        limit: input.limit,
        offset: input.offset,
      };
    },
  };
}
