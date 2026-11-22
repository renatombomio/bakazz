import LikeCount from "./LikeCount";

export type FavAnime = { id: number; title: string; image: string; href: string; likes: number; liked: boolean };
type Props = {
  items: FavAnime[];                       // hasta 5
  owner: boolean;                          // en tu propio perfil, los huecos libres invitan a añadir
  addHref: string;                         // p. ej. localizedPath("/buscar")
  lang: string;
  t: { addFavorite: string; likeLabel: (n: number, liked: boolean) => string };
};

/** Muro: 1 póster grande (2×2) + 4 pequeños. Con menos de 5, los huecos se muestran solo en tu perfil. */
export default function FavoritesWall({ items, owner, addHref, lang, t }: Props) {
  const shown = items.slice(0, 5);
  const ghosts = owner ? Array.from({ length: 5 - shown.length }, (_, k) => shown.length + k) : [];
  return (
    <div className="fw">
      {shown.map((a, i) => (
        <a key={a.id} className={i === 0 ? "po big" : "po"} href={a.href} aria-label={a.title}>
          <img src={a.image} alt="" loading="lazy" draggable={false} />
          <LikeCount count={a.likes} liked={a.liked} lang={lang} label={t.likeLabel} />
        </a>
      ))}
      {ghosts.map((slot) => (
        <a key={`g${slot}`} className={slot === 0 ? "po big ghost" : "po ghost"} href={addHref} aria-label={t.addFavorite}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
        </a>
      ))}
    </div>
  );
}