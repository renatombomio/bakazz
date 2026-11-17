import LikeCount from "./LikeCount";

export type FavCharacter = { id: number; name: string; image: string; href: string; likes: number; liked: boolean };
type Props = { items: FavCharacter[]; lang: string; likeLabel: (n: number, liked: boolean) => string };

/** Caras redondas en las 4 columnas del muro, con el me gusta como insignia sobre la foto. La serie solo aparece en "Ver todos". */
export default function CharactersRow({ items, lang, likeLabel }: Props) {
  return (
    <div className="chs">
      {items.map((c) => (
        <a key={c.id} className="ch" href={c.href}>
          <span className="ch-ph">
            <img src={c.image} alt="" loading="lazy" draggable={false} />
            <LikeCount count={c.likes} liked={c.liked} lang={lang} label={likeLabel} />
          </span>
          <b>{c.name}</b>
        </a>
      ))}
    </div>
  );
}