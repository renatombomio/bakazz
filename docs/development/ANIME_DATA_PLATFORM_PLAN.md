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

## 10. BAKAZZ business model and AniList clarification

### Owner's stated business model (2026-11-24)

The owner's current intention is:
- BAKAZZ is a free anime community. Users can browse anime information, maintain their personal collection/watch list, participate in discussions and use community features without paying.
- BAKAZZ will not sell anime, manga or anime catalogue products.
- The only planned on-site commercial activity is potentially allowing independent clothing brands/self-employed businesses to pay for visibility or promotion on the website.
- Any other income the owner may earn outside BAKAZZ is not intended to be revenue generated by the BAKAZZ service.

Do not describe BAKAZZ as an anime retailer or paid subscription service. Do not assume unrelated personal income is BAKAZZ revenue.

### What the $150/month clause says

AniList's published Terms of Use say that commercial applications/services operating below $150 in revenue per month may use the API free of charge without express permission, while applications/services operating above $150 in revenue per month need a commercial licence. The published wording does not define:
- whether sponsored placements/brand visibility are included in "revenue";
- whether only revenue directly attributable to API-powered features counts;
- whether the threshold is gross or net revenue;
- how mixed revenue streams are treated;
- how exactly the boundary at $150 is handled.

For BAKAZZ, free access by users does not by itself settle the question. If a clothing brand pays BAKAZZ for advertising, sponsorship or visibility displayed on the site, that payment may be revenue of the BAKAZZ service even though users pay nothing and BAKAZZ does not sell anime or manga. This is a reasonable interpretation to clarify with AniList, not a definitive ruling.

Revenue unrelated to BAKAZZ should not be voluntarily represented as BAKAZZ revenue in the enquiry. Describe only the planned on-site brand-promotion arrangement and ask AniList how it treats it.

### Questions to AniList

Send to `contact@anilist.co` and retain the written answer:
1. BAKAZZ is free to users and does not sell anime or manga. It provides anime information, personal lists/collections and a community with likes, comments and debates. Does this use fall under the competing anime list/tracker service restriction, and is written authorization required?
2. BAKAZZ may allow independent clothing brands to pay for promotional visibility on the website. Does this make BAKAZZ a commercial application/service for the API terms?
3. Does the $150/month threshold include those on-site sponsorship/advertising payments? Is it measured as gross BAKAZZ revenue, net revenue, or only revenue directly attributable to API-powered features?
4. Are the owner's unrelated income sources outside BAKAZZ excluded from the threshold?
5. Does the threshold apply to total monthly service revenue or only revenue earned during months when the service uses the AniList API?
6. What happens at exactly $150/month?
7. Does the threshold require a licence only once revenue exceeds $150/month, or must BAKAZZ request approval before accepting any sponsored placement?
8. Separately, is request-driven caching allowed? If yes, which fields, for what TTL, and may a cached response be used as stale fallback during an outage?
9. Are character data, descriptions, cover/banner images, relations and recommendations subject to different retention/display rules?

Do not treat silence as approval. Do not claim that the $150 threshold definitely applies or definitely does not apply to brand placements until AniList clarifies it.

### Draft email

Subject: Clarification on API use, free community service and limited brand sponsorship

Hello AniList team,

I am developing BAKAZZ, a free anime community website. Users will be able to browse anime information, maintain personal anime collections/watch lists, and participate in likes, comments and discussions. Users will not pay for access, and BAKAZZ will not sell anime or manga.

The only commercial activity we may introduce is allowing independent clothing brands or self-employed businesses to pay for promotional visibility on the website. We would like to understand whether this makes BAKAZZ a commercial application under your API Terms of Use and whether those sponsorship payments count toward the $150 monthly revenue threshold. Could you clarify whether the threshold is based on gross service revenue, net revenue, or revenue directly attributable to API-powered features? We would also appreciate clarification on whether income unrelated to BAKAZZ is outside this calculation and what applies at exactly $150 per month.

We would also like to confirm whether BAKAZZ's collection/watch-list and community functionality requires authorization under the competing anime/manga list or tracker clause.

Finally, we are considering a request-driven cache only: a record would be fetched after a user opens or selects a specific anime, duplicate concurrent requests would be coalesced, and no bulk imports or catalogue mirroring would take place. Would you permit this? If so, what fields and retention period are allowed, and may cached data be served as a temporary fallback during an API outage?

We intend to respect your terms and will not implement persistent caching until we understand what is permitted.

Thank you for your time.

Best regards,
BAKAZZ team

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

## 14. Scale and capacity plan — thousands of users

This section is a capacity design proposal only. It does not authorize implementation, migrations, configuration changes or plan upgrades.

### 14.1 Priority zero: establish a stable Preview baseline

Before starting the data-platform implementation:
- Verify the current branch Preview deployment is READY.
- Re-test the home page, anime detail, login, registration and protected-route redirect.
- Complete a real Google OAuth browser flow, including callback, cookie/session establishment and return to the requested destination.
- If any of these fail, investigate and resolve that first. Do not build new infrastructure on an unstable baseline.
- Keep Production in maintenance and do not deploy/promote.

A previous middleware source defect caused Preview HTTP 500 and was fixed in commit `2866b4c91e99a374c0ff7e1393ab895efbb98dd8`. The owner later confirmed the site was working, but the full Google OAuth end-to-end flow was not proven by that confirmation. Re-run the checks rather than assuming either failure or success.

### 14.2 Anime cache and internal API design

Proposed table shape for review only:
- `anilist_id` — existing numeric AniList ID, unique key.
- `payload` — only fields and data that AniList has expressly permitted BAKAZZ to retain.
- `fetched_at`
- `expires_at`
- `last_accessed_at` (optional; assess write amplification before adding)
- `source` / schema version / status metadata as needed.

Do not create this table until the owner approves a migration and AniList has clarified whether this request-driven cache, its fields, TTL and stale fallback are allowed in writing. A seven-day TTL is a product proposal, not permission under AniList's terms.

Proposed request flow:
1. Read the cache by ID.
2. If fresh, return it immediately.
3. If stale and retention/stale serving is approved, return stale data immediately and enqueue one background refresh.
4. If absent, join or create one in-flight request for that ID. The caller receives the provider result if the bounded request completes; if the queue is full or provider is unavailable, return the localized unavailable state and allow retry.
5. Never wait for AniList when a stale response is available.
6. Never launch repeated provider calls from each component.

If a user opens a known anime and the cached payload is stale, the stale payload should render without blocking on a refresh. If no cache exists and no approved provider response is available, show a localized placeholder; do not fabricate metadata.

Suggested internal routes:
- `GET /api/anime/:id`
- `GET /api/anime/:id/characters`

All provider calls must pass through one server-only provider gateway. Browser components and SSR pages must not call AniList directly. Keep user-specific state (likes, collection status, comments, privacy) out of public shared cache responses.

### 14.3 CDN caching

For public, non-personalized responses only:
- Evaluate Vercel CDN response caching with explicit `s-maxage` and `stale-while-revalidate`.
- Set `Cache-Control: public` only when the response contains no user-specific or private fields.
- Use deterministic cache keys and canonical URLs.
- Separate public anime metadata from per-user library/like state.
- Invalidate or version cache keys when a record is updated.
- Confirm that CDN/browser retention of provider-derived fields is allowed by AniList before enabling it. CDN caching is still data retention and must not be assumed exempt from the provider terms.

### 14.4 Single provider gateway and global limiter

- One distributed limiter across all Vercel instances and all AniList call sites; an in-memory counter alone is insufficient.
- Conservative target: at most 20 requests/minute globally, paced evenly, unless AniList gives stricter instructions.
- Coalesce duplicate concurrent requests by provider + ID + requested field set.
- Respect HTTP 429, `Retry-After`, and rate-limit headers. Stop requests for the specified cooldown.
- Bounded retries with exponential backoff and jitter for retryable network/5xx failures only.
- Circuit breaker on sustained failures; cap queue depth and maximum wait.
- Prioritize interactive detail requests; do not automatically fetch characters, relations or recommendations.
- Record queue depth, wait time, latency, response status, remaining quota and cache hit/miss counts.
- Never log API secrets or full provider payloads unnecessarily.

### 14.5 Remove direct browser/provider dependencies

Migrate, in controlled stages:
- `AnimeDetail.tsx` to BAKAZZ's internal detail endpoint.
- `src/pages/anime/[slug].astro` to local approved cache/internal API rather than direct AniList validation.
- Character API to return locally retained, authorized data and never trigger ingestion on page view.
- Profile/library title and cover lookups to BAKAZZ's internal data layer.
- MAL-to-AniList mapping to an explicit verified mapping flow; never infer IDs from fuzzy title matches.

When saving a library entry, retain BAKAZZ-owned user state and the selected numeric AniList ID. Persisting provider-sourced title/cover snapshots is subject to the same source rights and retention review; do not assume those snapshots are automatically allowed.

### 14.6 Localized failure states

The visitor-facing interface must not expose provider names or upstream technical details.

Suggested Spanish message when no approved cached data exists:
“Estamos preparando esta ficha. Vuelve a intentarlo en un momento.”

Provide a retry action with client-side cooldown. If a known title/cover can lawfully be displayed from an approved source, show it; otherwise do not invent or reproduce unapproved data. All strings must use the existing i18n system and have equivalent English copy.

### 14.7 Search and prewarming

- Search the local approved cache first.
- Only call the provider on an explicit user search miss, subject to queue/rate-limit and terms.
- Do not crawl result pages automatically or import every result.
- Do not run a nightly mass prewarm of trending, seasonal, duel or library titles until AniList expressly approves that background access and retention. A job that fetches hundreds of IDs is still bulk collection even if the IDs were selected by product usage.
- If a provider permits it, schedule only a bounded, documented refresh of records already requested by users; respect the exact allowed scope and retention.
- If permission is not granted, use the provider response only as permitted and evaluate alternative licensed sources for persistent fields.

### 14.8 Supabase/Postgres capacity

Before scaling traffic, review actual query patterns and metrics rather than adding infrastructure speculatively:
- Use Supabase's supported connection pooler for serverless workloads where appropriate; verify the exact connection string mode and prepared-statement compatibility for the deployed driver.
- Check Postgres connection counts, pool saturation, query duration, CPU, memory, disk and egress.
- Add indexes only for measured filters, joins, foreign keys and sort paths. Review the Supabase advisor's foreign-key index and RLS performance findings.
- Review RLS policies for correctness and query efficiency; never disable RLS as a performance shortcut.
- Paginate all potentially unbounded lists: search, comments, debates, notifications, collections, profiles and character lists.
- Remove N+1 patterns and queries inside loops; batch related reads.
- Avoid counting large collections on every request. Maintain counters only where justified, with atomic update logic, reconciliation and tests to prevent drift.
- Keep transactions short and avoid unnecessary writes to cache/access timestamps on every hit.
- Use read-only public data paths separately from user-specific private state.
- Do not add Redis or microservices until measurements show Postgres/CDN/managed queues are insufficient.

### 14.9 Abuse prevention and uploads

- Apply server-side rate limits to registration, login attempts, search, comments, likes, votes, debate creation and other mutation endpoints.
- Use per-IP and per-account limits with sensible exceptions for shared networks; avoid relying only on client-side throttling.
- Evaluate Cloudflare Turnstile or an equivalent challenge for high-risk anonymous forms and suspicious traffic. Add privacy/consent review before enabling.
- Validate MIME type and actual file content, impose maximum dimensions and file sizes, strip unnecessary metadata and generate responsive compressed variants for uploaded avatars/banners.
- Use private storage and signed URLs for private assets; moderate/report user-submitted images and provide abuse handling.
- Do not proxy or rehost third-party anime artwork unless the relevant licence permits it.

### 14.10 Observability and load testing

Instrument:
- p50/p95/p99 response latency by route.
- HTTP 4xx/5xx and client-side error rate.
- CDN hit/miss and stale response rate.
- Database query latency, connection usage and pool wait.
- AniList request count/minute, 429s, queue depth/wait, circuit-breaker state.
- Cache hit/miss/stale counts.
- Upload/storage/egress volume.
- Auth success/failure and OAuth callback outcomes.

Evaluate Sentry or an equivalent error tracker and alerting service. Before adoption, check data residency, personal-data collection, retention and budget. Do not log tokens, passwords, email confirmation links or private profile data.

Use k6 or equivalent against the Preview deployment only:
- Start with smoke tests, then staged concurrency (e.g. 25, 50, 100, 250 and 500 virtual users) and realistic ramp-up.
- Include anonymous browse, anime detail, search, profiles, paginated debates/comments and authenticated reads/writes.
- Run both cold-cache and warm-cache scenarios.
- Test AniList timeout/429 simulations without flooding the real provider.
- Monitor Vercel function duration/concurrency, Supabase connections/CPU, CDN cache ratio and p95/p99.
- Define pass/fail thresholds from a measured baseline; do not claim “thousands supported” merely because a small test passed.
- Never run load tests against Production or against AniList itself.

### 14.11 Queues and background work

Use background jobs only for work that genuinely needs asynchronous processing: cache refreshes (if permitted), notifications, moderation workflows, aggregation and scheduled editorial updates. Jobs must be idempotent, bounded, observable and retry-safe. Avoid creating a separate queue service until volume and platform limits justify it.

### 14.12 Hosting plans and production operating cost

Current official plan information reviewed on 2026-11-24:

| Provider | Plan | Published price / relevant terms | BAKAZZ recommendation |
|---|---|---|---|
| Vercel | Hobby | $0; strictly personal/non-commercial use | Suitable for private development/Preview only while usage is genuinely non-commercial. Not suitable for a site used to generate financial gain or host paid brand promotion. |
| Vercel | Pro | $20/month base; usage-based charges may apply; includes $20 usage credit according to current pricing | Expected minimum production plan if BAKAZZ is used for brand promotion or other commercial activity. Monitor usage and configure spend controls. |
| Supabase | Free | $0; 500 MB DB, shared CPU, 5 GB egress; projects pause after one week of inactivity | Development/testing only; not a dependable production tier. |
| Supabase | Pro | From $25/month; 8 GB DB disk, 250 GB egress, daily backups retained 7 days, 7-day logs; additional compute/usage can cost more | Recommended baseline for production database once launching publicly. Choose compute size based on load testing; Pro is not a guarantee of capacity for any traffic level. |
| Supabase | Team | From $599/month | Not justified at current stage unless SSO, compliance, longer backup retention, priority support or organization controls are required. |

Vercel's official Terms state that Hobby is limited to personal or non-commercial use. Its Fair Use guidance defines commercial usage broadly as a deployment used for financial gain by anyone involved in producing the project. Therefore even if users access BAKAZZ for free, paid brand visibility on the site is likely to require Vercel Pro. Confirm the account's exact billing/team setup before launch.

Supabase Free projects pause after inactivity and lack the production backup retention of Pro. Pro includes daily backups for seven days and avoids inactivity pausing. Pro starts at $25/month, but compute, egress, storage and add-ons can increase the bill. Use Pro as a baseline recommendation for production, not as a substitute for capacity testing.

Initial baseline estimate: approximately $45/month for Vercel Pro ($20) plus one Supabase Pro organization/project ($25), before VAT, usage overages, larger compute, storage, monitoring, email, domains and other services. Supabase compute credits and billing organization details can affect the exact invoice; verify in the billing dashboards before committing.

Official references:
- Vercel pricing: https://vercel.com/pricing
- Vercel Terms, Hobby restrictions: https://vercel.com/legal/terms
- Vercel commercial-use guidance: https://vercel.com/docs/limits/fair-use-guidelines
- Supabase pricing: https://supabase.com/pricing
- Supabase plan billing: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase backups: https://supabase.com/docs/guides/platform/backups

### 14.13 Phased implementation order

1. Reconfirm Preview stability and full Google OAuth/login behavior.
2. Obtain AniList's written answer on competing-service status, request-driven caching, stale serving, CDN retention and commercial thresholds.
3. Approve the cache schema and API contract in writing; only then prepare a Development migration for review.
4. Implement BAKAZZ internal detail/character APIs and migrate browser/SSR calls.
5. Add CDN caching for public responses only where source terms allow.
6. Implement distributed rate limiting, request coalescing, 429 handling and circuit breaker.
7. Add localized unavailable states and retry controls.
8. Add metrics, alerts, abuse protection, upload validation and database query optimization.
9. Add only permitted, bounded background refresh; no mass prewarming.
10. Load-test Preview in stages and record measured capacity.
11. Choose/upgrade production plans and prepare a production migration/release plan only after owner approval.

### 14.14 Approval boundaries

This section is a proposal only. It does not authorize:
- any Supabase migration, table creation, RLS/index change or data update;
- any Vercel/Supabase plan upgrade, billing change or environment-variable change;
- any change to `.env.local`;
- any production deployment, DNS change or removal of maintenance mode;
- any AniList cache retention before written clarification;
- any load test against Production or AniList.

The owner must explicitly approve each implementation stage. Development-only work must preserve the personal collection and all existing data.
