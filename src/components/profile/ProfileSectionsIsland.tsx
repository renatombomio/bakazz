import ProfileSections, { type DebateRow, type LibItem } from "./ProfileSections";
import type { FavAnime } from "./FavoritesWall";
import type { FavCharacter } from "./CharactersRow";

type Props = {
  lang: string;
  owner: boolean;
  favorites: FavAnime[];
  favoritesTotal: number;
  favoritesHref: string;
  characters: FavCharacter[];
  charactersTotal: number;
  charactersHref: string;
  collection: LibItem[];
  collectionTotal: number;
  collectionHref: string;
  watchlist: LibItem[];
  watchlistTotal: number;
  watchlistHref: string;
  debates: DebateRow[];
  debatesTotal: number;
  debatesHref: string;
  newDebateHref: string;
  addFavoriteHref: string;
  searchHref: string;
};

export default function ProfileSectionsIsland(props: Props) {
  const english = props.lang === "en";
  const number = (value: number) =>
    new Intl.NumberFormat(props.lang, { notation: "compact", maximumFractionDigits: 1 }).format(value);

  return (
    <ProfileSections
      {...props}
      t={{
        favorites: english ? "Favorite anime" : "Animes favoritos",
        characters: english ? "Favorite characters" : "Personajes favoritos",
        library: english ? "My library" : "Mi biblioteca",
        collection: english ? "Collection" : "Colección",
        watchlist: english ? "My list" : "Mi lista",
        debates: english ? "My debates" : "Mis debates",
        seeAll: english ? "See all" : "Ver todos",
        animes: (count) => `${count.toLocaleString(props.lang)} ${english ? "anime" : "animes"}`,
        addFavorite: english ? "Add a favorite anime" : "Añadir un anime favorito",
        likeLabel: (count, liked) =>
          `${number(count)} ${english ? (liked ? "likes, you too" : "likes") : (liked ? "me gusta, a ti también" : "me gusta")}`,
        libraryEmpty: english ? "You haven't saved any anime yet" : "Aún no has guardado ningún anime",
        browse: english ? "Browse anime" : "Buscar animes",
        noDebates: english ? "You haven't started any debates yet" : "Aún no has abierto ningún debate",
        newDebate: english ? "Start your first debate" : "Abrir el primero",
      }}
    />
  );
}
