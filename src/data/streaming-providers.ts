export type StreamingProvider = { name: string; logo: string; url: string };
export type StreamingAvailability = { region: "ES"; checkedAt: string; sourceUrl: string; providers: StreamingProvider[] };
const logo = (slug: string) => slug === "primevideo"
  ? "https://cdn.jsdelivr.net/npm/simple-icons@16.9.0/icons/primevideo.svg"
  : `https://cdn.simpleicons.org/${slug}/ffffff`;

// Catálogo editorial estático por ID estable de la colección de Ren.
export const streamingAvailability: Record<string, StreamingAvailability> = {
  "personal-005": {
    region: "ES", checkedAt: "2026-11-15",
    sourceUrl: "https://www.justwatch.com/es/serie/ataque-a-los-titanes",
    providers: [{ name: "Prime Video", logo: logo("primevideo"), url: "https://www.primevideo.com/" }],
  },
  "personal-140": {
    region: "ES", checkedAt: "2026-11-15",
    sourceUrl: "https://www.justwatch.com/es/serie/jujutsu-kaisen",
    providers: [
      { name: "Netflix", logo: logo("netflix"), url: "https://www.netflix.com/es/" },
      { name: "Prime Video", logo: logo("primevideo"), url: "https://www.primevideo.com/" },
      { name: "Disney+", logo: logo("disneyplus"), url: "https://www.disneyplus.com/es-es" },
      { name: "Crunchyroll", logo: logo("crunchyroll"), url: "https://www.crunchyroll.com/es-es" },
    ],
  },
  "personal-142": {
    region: "ES", checkedAt: "2026-11-15",
    sourceUrl: "https://www.justwatch.com/es/serie/death-note",
    providers: [
      { name: "Netflix", logo: logo("netflix"), url: "https://www.netflix.com/es/" },
      { name: "Crunchyroll", logo: logo("crunchyroll"), url: "https://www.crunchyroll.com/es-es" },
    ],
  },
};
