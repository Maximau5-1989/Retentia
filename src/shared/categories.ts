import type { CategoryId, TimeUnit } from "./types";

export interface CategoryPreset {
  id: CategoryId;
  label: string;
  description: string;
  duration: number;
  unit: TimeUnit;
  domains: readonly string[];
}

export const CATEGORY_PRESETS: readonly CategoryPreset[] = [
  {
    id: "social",
    label: "Social media",
    description: "Social networks, communities, and public profiles.",
    duration: 7,
    unit: "days",
    domains: ["facebook.com", "instagram.com", "linkedin.com", "reddit.com", "tiktok.com", "x.com"],
  },
  {
    id: "shopping",
    label: "Webshops",
    description: "Product browsing and online marketplaces.",
    duration: 14,
    unit: "days",
    domains: ["aliexpress.com", "amazon.com", "amazon.nl", "bol.com", "coolblue.nl", "ebay.com", "temu.com"],
  },
  {
    id: "news",
    label: "News",
    description: "News articles and current-affairs websites.",
    duration: 30,
    unit: "days",
    domains: ["bbc.com", "cnn.com", "nos.nl", "nrc.nl", "nu.nl", "telegraaf.nl", "volkskrant.nl"],
  },
  {
    id: "streaming",
    label: "Streaming",
    description: "Video, music, podcast, and livestream platforms.",
    duration: 30,
    unit: "days",
    domains: ["disneyplus.com", "netflix.com", "primevideo.com", "spotify.com", "twitch.tv", "youtube.com"],
  },
  {
    id: "search",
    label: "Search engines",
    description: "Search result pages that can contain sensitive queries.",
    duration: 1,
    unit: "days",
    domains: ["bing.com", "duckduckgo.com", "ecosia.org", "google.com", "google.nl", "search.brave.com"],
  },
  {
    id: "travel",
    label: "Travel",
    description: "Transport, accommodation, and trip comparison websites.",
    duration: 30,
    unit: "days",
    domains: ["9292.nl", "airbnb.com", "booking.com", "ns.nl", "skyscanner.com", "tripadvisor.com"],
  },
  {
    id: "entertainment",
    label: "Entertainment & gaming",
    description: "Games, entertainment databases, guides, and fan communities.",
    duration: 30,
    unit: "days",
    domains: ["fandom.com", "ign.com", "imdb.com", "playstation.com", "steamcommunity.com", "steampowered.com", "xbox.com"],
  },
] as const;

export function getCategoryPreset(id?: CategoryId): CategoryPreset | undefined {
  return CATEGORY_PRESETS.find((preset) => preset.id === id);
}

export function normalizeHostname(input: string): string | undefined {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export function suggestCategory(input: string): CategoryPreset | undefined {
  const hostname = normalizeHostname(input);
  if (!hostname) return undefined;
  return CATEGORY_PRESETS.find((preset) => preset.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)));
}
