/* Display-only components for Search. Data and filtering stay in SearchView. */
import type { CSSProperties } from "react";
import "./SearchDisplay.css";

export type DisplayMedia = {
  id: number;
  title: string;
  href: string;
  image: string;
  year?: number | null;
  score?: number | null;
  color?: string | null;
  formatLabel?: string | null;
  episodes?: number | null;
  genres?: string[];
};

type RailProps = { title: string; subtitle?: string; items: DisplayMedia[]; showScore?: boolean };

export function CategoryRail({ title, subtitle, items, showScore = false }: RailProps) {
  if (!items.length) return null;
  return (
    <section className="sd-sec" aria-label={title}>
      <h2>{title}</h2>
      {subtitle && <p className="sd-sub">{subtitle}</p>}
      <div className="sd-rail" tabIndex={0}>
        {items.map((media, index) => (
          <a key={media.id} className="sd-it" href={media.href}>
            <span className="sd-ph" style={{ background: media.color ?? "#1c1c22" }}>
              <img src={media.image} alt="" width={112} height={168} loading={index < 3 ? "eager" : "lazy"} draggable={false} />
              {showScore && media.score != null && <span className="sd-score">★ {media.score.toFixed(1)}</span>}
            </span>
            <b>{media.title}</b>
            {media.year != null && <span className="sd-year">{media.year}</span>}
          </a>
        ))}
      </div>
    </section>
  );
}

export type AwardEdition = { year: number; label: string; anime: DisplayMedia };
type AwardsProps = { title: string; subtitle?: string; editions: AwardEdition[] };

export function AwardsTimeline({ title, subtitle, editions }: AwardsProps) {
  const validEditions = editions.filter((edition) => Boolean(edition.anime?.image && edition.anime?.href && edition.anime?.title));
  if (!validEditions.length) return null;
  const [latest, ...older] = [...validEditions].sort((a, b) => b.year - a.year);
  return (
    <section className="sd-sec sd-awards" aria-label={title}>
      <h2>{title}</h2>
      {subtitle && <p className="sd-sub">{subtitle}</p>}
      <a className="sd-win" href={latest.anime.href}>
        <span className="sd-win-ph" style={{ background: latest.anime.color ?? "#1c1c22" }}>
          <img src={latest.anime.image} alt="" width={138} height={207} loading="lazy" draggable={false} />
        </span>
        <span className="sd-win-tx">
          <span className="sd-win-year">{latest.year}</span>
          <b>{latest.anime.title}</b>
          <span className="sd-win-lab">{latest.label}</span>
        </span>
      </a>
      {older.length > 0 && (
        <ul className="sd-old">
          {older.map((edition) => (
            <li key={edition.year}>
              <a href={edition.anime.href}>
                <span className="sd-old-year">{edition.year}</span>
                <span className="sd-old-ph" style={{ background: edition.anime.color ?? "#1c1c22" }}>
                  <img src={edition.anime.image} alt="" width={44} height={66} loading="lazy" draggable={false} />
                </span>
                <span className="sd-old-tx"><b>{edition.anime.title}</b><span>{edition.label}</span></span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type ResultsProps = { items: DisplayMedia[]; countLabel: string; emptyLabel: string; epsLabel: (count: number) => string };

export function ResultsList({ items, countLabel, emptyLabel, epsLabel }: ResultsProps) {
  return (
    <section className="sd-res" aria-live="polite">
      <p className="sd-count">{items.length ? countLabel : emptyLabel}</p>
      {items.length > 0 && (
        <ul>
          {items.map((media, index) => {
            const meta = [media.year, media.formatLabel, media.episodes ? epsLabel(media.episodes) : null].filter(Boolean).join(" · ");
            return (
              <li key={media.id}>
                <a className="sd-row" href={media.href} style={{ "--c": media.color ?? "#3a3a44" } as CSSProperties}>
                  <img src={media.image} alt="" width={64} height={96} loading={index < 6 ? "eager" : "lazy"} draggable={false} />
                  <span className="sd-row-tx">
                    <b>{media.title}</b>
                    {meta && <span className="sd-meta">{meta}</span>}
                    {media.genres && media.genres.length > 0 && <span className="sd-genres">{media.genres.slice(0, 3).join(", ")}</span>}
                  </span>
                  {media.score != null && <span className="sd-row-score">★ {media.score.toFixed(1)}</span>}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
