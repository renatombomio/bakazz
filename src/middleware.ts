import { defineMiddleware } from "astro:middleware";
import type { User } from "@supabase/supabase-js";
import { createSupabaseSsrClient } from "./lib/supabase-ssr";
import { localizedPath } from "./i18n";

// Production remains in maintenance until the BAKAZZ auth cutover is tested
// and explicitly approved. Preview is the active testing environment.
const MAINTENANCE_MODE = true;

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const isPreview = import.meta.env.VERCEL_ENV === "preview";
  const isEnglish = /^\/en(?:\/|$)/.test(pathname);
  const basePath = isEnglish ? pathname.replace(/^\/en(?=\/|$)/, "") || "/" : pathname;
  const routePath = basePath.length > 1 ? basePath.replace(/\/$/, "") : basePath;

  context.locals.lang = isEnglish ? "en" : "es";
  context.locals.basePath = basePath;

  if (MAINTENANCE_MODE && !isPreview) {
    if (routePath === "/maintenance") return next();
    const isStaticAsset =
      routePath.startsWith("/_astro/") ||
      routePath.startsWith("/audio/") ||
      routePath.startsWith("/videos/") ||
      routePath.startsWith("/video/") ||
      routePath.startsWith("/images/") ||
      routePath === "/favicon.svg" ||
      routePath === "/favicon.ico";
    if (isStaticAsset) return next();
    if (routePath.startsWith("/api/")) {
      return new Response(JSON.stringify({
        ok: false, error: "MAINTENANCE_MODE",
        message: "BAKAZZ is being updated. Please try again later.",
      }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Retry-After": "3600", "Cache-Control": "no-store" },
      });
    }
    return context.redirect("/maintenance/", 307);
  }

  const isPublicAssetOrApi =
    routePath.startsWith("/api/") ||
    routePath.startsWith("/_astro/") ||
    routePath.startsWith("/audio/") ||
    routePath.startsWith("/videos/") ||
    routePath.startsWith("/video/") ||
    routePath.startsWith("/images/") ||
    routePath === "/favicon.svg" ||
    routePath === "/favicon.ico";

  const isPublicAuthPage = [
    "/login", "/login/", "/register", "/register/",
    "/auth/callback", "/auth/callback/",
  ].includes(routePath);

  if (isPublicAssetOrApi) return isEnglish ? next(basePath + search) : next();

  // Preview is a private testing environment: unauthenticated visitors land
  // on login first, and protected application routes require a Development
  // account. Production keeps its maintenance gate.
  if (routePath === "/" && !isPreview) return isEnglish ? next(basePath + search) : next();

  context.cookies.set("lang", context.locals.lang, {
    path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax",
    httpOnly: true, secure: context.url.protocol === "https:",
  });

  let user: User | null = null;
  try {
    const supabase = createSupabaseSsrClient(context.request, context.cookies);
    const { data, error } = await supabase.auth.getUser();
    if (!error) user = data.user;
  } catch (error) {
    console.error("Supabase middleware authentication failed:", error);
    if (isPreview) {
      if (isPublicAuthPage) return isEnglish ? next(basePath + search) : next();
      return context.redirect(localizedPath(context.locals.lang, "/login/"), 303);
    }
    return new Response("Authentication service unavailable.", {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }

  if (!user) {
    if (isPublicAuthPage) return isEnglish ? next(basePath + search) : next();
    return context.redirect(localizedPath(context.locals.lang, "/login/"));
  }

  try {
    const supabase = createSupabaseSsrClient(context.request, context.cookies);
    const { data: profile, error } = await supabase
      .from("profiles").select("id, name, aka, created_at")
      .eq("id", user.id).maybeSingle();
    if (error) {
      console.error("Supabase profile lookup failed:", error.code);
      return new Response("Profile service unavailable.", {
        status: 503, headers: { "Cache-Control": "no-store" },
      });
    }
    context.locals.bakazzUser = {
      id: user.id,
      name: profile?.name ?? user.user_metadata?.name ?? "Usuario",
      aka: profile?.aka ?? user.user_metadata?.aka ?? "",
      created_at: profile?.created_at ?? user.created_at,
      email: user.email ?? "",
    };
  } catch (error) {
    console.error("Supabase profile lookup failed:", error);
    return new Response("Profile service unavailable.", {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }

  const nickname = context.locals.bakazzUser.aka?.trim() ?? "";
  const hasNickname = Boolean(nickname && !nickname.startsWith("nakama_"));

  if (isPublicAuthPage) {
    if (routePath === "/auth/callback" || routePath === "/login" || routePath === "/register") {
      const isCompletingProfile =
        routePath === "/login" && context.url.searchParams.get("complete-profile") === "1";
      if (!context.url.searchParams.has("recovery") && !isCompletingProfile) {
        return hasNickname
          ? context.redirect(isEnglish ? "/en/" : "/", 303)
          : context.redirect(localizedPath(context.locals.lang, "/login/") + "?complete-profile=1", 303);
      }
    }
  } else if (!hasNickname) {
    return context.redirect(localizedPath(context.locals.lang, "/login/") + "?complete-profile=1", 303);
  }

  return isEnglish ? next(basePath + search) : next();
});
