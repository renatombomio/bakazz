# BAKAZZ — handoff, development rules and incident log

> Last reviewed: 2026-11-24  
> Repository: `renatombomio/bakazz`  
> Active working branch: `feature/renanime-2.0-workspace`

This document is the mandatory starting point for any new ChatGPT/Codex/developer session. Read it before investigating, editing code, changing configuration or asking the project owner to repeat context. Update it whenever a significant implementation, decision, incident or operational constraint changes.

## 1. Start every new session here

1. Read this file completely.
2. Read the root `AGENTS.md` and `README.md`.
3. Inspect the current branch and latest commit. Do not assume this document is newer than the code.
4. Inspect the relevant implementation and existing tests before proposing a change.
5. Read the relevant documents under `docs/security/` and `docs/development/` before touching authentication, middleware, Supabase, deployment or environment configuration.
6. Confirm the current Vercel deployment and branch before testing. A deployment marked READY is not proof that every route works.
7. Continue from the current repository state. Do not repeat investigations or reimplement completed work without first checking commit history and source.

If a new conversation cannot access the repository, say so explicitly and request repository access or the relevant files. Do not invent repository state from memory.

## 2. Non-negotiable operating rules

### Git and scope
- Work only on `feature/renanime-2.0-workspace`.
- Do not create, rename, switch or delete branches unless the owner explicitly authorizes it.
- Do not commit to `main` or deploy to Production.
- Keep changes scoped and reviewable. Prefer one commit per screen, feature or logically independent fix.
- Before writing, inspect the latest branch head and the exact file contents/SHA. After writing, verify the commit and reread the changed file.
- Never overwrite a newer change with stale content. If the branch head changed, refresh and reconcile first.

### Supabase and data
- Development/Preview Supabase only: project ref `pakkdnfifrshqyqedpni`, URL `https://pakkdnfifrshqyqedpni.supabase.co`.
- Never connect a development test to Supabase Production.
- Never run destructive SQL, truncate/drop tables, reset projects, delete users or alter production data.
- The owner's personal collection (“Colección de Ren”) is untouchable.
- Do not assume database schemas or policies. Inspect migrations and the actual Development schema before making a database change.
- Review every migration before applying it. Do not execute SQL merely because it exists in the repository.
- Do not copy production data into Development.

### Secrets and environment
- Never read, print, request, commit or modify `.env.local` unless the owner explicitly asks.
- Never place secret keys, OAuth secrets, service-role keys, tokens, passwords or private credentials in source, documentation, issues, logs or commits.
- Use placeholders and variable names in documentation, never real values.
- Do not change Vercel environment variables, OAuth provider settings, Supabase Auth URLs or DNS without explicit authorization.
- Keep Preview and Production environment scopes separate. Preview must point to the Development Supabase project.

### Production safety
- Production domain: `www.bakazz.com` (also `bakazz.com`).
- `MAINTENANCE_MODE = true` in `src/middleware.ts` is intentional. It keeps the production host in maintenance while Preview is used for testing.
- Do not disable maintenance, promote a Preview deployment, deploy to Production or change the production domain without explicit approval.
- Do not infer that Production is ready because Preview works.

## 3. Current project snapshot

### Product
BAKAZZ is a bilingual (Spanish/English), mobile-first anime community. Public discovery pages should be accessible before sign-in. Personal areas and authenticated actions require an authenticated user. The public brand/domain is BAKAZZ / `www.bakazz.com`; remove obsolete Renanime naming from new user-facing copy unless discussing project history.

### Technology
- Astro 7, SSR, Vercel adapter
- React 19 islands and TypeScript
- Tailwind CSS v4
- Supabase Auth, PostgreSQL and `@supabase/ssr`
- AniList and Jikan data integrations
- pnpm; Vitest

Use the scripts actually present in `package.json`: `pnpm dev`, `pnpm build`, `pnpm preview`, `pnpm test`. Node requirement is `>=22.12.0`. Do not assume a script exists; inspect `package.json`.

### Environments
- Supabase Development ref: `pakkdnfifrshqyqedpni`.
- Supabase Production ref documented in the existing environment guide: `zgjetpoamiewygqlhheo`. Treat as production-only and do not access for development work.
- Vercel project: `bakazz`.
- Vercel project ID: `prj_h4IbcZbhJZCaPD5mt6NDcewj6vA9`.
- Vercel team ID: `team_epMLh0EjGposf2Zgagf7UMrB`.
- Production domain remains in maintenance. Preview deployment URLs are for testing only.

The authoritative variable names and environment separation are documented in [supabase-environments.md](./supabase-environments.md). Never add actual secret values to this repository.

## 4. Authentication and routing behavior

The current middleware in `src/middleware.ts` establishes these intended rules:

- Production maintenance applies only to `bakazz.com` and `www.bakazz.com`; Preview deployment URLs and localhost remain available for development.
- Public pages include the home page, search/browse pages, genres, Ren collection, community/debates reading, anime detail pages, public debate detail pages and public user profiles.
- Login, registration and auth callback routes are public.
- Personal/private routes redirect unauthenticated visitors to the localized login page and preserve the requested destination in the `next` parameter.
- Opening the debate composer is an authenticated action even though reading debates is public.
- After authentication, users without a valid nickname are sent through profile completion before reaching their requested destination.
- The middleware uses Supabase SSR cookies and obtains the authenticated user with `auth.getUser()`; do not replace this with an unverified client-side session check.
- Redirect destinations must remain local relative paths. Preserve the existing open-redirect protections.

Important: these rules describe the current middleware implementation. For any specific page, verify its route path, middleware behavior and page/API authorization together. A public page must not expose private user data or make private mutations available anonymously.

### Destination preservation changes (2026-11-24)
The following commits implemented the public/private route split and preservation of the intended destination through authentication:

- `171a80166285f950b70a3133ff23cc2b537a672b` — make public pages accessible before sign-in.
- `5abd7927645c8a571cfbdedd90bb2b1f078f41f8` — preserve destination after auth.
- `a0acd4959a933ff60ad41bfcc6072654cdaf299d` — preserve destination through Google OAuth.
- `ae5d617e5a9113729754875571bd790d4005f8a6` — preserve destination through email confirmation.
- `22dcb077cf99e547c9c4e7c268d037a6b798e316` — pass destination into registration request.

These commits are on the current feature branch history. Do not redo this work without first reproducing a failure and identifying the missing behavior.

## 5. Incident report — Preview HTTP 500 (2026-11-24)

### Symptom
The branch Preview alias returned HTTP 500 on the home page and login page, while an earlier deployment from commit `22dcb077` returned HTTP 200 for the tested public routes.

### Root cause found
A malformed `src/middleware.ts` had literal backslash + n character sequences (`\\n`) embedded in the source instead of actual line breaks. The malformed source was introduced/retained in the changes around commits `058ae8ed` and `5764194`. This corrupted the middleware source and caused the newer Preview deployment to fail.

Do not misdiagnose this incident as an environment-variable or Supabase outage: the concrete source defect was found in the middleware file. Vercel runtime logs for the older failing deployment were no longer available because the Hobby log retention window had elapsed, so no exact runtime stack trace was established.

### Fix applied
Commit:
- `2866b4c91e99a374c0ff7e1393ab895efbb98dd8`
- Message: `fix(middleware): replace escaped newline literals`

The fix replaced the three literal escaped-newline sequences with actual newline characters in `src/middleware.ts`. A post-change content check found zero remaining literal `\\n` sequences in that file. No other source file was changed for this fix.

The owner subsequently confirmed that the Preview site works. This incident is considered resolved based on that confirmation. The fix did not change Supabase, `.env.local`, Production settings or the production maintenance flag.

### Deployment references from the incident
- Vercel deployment ID: `dpl_FRS3hG39KnnQ3r5kq1oogj2i2LGq`
- Deployment URL: `https://bakazz-7jawe9kx8-rene-webs1.vercel.app`
- Branch: `feature/renanime-2.0-workspace`
- Commit: `2866b4c91e99a374c0ff7e1393ab895efbb98dd8`

The branch alias used during the incident was `https://bakazz-git-feature-renanime-20-workspace-rene-webs1.vercel.app`. Deployment URLs can change; always retrieve the current deployment from Vercel rather than assuming an old URL is current.

## 6. Mandatory incident investigation procedure

When the owner reports an error, do not apply speculative fixes or stop after finding the first plausible issue.

1. **Capture the failure.** Record exact URL, route, action, browser/network status, response body, timestamp and environment. Ask only for genuinely missing details.
2. **Identify the deployment.** Confirm Preview vs Production, branch, commit SHA, deployment ID and READY/FAILED state in Vercel.
3. **Compare working and failing states.** Compare the failing commit with the last known working commit. Inspect changed files and relevant commit diffs before editing.
4. **Inspect the complete execution path.** Check middleware, page/endpoint, shared libraries, Supabase client, cookies/session, environment variable *names and scope* (never secret values), external API dependencies and database policies as relevant.
5. **Check logs promptly.** Vercel runtime/build logs may have short retention. Capture relevant logs while available. If logs are unavailable, state that limitation; do not invent a stack trace.
6. **Establish root cause.** Separate confirmed evidence from hypotheses. Do not call a missing environment variable the cause until verified. Do not treat a deployment's READY state as proof that the route works.
7. **Make the smallest safe fix.** Preserve unrelated changes and project rules. Avoid broad rewrites, mass replacements, schema changes or dependency upgrades unless proven necessary.
8. **Run checks.** Execute relevant tests and build when an actual environment is available. Inspect the final diff and search for malformed source artifacts (including literal escaped newlines) when relevant.
9. **Verify the deployed behavior.** Wait for the new Preview deployment to reach READY, then request the exact affected URL and key neighboring routes. Check HTTP status and response content. Test the user flow, not just the homepage, where possible.
10. **Report honestly.** State what was changed, commit SHA, tests actually run, URLs/statuses checked, what remains unverified and whether Production was untouched.
11. **Document the result.** Add the incident, root cause, fix, verification and any follow-up to this document. Update the README/architecture docs if behavior changed.

Never say “fixed”, “tested”, “deployed successfully” or “verified” unless the corresponding action was actually completed and evidence is available.

## 7. Minimum regression checklist

For routing/auth changes, test the relevant cases in Preview:

| Case | Expected behavior |
|---|---|
| `/` while signed out | Public home page loads |
| `/login/` while signed out | Login page loads |
| `/register/` while signed out | Registration page loads |
| Public search/community/debate reading | Loads without sign-in |
| Public anime detail and public profile | Loads without sign-in; no private data leakage |
| Private profile/library route while signed out | Redirects to localized login with `next` |
| Return after email confirmation | Goes to the requested safe local destination |
| Return after Google OAuth | Goes to the requested safe local destination |
| Missing nickname after authentication | Profile completion, then requested destination |
| Debate composer while signed out | Authentication required |
| Production host | Maintenance remains active until explicit approval |

Also run:
```bash
pnpm install --frozen-lockfile
pnpm test
pnpm build
```
Only report commands as passed if they were actually run. If local execution is unavailable, say so and rely on available Preview/CI evidence without pretending it is equivalent.

## 8. Known follow-ups / verification boundaries

- Google OAuth initiation and Supabase sign-in events were observed in the Supabase logs during the previous investigation. That alone did not prove the final browser redirect landed on the correct Preview URL. Re-test the full browser flow before declaring OAuth end-to-end verified.
- Email confirmation destination preservation was implemented in code; re-test with a fresh registration/confirmation flow when auth is next changed.
- The previous security review of Development reported items requiring separate review: SECURITY DEFINER functions callable by anon/authenticated roles, leaked-password protection disabled, missing policies on the moderation-actions table, and performance/index warnings. These findings were not changed as part of the Preview 500 fix. Review function bodies and intended access before changing grants or RLS.
- Do not assume old README/security migration status is current. The checked-in code and latest branch commits are the source of truth; update docs when they diverge.
- A source review during this documentation update noticed a reference to `isPreview` in the middleware's Supabase-error catch branch. Before modifying that branch, verify whether it is declared/imported in the actual build context and add a targeted test. Do not silently assume the exceptional auth-error path is covered just because normal page loads work.

## 9. Documentation maintenance

Whenever a session changes behavior, update the appropriate document in the same task:
- Routing/auth/middleware: this file and relevant `docs/security/` contract.
- Supabase variables/environments/schema: `supabase-environments.md` and migration documentation.
- Product/UX decisions: `docs/product/` or the master roadmap.
- Incidents: section 5 and follow-up list in this file.
- Repository-wide rules: `AGENTS.md`.

Keep dates, branch names, deployment references and status labels accurate. Remove obsolete statements rather than appending contradictory instructions.


## Anime data platform work

Before changing anime data fetching, detail pages, search, characters, profiles, provider integrations or caching, read [ANIME_DATA_PLATFORM_PLAN.md](./ANIME_DATA_PLATFORM_PLAN.md). It records the audited provider call sites, current Development schema facts, target BAKAZZ-owned catalogue/API design, controlled ingestion policy, cache rules, security blocker and implementation phases. The proposal is not implemented yet; do not assume the catalogue table or internal detail API already exists.
