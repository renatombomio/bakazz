import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../../lib/supabase-ssr";
import { weekKey } from "../../../../components/community/duel";

export const prerender = false;

const ACTIVE_DUEL = { a: 20, b: 269 } as const;
type Choice = "a" | "b";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return json({ ok: false, error: "AUTH_REQUIRED" }, 401);
    }

    let body: { week?: unknown; choice?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "INVALID_BODY" }, 400);
    }

    const currentWeek = weekKey();
    if (typeof body.week !== "string" || body.week !== currentWeek) {
      return json({ ok: false, error: "STALE_DUEL_WEEK" }, 409);
    }

    if (body.choice !== "a" && body.choice !== "b") {
      return json({ ok: false, error: "INVALID_CHOICE" }, 400);
    }

    const choice = body.choice as Choice;
    const animeId = ACTIVE_DUEL[choice];

    const { error: insertError } = await supabase.from("duel_votes").insert({
      week: currentWeek,
      user_id: auth.user.id,
      anime_id: animeId,
    });

    if (insertError && insertError.code !== "23505") {
      console.error("Weekly duel vote insert failed:", insertError.code);
      return json({ ok: false, error: "VOTE_FAILED" }, 503);
    }

    const { data: ownVote, error: ownVoteError } = await supabase
      .from("duel_votes")
      .select("anime_id")
      .eq("week", currentWeek)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (ownVoteError || !ownVote) {
      console.error("Weekly duel vote lookup failed:", ownVoteError?.code);
      return json({ ok: false, error: "VOTE_LOOKUP_FAILED" }, 503);
    }

    const storedChoice: Choice =
      ownVote.anime_id === ACTIVE_DUEL.a ? "a" : "b";

    const { data: countRows, error: countsError } = await supabase.rpc("duel_counts", {
      p_week: currentWeek,
      p_a: ACTIVE_DUEL.a,
      p_b: ACTIVE_DUEL.b,
    });

    if (countsError) {
      console.error("Weekly duel counts failed:", countsError.code);
      return json({ ok: false, error: "COUNTS_FAILED" }, 503);
    }

    const counts = Array.isArray(countRows) ? countRows[0] : countRows;
    if (!counts) return json({ ok: false, error: "COUNTS_UNAVAILABLE" }, 503);

    return json({
      ok: true,
      choice: storedChoice,
      counts: {
        a: Number(counts.a) || 0,
        b: Number(counts.b) || 0,
      },
    });
  } catch (error) {
    console.error("Weekly duel vote endpoint failed:", error);
    return json({ ok: false, error: "VOTE_FAILED" }, 503);
  }
};
