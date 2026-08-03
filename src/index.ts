import { definePlugin } from '@opoha/plugin-sdk';

import { createMeilisearchProvider } from './provider.js';
import {
  getMeilisearchConfig,
  meilisearchConfigFromEnv,
  setMeilisearchConfig,
  type MeilisearchConfig,
} from './settings.js';

export { MeilisearchClient, MeilisearchApiError } from './client.js';
export type {
  MeilisearchTask,
  MeilisearchSearchResult,
  MeilisearchSearchOptions,
  MeilisearchClientOptions,
} from './client.js';
export { createMeilisearchProvider } from './provider.js';
export {
  DEFAULT_MEILISEARCH_CONFIG,
  getMeilisearchConfig,
  meilisearchApiKeyFromEnv,
  meilisearchConfigFromEnv,
  meilisearchConfigSchema,
  meilisearchIndexUid,
  resetMeilisearchConfigForTests,
  setMeilisearchConfig,
} from './settings.js';
export type { MeilisearchConfig } from './settings.js';

/**
 * Official Meilisearch search plugin (Phase 4 A-04).
 * Registers a SearchProvider that indexes catalog products and serves
 * `searchProducts` queries via the core SearchEngine — core never imports
 * this package or any Meilisearch client (boundary: core-module-boundaries-design.md).
 */
export default definePlugin({
  id: 'search-meilisearch',
  boot(ctx) {
    const fromEnv = meilisearchConfigFromEnv();
    if (Object.keys(fromEnv).length > 0) {
      setMeilisearchConfig(fromEnv);
    }

    ctx.registerSearchProvider(createMeilisearchProvider());

    ctx.registerGraphQL({
      name: 'meilisearchConfig',
      kind: 'query',
      descriptor: {
        resolve: (): MeilisearchConfig => getMeilisearchConfig(),
      },
    });

    ctx.registerAdmin({
      navigation: [
        {
          id: 'search-meilisearch-nav',
          label: 'Meilisearch',
          path: '/plugins/search-meilisearch',
          permission: 'plugin:search-meilisearch:read',
        },
      ],
      settings: [
        {
          id: 'search-meilisearch-settings',
          title: 'Meilisearch',
          path: '/plugins/search-meilisearch/settings',
          permission: 'plugin:search-meilisearch:configure',
        },
      ],
      permissions: [
        'plugin:search-meilisearch:read',
        'plugin:search-meilisearch:configure',
      ],
    });
  },
});
