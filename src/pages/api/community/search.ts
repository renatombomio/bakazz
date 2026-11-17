import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const GET: APIRoute = async ({ request, cookies }) => {
  const url = new URL(request.url);
  const raw = (url.searchParams.get("q") ?? "").trim().replace(/^@/, "").slice(0, 60);
  const query = raw.replace(/[,%()\\]/g, " ").replace(/\s+/g, " ").trim();
  if (query.length < 2) return json({ ok: true, users: [], debates: [] });

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const pattern = `%${query}%`;
    const [users, titleMatches, bodyMatches] = await Promise.all([
      supabase.from("profiles").select("id,aka,avatar_url,last_seen_at")
        .eq("is_private", false).not("aka", "is", null).ilike("aka", pattern)
        .order("last_seen_at", { ascending: false, nullsFirst: false }).limit(12),
      supabase.from("community_debates")
        .select("id,title,body,category,created_at,profiles!inner(aka,avatar_url,is_private)")
        .eq("status", "published").eq("profiles.is_private", false).ilike("title", pattern)
        .order("created_at", { ascending: false }).limit(12),
      supabase.from("community_debates")
        .select("id,title,body,category,created_at,profiles!inner(aka,avatar_url,is_private)")
        .eq("status", "published").eq("profiles.is_private", false).ilike("body", pattern)
        .order("created_at", { ascending: false }).limit(12),
    ]);
    if (users.error || titleMatches.error || bodyMatches.error) {
      console.warn("[community-search] query failed", users.error?.code, titleMatches.error?.code, bodyMatches.error?.code);
      return json({ ok: false, error: "SEARCH_UNAVAILABLE" }, 503);
    }
    const uniqueDebates = new Map<string, any>();
    for (const row of [...(titleMatches.data ?? []), ...(bodyMatches.data ?? [])]) uniqueDebates.set(row.id, row);
    const debates = [...uniqueDebates.values()]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 12)
      .map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          id: row.id,
          title: row.title,
          body: row.body,
          category: row.category,
          aka: profile?.aka ?? "",
          avatar_url: profile?.avatar_url ?? null,
        };
      });
    return json({
      ok: true,
      users: (users.data ?? []).filter((row) => row.aka).map((row) => ({
        id: row.id,
        aka: row.aka,
        avatar_url: row.avatar_url,
        isOnline: Boolean(row.last_seen_at && Date.now() - new Date(row.last_seen_at).getTime() <= 120_000),
      })),
      debates,
    });
  } catch (error) {
    console.error("[community-search] failed", error);
    return json({ ok: false, error: "SEARCH_UNAVAILABLE" }, 503);
  }
};
