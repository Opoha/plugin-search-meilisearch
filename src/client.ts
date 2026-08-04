/**
 * Minimal Meilisearch REST client (no `meilisearch` SDK dependency — Meilisearch's
 * HTTP API is small enough that native `fetch` covers indexing/search/delete).
 * @see https://www.meilisearch.com/docs/reference/api/documents
 * @see https://www.meilisearch.com/docs/reference/api/search
 */

export type MeilisearchClientOptions = {
  host: string;
  apiKey?: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

export type MeilisearchTask = {
  taskUid: number;
  indexUid: string;
  status: 'enqueued' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  type: string;
};

export type MeilisearchSearchResult = {
  hits: Array<Record<string, unknown>>;
  estimatedTotalHits?: number;
  query: string;
  processingTimeMs?: number;
};

export type MeilisearchSearchOptions = {
  limit?: number;
  offset?: number;
  filter?: string | string[];
};

/** Thrown when the Meilisearch HTTP API responds with a non-2xx status. */
export class MeilisearchApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Meilisearch API error ${status}: ${body}`);
    this.name = 'MeilisearchApiError';
  }
}

export class MeilisearchClient {
  private readonly host: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MeilisearchClientOptions) {
    this.host = options.host.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private async request<T>(path: string, init: { method: string; body?: unknown }): Promise<T> {
    const response = await this.fetchImpl(`${this.host}${path}`, {
      method: init.method,
      headers: this.headers(),
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new MeilisearchApiError(response.status, text);
    }
    return text.length > 0 ? (JSON.parse(text) as T) : (undefined as T);
  }

  /** Upsert documents into an index (creates the index implicitly on first write). */
  async addOrUpdateDocuments(
    indexUid: string,
    documents: Array<Record<string, unknown>>,
  ): Promise<MeilisearchTask> {
    return this.request<MeilisearchTask>(`/indexes/${encodeURIComponent(indexUid)}/documents`, {
      method: 'PUT',
      body: documents,
    });
  }

  async deleteDocument(indexUid: string, documentId: string): Promise<MeilisearchTask> {
    return this.request<MeilisearchTask>(
      `/indexes/${encodeURIComponent(indexUid)}/documents/${encodeURIComponent(documentId)}`,
      { method: 'DELETE' },
    );
  }

  async search(
    indexUid: string,
    query: string,
    options: MeilisearchSearchOptions = {},
  ): Promise<MeilisearchSearchResult> {
    return this.request<MeilisearchSearchResult>(
      `/indexes/${encodeURIComponent(indexUid)}/search`,
      {
        method: 'POST',
        body: {
          q: query,
          limit: options.limit,
          offset: options.offset,
          filter: options.filter,
        },
      },
    );
  }
}
