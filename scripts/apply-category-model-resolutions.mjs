import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const databasePath = resolve(root, "src", "shared", "generated", "category-domains.json");
const resolutionsPath = resolve(root, "scripts", "category-model-resolutions.json");

const database = JSON.parse(readFileSync(databasePath, "utf8"));
const resolutionData = JSON.parse(readFileSync(resolutionsPath, "utf8"));
const categories = Object.keys(database.domains);

for (const resolution of resolutionData.resolutions) {
  if (!categories.includes(resolution.category)) {
    throw new Error(`Unknown target category for ${resolution.domain}: ${resolution.category}`);
  }
  const matchingCategories = categories.filter((category) => database.domains[category].includes(resolution.domain));
  if (matchingCategories.length === 1 && matchingCategories[0] === resolution.category) {
    continue;
  }
  if (!matchingCategories.includes(resolution.category)) {
    throw new Error(`Resolution target is not a source category for ${resolution.domain}`);
  }
  if (matchingCategories.length < 2) {
    throw new Error(`Resolution is no longer needed for ${resolution.domain}`);
  }
  for (const category of matchingCategories) {
    if (category !== resolution.category) {
      database.domains[category] = database.domains[category].filter((domain) => domain !== resolution.domain);
    }
  }
}

database.modelConflictResolutions = {
  generatedAt: resolutionData.generatedAt,
  method: resolutionData.method,
  resolvedDomains: resolutionData.resolutions.length,
};

writeFileSync(databasePath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
console.log(`Applied ${resolutionData.resolutions.length} local model conflict resolutions.`);
