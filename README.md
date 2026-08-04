# Meilisearch Search Plugin

Official `@opoha/plugin-search-meilisearch` — registers a `SearchProvider` with the Opoha core `SearchEngine`.

Core never imports this package or a Meilisearch client — it only calls `SearchEngine.indexDocument` / `deleteDocument` / `search`, which the plugin-loader routes to whichever `SearchProvider` a plugin has registered (`core-module-boundaries-design.md`).

## What it registers

- Search provider `meilisearch` — `indexDocument` / `deleteDocument` / `search` mapped onto the [Meilisearch HTTP API](https://www.meilisearch.com/docs/reference/api/overview) document and search shapes (no `meilisearch` SDK dependency — a small `fetch`-based client is enough)
- GraphQL query contribution `meilisearchConfig`
- Admin settings + nav under `/plugins/search-meilisearch`
- Permissions `plugin:search-meilisearch:read` / `plugin:search-meilisearch:configure`

Documents are indexed per type into `${OPOHA_MEILISEARCH_INDEX_PREFIX}_${type}s` (e.g. `opoha_products`). Products flow in automatically via core catalog event listeners publishing `ProductCreated` / `ProductUpdated` / `ProductDeleted`.

## Configuration

See `.env.example` — `OPOHA_MEILISEARCH_HOST`, `OPOHA_MEILISEARCH_API_KEY` (secret, never committed), `OPOHA_MEILISEARCH_INDEX_PREFIX`, `OPOHA_MEILISEARCH_ENABLED`.

## Load

```bash
pnpm install && pnpm build
export OPOHA_PLUGINS="$(pwd)"
```

Core discovers via `OPOHA_PLUGINS` / `OPOHA_PLUGINS_PATH` and dynamically imports `dist/index.js` — core never statically imports this package.

## Run Meilisearch locally

```bash
docker run -p 7700:7700 getmeili/meilisearch:latest
```
