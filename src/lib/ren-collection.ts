import { getWatchedLibrary } from "../data/library";
import identityCatalogue from "../data/ren-anime-identities.json";
import coverManifest from "../data/ren-cover-manifest.json";
import { localizedPath } from "../i18n";

type Identity = {
  animeId: string;
  format: "SERIES" | "MOVIE";
  displayTitle: string;
  providerTitles?: { romaji?: string | null; english?: string | null };
  coverImage?: { extraLarge?: string | null; large?: string | null } | null;
};
type ManifestEntry = {
  animeId: string;
  format?: "SERIES" | "MOVIE";
  displayTitle?: string;
  posterUrl?: string | null;
  color?: string | null;
  popularity?: number;
};

export type RenCollectionItem = {
  animeId: string;
  title: string;
  href: string;
  cover: string;
  color: string;
  popularity: number;
  recommended: boolean;
};

const identities = new Map<string, Identity>(
  (identityCatalogue as { entries?: Identity[] }).entries?.map((entry) => [entry.animeId, entry]) ?? [],
);
const catalogue = new Map<string, ManifestEntry>(
  (coverManifest as { entries?: ManifestEntry[] }).entries?.map((entry) => [entry.animeId, entry]) ?? [],
);

/** Fixed editorial data: rendering this page never calls AniList or another API. */
export function getRenCollectionItems(lang: "es" | "en"): RenCollectionItem[] {
  return getWatchedLibrary().flatMap((entry): RenCollectionItem[] => {
    const identity = identities.get(entry.animeId);
    const metadata = catalogue.get(entry.animeId);
    const format = entry.format ?? metadata?.format ?? identity?.format ?? "SERIES";
    if (format === "MOVIE") return [];

    return [{
      animeId: entry.animeId,
      title: metadata?.displayTitle || identity?.providerTitles?.romaji || identity?.displayTitle || entry.title,
      href: localizedPath(lang, `/anime/${entry.animeId}/`),
      cover: metadata?.posterUrl || identity?.coverImage?.extraLarge || identity?.coverImage?.large || "",
      color: metadata?.color || "#3a3a44",
      popularity: metadata?.popularity ?? 0,
      recommended: entry.state.recommended || entry.state.favorite,
    }];
  });
}
