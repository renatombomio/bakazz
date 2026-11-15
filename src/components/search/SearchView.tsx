import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { localizedPath, useT, type Lang } from "../../i18n";

interface Media {
  id: number;
  title?: { romaji?: string | null; english?: string | null };
  coverImage?: { extraLarge?: string | null; large?: string | null };
  format?: string | null;
  startDate?: { year?: number | null } | null;
  genres?: string[];
}
type Status = "FINISHED" | "RELEASING";
interface Filters { genres: string[]; year: string; status: Status | ""; }
const EMPTY: Filters = { genres: [], year: "", status: "" };
const PAGE_SIZE = 24;

function readFilters(params: URLSearchParams): Filters {
  const rawGenres = params.get("genre") ?? "";
  const genres = [...new Set(rawGenres.split(",").map((value) => value.trim()).filter(Boolean))];
  const year = params.get("year") ?? "";
  const status = params.get("status") ?? "";
  return {
    genres,
    year: /^\d{4}$/.test(year) || year === "before2020" ? year : "",
    status: status === "FINISHED" || status === "RELEASING" ? status : "",
  };
}
function hasSelectedFilters(filters: Filters) {
  return filters.genres.length > 0 || Boolean(filters.year || filters.status);
}
function buildParams(query: string, filters: Filters, page = 1, count = false) {
  const params = new URLSearchParams();
  if (query.trim().length >= 2) params.set("q", query.trim());
  if (filters.genres.length) params.set("genre", filters.genres.join(","));
  if (filters.year) params.set("year", filters.year);
  if (filters.status) params.set("status", filters.status);
  if (count) params.set("count", "1");
  else if (page > 1) params.set("page", String(page));
  return params;
}

export default function SearchView({ lang = "es" }: { lang?: Lang }) {
  const t = useT(lang);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [initialized, setInitialized] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [results, setResults] = useState<Media[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const appliedKey = JSON.stringify(applied);
  const draftKey = JSON.stringify(draft);
  const hasFilters = hasSelectedFilters(applied);
  const summary = useMemo(() => {
    const parts = [...applied.genres];
    if (applied.year) parts.push(applied.year === "before2020" ? t("search.before2020") : applied.year);
    if (applied.status) parts.push(applied.status === "FINISHED" ? t("search.finished") : t("search.releasing"));
    return parts.join(", ");
  }, [appliedKey, lang]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = readFilters(params);
    setApplied(initial);
    setDraft(initial);
    setQuery(params.get("q") ?? "");
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const params = buildParams(query, applied);
    const suffix = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (suffix ? `?${suffix}` : ""));
  }, [query, appliedKey, initialized]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/anime-search?genres=1", { signal: controller.signal }).then((response) => response.json()),
      fetch("/api/anime-search?years=1", { signal: controller.signal }).then((response) => response.json()),
    ]).then(([genrePayload, yearPayload]) => {
      if (genrePayload.success && Array.isArray(genrePayload.genres)) setGenres(genrePayload.genres);
      if (yearPayload.success && Array.isArray(yearPayload.years)) setYears(yearPayload.years);
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const controller = new AbortController();
    let cancelled = false;
    const filtersActive = hasSelectedFilters(applied);
    if (debouncedQuery.length === 1) {
      setResults([]);
      setTotal(0);
      setHasNext(false);
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    setError(false);
    const params = filtersActive || debouncedQuery.length >= 2
      ? buildParams(debouncedQuery, applied)
      : new URLSearchParams({ popular: "1" });
    fetch("/api/anime-search?" + params.toString(), { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || "Search failed");
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setResults(payload.items ?? []);
        setTotal(payload.total ?? 0);
        setHasNext(Boolean(payload.hasNextPage));
      })
      .catch((reason) => {
        if (!cancelled && reason?.name !== "AbortError") setError(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [initialized, debouncedQuery, appliedKey]);

  useEffect(() => {
    if (!filtersOpen) return;
    const controller = new AbortController();
    setCount(null);
    setCountLoading(true);
    const timeout = window.setTimeout(() => {
      const params = buildParams(debouncedQuery || query, draft, 1, true);
      if (!params.has("q") && !params.has("genre") && !params.has("year") && !params.has("status")) params.set("popular", "1");
      fetch("/api/anime-search?" + params.toString(), { signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.success) throw new Error(payload.error || "Count failed");
          return payload;
        })
        .then((payload) => setCount(Number(payload.total ?? 0)))
        .catch((reason) => { if (reason?.name !== "AbortError") setCount(0); })
        .finally(() => { if (!controller.signal.aborted) setCountLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [filtersOpen, draftKey, debouncedQuery, query]);

  const closePanel = useCallback(() => {
    setFiltersOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFirst = () => dialogRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
    const frame = window.requestAnimationFrame(focusFirst);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen, closePanel]);

  const updateGenre = (genre: string) => setDraft((current) => ({
    ...current,
    genres: current.genres.includes(genre) ? current.genres.filter((item) => item !== genre) : [...current.genres, genre],
  }));
  const updateYear = (year: string) => setDraft((current) => ({ ...current, year: current.year === year ? "" : year }));
  const updateStatus = (status: Status) => setDraft((current) => ({ ...current, status: current.status === status ? "" : status }));
  const clearFilters = () => setDraft(EMPTY);
  const applyFilters = () => {
    setApplied(draft);
    setFiltersOpen(false);
    triggerRef.current?.focus();
  };
  const removeFilters = () => {
    setApplied(EMPTY);
    setDraft(EMPTY);
  };

  const loadMore = async () => {
    if (!hasNext || loading) return;
    setLoading(true);
    try {
      const params = buildParams(debouncedQuery, applied);
      params.set("page", String(Math.floor(results.length / PAGE_SIZE) + 1));
      const response = await fetch("/api/anime-search?" + params.toString());
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error("Load more failed");
      setResults((current) => [...current, ...(payload.items ?? [])]);
      setHasNext(Boolean(payload.hasNextPage));
    } catch { setError(true); }
    finally { setLoading(false); }
  };

  const renderCard = (item: Media) => {
    const title = lang === "en"
      ? item.title?.english || item.title?.romaji || t("detail.noTitle")
      : item.title?.romaji || item.title?.english || t("detail.noTitle");
    const image = item.coverImage?.extraLarge || item.coverImage?.large;
    return (
      <article className="search-result" key={item.id}>
        <a className="search-card" href={localizedPath(lang, `/anime/${item.id}/`)} aria-label={title}>
          <div className="search-poster">{image ? <img src={image} alt="" loading="lazy" /> : <span>{title}</span>}</div>
          <h3>{title}</h3>
        </a>
      </article>
    );
  };

  const buttonLabel = count === 0
    ? t("search.noResults")
    : countLoading || count === null
      ? t("search.seeLoading")
      : t("search.seeCount").replace("{count}", count.toLocaleString(lang === "en" ? "en-GB" : "es-ES"));

  return (
    <div className="search-view">
      <style>{`
        .search-view { width: 100%; color: #f2efe9; }
        .search-view h1 { margin: 0 0 1.4rem; font: 800 clamp(2rem,4vw,2.5rem)/1.05 Inter,system-ui,sans-serif; letter-spacing: -.035em; }
        .search-form { display:flex; align-items:center; gap:.7rem; height:52px; margin:0 0 1.1rem; padding:0 18px; border:0; border-radius:999px; background:#1c1c22; }
        .search-form:focus-within { outline:2px solid #f472b6; outline-offset:3px; }
        .search-form svg { flex:0 0 auto; color:#a6a2ad; }
        .search-form input { flex:1; min-width:0; height:100%; border:0; outline:0; background:transparent; color:#f2efe9; font:400 15px/1.2 Inter,system-ui,sans-serif; }
        .search-filter-bar { display:flex; align-items:center; gap:10px; min-height:32px; margin:0 0 1.45rem; min-width:0; }
        .search-filter-trigger { padding:0; border:0; background:none; color:#f2efe9; font:700 15px/1.3 Inter,system-ui,sans-serif; cursor:pointer; }
        .search-filter-summary { min-width:0; overflow:hidden; color:#c9c5cf; font:500 14px/1.3 Inter,system-ui,sans-serif; text-overflow:ellipsis; white-space:nowrap; }
        .search-filter-remove { margin-left:auto; flex:0 0 auto; padding:0; border:0; background:none; color:#c9c5cf; font:500 14px/1.3 Inter,system-ui,sans-serif; cursor:pointer; }
        .search-filter-trigger:focus-visible,.search-filter-remove:focus-visible { outline:2px solid #f472b6; outline-offset:4px; border-radius:4px; }
        .search-section-title { margin:0 0 1rem; color:#f2efe9; font:700 20px/1.2 Inter,system-ui,sans-serif; }
        .search-results-count { margin:0 0 1rem; color:#a6a2ad; font:400 14px/1.4 Inter,system-ui,sans-serif; }
        .search-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:20px 8px; }
        .search-result { min-width:0; }
        .search-card { display:block; min-width:0; color:inherit; text-decoration:none; }
        .search-poster { aspect-ratio:2/3; overflow:hidden; border-radius:8px; background:#1c1c22; }
        .search-poster img { display:block; width:100%; height:100%; object-fit:cover; }
        .search-poster span { display:grid; width:100%; height:100%; place-items:center; padding:8px; color:#a6a2ad; font-size:12px; text-align:center; }
        .search-card h3 { display:-webkit-box; overflow:hidden; margin:7px 0 0; color:#d8d4de; font:500 12px/1.35 Inter,system-ui,sans-serif; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
        .search-state { margin:1rem 0; color:#a6a2ad; font:400 14px/1.4 Inter,system-ui,sans-serif; }
        .search-more { display:block; margin:24px auto 0; padding:12px 20px; border:0; border-radius:999px; background:#1c1c22; color:#f2efe9; font:600 14px Inter,system-ui,sans-serif; cursor:pointer; }
        .sf-back { position:fixed; inset:0; z-index:100; display:flex; align-items:flex-end; justify-content:center; background:rgba(0,0,0,.6); }
        .sf-sheet { display:flex; flex-direction:column; width:100%; max-height:88svh; padding:10px 16px calc(16px + env(safe-area-inset-bottom)); border-radius:24px 24px 0 0; background:#131316; color:#f2efe9; animation:sf-up .22s ease-out; }
        .sf-grab { width:40px; height:4px; margin:0 auto 14px; border-radius:2px; background:#3a3a44; }
        .sf-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
        .sf-head h2 { margin:0; font:700 18px/1.3 Inter,system-ui,sans-serif; }
        .sf-clear { padding:0; border:0; background:none; color:#a6a2ad; font:500 14px Inter,system-ui,sans-serif; cursor:pointer; }
        .sf-body { min-height:0; overflow-y:auto; padding:0 0 6px; overscroll-behavior:contain; }
        .sf-lab { margin:16px 0 8px; color:#a6a2ad; font:400 14px/1.3 Inter,system-ui,sans-serif; }
        .sf-chips { display:flex; flex-wrap:wrap; gap:8px; }
        .sf-chip { padding:8px 14px; border:0; border-radius:999px; background:#1c1c22; color:#d8d4de; font:600 14px/1.25 Inter,system-ui,sans-serif; cursor:pointer; }
        .sf-chip[aria-pressed="true"] { background:#ec4899; color:#fff; }
        .sf-chip:focus-visible,.sf-clear:focus-visible,.sf-go:focus-visible { outline:2px solid #f472b6; outline-offset:3px; }
        .sf-go { flex:0 0 auto; margin-top:14px; padding:15px; border:0; border-radius:999px; background:#ec4899; color:#fff; font:700 15px Inter,system-ui,sans-serif; cursor:pointer; }
        .sf-go:disabled { background:#2a2a31; color:#8d8993; cursor:default; }
        @keyframes sf-up { from { transform:translateY(24px); opacity:0; } to { transform:none; opacity:1; } }
        @media (prefers-reduced-motion:reduce) { .sf-sheet { animation:none; } }
        @media (min-width:768px) {
          .sf-back { align-items:center; padding:24px; }
          .sf-sheet { width:min(100%,560px); max-height:88svh; padding:18px 24px 22px; border-radius:24px; }
          .sf-grab { display:none; }
        }
      `}</style>
      <h1>{t("search.pageTitle")}</h1>
      <form className="search-form" onSubmit={(event: FormEvent) => event.preventDefault()}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 4 4" /></svg>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search.placeholder")} aria-label={t("search.label")} />
      </form>
      <div className="search-filter-bar">
        <button ref={triggerRef} type="button" className="search-filter-trigger" aria-label={t("search.filters")} aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => { setDraft(applied); setFiltersOpen(true); }}>{t("search.filters")}</button>
        {hasFilters && <span className="search-filter-summary">{summary}</span>}
        {hasFilters && <button type="button" className="search-filter-remove" aria-label={t("search.removeFilters")} onClick={removeFilters}>{t("search.removeFilters")}</button>}
      </div>
      {!query.trim() && !hasFilters && <h2 className="search-section-title">{t("search.popular")}</h2>}
      {(query.trim() || hasFilters) && <p className="search-results-count">{t("search.resultsCount").replace("{count}", total.toLocaleString(lang === "en" ? "en-GB" : "es-ES"))}</p>}
      {loading && <p className="search-state" role="status">{t("search.loading")}</p>}
      {error && <p className="search-state" role="alert">{t("search.error")}</p>}
      {!loading && !error && results.length > 0 && <div className="search-grid">{results.map(renderCard)}</div>}
      {!loading && !error && results.length === 0 && (query.trim() || hasFilters) && <p className="search-state">{t("search.noResults")}</p>}
      {hasNext && !loading && <button type="button" className="search-more" onClick={loadMore}>{t("search.more")}</button>}
      {filtersOpen && (
        <div className="sf-back" onMouseDown={(event) => { if (event.target === event.currentTarget) closePanel(); }}>
          <div ref={dialogRef} className="sf-sheet" role="dialog" aria-modal="true" aria-labelledby="sf-title">
            <div className="sf-grab" aria-hidden="true" />
            <div className="sf-head"><h2 id="sf-title">{t("search.filters")}</h2><button type="button" className="sf-clear" onClick={clearFilters}>{t("search.clear")}</button></div>
            <div className="sf-body">
              <section className="sf-group"><p className="sf-lab">{t("search.genre")}</p><div className="sf-chips">
                {genres.map((genre) => <button key={genre} type="button" className="sf-chip" aria-pressed={draft.genres.includes(genre)} onClick={() => updateGenre(genre)}>{genre}</button>)}
              </div></section>
              <section className="sf-group"><p className="sf-lab">{t("search.year")}</p><div className="sf-chips">
                {years.map((year) => <button key={year} type="button" className="sf-chip" aria-pressed={draft.year === year} onClick={() => updateYear(year)}>{year === "before2020" ? t("search.before2020") : year}</button>)}
              </div></section>
              <section className="sf-group"><p className="sf-lab">{t("search.status")}</p><div className="sf-chips">
                <button type="button" className="sf-chip" aria-pressed={draft.status === "FINISHED"} onClick={() => updateStatus("FINISHED")}>{t("search.finished")}</button>
                <button type="button" className="sf-chip" aria-pressed={draft.status === "RELEASING"} onClick={() => updateStatus("RELEASING")}>{t("search.releasing")}</button>
              </div></section>
            </div>
            <button type="button" className="sf-go" disabled={count === 0 || countLoading || count === null} onClick={applyFilters}>
              {count === 0 ? t("search.noResults") : buttonLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
