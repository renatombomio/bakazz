import { readFile } from "node:fs/promises";

const fileUrl = new URL("../src/data/duels.json", import.meta.url);
const catalog = JSON.parse(await readFile(fileUrl, "utf8"));
const errors = [];

const fail = (message) => errors.push(message);
const isHttps = (value) => typeof value === "string" && /^https:\/\/\S+$/.test(value);

if (!catalog || !Array.isArray(catalog.duels)) {
  fail("src/data/duels.json must contain a duels array.");
} else {
  if (catalog.duels.length !== 60) {
    fail(`Expected exactly 60 duels; found ${catalog.duels.length}.`);
  }

  const pairKeys = new Set();
  const appearances = new Map();

  catalog.duels.forEach((duel, index) => {
    const number = index + 1;
    for (const sideName of ["a", "b"]) {
      const side = duel?.[sideName];
      if (!side || !Number.isSafeInteger(side.id) || side.id <= 0) {
        fail(`Duel ${number} (${sideName}): invalid AniList ID.`);
        continue;
      }
      if (typeof side.title !== "string" || !side.title.trim()) {
        fail(`Duel ${number} (${sideName}): missing title.`);
      }
      if (!isHttps(side.image)) {
        fail(`Duel ${number} (${sideName}): image must be an HTTPS URL.`);
      }
      if (side.format !== "TV" && side.format !== "TV_SHORT" && side.format !== "ONA") {
        fail(`Duel ${number} (${sideName}): only TV, TV_SHORT or ONA anime series are allowed.`);
      }
      appearances.set(side.id, (appearances.get(side.id) ?? 0) + 1);
    }

    if (duel?.a?.id && duel?.a?.id === duel?.b?.id) {
      fail(`Duel ${number}: both sides reference the same anime.`);
    }

    if (duel?.a?.id && duel?.b?.id) {
      const key = [duel.a.id, duel.b.id].sort((a, b) => a - b).join(":");
      if (pairKeys.has(key)) fail(`Duel ${number}: duplicated pairing.`);
      pairKeys.add(key);
    }
  });

  for (const [id, count] of appearances) {
    if (count > 2) fail(`Anime ID ${id} appears in ${count} duels (maximum 2).`);
  }
}

if (errors.length) {
  console.error("Duel catalog validation failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Duel catalog valid: exactly 60 complete, unique A/B pairings.");
