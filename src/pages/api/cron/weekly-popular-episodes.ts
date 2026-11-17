import type { APIRoute } from "astro";

export const prerender = false;

/**
 * Refreshes the shared weekly-episodes cache for both supported locales.
 * Vercel Cron invokes this endpoint every Monday shortly after 00:00 UTC.
 */
export const GET: APIRoute = async ({ request }) => {
  const cronSecret = import.meta.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[weekly-popular-episodes-cron] CRON_SECRET is not configured.");
    return Response.json({ success: false, error: "CRON_CONFIGURATION_MISSING" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const results: Array<{ lang: "es" | "en"; status: number; success: boolean }> = [];

  for (const lang of ["es", "en"] as const) {
    try {
      const response = await fetch(`${origin}/api/weekly-popular-episodes?lang=${lang}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      const payload = await response.json().catch(() => null);
      results.push({ lang, status: response.status, success: response.ok && payload?.success === true });
      if (!response.ok || payload?.success !== true) {
        console.error(`[weekly-popular-episodes-cron] Refresh failed for ${lang} (HTTP ${response.status}).`);
      }
    } catch (error) {
      console.error(`[weekly-popular-episodes-cron] Refresh request failed for ${lang}:`, error);
      results.push({ lang, status: 0, success: false });
    }
  }

  const success = results.every((result) => result.success);
  return Response.json(
    { success, refreshedAt: new Date().toISOString(), results },
    { status: success ? 200 : 502, headers: { "Cache-Control": "no-store" } },
  );
};
