import { useState } from "react";
import FavoritesWall, { type FavAnime } from "./FavoritesWall";
import CharactersRow, { type FavCharacter } from "./CharactersRow";
import "./ProfileSections.css";

export type LibItem = { id: number; title: string; cover: string; href: string };
export type DebateRow = { id: number; title: string; meta: string; href: string };   // meta ya formateada: "12 respuestas · hace 8 d"

type Props = {
  lang: string;
  owner: boolean;
  favorites: FavAnime[];            favoritesTotal: number;  favoritesHref: string;
  characters: FavCharacter[];       charactersTotal: number; charactersHref: string;     // pasa como mucho 4
  collection: LibItem[];            collectionTotal: number; collectionHref: string;     // pasa como mucho 6
  watchlist: LibItem[];             watchlistTotal: number;  watchlistHref: string;      // pasa como mucho 6
  debates: DebateRow[];             debatesTotal: number;    debatesHref: string;  newDebateHref: string;   // como mucho 3
  addFavoriteHref: string;          searchHref: string;
  t: {
    favorites: string; characters: string; library: string; collection: string; watchlist: string; debates: string; seeAll: string;
    animes: (n: number) => string;                       // "24 animes"
    addFavorite: string; likeLabel: (n: number, liked: boolean) => string;
    libraryEmpty: string; browse: string; noDebates: string; newDebate: string;
  };
};

function Head({ title, href, more, big = false, sub, seeAll }: { title: string; href: string; more: boolean; big?: boolean; sub?: string; seeAll: string }) {
  return (
    <header className={big ? "ps-h ps-h-big" : "ps-h"}>
      <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      {more && <a className="ps-all" href={href}>{seeAll}</a>}
    </header>
  );
}

/** Secciones del perfil con un único sistema de espacios (40px entre secciones, 14px bajo cada título). */
export default function ProfileSections(p: Props) {
  const { t } = p;
  const [tab, setTab] = useState<"collection" | "watchlist">("collection");
  const items = tab === "collection" ? p.collection : p.watchlist;
  const total = tab === "collection" ? p.collectionTotal : p.watchlistTotal;
  const href = tab === "collection" ? p.collectionHref : p.watchlistHref;
  const libraryEmpty = p.collectionTotal + p.watchlistTotal === 0;

  return (
    <div className="ps">
      {(p.favoritesTotal > 0 || p.owner) && (
        <section>
          <Head title={t.favorites} href={p.favoritesHref} more={p.favoritesTotal > 5} seeAll={t.seeAll} />
          <FavoritesWall items={p.favorites} owner={p.owner} addHref={p.addFavoriteHref} lang={p.lang} t={{ addFavorite: t.addFavorite, likeLabel: t.likeLabel }} />
        </section>
      )}

      {p.charactersTotal > 0 && (
        <section>
          <Head title={t.characters} href={p.charactersHref} more={p.charactersTotal > 4} seeAll={t.seeAll} />
          <CharactersRow items={p.characters.slice(0, 4)} lang={p.lang} likeLabel={t.likeLabel} />
        </section>
      )}

      <section>
        <Head big title={t.library} href={href} more={!libraryEmpty && total > 6} sub={libraryEmpty ? undefined : t.animes(total)} seeAll={t.seeAll} />
        {libraryEmpty ? (
          <div className="ps-empty"><p>{t.libraryEmpty}</p><a className="ps-all" href={p.searchHref}>{t.browse}</a></div>
        ) : (
          <>
            <div className="ps-tabs" role="tablist">
              {(["collection", "watchlist"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{k === "collection" ? t.collection : t.watchlist}</button>
              ))}
            </div>
            <div className="ps-grid" role="tabpanel">
              {items.slice(0, 6).map((a) => (
                <a key={a.id} className="po" href={a.href} aria-label={a.title}><img src={a.cover} alt="" loading="lazy" draggable={false} /></a>
              ))}
            </div>
          </>
        )}
      </section>

      {(p.debatesTotal > 0 || p.owner) && (
        <section>
          <Head title={t.debates} href={p.debatesHref} more={p.debatesTotal > 3} seeAll={t.seeAll} />
          {p.debatesTotal === 0 ? (
            <div className="ps-empty"><p>{t.noDebates}</p><a className="ps-all" href={p.newDebateHref}>{t.newDebate}</a></div>
          ) : (
            <ul className="ps-deb">
              {p.debates.slice(0, 3).map((d) => (<li key={d.id}><a href={d.href}><b>{d.title}</b><span>{d.meta}</span></a></li>))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}