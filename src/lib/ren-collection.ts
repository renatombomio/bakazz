import { getWatchedLibrary } from "../data/library";
import identityCatalogue from "../data/ren-anime-identities.json";
import coverManifest from "../data/ren-cover-manifest.json";
import { getPersistentCache } from "./server/persistent-cache";
import { localizedPath } from "../i18n";

type Identity = {
  animeId: string;
  anilistId: number;
  format: "SERIES" | "MOVIE";
  displayTitle: string;
  providerTitles?: { romaji?: string | null; english?: string | null };
  coverImage?: { extraLarge?: string | null; large?: string | null } | null;
};
type ManifestEntry = { animeId: string; externalId?: string | null; posterUrl?: string | null };
type AniListMedia = {
  id: number;
  title?: { romaji?: string | null; english?: string | null };
  format?: string | null;
  popularity?: number | null;
  coverImage?: { extraLarge?: string | null; large?: string | null; color?: string | null } | null;
};
type AniListPayload = { data?: { Page?: { media?: AniListMedia[] } }; errors?: { message?: string }[] };

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
const posters = new Map<string, ManifestEntry>(
  (coverManifest as { entries?: ManifestEntry[] }).entries?.map((entry) => [entry.animeId, entry]) ?? [],
);
const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const BATCH_SIZE = 50;

async function fetchAniListBatch(ids: number[]): Promise<AniListMedia[]> {
  const cached = await getPersistentCache<AniListMedia[]>("ren-collection-cover-colors", { ids }, CACHE_TTL_SECONDS, async () => {
    const response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: `query RenCollectionCovers($ids: [Int]) {
          Page(page: 1, perPage: 50) {
            media(id_in: $ids, type: ANIME) {
              id
              title { romaji english }
              format
              popularity
              coverImage { extraLarge large color }
            }
          }
        }`,
        variables: { ids },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`AniList returned HTTP ${response.status}`);
    const payload = await response.json() as AniListPayload;
    if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).filter(Boolean).join("; "));
    const media = payload.data?.Page?.media;
    if (!Array.isArray(media)) throw new Error("AniList returned an invalid collection response.");
    return media;
  });
  return cached.value;
}

export async function getRenCollectionItems(lang: "es" | "en"): Promise<RenCollectionItem[]> {
  const watched = getWatchedLibrary();
  const candidates = watched.filter((entry) => {
    const identity = identities.get(entry.animeId);
    return entry.format !== "MOVIE" && identity?.format !== "MOVIE";
  });
  const ids = candidates
    .map((entry) => Number(posters.get(entry.animeId)?.externalId ?? identities.get(entry.animeId)?.anilistId))
    .filter((id) => Number.isInteger(id) && id > 0);
  const uniqueIds = [...new Set(ids)];
  const mediaById = new Map<number, AniListMedia>();

  const batches = Array.from({ length: Math.ceil(uniqueIds.length / BATCH_SIZE) }, (_, index) =>
    uniqueIds.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
  );
  const results = await Promise.all(batches.map(async (batch) => {
    try {
      return await fetchAniListBatch(batch);
    } catch (error) {
      console.warn("[ren-collection] AniList metadata unavailable:", error);
      return [];
    }
  }));
  for (const result of results) {
    for (const item of result) mediaById.set(item.id, item);
  }

  const items = candidates.flatMap((entry): RenCollectionItem[] => {
    const identity = identities.get(entry.animeId);
    const manifest = posters.get(entry.animeId);
    const anilistId = Number(manifest?.externalId ?? identity?.anilistId);
    const media = Number.isInteger(anilistId) ? mediaById.get(anilistId) : undefined;
    if (media?.format === "MOVIE") return [];
    const cover = media?.coverImage?.extraLarge
      || media?.coverImage?.large
      || identity?.coverImage?.extraLarge
      || identity?.coverImage?.large
      || manifest?.posterUrl
      || "";
    const title = media?.title?.romaji || media?.title?.english || identity?.providerTitles?.romaji || identity?.displayTitle || entry.title;
    return [{
      animeId: entry.animeId,
      title,
      href: localizedPath(lang, `/anime/${entry.animeId}/`),
      cover,
      color: media?.coverImage?.color || "#3a3a44",
      popularity: media?.popularity ?? 0,
      recommended: entry.state.recommended,
    }];
  });

  return items;
}
