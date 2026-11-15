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

const provider = {
  netflix: { key: "netflix", name: "Netflix", url: "https://www.netflix.com/es/" } as const,
  prime: { key: "prime", name: "Prime Video", url: "https://www.primevideo.com/" } as const,
  disney: { key: "disney", name: "Disney+", url: "https://www.disneyplus.com/es-es" } as const,
  crunchyroll: { key: "crunchyroll", name: "Crunchyroll", url: "https://www.crunchyroll.com/es-es" } as const,
};

// Disponibilidad contrastada para España con JustWatch.
// Solo se incluyen plataformas con streaming confirmado; alquiler/compra y canales de terceros se excluyen.
export const streamingAvailability: Record<string, StreamingAvailability> = {
  "personal-001": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/my-hero-academia",
    providers: [provider.netflix, provider.disney, provider.crunchyroll],
  },
  "personal-003": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/naruto",
    providers: [provider.netflix, provider.prime, provider.disney, provider.crunchyroll],
  },
  "personal-004": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/bleach",
    providers: [provider.disney],
  },
  "personal-005": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/ataque-a-los-titanes",
    providers: [provider.prime],
  },
  "personal-006": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/one-piece",
    providers: [provider.netflix, provider.disney, provider.crunchyroll],
  },
  "personal-010": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/one-punch-man",
    providers: [provider.crunchyroll],
  },
  "personal-012": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/black-clover",
    providers: [provider.crunchyroll],
  },
  "personal-013": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/danmachi-que-tiene-de-malo-intentar-ligar-en-una-mazmorra",
    providers: [provider.prime],
  },
  "personal-014": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/kakegurui",
    providers: [provider.netflix],
  },
  "personal-022": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/d-gray-man",
    providers: [provider.crunchyroll],
  },
  "personal-035": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/tokyo-ghoul",
    providers: [provider.netflix],
  },
  "personal-040": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/bungou-stray-dogs",
    providers: [provider.crunchyroll],
  },
  "personal-048": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/goblin-slayer",
    providers: [provider.prime],
  },
  "personal-053": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/kuroko-no-basket",
    providers: [provider.netflix, provider.prime],
  },
  "personal-054": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/no-game-no-life",
    providers: [provider.netflix],
  },
  "personal-052": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/enen-no-shouboutai",
    providers: [provider.disney, provider.crunchyroll],
  },
  "personal-089": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/vinland-saga",
    providers: [provider.netflix, provider.prime, provider.crunchyroll],
  },
  "personal-092": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/mushoku-tensei-isekai-ittara-honki-dasu-2021",
    providers: [provider.crunchyroll],
  },
  "personal-096": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/sk8-the-infinity",
    providers: [provider.crunchyroll],
  },
  "personal-100": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/vivy-fluorite-eyes-song",
    providers: [provider.crunchyroll],
  },
  "personal-140": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/jujutsu-kaisen",
    providers: [provider.netflix, provider.prime, provider.disney, provider.crunchyroll],
  },
  "personal-018": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/dororo-2019",
    providers: [provider.prime],
  },
  "personal-033": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/magi",
    providers: [provider.crunchyroll],
  },
  "personal-051": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/tate-no-yuusha-no-nariagari",
    providers: [provider.netflix, provider.disney, provider.crunchyroll],
  },
  "personal-086": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/the-god-of-high-school",
    providers: [provider.crunchyroll],
  },
  "personal-088": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/kenganashiyura",
    providers: [provider.netflix],
  },
  "personal-109": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/parasyte-kiseijuu-sei-no-kakuritsu",
    providers: [provider.netflix],
  },
  "personal-085": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/dorohedoro",
    providers: [provider.netflix, provider.disney, provider.crunchyroll],
  },
  "personal-105": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/youkoso-jitsuryoku-shijou-shugi-no-kyoushitsu-e",
    providers: [provider.crunchyroll],
  },
  "personal-107": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/tower-of-god",
    providers: [provider.crunchyroll],
  },
  "personal-112": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/hajime-no-ippo",
    providers: [provider.netflix],
  },
  "personal-113": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/jigokuraku",
    providers: [provider.crunchyroll],
  },
  "personal-137": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/cike-wu-liuqi",
    providers: [provider.netflix],
  },
  "personal-121": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/bartender-glass-of-god",
    providers: [provider.crunchyroll],
  },
  "personal-128": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/solo-leveling",
    providers: [provider.crunchyroll],
  },
  "personal-131": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/dead-account",
    providers: [provider.crunchyroll],
  },
  "personal-138": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/the-eminence-in-shadow",
    providers: [provider.netflix],
  },
  "personal-139": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/cowboy-bebop",
    providers: [provider.netflix],
  },
  "personal-015": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/kimetsu-no-yaiba",
    providers: [provider.netflix, provider.prime, provider.crunchyroll],
  },
  "personal-055": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/haikyu-los-ases-del-voley",
    providers: [provider.netflix, provider.prime, provider.crunchyroll],
  },
  "personal-065": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/mahoutsukai-no-yome",
    providers: [provider.crunchyroll],
  },
  "personal-074": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/re-zero-kara-hajimeru-isekai-seikatsu",
    providers: [provider.crunchyroll],
  },
  "personal-110": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/komi-san-wa-komyushou-desu",
    providers: [provider.netflix],
  },
  "personal-141": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/hunter-x-hunter-2011",
    providers: [provider.prime, provider.netflix, provider.crunchyroll],
  },
  "personal-090": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/kanojo-okarishimasu",
    providers: [provider.crunchyroll],
  },
  "personal-119": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/kaiju-no-8",
    providers: [provider.crunchyroll],
  },
  "personal-120": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/wind-breaker",
    providers: [provider.crunchyroll],
  },
  "personal-127": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/sakamoto-days",
    providers: [provider.netflix],
  },
  "personal-135": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/gachiakuta",
    providers: [provider.disney, provider.crunchyroll],
  },
  "personal-142": {
    region: "ES", checkedAt: "2026-11-15", sourceUrl: "https://www.justwatch.com/es/serie/death-note",
    providers: [provider.crunchyroll],
  },
};
