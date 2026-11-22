import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;
const PAGE_SIZE = 20;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function safePage(value: string | null) {
  const page = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(page) ? Math.max(0, Math.min(1000, page)) : 0;
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().replace(/^@+/, "").replace(/[,%()\\]/g, " ").replace(/\s+/g, " ").slice(0, 60).trim();
  if (query.length < 2) return json({ ok: true, users: [], debates: [], usersTotal: 0, debatesTotal: 0 });
  const usersPage = safePage(url.searchParams.get("usersPage"));
  const debatesPage = safePage(url.searchParams.get("debatesPage"));
  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const userFields = "id,name,aka,avatar_url,last_seen_at";
    const exact = () => supabase.from("profiles").select(userFields, { count: "exact", head: true }).eq("is_private", false).not("aka", "is", null).ilike("aka", query);
    const prefix = () => supabase.from("profiles").select(userFields, { count: "exact", head: true }).eq("is_private", false).not("aka", "is", null).ilike("aka", query + "%").not("aka", "ilike", query);
    const contains = () => supabase.from("profiles").select(userFields, { count: "exact", head: true }).eq("is_private", false).not("aka", "is", null).ilike("aka", "%" + query + "%").not("aka", "ilike", query + "%");
    const [exactCount, prefixCount, containsCount, debateCount] = await Promise.all([
      exact(), prefix(), contains(),
      supabase.from("community_debates").select("id,profiles!inner(id)", { count: "exact", head: true })
        .eq("status", "published").eq("profiles.is_private", false).ilike("title", "%" + query + "%"),
    ]);
    if (exactCount.error || prefixCount.error || containsCount.error || debateCount.error) {
      console.warn("[community-search] count failed", exactCount.error?.code, prefixCount.error?.code, containsCount.error?.code, debateCount.error?.code);
      return json({ ok: false, error: "SEARCH_UNAVAILABLE" }, 503);
    }
    const bucketCounts = [exactCount.count ?? 0, prefixCount.count ?? 0, containsCount.count ?? 0];
    const usersTotal = bucketCounts.reduce((sum, count) => sum + count, 0);
    const offset = usersPage * PAGE_SIZE;
    let skip = offset;
    let remaining = PAGE_SIZE;
    const userRows: any[] = [];
    const buckets = [
      { count: bucketCounts[0], query: () => supabase.from("profiles").select(userFields).eq("is_private", false).not("aka", "is", null).ilike("aka", query) },
      { count: bucketCounts[1], query: () => supabase.from("profiles").select(userFields).eq("is_private", false).not("aka", "is", null).ilike("aka", query + "%").not("aka", "ilike", query) },
      { count: bucketCounts[2], query: () => supabase.from("profiles").select(userFields).eq("is_private", false).not("aka", "is", null).ilike("aka", "%" + query + "%").not("aka", "ilike", query + "%") },
    ];
    for (const bucket of buckets) {
      if (remaining <= 0) break;
      if (skip >= bucket.count) { skip -= bucket.count; continue; }
      const take = Math.min(remaining, bucket.count - skip);
      const result = await bucket.query().order("aka", { ascending: true }).range(skip, skip + take - 1);
      if (result.error) return json({ ok: false, error: "SEARCH_UNAVAILABLE" }, 503);
      userRows.push(...(result.data ?? []));
      remaining -= take;
      skip = 0;
    }
    const debateResult = await supabase.from("community_debates")
      .select("id,title,created_at,profiles!inner(aka,avatar_url,is_private)")
      .eq("status", "published").eq("profiles.is_private", false).ilike("title", "%" + query + "%")
      .order("created_at", { ascending: false })
      .range(debatesPage * PAGE_SIZE, debatesPage * PAGE_SIZE + PAGE_SIZE - 1);
    if (debateResult.error) {
      console.warn("[community-search] debates failed", debateResult.error.code);
      return json({ ok: false, error: "SEARCH_UNAVAILABLE" }, 503);
    }
    const users = await Promise.all(userRows.filter(row => row.aka).map(async (row) => {
      const { data: stats, error: statsError } = await supabase.rpc("get_public_profile_stats", { target_user_id: row.id });
      if (statsError) console.warn("[community-search] user stats unavailable", statsError.code);
      const aggregate = Array.isArray(stats) ? stats[0] : stats;
      return {
        id: row.id, username: row.aka, name: row.name ?? null, avatar: row.avatar_url ?? null,
        href: (url.pathname.startsWith("/en/") ? "/en" : "") + "/u/" + encodeURIComponent(row.aka) + "/",
        seen: Number(aggregate?.watched_count) || 0,
        favorites: Number(aggregate?.anime_likes_count) || 0,
      };
    }));
    const debates = await Promise.all((debateResult.data ?? []).map(async (row: any) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const { count } = await supabase.from("community_debate_comments").select("id", { count: "exact", head: true }).eq("debate_id", row.id).eq("status", "visible");
      const minutes = Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 60000));
      const english = url.pathname.startsWith("/en/");
      const age = minutes < 60 ? (minutes < 1 ? (english ? "now" : "ahora") : minutes + (english ? "m" : " min"))
        : minutes < 1440 ? Math.floor(minutes / 60) + (english ? "h" : " h")
        : Math.floor(minutes / 1440) + (english ? "d" : " d");
      return {
        id: row.id, title: row.title,
        meta: (count ?? 0) + (english ? " replies · " : " respuestas · ") + age + (english ? " · by @" : " · por @") + (profile?.aka ?? ""),
        href: (english ? "/en" : "") + "/community/debates/" + row.id + "/",
      };
    }));
    return json({ ok: true, users, debates, usersTotal, debatesTotal: debateCount.count ?? 0, pageSize: PAGE_SIZE });
  } catch (error) {
    console.error("[community-search] failed", error);
    return json({ ok: false, error: "SEARCH_UNAVAILABLE" }, 503);
  }
};
