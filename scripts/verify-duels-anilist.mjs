import { readFile } from "node:fs/promises";

const catalog = JSON.parse(
  await readFile(new URL("../src/data/duels.json", import.meta.url), "utf8"),
);
const duels = catalog.duels ?? [];
const sides = duels.flatMap((duel, index) => [
  { duel: index + 1, side: "a", anime: duel.a },
  { duel: index + 1, side: "b", anime: duel.b },
]);
const ids = [...new Set(sides.map(({ anime }) => anime.id))];
const found = new Map();
const query = `
  query ($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        id
        format
        title { romaji english }
        coverImage { extraLarge large }
      }
    }
  }
`;

for (let offset = 0; offset < ids.length; offset += 50) {
  const batch = ids.slice(offset, offset + 50);
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { ids: batch } }),
  });
  if (!response.ok) throw new Error(`AniList verification failed: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors[0].message);
  for (const media of payload.data?.Page?.media ?? []) found.set(media.id, media);
}

const normalize = (value) => String(value ?? "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const errors = [];

for (const { duel, side, anime } of sides) {
  const media = found.get(anime.id);
  if (!media) {
    errors.push(`Duel ${duel} (${side}): AniList ID ${anime.id} not found.`);
    continue;
  }
  if (!["TV", "TV_SHORT", "ONA"].includes(media.format)) {
    errors.push(`Duel ${duel} (${side}): ${anime.title} has unsupported format ${media.format}.`);
  }
  const titles = [media.title.romaji, media.title.english].filter(Boolean).map(normalize);
  if (!titles.includes(normalize(anime.title))) {
    errors.push(`Duel ${duel} (${side}): catalog title "${anime.title}" does not match AniList.`);
  }
  const currentImage = media.coverImage?.extraLarge ?? media.coverImage?.large ?? null;
  if (!currentImage || currentImage !== anime.image) {
    errors.push(`Duel ${duel} (${side}): cover URL does not match AniList.`);
  }
}

for (const { duel, side, anime } of sides) {
  try {
    const response = await fetch(anime.image, { method: "HEAD" });
    if (!response.ok) errors.push(`Duel ${duel} (${side}): cover returned HTTP ${response.status}.`);
  } catch {
    errors.push(`Duel ${duel} (${side}): cover URL could not be reached.`);
  }
}

if (errors.length) {
  console.error("AniList verification failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`AniList verified ${duels.length} duels, ${sides.length} covers and ${ids.length} unique anime IDs.`);
