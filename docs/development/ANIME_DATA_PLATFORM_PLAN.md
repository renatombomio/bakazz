# BAKAZZ Anime Data Platform — architecture proposal

> Status: architecture proposal; not yet implemented  
> Date: 2026-11-24  
> Target branch: `feature/renanime-2.0-workspace`  
> Supabase target for all implementation/testing: Development only (`pakkdnfifrshqyqedpni`)

## 1. Objective

Make BAKAZZ independent of live AniList/Jikan calls for normal page rendering. BAKAZZ should own a curated, persistent anime catalogue and internal read APIs. External providers become ingestion/enrichment sources, not runtime dependencies for every visitor.

Target user experience:
- Anime detail pages render from BAKAZZ's database.
- Search reads the local catalogue first.
- Library, likes, comments, debates, duels, profiles and character relations keep using stable anime identifiers.
- Missing provider data never blocks a page from rendering or prevents a known catalogue item from being saved.
- External calls are bounded, controlled, observable and made only for explicit ingestion/enrichment or a controlled search miss.

This is a staged plan, not a claim that these capabilities already exist.

## 2. Current audit findings

### Direct provider calls in runtime paths
- `src/pages/anime/[slug].astro` calls AniList during SSR to check a numeric anime ID not found in the static local library.
- `src/components/anime/AnimeDetail.tsx` resolves the detail from the browser. It calls AniList directly, retries provider failures, searches by title for non-canonical IDs and uses browser localStorage as its detail cache.
- `src/pages/api/anime/[id]/characters.ts` reads the local `anime_characters` / `characters` tables first, but when no rows are found it calls AniList and writes the result back using `sync_anime_character_catalog`. A user opening a page can therefore trigger catalogue ingestion.
- `src/data/personal-library.ts` resolves MAL IDs by making a direct AniList call before saving.
- `src/pages/u/[aka].astro` contains direct AniList lookups for profile library titles and shared anime.
- `src/pages/api/profile/character-favorites.ts` also fetches anime titles from AniList.
- Search and discovery have shared persistent cache support, but it does not provide a complete normalized catalogue for all detail and social features.
- `src/lib/server/anilist-gateway.ts` has a shared-slot limiter, while several browser and server paths call providers without using that gateway. The result is inconsistent timeout, retry, rate-limit and caching behavior.

### Existing database facts
Development contains:
- `public.user_anime`: user library rows with integer `anime_id` values.
- `public.anime_likes`, `public.anime_comments`, `public.anime_of_the_week`, `public.duel_votes`, debates with optional anime IDs and the anime-character relation tables: they also use integer anime identifiers.
- `public.characters`: 1,507 rows.
- `public.anime_characters`: 1,549 rows.
- `private.anime_search_cache` and lock/config tables for persistent cache.
- No dedicated master anime metadata catalogue table was present in the inspected Development table inventory.

The current identifier convention is AniList numeric ID. Preserve it during the first implementation to avoid breaking existing data and relationships. Do not migrate IDs to a new internal sequence as part of this project.

## 3. Target architecture

```text
Browser / Astro pages
        |
        v
BAKAZZ internal read APIs
  /api/anime/:id
  /api/anime/search
  /api/anime/:id/characters
        |
        v
Supabase Development / Production (separate environments)
  anime_catalog
  anime_catalog_aliases / external IDs
  characters + anime_characters
  existing user/social tables
        ^
        |
Controlled ingestion and enrichment jobs
        |
        v
AniList / Jikan / other approved providers
```

The browser and normal SSR page render must not call AniList or Jikan directly.

## 4. Catalogue data model proposal

Design the schema before writing a migration. Proposed entities:

### `public.anime_catalog`
One canonical row per anime. For compatibility, `id` should initially be the AniList numeric ID already used throughout BAKAZZ.

Proposed fields (final types/constraints require migration review):
- `id` — canonical AniList numeric ID, primary key.
- `mal_id` — nullable MAL ID, unique when present.
- `title_romaji`, `title_english`, `title_native`.
- `synonyms` — alternate titles for local search.
- `description`, `genres`, `format`, `status`.
- `start_year`, `start_month`, `start_day`, `season`, `season_year`.
- `episodes`, `duration_minutes`, `average_score`.
- `cover_image_url`, `banner_image_url`, `trailer`.
- `studios`, `relations`, `recommendations` (structured JSON only where useful; avoid duplicating large provider payloads).
- `source`, `source_updated_at`, `synced_at`, `created_at`, `updated_at`.
- `catalog_status` or `is_published` to distinguish imported/reviewed items from unreviewed candidates.

Use a deliberately selected field set, not a raw copy of every provider response. Add database indexes for title lookup, MAL ID, format, year, status and any real filter/sort query.

### External identity mapping
Prefer a separate `anime_external_ids` table if BAKAZZ expects more than AniList and MAL:
- provider key (e.g. `anilist`, `mal`, `kitsu`)
- external ID
- canonical BAKAZZ anime ID
- unique(provider, external_id)

This avoids binding the whole product permanently to one upstream ID provider. For the first release, however, keep AniList ID as the canonical integer to preserve compatibility with current tables.

### Alternate title lookup
Use either a normalized alias table or a generated normalized search column, with a unique/indexed normalized representation where practical. Avoid fuzzy full-table scans for every keystroke. Exact normalized title and prefix/trigram search can be considered after inspecting Postgres extensions and query plans.

### Existing character catalogue
Keep `characters` and `anime_characters`; they are already populated. Character metadata and relations should be refreshed by controlled ingestion, not by page-view-triggered writes. Keep character likes and aggregate counters independent of provider sync.

## 5. Internal BAKAZZ API contract

All client requests should target BAKAZZ-owned endpoints. Proposed contract:

### `GET /api/anime/:id`
- Read one row from `anime_catalog`.
- Return a stable, provider-neutral response shape.
- Return 404 when the ID is not in the published catalogue.
- Never call AniList/Jikan synchronously on a normal detail-page request.
- Public cache headers may be used for published catalogue data; user-specific state must be fetched separately and never included in a shared CDN response.

### `GET /api/anime/search?q=&page=&genre=&year=&format=`
- Search the local catalogue first.
- Cap page size and query length.
- Normalize search terms and filters for deterministic cache keys.
- Use indexed queries and stable pagination.
- Return metadata indicating local result source and whether a controlled fallback was used, without exposing provider errors or internal credentials.

### `GET /api/anime/:id/characters?page=`
- Read the existing local character relations and character rows.
- Return local results immediately.
- Do not make an upstream request because a user opened the page.
- If no local character data exists, return an empty/not-yet-catalogued state; enrichment is performed separately.

### Private ingestion API / job
- A server-only job imports/upserts catalogue records and character relations.
- It must require a dedicated secret/cron authorization and must never be callable by anonymous browser requests.
- It must not use a Supabase secret key in client code.
- Prefer scheduled batch jobs and controlled scripts over a public “sync on page view” endpoint.
- If a manual curation interface is later needed, authorize it with a verified server-side role/allowlist; do not assume a profile nickname is an admin role.

## 6. When external API calls are allowed

| Situation | Provider call? | Behavior |
|---|---|---|
| Open a known anime detail page | No | Read local catalogue |
| Refresh a known detail page | No | Serve local data; refresh only via scheduled job |
| Search a title already in catalogue | No | Local indexed search |
| Search returns no local result | Conditional | One controlled provider search may run after rate-limit/circuit-breaker checks; cache result and do not repeat identical misses |
| User selects an external search candidate | Conditional | Validate identity and import/upsert before allowing persistent library save |
| Anime has no local characters | No on page request | Mark enrichment pending; scheduled/manual ingestion handles it |
| Scheduled catalogue refresh | Yes | Batch, bounded concurrency, incremental updates |
| Editorial curation/import | Yes | Controlled batch import with review and audit record |
| Provider unavailable | No retry storm | Serve local/stale data; otherwise return a controlled empty/unavailable state |

A provider search miss must not automatically insert an ambiguous title as a published catalogue record. Store candidate results separately or require a high-confidence identity match/review before publication.

## 7. Ingestion and refresh strategy

### Curated catalogue, not the entire upstream universe
Start with anime BAKAZZ actually needs:
1. Existing fixed/owner collection and titles referenced by current user/social rows.
2. Home page, monthly selection, weekly episodes and upcoming releases.
3. Titles in current search/discovery result sets that users select or save.
4. Titles required by existing character catalogue relations.
5. Additional editorial picks approved for BAKAZZ.

Do not attempt to import the entire AniList database at once. The catalogue should grow based on actual product use and curation.

### Batch import
- Batch AniList IDs where GraphQL supports `id_in`.
- Use bounded concurrency and a single provider gateway for every request.
- Respect Retry-After; exponential backoff with jitter; no aggressive retry loops.
- Use timeouts, maximum batch size, request budgets and a circuit breaker.
- Upsert idempotently by canonical ID.
- Persist job progress/checkpoints so interrupted imports resume safely.
- Track source timestamp and local sync timestamp.
- Do not overwrite curated fields with lower-quality provider data without a defined precedence rule.
- Log counts, durations, provider status, retries, failures and imported IDs; never log secrets.
- Character relations should be fetched in batches per selected anime and stored through a controlled sync path.

### Refresh cadence
Different data changes at different rates:
- Core metadata, synopsis, genres, format, episode count: refresh infrequently (e.g. weekly or monthly) unless a new release is active.
- Ongoing series status/episodes: refresh daily or via editorial schedule.
- Seasonal/upcoming data: refresh daily during active season windows.
- Characters/relations: import once for selected titles; refresh only when explicitly requested or periodically if needed.
- Images: store stable provider URLs first; evaluate image proxy/storage only after licensing/terms, caching and bandwidth implications are understood.

Cadences are starting proposals and should be tuned using actual update requirements and provider terms.

## 8. Caching and response-time policy

Use layered caching:
1. **Postgres catalogue** — durable source of truth.
2. **Vercel/CDN cache** — public, deterministic catalogue/detail/search responses with explicit cache keys and safe public headers.
3. **Optional application cache** — only for hot public payloads where measurements justify it.
4. **Browser cache** — a convenience, never the only cache and never the source of truth.

Suggested initial policy (validate with traffic and data freshness):
- Published detail: CDN `s-maxage=3600`, `stale-while-revalidate=86400`.
- Catalogue search: short CDN cache (e.g. 60–300 seconds) plus indexed DB query.
- Editorial feeds: 5–15 minutes, with scheduled refresh for source data.
- User library, likes, comments, profile privacy and personalized status: private/no-store or user-scoped cache; never shared public CDN cache.
- Negative lookup: short TTL to avoid repeated provider misses, with invalidation on import.

Serve stale public catalogue data during provider outages. Provider availability must not be in the critical path for detail rendering.

Do not add Redis or another paid service before measuring whether Postgres + CDN + existing persistent cache is insufficient.

## 9. Search and identity correctness

The screenshot failure (“could not identify this anime in AniList; cannot save”) indicates a provider identity-resolution dependency. Fix the identity layer, not the button:
- Search and display the BAKAZZ catalogue ID.
- Map MAL/AniList/other provider IDs through an explicit identity table.
- Never assume MAL ID equals AniList ID.
- Never use a fuzzy title match as an unverified canonical ID.
- For known catalogue anime, saving must use the stable canonical ID already used by `user_anime`.
- For an external search result, confirm the selected candidate and persist its ID mapping before library writes.
- Keep the current `user_anime.anime_id` values and all existing likes/comments/debates/duel references intact.

## 10. Performance and reliability requirements

Before calling the data platform scalable, measure it:
- p50/p95/p99 latency for detail, search, characters and profile.
- Provider request count per page view (target: zero for normal known detail).
- Catalogue cache hit ratio and stale response ratio.
- Database query latency, rows scanned, index usage, connection pressure.
- Provider 429/5xx rate, retry count and circuit-breaker events.
- API error rate and response payload size.
- Ingestion throughput, backlog, failure and retry counts.

Required tests:
- Detail page renders when AniList/Jikan are unavailable.
- Known anime detail makes zero upstream calls.
- Search hit makes zero upstream calls.
- Repeated identical provider misses are cached and bounded.
- Concurrent cache misses do not trigger a provider stampede.
- Provider 429 respects Retry-After and does not retry aggressively.
- MAL and AniList IDs map correctly; mismatches cannot save the wrong anime.
- Catalogue import is idempotent and cannot erase curated data.
- Character page reads local rows and never performs user-triggered ingestion.
- RLS tests prove anonymous users cannot mutate catalogue data and users cannot access other users' private library data.

## 11. Security blocker found during the Development audit

Supabase Development's advisor currently reports RLS disabled on `private.anime_search_cache_config` (critical). It also reports a public-executable SECURITY DEFINER function for character catalogue synchronization. Do not auto-apply the advisor's one-line RLS remediation: inspect schema exposure, grants and the function's access path first, then define the correct server-only access model. This is a separate security task that should be resolved before expanding catalogue write capabilities.

## 12. Implementation phases

### Phase A — Baseline and contract
- Add this architecture document and record the current provider call sites.
- Confirm all consumers of anime IDs and current schema/migrations.
- Define the catalogue response type and API contracts.
- Decide curation/publishing rules and external ID mapping.

### Phase B — Catalogue schema (Development only)
- Create reviewed migrations for `anime_catalog` and external ID/alias mapping.
- Add indexes based on expected lookup/filter paths.
- Define RLS/grants so public users can read only published catalogue rows and cannot write.
- Restrict ingestion writes to a server-only path.
- Validate on a clean Development baseline; preserve all current data.

### Phase C — Controlled import
- Build an idempotent batch import script/job for curated IDs.
- Import current owner collection, existing references and editorial anime first.
- Import/attach existing character data without duplicating IDs.
- Add progress logs, checkpoints and retry/backoff.

### Phase D — Internal read APIs
- Implement `GET /api/anime/:id`, local search and local characters reads.
- Add response validation, cache headers, query limits and tests.
- Keep old endpoints available until all callers are migrated and parity is proven.

### Phase E — Remove direct runtime provider dependencies
- Migrate AnimeDetail to BAKAZZ detail API.
- Migrate SSR route existence/title check to local catalogue.
- Migrate profile library/shared anime titles and character-favourite titles to local catalogue batch queries.
- Remove direct MAL-to-AniList calls from the library save path; resolve through local external-ID mapping.
- Change character endpoint so page views never trigger provider sync.
- Ensure search uses local results first and only uses controlled fallback on genuine catalogue miss.

### Phase F — Resilience, tests and load
- Add provider circuit breaker, request budgets and metrics.
- Add integration/RLS tests and regression tests for the screenshot failure.
- Load test browse, search, detail, characters, profiles and mixed traffic.
- Tune cache TTL/indexes from measured data.
- Verify Preview routes and provider outage behavior.

### Phase G — Production readiness (approval required)
- Rehearse migrations and import on Development.
- Review backups, rollback and data reconciliation.
- Do not touch Production until the owner explicitly authorizes a release plan and migration.

## 13. Definition of done

- Known anime pages render from BAKAZZ data with no upstream API call.
- Catalogue search and identity mapping are deterministic and indexed.
- Library save never depends on a live AniList request for a known item.
- Character data is served from local storage and page views do not cause imports.
- External provider requests are limited to controlled jobs or bounded search fallback.
- All existing user/social anime IDs remain compatible.
- Provider outage does not break core browsing, detail, library or community features.
- Security/RLS and load tests pass in Development.
- Preview deployment is READY and all relevant routes are verified.
- Production remains unchanged until explicit owner approval.
