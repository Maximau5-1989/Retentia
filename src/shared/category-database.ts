import categoryData from "./generated/category-domains.json";
import type { CategoryId } from "./types";

interface CategoryDatabaseFile {
  schemaVersion: number;
  generatedAt: string;
  maxDomainsPerCategory: number;
  popularityScope: string;
  sources: Array<{ name: string; url: string; license: string; use: string }>;
  domains: Record<CategoryId, string[]>;
}

const database = categoryData as CategoryDatabaseFile;
const categoryDomainSets = new Map<CategoryId, ReadonlySet<string>>(
  Object.entries(database.domains).map(([category, domains]) => [category as CategoryId, new Set(domains)]),
);

export const CATEGORY_DATABASE_METADATA = {
  generatedAt: database.generatedAt,
  maxDomainsPerCategory: database.maxDomainsPerCategory,
  popularityScope: database.popularityScope,
  sources: database.sources,
  counts: Object.fromEntries(Object.entries(database.domains).map(([category, domains]) => [category, domains.length])) as Record<CategoryId, number>,
} as const;

export function findDatabaseCategories(hostname: string): CategoryId[] {
  const normalized = hostname.trim().toLowerCase().replace(/^www\d*\./, "").replace(/\.$/, "");
  if (!normalized) return [];
  const labels = normalized.split(".").filter(Boolean);
  if (labels.length < 2) return [];

  const matches = new Set<CategoryId>();
  for (let start = 0; start <= labels.length - 2; start += 1) {
    const candidate = labels.slice(start).join(".");
    for (const [category, domains] of categoryDomainSets) {
      if (domains.has(candidate)) matches.add(category);
    }
  }
  return [...matches];
}
