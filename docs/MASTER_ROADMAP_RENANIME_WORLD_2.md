# RENANIME WORLD 2.0 — Master Audit & Roadmap
**Last audited:** 2026-11-15 (Europe/Amsterdam)  
**Repository:** `renatombomio/renanime`  
**Working branch:** `feature/renanime-2.0-workspace`  
**Roadmap revision based on HEAD:** `2733d4d709d39e1896a44b16d3138a553e4ccd3b`  
**Preview:** https://renanime-9d2ugxys1-rene-webs1.vercel.app  
**Deployment:** `dpl_8obHwj3sT8ttvVu6dvyUbQHqVYDh` — READY  
**Status:** final product polish + brand redesign + pre-launch hardening. Not production-approved.

---

## 1. Product mission

Renanime World is an anime discovery and community platform, not just an anime gallery. It combines editorial discovery, personal libraries, user profiles, community debates, comments, reactions, character rankings, and notifications.

The product must be designed for thousands of users, concurrent activity, traffic spikes, unreliable third-party providers, and gradual feature growth. “It works on one account” is not a release criterion.

**Reliability objective:** prevent avoidable outages, isolate failures, apply bounded resource use, degrade gracefully, and provide enough observability to diagnose incidents. No system can honestly promise zero downtime; the engineering goal is controlled failure and recovery rather than cascading collapse.

## 2. Non-negotiable working rules

1. Work only in `feature/renanime-2.0-workspace`. Never switch to `main`, create a new branch, or create a new environment unless Renato explicitly changes this rule.
2. Use the connected GitHub, Supabase, and Vercel tools. Renato prefers not to use Terminal.
3. Development/Preview Supabase only for testing. **Never test against production data.**
4. No destructive database changes. Never truncate, drop, reset, or rewrite user data without explicit, informed approval and a verified backup/rollback plan.
5. Ren’s personal collection is untouchable. Preserve its records, identity, ordering, and editorial treatment.
6. No production deployment, domain cutover, or production data migration without explicit approval.
7. One focused commit per screen/feature. Keep commits small and reversible.
8. A successful Git push or build is not a successful deployment. Confirm Vercel state is `READY` and matches the expected branch + SHA.
9. Do not expose secrets, tokens, service-role/secret keys, user data, or private environment values in chat, logs, commits, or client bundles.
10. Inspect the current implementation before changing it. Do not recreate working functionality or duplicate data already held by AniList/Jikan/Supabase.
11. Every feature must have loading, empty, error, and success states where relevant; responsive and accessibility checks; validation; and tests appropriate to its risk.
12. Renanime’s standard experience is permanently dark. Ghibli is the sole visual exception and retains its independent identity.

## 3. Current system map

### Frontend and runtime
- Astro 7 SSR, React 19 islands, TypeScript, Tailwind CSS 4.
- Vercel adapter: `@astrojs/vercel`; project runtime configured as Node 24.x.
- Supabase JS v2 and `@supabase/ssr`.
- GSAP, Three.js / React Three Fiber / ShaderGradient, Sharp, Vitest.
- Package manager: pnpm; lockfile is committed.
- Mobile-first design; 390px viewport is the baseline.
- Spanish and English; `Astro.locals.lang` and `localizedPath` are the established localization conventions.

### Frontend routes/features found in the branch
- Home/editorial: hero, anime of the month, weekly episodes, anime news, seasonal featured anime, upcoming releases, community carousel.
- Discovery: search, filters, genres, favorites, collection, pending list, anime detail.
- Community: community home, debates feed, debate detail, comments, likes, reports/moderation foundation, activity, notifications.
- Identity: login/register/OAuth callback, profile editor, public profile, profile anime favorites, character favorites.
- Special: Ren’s collection/archive and Ghibli editorial experience.
- API routes cover auth, profile/media, anime search, comments/reactions/likes, community debates, notifications, library, characters, rankings, discovery data, and cron selection.

### Backend and data
- Supabase Auth + PostgreSQL + Storage + RLS.
- Server-side API routes in Astro.
- AniList GraphQL is the primary anime data provider; Jikan is a fallback for title search, subject to explicit rate-limit behavior.
- Persistent Supabase-backed cache has been extended from search/filter queries to discovery namespaces.
- No separate queue/worker architecture or load-test suite was identified in the audited tree. Treat background jobs and load testing as pending, not implemented.

## 4. Environment inventory — verified

### Supabase
| Purpose | Project | Region | Current status |
|---|---|---|---|
| Production | `zgjetpoamiewygqlhheo` | eu-west-1 | ACTIVE_HEALTHY |
| Development / Preview | `pakkdnfifrshqyqedpni` | eu-west-1 | ACTIVE_HEALTHY |

All testing and schema inspection in this audit used **Development** only. Production was not queried for schema/data and must remain untouched.

Development has 18 listed tables across `public` and `private`. All public tables listed by the advisor have RLS enabled. Current table row counts are test/development data, not scale evidence.

Core public tables: profiles, user_anime, anime_likes, anime_comments, anime_comment_reactions, notifications, anime_of_the_week, community_debates, community_debate_comments, community_debate_likes, community_reports, community_moderation_actions, characters, anime_characters, character_likes, character_like_totals.

Private cache tables: anime_search_cache_config, anime_search_cache, anime_search_cache_locks.

Development migration history contains 21 entries, including auth/profile/library baseline, profile identity/media, presence, comments/reactions/notifications, anime-of-week selection, debate/moderation, character catalogue/likes, and persistent search/discovery cache. Before any further migration, compare repository migration filenames with remote migration history; timestamps/names are not perfectly identical in every entry and must be reconciled carefully.

### Vercel
- Project: `renanime`, Astro, Node 24.x.
- Latest audited Preview deployment is READY and points to the working branch and audited SHA.
- `renanimeworld.com` is verified on the project and redirects to `www.renanimeworld.com` with HTTP 308.
- Project currently reports `live: false`; production activation is not approved.
- Preview variables verified by name/target only (values deliberately not read): Development Supabase URL + publishable key, and branch-scoped `ANIME_SEARCH_CACHE_TOKEN`.
- Production Supabase URL/key and secret key variables exist as Production-target variables; do not retrieve or modify their values.
- A legacy Preview variable set for `feature/supabase-auth-migration` also exists. Review and clean up obsolete branch-scoped variables only after confirming they are unused.
- The code/docs mention `SUPABASE_SECRET_KEY` for trusted character catalogue sync and `CRON_SECRET` for monthly cron. These were not present among the audited Preview variable names. Preview cron/catalogue sync may therefore be unavailable until intentionally configured. Do not copy Production credentials into Preview.

## 5. Work already implemented

### Identity and community foundations
- Supabase Auth flow: registration, login, logout, OAuth callback, session, reset/update password.
- Profiles with public aka, avatar/banner media, bio, genres, online presence.
- Personal anime library and public profile/library reads.
- Anime likes, comments, replies/reactions, notifications.
- Community debates feed and detail, debate comments/likes, reporting and moderation data foundations.
- Character catalogue, anime-character relations, character likes and aggregate totals.
- Gamification rank calculation helper and tests.

### Discovery and editorial
- AniList-backed search API; SearchView uses the server endpoint.
- Search/filter validation, normalized cache keys, pagination, adult-content exclusion, Jikan fallback for normal provider failures, and explicit 429 handling.
- Persistent cache stores full payloads including empty results, with separate keys per normalized query/filter combination and page.
- Shared database cache and lock functions coordinate requests across Vercel instances; in-process deduplication reduces duplicate work inside one instance.
- Cache TTLs currently documented/implemented: search 12h, filters 6h, Jikan fallback max 30m; discovery endpoints generally use 1h where configured.
- Weekly episodes: AniList only, previous Monday-to-Monday UTC window, exclude adult, romaji title first, rank by popularity, top 5, Amsterdam timezone labels, 1h persistent cache.
- Upcoming releases: 90-day window, AniList, adult exclusion, 1h persistent cache.
- Anime news: RSS aggregation with caching in its library; endpoint returns 502 if unavailable.
- Seasonal featured anime API and selection logic exist.
- Anime-of-the-month cron endpoint exists and requires a bearer cron secret plus server-side Supabase secret.

### Visual and brand work
- The automatic day/night theme has already been removed. There is no day-mode controller to build, audit, or maintain.
- Product decision (2026-11-15): all standard Renanime routes are permanently dark. No light mode, solar schedule, geolocation-based theme, or theme preference.
- Ghibli remains the sole exception, with its independent palette, typography, and visual identity. Preserve its existing implementation; do not apply global theme changes to it.
- Brand direction: Renanime World; visual, colourful world/globe identity, wolf mascot, distinctive wordmark. The identity redesign and asset system are still in progress.
- Product monetization concepts include Amazon affiliate links, merchandise, and milestone giveaways. These are ideas/plans, not release-ready functionality.

## 6. Current audit findings — important

### P0 — Security and release blockers
1. **Supabase advisor reports RLS disabled on `private.anime_search_cache_config` (critical).** The advisor recommends `ALTER TABLE private.anime_search_cache_config ENABLE ROW LEVEL SECURITY;`, but explicitly warns not to apply this automatically without designing the policies/access model. Investigate whether private schema exposure/grants make this externally reachable; then define a safe policy or revoke all client-role access and validate the server-only helper. Do not blindly run the one-line remediation.
2. **Public SECURITY DEFINER RPC:** `public.sync_anime_character_catalog(integer,jsonb,jsonb)` is executable by anon and authenticated according to the security advisor. Review why it needs SECURITY DEFINER, validate caller authorization and input bounds, and preferably move privileged logic into a non-exposed schema or revoke public execution. This is a security review, not an automatic change.
3. **Leaked-password protection disabled** in Development Auth. Enable and test before public launch; review Production configuration separately before any release.
4. Preview environment appears to lack `SUPABASE_SECRET_KEY` and `CRON_SECRET`, although source/docs require them for trusted catalogue sync and cron. Verify intended Preview behavior and configure Development-only values if these jobs are required.
5. Audit every RLS policy, RPC, Storage bucket policy, auth callback, ownership check, and moderation permission before public release. A table having RLS enabled does not by itself prove the policy is correct.

### P1 — Performance and scale risks
1. Supabase performance advisor reports 4 unindexed foreign keys: `anime_characters.character_id`, `anime_comment_reactions.user_id`, `notifications.actor_id`, `notifications.comment_id`. Add covering indexes after checking existing indexes/query plans.
2. Advisor reports an RLS initplan warning for `community_debates` policy “Community moderators can remove debate images”; use a stable `(select auth.<function>())` form where appropriate.
3. Advisor reports multiple permissive SELECT policies on `profiles` and `user_anime`. Consolidate only after verifying owner and public-profile visibility semantics.
4. 17 indexes are currently reported unused. This is a small development dataset; **do not delete them based on this signal**. Reassess with realistic traffic/query stats after load tests.
5. Presence endpoint writes `profiles.last_seen_at`; the client currently polls every 45 seconds for signed-in users. This can become a large write multiplier. Evaluate longer intervals, visibility/idle gating, debounce, and/or a dedicated presence design.
6. Anime comment count route can issue one count query per anime ID (up to 100). Replace with a grouped/aggregate query or maintained counter if confirmed hot.
7. Character favourites endpoint fetches associated anime titles from AniList per request. Add batching/cache and avoid repeated upstream calls.
8. Review all public feeds/rankings for unbounded reads, exact counts, expensive joins, N+1 patterns, and stable pagination. Require indexed keyset pagination for high-volume feeds where appropriate.
9. The persistent cache is useful but not a complete scale solution: verify cache stampede behavior, lock expiry, negative caching, eviction/retention, max payload, RPC rate, failure fallback, and observability. Search and discovery currently have similar but separate cache logic; consolidate carefully only after tests.
10. Do not rely on Vercel CDN caching for personalized/authenticated routes. Cache only public, deterministic data with explicit variation keys and safe headers.

### P1 — Quality and deployment risks
1. GitHub Actions quality workflow triggers on push/PR to `main`, not the current feature branch. Ensure the final branch is tested with an explicit CI run or PR gate before production.
2. Existing Vitest suite has only a small number of test files (anime normalization/franchise/search, poster fallback, gamification ranks). Add API, auth/RLS, cache, pagination, and regression tests.
3. No dedicated load/stress/soak test suite was found.
4. The automatic day/night theme has been removed. Do not reintroduce a day-mode controller, solar/geolocation logic, light-theme CSS, or theme preference. Standard routes stay dark; Ghibli retains its independent styling.
5. Latest deployment is Preview-only; custom domain verification does not mean the production application is live.

### P2 — Product completeness
- Confirm all home/discovery sections have consistent loading, empty, unavailable, and retry behavior.
- Complete responsive QA for 390px baseline, tablet, desktop, and long content.
- Complete English/Spanish coverage and ensure route links preserve locale.
- Finalize Renanime World brand system (logo, mascot, globe/world artwork, colour, typography, iconography, favicon, social assets).
- Finish editorial consistency for home, Ghibli, search, profile, community, rankings, and detail pages.
- Confirm streaming availability by Spain region only if the data provider/source is reliable and licensing terms permit display.
- Define moderation workflow and operational ownership before public community growth.
- Defer monetization, affiliate tracking, merchandise fulfilment, and giveaways until platform safety, privacy, and operational support are ready.

## 7. Scale-first architecture principles

### Request and provider protection
- Every external provider call needs a timeout, bounded retries with jitter, clear rate-limit handling, and a circuit-breaker/backoff strategy.
- Never retry a 429 aggressively. Respect Retry-After and serve valid stale cache when policy permits.
- Use shared persistent cache for identical public data across instances. Define TTL, stale policy, negative-cache behavior, and maximum payload by namespace.
- Avoid per-user requests triggering repeated upstream API work.
- Keep public and personalized cache paths separate.

### Database
- Index every high-traffic filter, join, foreign key, sort, and pagination path.
- Use keyset pagination for growing feeds; cap page sizes and request payloads.
- Avoid exact count queries on every render where an aggregate/counter is more appropriate.
- Keep write transactions small and idempotent. Use unique constraints for likes/reactions and atomic database operations for counters.
- Use RLS as authorization enforcement, not merely a UI filter. Test cross-user access explicitly.
- Define retention/cleanup for notifications, reports, moderation records, presence, cache and orphaned Storage objects.
- Monitor connection saturation, query latency, slow queries, locks, table/index growth, and Supabase resource limits.

### Application and Vercel
- Keep SSR/API handlers stateless and horizontally scalable; do not rely on in-memory state for correctness.
- In-memory deduplication may optimize one instance but shared state must live in durable infrastructure.
- Bound concurrency and payload sizes. Add rate limits to login/register, comments, debates, reactions, reports, upload and search endpoints.
- Ensure all endpoints fail with controlled status codes and do not leak internal details.
- Add request IDs, structured logs, error tracking, uptime checks and dashboards.
- Define operational alerts and incident/rollback procedures.

### Availability and graceful degradation
- If AniList/Jikan/RSS is down, serve cached data where safe and show a non-blocking unavailable state otherwise.
- If community writes fail, never display false success. Keep user input recoverable where possible.
- A discovery provider failure must not take down profiles/community/auth.
- Use health checks, dependency timeouts, circuit breakers, and bounded queues for expensive/background work.

## 8. Roadmap — execution order

### Phase 0 — Lock the baseline and complete visual QA
- Confirm branch + HEAD + READY Preview before every task.
- Run browser QA on home, profile (own + public), community, debate list/detail, search, genres, collection, favourites, anime detail, notifications and Ghibli.
- Confirm the standard Renanime experience remains dark and Ghibli retains its separate visual identity; this is a product invariant, not a theme feature to implement.
- Run responsive/accessibility checks for contrast, mobile menu, forms and overlays; fix regressions in isolated commits.

### Phase 1 — Security hardening (release blocker)
- Resolve cache-config RLS advisor finding safely.
- Review/restrict `sync_anime_character_catalog` SECURITY DEFINER RPC.
- Enable leaked-password protection in Development and test password flow.
- Audit RLS policies for every public table and test user A cannot read/write user B’s private records.
- Audit Storage policies, uploads, path ownership, file type/size, deletion and orphan cleanup.
- Audit auth/session/cookie/CSRF/rate-limit controls and all privileged server routes.
- Verify Preview cron/catalogue secrets without ever copying Production secrets.

### Phase 2 — Database and API performance
- Add missing foreign-key indexes after checking duplicates/query plans.
- Fix RLS initplan and redundant permissive policy warnings without changing intended access.
- Review query plans and indexes for profiles, libraries, debates, comments, reactions, notifications and rankings.
- Eliminate N+1 and excessive exact-count patterns.
- Reduce presence write frequency and add idle/visibility handling.
- Standardize API validation, pagination, response sizes, timeouts, errors and idempotency.
- Add per-endpoint rate limits and abuse protection.

### Phase 3 — Shared caching and provider resilience
- Map every AniList/Jikan/RSS request and its calling page.
- Extend cache to every public discovery/feed payload that benefits from sharing.
- Standardize namespace + normalized dimensions + locale/region + page in cache keys.
- Define per-namespace TTL and stale-while-revalidate policy.
- Ensure distributed lock lease and fallback behavior are bounded under concurrency.
- Add cache hit/miss/bypass/error metrics; test cache outage and provider outage.
- Cache character-title metadata and avoid repeated upstream requests.
- Review cron refresh strategy for seasonal/monthly editorial data.

### Phase 4 — Test strategy and scale verification
- Add unit tests for normalizers, query keys, provider parsers, ranking and locale.
- Add API integration tests for auth, authorization, validation, pagination, likes, comments, debates, notifications, cache and rate limits.
- Add RLS matrix tests using multiple users and unauthenticated access.
- Add migration verification against a clean Development baseline and remote migration history.
- Add visual regression/accessibility tests for key pages.
- Add load tests with realistic traffic profiles: browse-only, search bursts, community feed, concurrent likes/comments, login bursts, mixed workload.
- Run stress and soak tests; measure p50/p95/p99 latency, error rate, DB connections, CPU/memory, provider request volume, cache hit ratio and write amplification.
- Define explicit launch thresholds and rollback thresholds before production.

### Phase 5 — Product polish and Renanime World brand
- Finalize logo/wordmark, wolf mascot, colourful 3D-like globe/world mark, palette, typography, favicon and social identity.
- Apply the brand system consistently across the permanent dark experience and mobile/desktop; preserve Ghibli as a separate visual system.
- Finalize home hierarchy: hero, monthly anime, weekly episodes, news, upcoming releases, community.
- Refine profiles, community and debates as a coherent social product.
- Complete ranking and character sections; verify aggregate counts under concurrency.
- Review animation, motion preferences, performance budgets, image formats, lazy loading and layout shift.
- Complete Spanish/English copy and metadata.

### Phase 6 — Operational readiness and controlled launch
- Confirm production schema/migrations are reproducible from Development without copying test data.
- Prepare backup/restore and rollback runbook.
- Confirm domain, redirects, HTTPS, canonical URLs, robots/sitemap and analytics.
- Configure monitoring, alerts, error reporting, uptime, database health and provider status.
- Verify environment separation and secrets ownership.
- Perform final security review and load test.
- Obtain Renato’s explicit approval before any Production migration or deployment.
- Launch gradually, monitor, and keep rollback ready.

### Phase 7 — Post-launch growth (not a launch blocker)
- Affiliate links and disclosure/compliance.
- Renanime merchandise and fulfilment process.
- Community milestone giveaways (first planned prize: mug; trigger and rules to be defined).
- Additional gamification, badges, followers and notifications as usage data justifies.
- Scale infrastructure based on measured load, not guesswork.

## 9. Definition of done

A feature is not done until:
- It works for anonymous and authenticated states as intended.
- It enforces ownership and RLS correctly.
- It has loading/empty/error/success states.
- It is responsive and accessible.
- It has validation and automated tests appropriate to risk.
- It does not create N+1 calls or unbounded reads/writes.
- It uses cache/provider timeouts/rate limits where applicable.
- It does not break other routes, locale, the permanent dark experience, or Ghibli.
- Its commit is on the required branch.
- Vercel confirms the matching deployment is READY.
- Relevant Preview checks are performed and recorded.

## 10. Current next action

**Do not start another feature yet.** First execute Phase 0 browser QA, then Phase 1 security hardening. The Supabase advisor currently reports a critical RLS finding and two public-executable SECURITY DEFINER warnings; these must be resolved and re-checked before launch work proceeds.

## 11. New-conversation handoff prompt

Paste the following into a new conversation in the FREELANCE WORK project:

> Continue the Renanime World 2.0 project using the repository and connected GitHub, Supabase and Vercel tools. First read `docs/MASTER_ROADMAP_RENANIME_WORLD_2.md` from repository `renatombomio/renanime`, branch `feature/renanime-2.0-workspace`. Do not ask me to repeat project context.
>
> Before making changes, verify the current branch HEAD, latest Preview deployment state, Supabase Development project and current advisors. Work only on `feature/renanime-2.0-workspace`; never switch to main or create branches. Use only Supabase Development project `pakkdnfifrshqyqedpni` for tests and schema work. Never query or modify Production project `zgjetpoamiewygqlhheo` during development. No destructive database operations. Ren’s personal collection is untouchable. No production deployment or migration without my explicit approval.
>
> We are in final polish, brand redesign and pre-launch hardening. Design and engineer for thousands of users: bounded requests, caching, concurrency safety, RLS, rate limits, query/index performance, provider resilience, observability, load tests and graceful degradation. Do not claim “cannot collapse”; prove resilience through tests and measured limits.
>
> Current baseline at audit: HEAD `3b77269f80a13439d4f4affb3b41a46368fcecca`; Preview deployment `dpl_8obHwj3sT8ttvVu6dvyUbQHqVYDh` READY at https://renanime-9d2ugxys1-rene-webs1.vercel.app. Start with Phase 0 visual QA and Phase 1 security hardening in the roadmap. Important current Supabase advisor findings: RLS disabled on `private.anime_search_cache_config`; public SECURITY DEFINER RPC `sync_anime_character_catalog` executable by anon/authenticated; leaked-password protection disabled. Do not auto-fix or run suggested SQL without reviewing access design. Performance findings: missing FK indexes, one RLS initplan warning, redundant permissive SELECT policies; unused-index warnings are not grounds for deletion on a tiny dev dataset.
>
> Keep all standard Renanime routes permanently dark. Do not add a light mode, automatic solar theme, geolocation theme logic, or theme preference. Ghibli is the only exception and must retain its independent visual identity. Continue the colourful Renanime World brand redesign (wolf mascot, distinctive wordmark and world identity). One focused commit per change; verify build and Vercel READY before reporting success. First inspect, then plan, then implement; never assume prior code state without reading it.

---

**Audit scope and limitations:** This is a repository + connected-service state audit, not a full penetration test, browser QA session, or load test. The branch tree, package/config, key API/cache implementations, Supabase Development project, migration history, table inventory, advisors, Vercel project/domain, Preview environment-variable names and latest deployment were inspected. Production database contents and secret values were deliberately not accessed.
