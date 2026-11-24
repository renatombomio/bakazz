# BAKAZZ repository instructions

## Mandatory project context
Before every task, read:
- `docs/development/AI_HANDOFF_AND_WORKFLOW.md` — mandatory handoff, safety rules, current state, incident history and verification procedure.
- `README.md` — product and technical overview.
- The relevant documents under `docs/security/`, `docs/development/` and `docs/product/`.

Do not ask the owner to repeat information already documented. Inspect the current branch, latest commit and actual source before relying on documentation.

## Hard safety rules
- Work exclusively on `feature/renanime-2.0-workspace`. Do not create or switch branches unless explicitly authorized.
- Use Supabase Development only (`pakkdnfifrshqyqedpni`). Never test against or modify Supabase Production.
- Never perform destructive database operations. The owner's personal “Colección de Ren” is untouchable.
- Never read, print, commit or modify `.env.local` unless explicitly requested.
- Never expose secrets or credentials.
- Keep `MAINTENANCE_MODE = true` for `bakazz.com` and `www.bakazz.com`. No production deploy, promotion, maintenance removal, DNS or production configuration changes without explicit approval.
- Preview is the test environment. Verify the actual deployment and affected routes; READY alone is insufficient.
- Preserve unrelated work. Make the smallest evidence-based change and commit logically scoped work.

## Required engineering behavior
- Reproduce and investigate before changing code. Inspect middleware, route, API, auth/session, environment scope, logs and relevant diffs as appropriate.
- Separate confirmed root causes from hypotheses. Never invent log output or claim a test passed if it was not run.
- Before writes, inspect latest branch head and file SHA. After writes, inspect the commit and reread the changed file.
- For routing/auth changes, test public pages, protected routes, login/register, destination preservation, OAuth/email callback behavior and profile completion where applicable.
- Run `pnpm test` and `pnpm build` when the execution environment permits. If unavailable, state that clearly and verify Preview/CI evidence without claiming local checks passed.
- Document significant changes and incidents in `docs/development/AI_HANDOFF_AND_WORKFLOW.md` in the same task.

## Development server
Use background mode when starting the dev server:
```bash
astro dev --background
```
Manage it with `astro dev stop`, `astro dev status` and `astro dev logs`.
