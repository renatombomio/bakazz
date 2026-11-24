# BAKAZZ — hosting and database scaling decision

> Status: owner decision recorded; planning only. No billing, plan, environment or deployment changes have been made.
> Date: 2026-11-24
> Branch: `feature/renanime-2.0-workspace`

## 1. Decision

The hosting and database services will not be upgraded in lockstep.

- **Vercel:** keep Vercel Pro as the planned hosting plan for the commercial/public BAKAZZ service. Do not downgrade the production hosting plan as part of cost optimization.
- **Supabase:** keep the currently active Supabase plan during the initial user-growth phase. Do not upgrade to Pro solely because Vercel is Pro or because the long-term target is thousands of users.
- **Supabase scaling:** upgrade only when measured usage, reliability requirements or production operational needs justify it. Review metrics before limits are reached; do not wait for an outage.
- **No automatic billing changes:** this decision records the strategy. It does not authorize changing subscriptions, payment methods, compute size or billing settings.

## 2. Vercel operating policy

Vercel Pro remains the planned hosting tier for BAKAZZ when the service is operated commercially, including any paid brand-promotion placements. The published Hobby restrictions make Hobby unsuitable for a commercial service even when end users do not pay.

Operational requirements:
- Monitor function usage, bandwidth, image optimization and other metered usage.
- Configure spend alerts/controls where available.
- Review invoices and usage before adding traffic-intensive features.
- Reassess the plan only if BAKAZZ's business model or Vercel's terms/pricing materially change.

The Pro plan is not a guarantee of unlimited capacity. Application performance must still be measured and load-tested on Preview.

## 3. Supabase operating policy

Keep the currently active Supabase plan initially. Before public launch, confirm what that plan actually includes and whether it satisfies the minimum operational requirements for the launch stage. This is a readiness check, not an instruction to upgrade.

Track the following indicators:
- Database size and remaining storage headroom.
- Egress and bandwidth consumption.
- CPU, memory and query latency.
- Active connections, connection-pool saturation and wait time.
- Error rates, timeouts and failed transactions.
- Backup availability, retention and recovery requirements.
- Growth rate and projected time to any plan limit.

### Upgrade triggers

Review a Supabase plan upgrade when one or more of these conditions is observed:
1. A resource approaches its plan limit or has insufficient headroom for expected growth.
2. Sustained CPU, memory, connection-pool or query-latency pressure affects user experience.
3. Egress/storage growth makes the current tier uneconomic or unsafe.
4. Production requires backup retention, recovery options, support or availability commitments not provided by the current plan.
5. Load tests show the current database tier is the bottleneck after query, index, pagination and connection-pooling issues have been addressed.

Do not upgrade merely because registrations increase. Use active usage and measured resource pressure, not total account count alone.

## 4. Review cadence and decision process

- Review Supabase usage weekly during the initial public-growth period.
- Review the plan and cost forecast monthly, and after any major feature launch or traffic spike.
- Record the observed metric, current limit, trend, projected time to limit, proposed target plan and expected monthly cost before an upgrade.
- Test changes in Development/Preview first.
- Any plan upgrade or billing change requires the owner's explicit approval.

## 5. Cost planning

The earlier estimate of approximately USD 45/month (Vercel Pro plus Supabase Pro) is **not** the initial mandatory operating budget under this decision. It is only a reference scenario for a future point when Supabase Pro is justified.

The initial budget should therefore include:
- Vercel Pro base plan and any usage charges.
- The actual current Supabase subscription cost.
- Any separately approved email, monitoring, storage, domain or other service costs.

Do not assume the final invoice equals advertised base prices. Confirm taxes, usage, credits, compute add-ons and billing organization details in the provider dashboards.

## 6. Relationship to the scale plan

This decision supersedes the earlier recommendation in `ANIME_DATA_PLATFORM_PLAN.md` section 14.12 that described Supabase Pro as the recommended production baseline from launch. The current owner decision is to defer the Supabase upgrade and scale it in response to measured usage and operational requirements.

It does not change the technical capacity work:
- use the supported Supabase connection pooler where appropriate;
- optimize queries, indexes, RLS and pagination before buying more compute;
- avoid N+1 queries and unnecessary writes;
- instrument latency, resource usage, errors and connection pressure;
- load-test only on Preview, never Production or the AniList API;
- do not claim support for thousands of concurrent users until measured tests establish capacity.

## 7. Safety boundaries

This document does not authorize:
- upgrading or downgrading Vercel or Supabase;
- changing billing, payment or subscription settings;
- changing environment variables or `.env.local`;
- database migrations, schema changes or data operations;
- Production deployment or maintenance-mode changes.

All development database work remains restricted to Supabase Development, and existing user data and the personal collection must be preserved.
