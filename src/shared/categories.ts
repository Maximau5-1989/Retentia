import type { CategoryId, CategoryOverrides, CategoryRejections, CategoryScanBucket, CategoryScanDomain, TimeUnit } from "./types";

export type CategoryConfidence = "high" | "medium" | "none";

interface ClassificationSignals {
  hostKeywords: readonly string[];
  urlKeywords: readonly string[];
  titleKeywords: readonly string[];
  highConfidenceScore?: number;
}

export interface CategoryPreset {
  id: CategoryId;
  label: string;
  description: string;
  duration: number;
  unit: TimeUnit;
  deleteImmediately?: boolean;
  domains: readonly string[];
  signals: ClassificationSignals;
}

export interface CategoryClassification {
  category?: CategoryId;
  suggestedCategory?: CategoryId;
  confidence: CategoryConfidence;
  score: number;
  source: "domain" | "signals" | "override" | "none";
}

export const CATEGORY_PRESETS: readonly CategoryPreset[] = [
  {
    id: "social",
    label: "Social media",
    description: "Social networks, communities, and public profiles.",
    duration: 7,
    unit: "days",
    domains: ["facebook.com", "instagram.com", "linkedin.com", "reddit.com", "tiktok.com", "x.com"],
    signals: {
      hostKeywords: ["social", "community", "forum"],
      urlKeywords: ["community", "profile", "members", "forum"],
      titleKeywords: ["social network", "online community", "member profile"],
    },
  },
  {
    id: "shopping",
    label: "Webshops",
    description: "Product browsing and online marketplaces.",
    duration: 14,
    unit: "days",
    domains: ["aliexpress.com", "amazon.com", "amazon.nl", "bol.com", "coolblue.nl", "ebay.com", "temu.com"],
    signals: {
      hostKeywords: ["shop", "store", "marketplace", "webshop"],
      urlKeywords: ["product", "products", "cart", "checkout", "shop", "store"],
      titleKeywords: ["shopping", "webshop", "online store", "shopping cart", "checkout"],
    },
  },
  {
    id: "news",
    label: "News",
    description: "News articles and current-affairs websites.",
    duration: 30,
    unit: "days",
    domains: ["bbc.com", "cnn.com", "nos.nl", "nrc.nl", "nu.nl", "telegraaf.nl", "volkskrant.nl"],
    signals: {
      hostKeywords: ["news", "nieuws", "daily", "times"],
      urlKeywords: ["news", "nieuws", "article", "breaking"],
      titleKeywords: ["breaking news", "latest news", "nieuws", "news article"],
    },
  },
  {
    id: "streaming",
    label: "Streaming",
    description: "Video, music, podcast, and livestream platforms.",
    duration: 30,
    unit: "days",
    domains: ["disneyplus.com", "netflix.com", "primevideo.com", "spotify.com", "twitch.tv", "youtube.com"],
    signals: {
      hostKeywords: ["stream", "video", "music", "podcast"],
      urlKeywords: ["watch", "video", "videos", "stream", "playlist", "podcast"],
      titleKeywords: ["watch online", "streaming", "livestream", "podcast", "music video"],
    },
  },
  {
    id: "search",
    label: "Search engines",
    description: "Search result pages that can contain sensitive queries.",
    duration: 1,
    unit: "days",
    domains: ["bing.com", "duckduckgo.com", "ecosia.org", "google.com", "google.nl", "search.brave.com"],
    signals: {
      hostKeywords: ["search"],
      urlKeywords: ["search", "query", "results"],
      titleKeywords: ["search results", "zoekresultaten", "search engine"],
    },
  },
  {
    id: "travel",
    label: "Travel",
    description: "Transport, accommodation, and trip comparison websites.",
    duration: 30,
    unit: "days",
    domains: ["9292.nl", "airbnb.com", "booking.com", "ns.nl", "skyscanner.com", "tripadvisor.com"],
    signals: {
      hostKeywords: ["travel", "trips", "hotel", "flights"],
      urlKeywords: ["flight", "flights", "hotel", "hotels", "accommodation", "booking"],
      titleKeywords: ["book a flight", "hotel deals", "travel deals", "accommodation"],
    },
  },
  {
    id: "entertainment",
    label: "Entertainment & gaming",
    description: "Games, entertainment databases, guides, and fan communities.",
    duration: 30,
    unit: "days",
    domains: ["fandom.com", "ign.com", "imdb.com", "playstation.com", "steamcommunity.com", "steampowered.com", "xbox.com"],
    signals: {
      hostKeywords: ["gaming", "games", "game"],
      urlKeywords: ["game", "games", "gaming", "movies", "entertainment"],
      titleKeywords: ["gaming", "video game", "movie database", "entertainment"],
    },
  },
  {
    id: "adult",
    label: "18+",
    description: "Adult-content websites classified locally without opening or reading page content.",
    duration: 1,
    unit: "days",
    deleteImmediately: true,
    domains: ["chaturbate.com", "onlyfans.com", "pornhub.com", "redtube.com", "xhamster.com", "xnxx.com", "xvideos.com", "youporn.com"],
    signals: {
      hostKeywords: ["adult", "porn", "porno", "pornhub", "redtube", "xhamster", "xnxx", "xvideos", "youporn", "chaturbate", "xxx", "nsfw", "hentai", "sexcam"],
      urlKeywords: ["adult", "porn", "porno", "xxx", "nsfw", "nude", "nudes", "hentai", "sex", "erotic"],
      titleKeywords: ["adult", "porn", "porno", "xxx", "nsfw", "nude", "hentai", "sex video", "erotic", "18+", "video", "videos"],
      highConfidenceScore: 50,
    },
  },
] as const;

const MEDIUM_CONFIDENCE_SCORE = 35;
const DEFAULT_HIGH_CONFIDENCE_SCORE = 60;
const HIGH_CONFIDENCE_MARGIN = 15;

export function getCategoryPreset(id?: CategoryId): CategoryPreset | undefined {
  return CATEGORY_PRESETS.find((preset) => preset.id === id);
}

export function normalizeHostname(input: string): string | undefined {
  const parsed = parseUrl(input);
  return parsed?.hostname.replace(/^www\./, "");
}

export function classifyCategory(input: string, title = "", overrides: CategoryOverrides = {}): CategoryClassification {
  const parsed = parseUrl(input);
  if (!parsed) return { confidence: "none", score: 0, source: "none" };
  const hostname = parsed.hostname.replace(/^www\./, "");
  const override = findOverride(hostname, overrides);
  if (override) return { category: override, confidence: "high", score: 100, source: "override" };

  const domainPreset = CATEGORY_PRESETS.find((preset) => preset.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)));
  if (domainPreset) return { category: domainPreset.id, confidence: "high", score: 100, source: "domain" };

  const urlText = `${parsed.pathname} ${parsed.search}`;
  const scores = CATEGORY_PRESETS
    .map((preset) => ({ preset, score: scoreSignals(hostname, urlText, title, preset.signals) }))
    .sort((a, b) => b.score - a.score);
  const winner = scores[0];
  const runnerUp = scores[1]?.score ?? 0;
  if (!winner || winner.score < MEDIUM_CONFIDENCE_SCORE) return { confidence: "none", score: winner?.score ?? 0, source: "none" };

  const highThreshold = winner.preset.signals.highConfidenceScore ?? DEFAULT_HIGH_CONFIDENCE_SCORE;
  if (winner.score >= highThreshold && winner.score - runnerUp >= HIGH_CONFIDENCE_MARGIN) {
    return { category: winner.preset.id, confidence: "high", score: winner.score, source: "signals" };
  }
  return { suggestedCategory: winner.preset.id, confidence: "medium", score: winner.score, source: "signals" };
}

export function suggestCategory(input: string, title = ""): CategoryPreset | undefined {
  return getCategoryPreset(classifyCategory(input, title).category);
}

export function resolveCategory(input: string, overrides: CategoryOverrides = {}, title = ""): CategoryId | undefined {
  return classifyCategory(input, title, overrides).category;
}

export function categorizeHistoryEntries(entries: ReadonlyArray<{ url?: string; title?: string; visitCount?: number }>, overrides: CategoryOverrides = {}, rejections: CategoryRejections = {}): CategoryScanBucket[] {
  const buckets = new Map<CategoryId | undefined, CategoryScanBucket>();
  for (const preset of CATEGORY_PRESETS) {
    buckets.set(preset.id, { category: preset.id, urls: 0, visits: 0, domains: [] });
  }
  buckets.set(undefined, { category: undefined, urls: 0, visits: 0, domains: [] });
  const domainMaps = new Map<CategoryId | undefined, Map<string, CategoryScanDomain>>(
    [...buckets.keys()].map((category) => [category, new Map()]),
  );

  for (const entry of entries) {
    if (!entry.url) continue;
    const domain = normalizeHostname(entry.url);
    if (!domain) continue;
    const classification = classifyCategory(entry.url, entry.title, overrides);
    if (classification.suggestedCategory && rejections[domain]?.includes(classification.suggestedCategory)) {
      classification.suggestedCategory = undefined;
      classification.confidence = "none";
      classification.score = 0;
    }
    const category = classification.category;
    const bucket = buckets.get(category)!;
    const key = `${domain}|${classification.suggestedCategory ?? ""}`;
    const domainMap = domainMaps.get(category)!;
    const current = domainMap.get(key) ?? {
      domain,
      urls: 0,
      visits: 0,
      overridden: classification.source === "override",
      confidence: classification.confidence,
      score: classification.score,
      suggestedCategory: classification.suggestedCategory,
    };
    current.urls += 1;
    current.visits += entry.visitCount ?? 0;
    current.score = Math.max(current.score, classification.score);
    domainMap.set(key, current);
    bucket.urls += 1;
    bucket.visits += entry.visitCount ?? 0;
  }

  for (const [category, bucket] of buckets) {
    bucket.domains = [...domainMaps.get(category)!.values()]
      .sort((a, b) => b.urls - a.urls || a.domain.localeCompare(b.domain));
  }
  return [...CATEGORY_PRESETS.map((preset) => buckets.get(preset.id)!), buckets.get(undefined)!];
}

function parseUrl(input: string): URL | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return undefined;
  }
}

function findOverride(hostname: string, overrides: CategoryOverrides): CategoryId | undefined {
  return Object.entries(overrides)
    .sort(([a], [b]) => b.length - a.length)
    .find(([domain]) => hostname === domain || hostname.endsWith(`.${domain}`))?.[1];
}

function scoreSignals(hostname: string, urlText: string, title: string, signals: ClassificationSignals): number {
  const hostHits = countMatches(hostname, signals.hostKeywords, true);
  const urlHits = countMatches(urlText, signals.urlKeywords);
  const titleHits = countMatches(title, signals.titleKeywords);
  return Math.min(80, hostHits * 60) + Math.min(50, urlHits * 25) + Math.min(60, titleHits * 20);
}

function countMatches(input: string, keywords: readonly string[], allowCompactMatch = false): number {
  const normalized = normalizeText(input);
  const tokens = new Set(normalized.split(" ").filter(Boolean));
  const compact = normalized.replaceAll(" ", "");
  return keywords.filter((keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) return false;
    if (normalizedKeyword.includes(" ")) return ` ${normalized} `.includes(` ${normalizedKeyword} `);
    if (tokens.has(normalizedKeyword)) return true;
    return allowCompactMatch && normalizedKeyword.length >= 5 && compact.includes(normalizedKeyword.replaceAll(" ", ""));
  }).length;
}

function normalizeText(input: string): string {
  return input.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9+]+/g, " ").trim();
}
