# BAKAZZ Anime Data Access — revised architecture proposal

> Status: proposal only — no code, migration, database, environment or deployment changes have been made  
> Date: 2026-11-24  
> Target branch: `feature/renanime-2.0-workspace`  
> Database for any future approved implementation: Supabase Development only (`pakkdnfifrshqyqedpni`)

## 1. Why the previous proposal is withdrawn

The previous proposal for a persistent master catalogue, scheduled bulk imports and broad character ingestion is withdrawn. It risks conflicting with AniList's published API terms.

AniList's current Terms of Use state that:
- API use is free for non-commercial use; commercial services with less than $150 monthly revenue may use it free without express permission.
- Using the API as a backup or data-storage service is prohibited.
- Hoarding or mass collection of API data is prohibited.
- Use in competing, non-complementary services of the same nature, including anime/manga list or tracker services, is prohibited. The terms say competing services may be authorized on request if they provide significant sustained integration/syncing with AniList and AniList user accounts.
- Commercial services above the stated revenue threshold need a commercial licence, discussed via contact@anilist.co.

The current rate-limit guide says the normal limit is 90 requests/minute, but the API is presently in a degraded state and limited to 30 requests/minute. It also documents a burst limiter, rate-limit headers and Retry-After behavior. The guide says requests for increased limits are not currently being accepted.

**Important interpretation:** the published terms do not clearly grant a general right to retain AniList responses for seven days, even when the data was fetched because a user requested a page. A short-lived cache, stale fallback copy, CDN cache or database cache may still be considered data storage depending on AniList's interpretation. Therefore, the design below treats persistent caching of AniList-sourced fields as conditional on written confirmation from AniList. Do not treat the proposed TTL as legal permission.

## 2. Product objective

Improve BAKAZZ performance and reliability without mirroring AniList or collecting data in bulk.

- Keep BAKAZZ-owned APIs as the interface used by the frontend.
- Resolve and fetch only the anime a user explicitly requests or selects.
- Deduplicate concurrent requests for the same anime.
- Enforce one distributed, conservative rate limiter for all server-side AniList requests.
- Do not perform AniList calls during unrelated page rendering, profile rendering or character browsing.
- Do not import whole seasons, rankings, search pages or the full character graph into a local catalogue.
- Preserve current numeric AniList IDs wherever they are already used by libraries, likes, comments, debates and duels.
- Keep BAKAZZ-owned user-generated data (reviews, likes, comments, personal status and community content) separate from provider-sourced metadata.

## 3. Current code audit — call sites to migrate

The following current code paths were inspected on `feature/renanime-2.0-workspace`:

- `src/components/anime/AnimeDetail.tsx`: browser-side AniList detail resolution, retry logic, title search and browser localStorage detail cache.
- `src/pages/anime/[slug].astro`: SSR AniList lookup to validate/resolve some numeric anime IDs.
- `src/pages/api/anime/[id]/characters.ts`: reads local character tables first, but fetches AniList and persists characters/relations when local rows are missing.
- `src/data/personal-library.ts`: resolves MAL IDs through a direct AniList request before saving.
- `src/pages/u/[aka].astro`: direct AniList lookups for profile library titles/shared anime.
- `src/pages/api/profile/character-favorites.ts`: fetches anime titles from AniList.
- `src/pages/api/anime-search.ts`: already has a persistent shared search cache and provider fallback logic; its cache semantics and stored fields must be reviewed against AniList's written guidance before being retained.
- `src/lib/server/anilist-gateway.ts`: existing distributed shared-slot limiter, but other call sites bypass it.

The existing database includes:
- `public.user_anime` and social tables using numeric AniList IDs.
- `public.characters` and `public.anime_characters` with existing rows.
- Persistent search-cache tables and lock/config tables.

These existing rows are not authorization to expand AniList data retention. Do not bulk-copy or expand these datasets. Existing character rows and their provenance/retention should be reviewed separately before further syncing.

## 4. Proposed runtime architecture

```text
Browser / Astro pages
        |
        v
BAKAZZ internal API
  GET /api/anime/:id
  GET /api/anime/search
  GET /api/anime/:id/characters
        |
        v
Request coordinator
  - per-ID in-flight deduplication
  - distributed rate limiter
  - bounded queue
  - timeouts / circuit breaker
        |
        +---- approved short-lived cache (only if AniList confirms)
        |
        v
AniList API
```

The frontend calls BAKAZZ endpoints, not AniList directly. This centralizes timeout handling, request deduplication, observability and rate limiting. It does **not** increase AniList's quota: all server-side calls must be budgeted against the current shared limit and burst limiter.

## 5. Request-driven cache policy — approval required

### Proposed behavior

When a user opens a detail page:
1. BAKAZZ checks whether an approved, unexpired response for that exact AniList ID is available.
2. If present, serve it.
3. If absent, enqueue one AniList request for that ID.
4. Concurrent requests for the same ID join the same in-flight promise; they must not issue duplicate provider calls.
5. If AniList responds successfully, return the result and cache only the fields and duration explicitly approved by AniList.
6. If AniList fails, serve an unexpired approved cached response if available. Otherwise show a controlled unavailable state; do not launch retries from every component.

### TTL

A seven-day TTL was suggested as an initial product target, not as an established permission. It must not be implemented for AniList-sourced data until AniList confirms in writing that request-driven caching for that duration and purpose is allowed.

Ask AniList to specify:
- whether request-driven caching is allowed at all;
- whether metadata, images, descriptions, scores, relations and character data have different rules;
- permitted storage location and retention/TTL;
- whether stale fallback copies are allowed during outages;
- whether CDN/browser caching is allowed;
- whether cached data may be shown to users who did not trigger the original request.

If permission is denied or unclear, disable persistent storage of AniList response bodies. Keep only ephemeral in-flight deduplication and minimal operational metrics that do not reproduce provider content. Use another source only after its own licence/terms explicitly allow the intended retention and use.

## 6. Global AniList queue and rate limiting

The current documented degraded limit is 30 requests per minute. Design below it with a conservative target of **20 requests per minute globally** for BAKAZZ, subject to any lower limit or instructions AniList communicates.

Requirements:
- One distributed limiter shared across all Vercel instances and all AniList call sites.
- Do not rely on an in-memory counter or per-instance queue as the only limiter.
- Pace requests evenly (approximately one request every three seconds at 20/minute); avoid bursts.
- Respect response headers such as `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` and `X-RateLimit-Reset`.
- On HTTP/GraphQL 429, stop sending requests for the instructed period. Do not continue retries during AniList's timeout window.
- Use bounded exponential backoff with jitter for retryable 5xx/network failures; do not retry non-retryable GraphQL errors.
- Add a circuit breaker for sustained provider failure and a maximum queue wait. If the queue is full, return a controlled 503/retry response rather than spawning more work.
- Prioritize an interactive detail request over optional enrichment. Do not enqueue characters, relations or recommendations automatically when the user only needs the core detail.
- Coalesce identical requests and query only the fields needed for the requested screen.
- Log provider status, latency, remaining quota, queue depth and retry counts, not full payloads or secrets.

The 20/minute budget is an engineering safety target, not a quota granted by AniList. Revisit it only if the provider's published limit changes or AniList gives written instructions.

## 7. API contracts

### `GET /api/anime/:id`
- Accept only a valid positive numeric AniList ID for the existing compatibility model.
- Read an approved unexpired cache if caching has been authorized.
- Otherwise request the minimum required fields through the shared queue.
- Return a normalized BAKAZZ response shape.
- Do not perform title search as a hidden fallback for an invalid numeric ID.
- Return controlled 404/503 responses; never turn provider errors into a false "anime does not exist" result.

### `GET /api/anime/search?q=&page=`
- Search AniList only when a user explicitly submits a search that is not served by an approved cache.
- Enforce query length, page-size and rate limits.
- Deduplicate identical searches.
- Do not crawl subsequent pages automatically.
- Do not persist search result collections or import every result into a local catalogue unless AniList explicitly authorizes that use.
- If search caching is not authorized, retain no provider result set after the response.

### `GET /api/anime/:id/characters?page=`
- Fetch character data only when the user explicitly opens/requests the characters section, and only if the relevant caching/storage is authorized.
- Do not make background character requests merely because the detail page loads.
- Do not mass-import character lists or relations.
- If local existing character rows are displayed, review their provenance and retention rules; do not silently extend or refresh them from AniList.

### Library writes
- Keep the existing AniList numeric ID contract for known items.
- Do not make a library save depend on a fresh provider request if the selected item already has a valid numeric AniList ID.
- For MAL IDs or other provider IDs, resolve mappings only through a source and mapping process permitted by that source's terms. Never guess an AniList ID from a title.
- Keep personal library state as BAKAZZ user-generated data, distinct from copying AniList's catalogue.

## 8. What BAKAZZ may store independently

The design should clearly separate BAKAZZ-owned data from provider metadata.

BAKAZZ-owned data includes:
- user watch status and personal library records;
- personal ratings, reviews and notes written by users;
- likes, comments, debate content and duel votes;
- moderation and community activity;
- BAKAZZ-authored editorial text and curated selections, provided the underlying metadata/image use is separately compliant.

Do not assume that an AniList ID alone, a title, an image URL, a synopsis, a score, character information or a relation graph is automatically free of provider restrictions. Confirm the allowed fields and retention with AniList and check image/content rights independently.

## 9. Alternative data source

Evaluate Jikan and other providers only after reviewing their current terms, rate limits, attribution rules, caching/retention permissions and commercial-use rules. An alternative API is not automatically a licence to mirror MyAnimeList or another catalogue.

For any provider, record:
- source and field provenance;
- allowed use and redistribution;
- permitted caching/storage and TTL;
- attribution requirements;
- commercial thresholds/licensing;
- rate limits and outage behavior.

Do not combine sources into a persistent catalogue until the terms for each source permit it.

## 10. AniList clarification email — send before implementing persistent cache

Send a concise description of BAKAZZ to `contact@anilist.co`. Explain:
- BAKAZZ is an anime-focused community with personal watch lists/collections, likes, comments, debates and character interactions.
- It may eventually have merchandising or other revenue.
- We currently use the public AniList GraphQL API for anime metadata and search.
- We want to centralize requests through our server, deduplicate concurrent requests and apply a global 20 requests/minute limiter.
- We propose caching only records requested by users, with a seven-day expiry and stale fallback during outages; no bulk imports, no full-catalogue mirror and no background mass character collection.
- We need explicit clarification whether this request-driven cache, seven-day retention, stale fallback, and use in a community with watch-list features are allowed.
- Ask whether BAKAZZ needs a competing-service authorization and what integration/syncing requirements would apply.
- Ask how the $150/month revenue threshold applies to mixed revenue such as merchandise, affiliate income, sponsorships and subscriptions, and whether gross revenue or API-attributable revenue is considered.
- Ask whether there are attribution, display or deletion requirements.

Do not treat silence as approval. Keep persistent AniList caching disabled until written clarification is received and reviewed.

## 11. Implementation phases — no changes until approval

### Phase A — compliance clarification
- Send the email and retain the written response in project documentation.
- Review all current AniList-derived persisted data and existing cache tables against the response.
- Review BAKAZZ's list/tracker functionality with AniList's competing-service clause.
- Review commercial model and expected revenue sources.

### Phase B — request coordinator (only after policy decision)
- Design one shared queue and distributed rate limiter.
- Centralize every AniList request through the gateway.
- Add request deduplication, backoff, circuit breaker, queue limits and metrics.
- Do not change provider data retention in this phase unless expressly approved.

### Phase C — BAKAZZ internal read API
- Add the internal detail/search/character API contracts.
- Migrate browser and SSR consumers to those endpoints.
- Avoid persistent provider-response caching until the allowed policy is documented.
- Preserve existing user/social identifiers and data.

### Phase D — approved cache or alternative source
- If AniList approves request-driven caching, implement only the exact fields, audience and TTL they approve.
- If not, use ephemeral response handling and/or a separately licensed data source whose terms permit persistent storage.
- Keep provider provenance and retention rules explicit.

### Phase E — verification
- Test AniList unavailable, 429, 5xx, queue saturation and cold-cache behavior.
- Test simultaneous requests for one anime result in one provider request.
- Test global rate stays within the configured budget across multiple server instances.
- Test core page does not automatically fetch characters, recommendations or unrelated relations.
- Test saving an item with a known numeric AniList ID does not require a provider round trip.
- Verify no mass import or background crawl can run.

## 12. Security and database constraints

- No Supabase migration, table creation, policy change, data import, cache purge or schema change is authorized by this document.
- Do not change Production, `.env.local`, Vercel environment variables or deployment settings.
- Any later implementation must use Supabase Development only and preserve all existing user data and the personal collection.
- Existing security-advisor findings remain a separate review; do not apply automatic RLS changes as part of this proposal.

## 13. Definition of done

- AniList usage complies with written guidance applicable to BAKAZZ.
- No mass collection, catalogue mirroring or unapproved persistent cache exists.
- All AniList calls pass through one global queue/rate limiter.
- Normal detail page rendering uses one deduplicated, minimum-field request at most when no approved cached response exists.
- Characters and optional enrichment are fetched only on explicit demand.
- AniList 429/outage does not create a retry storm.
- Existing numeric IDs and user-generated BAKAZZ data remain intact.
- No production or Supabase change occurs without explicit approval.
