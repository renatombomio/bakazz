export type StreamingProvider = {
  name: string;
  url: string;
};

export type StreamingAvailability = {
  region: "ES";
  checkedAt: string;
  sourceUrl: string;
  providers: StreamingProvider[];
};

// Curated, version-controlled availability for Spain. No runtime provider API calls.
export const streamingAvailability: Record<number, StreamingAvailability> = {
  16498: {
    region: "ES",
    checkedAt: "2026-11-15",
    sourceUrl: "https://www.justwatch.com/es/serie/ataque-a-los-titanes",
    providers: [
      { name: "Netflix", url: "https://www.netflix.com/es/" },
      { name: "Prime Video", url: "https://www.primevideo.com/" },
      { name: "Crunchyroll", url: "https://www.crunchyroll.com/es-es" },
      { name: "AnimeBox", url: "https://animebox.es/" },
    ],
  },
  113415: {
    region: "ES",
    checkedAt: "2026-11-15",
    sourceUrl: "https://www.justwatch.com/es/serie/jujutsu-kaisen",
    providers: [
      { name: "Netflix", url: "https://www.netflix.com/es/" },
      { name: "Prime Video", url: "https://www.primevideo.com/" },
      { name: "Disney+", url: "https://www.disneyplus.com/es-es" },
      { name: "Crunchyroll", url: "https://www.crunchyroll.com/es-es" },
    ],
  },
  1535: {
    region: "ES",
    checkedAt: "2026-11-15",
    sourceUrl: "https://www.justwatch.com/es/serie/death-note",
    providers: [
      { name: "Netflix", url: "https://www.netflix.com/es/" },
      { name: "Crunchyroll", url: "https://www.crunchyroll.com/es-es" },
    ],
  },
};
