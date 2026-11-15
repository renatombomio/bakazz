export type StreamingProvider = {
  key: "netflix" | "prime" | "disney" | "crunchyroll";
  name: string;
  url: string;
};
export type StreamingAvailability = {
  region: "ES";
  checkedAt: string;
  sourceUrl: string;
  providers: StreamingProvider[];
};

// Catálogo editorial estático por ID interno de la biblioteca.
export const streamingAvailability: Record<string, StreamingAvailability> = {
  "personal-005": {
    region: "ES", checkedAt: "2026-11-15",
    sourceUrl: "https://www.justwatch.com/es/serie/ataque-a-los-titanes",
    providers: [{ key: "prime", name: "Prime Video", url: "https://www.primevideo.com/" }],
  },
  "personal-140": {
    region: "ES", checkedAt: "2026-11-15",
    sourceUrl: "https://www.justwatch.com/es/serie/jujutsu-kaisen",
    providers: [
      { key: "netflix", name: "Netflix", url: "https://www.netflix.com/es/" },
      { key: "prime", name: "Prime Video", url: "https://www.primevideo.com/" },
      { key: "disney", name: "Disney+", url: "https://www.disneyplus.com/es-es" },
      { key: "crunchyroll", name: "Crunchyroll", url: "https://www.crunchyroll.com/es-es" },
    ],
  },
  "personal-142": {
    region: "ES", checkedAt: "2026-11-15",
    sourceUrl: "https://www.justwatch.com/es/serie/death-note",
    providers: [
      { key: "netflix", name: "Netflix", url: "https://www.netflix.com/es/" },
      { key: "crunchyroll", name: "Crunchyroll", url: "https://www.crunchyroll.com/es-es" },
    ],
  },
};
