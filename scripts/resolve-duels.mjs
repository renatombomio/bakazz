import { DUEL_SEED } from "./duels-seed.mjs";

const endpoint = "https://graphql.anilist.co";
const query = `
  query ($search: String) {
    Page(page: 1, perPage: 5) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        format
        title { romaji english native }
        coverImage { extraLarge large color }
      }
    }
  }
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelay(response, attempt) {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(1, seconds) * 1000;
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(1000, date - Date.now());
  }
  return Math.min(60_000, 2_000 * 2 ** attempt);
}

async function searchAnime(search, attempt = 0) {
  const response = await fetch(endpoint, {\n    signal: AbortSignal.timeout(20_000),
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { search } }),
  });

  if (response.status === 429 && attempt < 4) {
    const retryAfter = Number(response.headers.get("retry-after")) || 60;
    console.warn(`Rate limit for "${search}". Waiting ${retryAfter}s.`);
    await sleep(retryAfter * 1000);
    return searchAnime(search, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`AniList HTTP ${response.status} while searching "${search}"`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`AniList query failed for "${search}": ${payload.errors[0].message}`);
  }

  return payload.data?.Page?.media ?? [];
}

const uniqueTitles = [...new Set(DUEL_SEED.flat())];
const results = [];

for (let index = 0; index < uniqueTitles.length; index += 1) {
  const search = uniqueTitles[index];
  const candidates = await searchAnime(search);
  results.push({
    search,
    reviewed: false,
    candidates: candidates.map((media) => ({
      id: media.id,
      format: media.format,
      title: media.title,
      image: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
      color: media.coverImage?.color ?? null,
    })),
  });

  console.error(`[${index + 1}/${uniqueTitles.length}] ${search}: ${candidates.length} candidates`);
  if (index < uniqueTitles.length - 1) await sleep(900);
}

const output = {
  generatedAt: new Date().toISOString(),
  source: "AniList GraphQL",
  reviewRequired: true,
  pairs: DUEL_SEED.map(([a, b], index) => ({
    number: index + 1,
    a: { search: a, candidates: results.find((item) => item.search === a)?.candidates ?? [] },
    b: { search: b, candidates: results.find((item) => item.search === b)?.candidates ?? [] },
  })),
  results,
};

process.stdout.write(JSON.stringify(output, null, 2) + "\n");
