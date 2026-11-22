import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseSsrClient } from "../../../../lib/supabase-ssr";

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function removeUserMedia(admin: ReturnType<typeof createClient>, userId: string) {
  const bucket = admin.storage.from("profile-media");
  for (const folder of ["avatar", "cover"]) {
    const { data, error } = await bucket.list(`${userId}/${folder}`, { limit: 1000 });
    if (error) throw new Error("MEDIA_CLEANUP_FAILED");
    const paths = (data ?? []).filter((item) => item.name).map((item) => `${userId}/${folder}/${item.name}`);
    if (paths.length) {
      const { error: removeError } = await bucket.remove(paths);
      if (removeError) throw new Error("MEDIA_CLEANUP_FAILED");
    }
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { confirmation?: unknown };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "INVALID_REQUEST" }, 400); }

  try {
    const sessionClient = createSupabaseSsrClient(request, cookies);
    const { data: auth, error: authError } = await sessionClient.auth.getUser();
    if (authError || !auth.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);
    if (body.confirmation !== "ELIMINAR" && body.confirmation !== "DELETE") {
      return json({ ok: false, error: "CONFIRMATION_REQUIRED" }, 400);
    }

    const url = import.meta.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      console.error("Account deletion is unavailable: server admin credentials are not configured.");
      return json({ ok: false, error: "DELETE_UNAVAILABLE" }, 503);
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    await removeUserMedia(admin, auth.user.id);

    const { error: deleteError } = await admin.auth.admin.deleteUser(auth.user.id);
    if (deleteError) {
      console.error("Account deletion failed:", deleteError.message);
      return json({ ok: false, error: "DELETE_FAILED" }, 502);
    }
    return json({ ok: true });
  } catch (error) {
    console.error("Account deletion endpoint failed:", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "DELETE_UNAVAILABLE" }, 503);
  }
};
