import { defineMiddleware } from "astro:middleware";
import type { User } from "@supabase/supabase-js";
import { createSupabaseSsrClient } from "./lib/supabase-ssr";
import { localizedPath } from "./i18n";

// Production remains in maintenance until the BAKAZZ auth cutover is tested
// and explicitly approved. Preview is the active testing environment.
const MAINTENANCE_MODE = true;

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  // Maintenance is intentionally restricted to the two production hostnames.
  // Every Preview, deployment URL, localhost, and other host stays accessible.
  const hostname = context.url.hostname.toLowerCase();
  const isProductionHost = hostname === "bakazz.com" || hostname === "www.bakazz.com";
  const isEnglish = /^\/en(?:\/|$)/.test(pathname);
  const basePath = isEnglish ? pathname.replace(/^\/en(?=\/|$)/, "") || "/" : pathname;
  const routePath = basePath.length > 1 ? basePath.replace(/\/$/, "") : basePath;

  context.locals.lang = isEnglish ? "en" : "es";
  context.locals.basePath = basePath;

  if (MAINTENANCE_MODE && isProductionHost) {
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

  // Public-facing BAKAZZ routes: visitors can discover the product before
  // creating an account. Personal areas remain protected below.
  const isPublicPage =
    routePath === "/" ||
    [
      "/buscar", "/search", "/genres", "/ren-collection",
      "/community", "/community/debates",
    ].includes(routePath) ||
    /^\/anime\/[^/]+$/.test(routePath) ||
    /^\/community\/debates\/[^/]+$/.test(routePath) ||
    /^\/u\/[^/]+$/.test(routePath);

  // Reading debates is public; opening the composer is an authenticated action.
  const isProtectedAction =
    routePath === "/community/debates" &&
    context.url.searchParams.get("compose") === "1";
  const requiresAuthentication = !isPublicPage || isProtectedAction;

  if (isPublicAssetOrApi) return isEnglish ? next(basePath + search) : next();

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
    if (isPublicAuthPage || (isPublicPage && !isProtectedAction)) {
      return isEnglish ? next(basePath + search) : next();
    }
    if (isPreview) {
      const loginUrl = new URL(localizedPath(context.locals.lang, "/login/"), context.url);
      loginUrl.searchParams.set("next", pathname + search);
      return context.redirect(loginUrl.pathname + loginUrl.search, 303);
    }
    return new Response("Authentication service unavailable.", {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }

  if (!user) {
    if (isPublicAuthPage || (isPublicPage && !isProtectedAction)) {
      return isEnglish ? next(basePath + search) : next();
    }
    const loginUrl = new URL(localizedPath(context.locals.lang, "/login/"), context.url);
    loginUrl.searchParams.set("next", pathname + search);
    return context.redirect(loginUrl.pathname + loginUrl.search, 303);
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
        const requestedNext = context.url.searchParams.get("next") ?? "";
        const safeNext =
          requestedNext.startsWith("/") &&
          !requestedNext.startsWith("//") &&
          !requestedNext.includes("\\") &&
          !requestedNext.includes("://")
            ? requestedNext
            : (isEnglish ? "/en/" : "/");
        return hasNickname
          ? context.redirect(safeNext, 303)
          : context.redirect(
              localizedPath(context.locals.lang, "/login/") +
                "?complete-profile=1&next=" + encodeURIComponent(safeNext),
              303,
            );
      }
    }
  } else if (!hasNickname && requiresAuthentication) {
    const loginUrl = new URL(localizedPath(context.locals.lang, "/login/"), context.url);
    loginUrl.searchParams.set("complete-profile", "1");
    loginUrl.searchParams.set("next", pathname + search);
    return context.redirect(loginUrl.pathname + loginUrl.search, 303);
  }

  return isEnglish ? next(basePath + search) : next();
});
