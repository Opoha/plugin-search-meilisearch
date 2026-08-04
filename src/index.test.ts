import type { SearchProvider } from '@opoha/plugin-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import plugin from './index.js';
import { resetMeilisearchConfigForTests } from './settings.js';

function createContext() {
  const registerSearchProvider = vi.fn();
  const registerGraphQL = vi.fn();
  const registerAdmin = vi.fn();
  const ctx = {
    pluginId: 'search-meilisearch',
    registerGraphQL,
    registerProvider: vi.fn(),
    registerListener: vi.fn(),
    registerAdmin,
    registerPaymentProvider: vi.fn(),
    registerShippingMethod: vi.fn(),
    registerTaxProvider: vi.fn(),
    registerPromotionRuleProvider: vi.fn(),
    registerNotificationProvider: vi.fn(),
    registerStorageAdapter: vi.fn(),
    registerSearchProvider,
  };
  return { ctx, registerSearchProvider, registerGraphQL, registerAdmin };
}

describe('plugin-search-meilisearch', () => {
  afterEach(() => {
    resetMeilisearchConfigForTests();
    delete process.env.OPOHA_MEILISEARCH_HOST;
    delete process.env.OPOHA_MEILISEARCH_ENABLED;
  });

  it('declares id search-meilisearch and engines.search = [meilisearch]', () => {
    expect(plugin.id).toBe('search-meilisearch');
  });

  it('registers a SearchProvider with code meilisearch on boot', async () => {
    const { ctx, registerSearchProvider } = createContext();
    await plugin.boot?.(ctx as never);

    expect(registerSearchProvider).toHaveBeenCalledTimes(1);
    const provider = registerSearchProvider.mock.calls[0]?.[0] as SearchProvider;
    expect(provider.code).toBe('meilisearch');
    expect(provider.displayName).toBe('Meilisearch');
    expect(typeof provider.indexDocument).toBe('function');
    expect(typeof provider.deleteDocument).toBe('function');
    expect(typeof provider.search).toBe('function');
  });

  it('registers admin nav/settings + plugin:search-meilisearch:* permissions', async () => {
    const { ctx, registerAdmin } = createContext();
    await plugin.boot?.(ctx as never);

    expect(registerAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions: ['plugin:search-meilisearch:read', 'plugin:search-meilisearch:configure'],
      }),
    );
  });

  it('registers a meilisearchConfig GraphQL query', async () => {
    const { ctx, registerGraphQL } = createContext();
    await plugin.boot?.(ctx as never);

    expect(registerGraphQL).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'meilisearchConfig', kind: 'query' }),
    );
  });

  it('applies OPOHA_MEILISEARCH_* env at boot', async () => {
    process.env.OPOHA_MEILISEARCH_HOST = 'http://meili.example:7700';
    process.env.OPOHA_MEILISEARCH_ENABLED = 'false';
    const { ctx, registerSearchProvider } = createContext();
    await plugin.boot?.(ctx as never);

    const provider = registerSearchProvider.mock.calls[0]?.[0] as SearchProvider;
    const result = await provider.search({ query: 'x', type: 'product' });
    expect(result.hits).toEqual([]);
  });
});
