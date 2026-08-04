import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MeilisearchApiError, MeilisearchClient } from './client.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('MeilisearchClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
  });

  it('upserts documents via PUT /indexes/:indexUid/documents with bearer auth', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        taskUid: 1,
        indexUid: 'opoha_products',
        status: 'enqueued',
        type: 'documentAdditionOrUpdate',
      }),
    );
    const client = new MeilisearchClient({
      host: 'http://localhost:7700',
      apiKey: 'secret-key',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const task = await client.addOrUpdateDocuments('opoha_products', [
      { id: 'p1', title: 'Widget' },
    ]);

    expect(task.status).toBe('enqueued');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:7700/indexes/opoha_products/documents',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify([{ id: 'p1', title: 'Widget' }]),
      }),
    );
  });

  it('deletes a document via DELETE /indexes/:indexUid/documents/:id', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        taskUid: 2,
        indexUid: 'opoha_products',
        status: 'enqueued',
        type: 'documentDeletion',
      }),
    );
    const client = new MeilisearchClient({
      host: 'http://localhost:7700',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await client.deleteDocument('opoha_products', 'p1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:7700/indexes/opoha_products/documents/p1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('searches via POST /indexes/:indexUid/search', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        hits: [{ id: 'p1', title: 'Widget' }],
        estimatedTotalHits: 1,
        query: 'widget',
      }),
    );
    const client = new MeilisearchClient({
      host: 'http://localhost:7700',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const result = await client.search('opoha_products', 'widget', {
      limit: 20,
      offset: 0,
    });

    expect(result.hits).toHaveLength(1);
    expect(result.estimatedTotalHits).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:7700/indexes/opoha_products/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ q: 'widget', limit: 20, offset: 0, filter: undefined }),
      }),
    );
  });

  it('throws MeilisearchApiError on non-2xx responses', async () => {
    fetchMock.mockResolvedValue(new Response('index not found', { status: 404 }));
    const client = new MeilisearchClient({
      host: 'http://localhost:7700',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(client.search('missing_index', 'x')).rejects.toBeInstanceOf(MeilisearchApiError);
  });

  it('strips trailing slashes from host', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ hits: [], query: '' }));
    const client = new MeilisearchClient({
      host: 'http://localhost:7700/',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await client.search('opoha_products', '');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:7700/indexes/opoha_products/search',
      expect.anything(),
    );
  });
});
