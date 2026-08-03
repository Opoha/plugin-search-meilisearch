import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MeilisearchClient } from './client.js';
import { createMeilisearchProvider } from './provider.js';
import {
  resetMeilisearchConfigForTests,
  setMeilisearchConfig,
} from './settings.js';

describe('createMeilisearchProvider (Phase 4 A-04 — Meilisearch shapes)', () => {
  let addOrUpdateDocuments: ReturnType<typeof vi.fn>;
  let deleteDocument: ReturnType<typeof vi.fn>;
  let search: ReturnType<typeof vi.fn>;
  let lastHost: string | undefined;
  let lastApiKey: string | undefined;

  beforeEach(() => {
    resetMeilisearchConfigForTests();
    addOrUpdateDocuments = vi.fn().mockResolvedValue({
      taskUid: 1,
      indexUid: 'opoha_products',
      status: 'enqueued',
      type: 'documentAdditionOrUpdate',
    });
    deleteDocument = vi.fn().mockResolvedValue({
      taskUid: 2,
      indexUid: 'opoha_products',
      status: 'enqueued',
      type: 'documentDeletion',
    });
    search = vi.fn().mockResolvedValue({
      hits: [
        {
          id: 'p1',
          title: 'Widget',
          slug: 'widget',
          _rankingScore: 0.9,
          _formatted: { description: '<em>Widget</em> for sale' },
        },
      ],
      estimatedTotalHits: 1,
      query: 'widget',
    });
  });

  afterEach(() => {
    resetMeilisearchConfigForTests();
  });

  function provider() {
    return createMeilisearchProvider((host, apiKey) => {
      lastHost = host;
      lastApiKey = apiKey;
      return {
        addOrUpdateDocuments,
        deleteDocument,
        search,
      } as unknown as MeilisearchClient;
    });
  }

  it('indexes a SearchDocument as a Meilisearch document (code + shape)', async () => {
    const p = provider();
    expect(p.code).toBe('meilisearch');
    expect(p.displayName).toBe('Meilisearch');

    await p.indexDocument({
      id: 'p1',
      type: 'product',
      title: 'Widget',
      slug: 'widget',
      description: 'A widget',
      metadata: { isActive: true },
    });

    expect(addOrUpdateDocuments).toHaveBeenCalledWith('opoha_products', [
      {
        id: 'p1',
        title: 'Widget',
        slug: 'widget',
        description: 'A widget',
        isActive: true,
      },
    ]);
  });

  it('deletes a document from the type-scoped index', async () => {
    await provider().deleteDocument({ id: 'p1', type: 'product' });
    expect(deleteDocument).toHaveBeenCalledWith('opoha_products', 'p1');
  });

  it('maps Meilisearch search hits into SearchQueryResult', async () => {
    const result = await provider().search({ query: 'widget', type: 'product' });

    expect(search).toHaveBeenCalledWith('opoha_products', 'widget', {
      limit: undefined,
      offset: undefined,
    });
    expect(result.providerCode).toBe('meilisearch');
    expect(result.total).toBe(1);
    expect(result.hits).toEqual([
      {
        id: 'p1',
        type: 'product',
        score: 0.9,
        title: 'Widget',
        slug: 'widget',
        highlight: '<em>Widget</em> for sale',
      },
    ]);
  });

  it('uses configured host / index prefix / env api key', async () => {
    setMeilisearchConfig({ host: 'http://meili.internal:7700', indexPrefix: 'shop' });
    process.env.OPOHA_MEILISEARCH_API_KEY = 'from-env';
    try {
      await provider().deleteDocument({ id: 'p9', type: 'product' });
      expect(lastHost).toBe('http://meili.internal:7700');
      expect(lastApiKey).toBe('from-env');
      expect(deleteDocument).toHaveBeenCalledWith('shop_products', 'p9');
    } finally {
      delete process.env.OPOHA_MEILISEARCH_API_KEY;
    }
  });

  it('soft-noops index/delete and returns empty search when disabled', async () => {
    setMeilisearchConfig({ enabled: false });
    const p = provider();

    await p.indexDocument({ id: 'p1', type: 'product', title: 'Widget' });
    await p.deleteDocument({ id: 'p1', type: 'product' });
    const result = await p.search({ query: 'widget' });

    expect(addOrUpdateDocuments).not.toHaveBeenCalled();
    expect(deleteDocument).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(result).toMatchObject({ hits: [], total: 0, providerCode: 'meilisearch' });
  });
});
