import { spawn } from "node:child_process";
import { createReadStream, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

const CATEGORY_IDS = ["social", "shopping", "news", "streaming", "search", "travel", "entertainment", "adult"];
const MAX_PER_CATEGORY = 50_000;
const args = readArgs(process.argv.slice(2));
const root = resolve(import.meta.dirname, "..");
const outputPath = resolve(args.output ?? resolve(root, "src", "shared", "generated", "category-domains.json"));
const resolutionsPath = resolve(root, "scripts", "category-model-resolutions.json");

for (const required of ["ut1", "curlie", "crux"]) {
  if (!args[required]) fail(`Missing --${required} <path>.`);
}

const candidates = new Map();
const matches = new Map(CATEGORY_IDS.map((category) => [category, new Map()]));

await loadUt1Adult(resolve(args.ut1), candidates);
await loadCurlie(resolve(args.curlie), candidates);
console.log(`Loaded ${candidates.size} categorized source domains.`);
const popularityOriginCount = await filterCandidatesByCrux(resolve(args.crux), candidates, matches);

const domains = Object.fromEntries(CATEGORY_IDS.map((category) => {
  const selected = [...matches.get(category)]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_PER_CATEGORY)
    .map(([domain]) => domain);
  return [category, selected];
}));
const modelConflictResolutions = applyModelConflictResolutions(domains, resolutionsPath);

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  maxDomainsPerCategory: MAX_PER_CATEGORY,
  popularityScope: `Google CrUX popular origins (${popularityOriginCount} origin rows checked)`,
  sources: [
    {
      name: "UT1 Blacklists",
      url: "https://dsi.ut-capitole.fr/blacklists/",
      license: "CC BY-SA 4.0",
      use: "18+ domain categorization",
    },
    {
      name: "Curlie Directory",
      url: "https://curlie.org/",
      license: "CC BY 3.0",
      use: "General website categorization",
    },
    {
      name: "Google Chrome UX Report",
      url: "https://developer.chrome.com/docs/crux/",
      license: "CC BY 4.0",
      use: "Popularity filtering",
    },
    {
      name: "CrUX Cache",
      url: "https://github.com/lonetis/crux-cache",
      license: "MIT",
      use: "Distribution mirror for the Google CrUX dataset",
    },
  ],
  domains,
  ...(modelConflictResolutions ? { modelConflictResolutions } : {}),
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

for (const category of CATEGORY_IDS) {
  console.log(`${category}: ${domains[category].length} domains (${matches.get(category).size} candidates)`);
}
console.log(`Wrote ${outputPath}`);

async function filterCandidatesByCrux(path, candidates, matches) {
  let originCount = 0;
  const files = statSync(path).isDirectory()
    ? readdirSync(path).filter((name) => name.endsWith(".csv")).sort(compareChunkNames).map((name) => resolve(path, name))
    : [path];

  for (const file of files) {
    const input = file.endsWith(".gz") ? createReadStream(file).pipe(createGunzip()) : createReadStream(file);
    const lines = createInterface({ input, crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line || line.startsWith("origin,")) continue;
      const separator = line.lastIndexOf(",");
      if (separator < 0) continue;
      const domain = normalizeDomain(line.slice(0, separator));
      const rank = Number(line.slice(separator + 1));
      if (!domain || !Number.isFinite(rank)) continue;
      originCount += 1;
      const categoryMask = candidates.get(domain);
      if (categoryMask === undefined) continue;
      for (let index = 0; index < CATEGORY_IDS.length; index += 1) {
        if ((categoryMask & (1 << index)) !== 0) addMatch(matches.get(CATEGORY_IDS[index]), domain, rank);
      }
    }
  }
  console.log(`Checked ${originCount} CrUX origin rows.`);
  return originCount;
}

function compareChunkNames(a, b) {
  const aChunk = Number(a.match(/_(\d+)\.csv$/)?.[1] ?? 0);
  const bChunk = Number(b.match(/_(\d+)\.csv$/)?.[1] ?? 0);
  return aChunk - bChunk || a.localeCompare(b);
}

async function loadUt1Adult(archive, candidates) {
  await readTarMemberLines(archive, "adult/domains", (line) => {
    const domain = normalizeDomain(line);
    if (domain) addCandidate(candidates, domain, "adult");
  });
}

async function loadCurlie(archive, candidates) {
  const members = await listTarMembers(archive);
  const categoryIds = new Map();

  const readableMembers = members.filter((name) => /^[\x00-\x7F]+$/.test(name));

  for (const member of readableMembers.filter((name) => name.endsWith("-s.tsv"))) {
    await readTarMemberLines(archive, member, (line) => {
      const firstTab = line.indexOf("\t");
      if (firstTab < 0) return;
      const secondTab = line.indexOf("\t", firstTab + 1);
      if (secondTab < 0) return;
      const id = line.slice(0, firstTab);
      const path = line.slice(firstTab + 1, secondTab);
      const categories = classifyCurliePath(path);
      if (categories.length) categoryIds.set(id, categories);
    });
  }

  console.log(`Loaded ${categoryIds.size} relevant Curlie categories.`);

  for (const member of readableMembers.filter((name) => name.endsWith("-c.tsv"))) {
    await readTarMemberLines(archive, member, (line) => {
      const firstTab = line.indexOf("\t");
      const lastTab = line.lastIndexOf("\t");
      if (firstTab < 0 || lastTab <= firstTab) return;
      const categories = categoryIds.get(line.slice(lastTab + 1).trim());
      if (!categories) return;
      const domain = normalizeCurlieHomepage(line.slice(0, firstTab));
      if (!domain) return;
      for (const category of categories) addCandidate(candidates, domain, category);
    });
  }
}

function classifyCurliePath(path) {
  const normalized = path.replaceAll(" ", "_");
  const categories = [];
  if (/(^|\/)Adult(\/|$)/i.test(normalized)) categories.push("adult");
  if (/(^|\/)(Social_Networking|Social_Networks|Online_Communities)(\/|$)/i.test(normalized)) categories.push("social");
  if (/^Shopping(\/|$)/i.test(normalized) || /(^|\/)(Online_Shopping|Auctions)(\/|$)/i.test(normalized)) categories.push("shopping");
  if (/(^|\/)(News|News_and_Media|Newspapers)(\/|$)/i.test(normalized)) categories.push("news");
  if (/(^|\/)(Streaming_Media|Internet_Radio|Web_Radio|Video_Sharing|Online_Video|Podcasts)(\/|$)/i.test(normalized)) categories.push("streaming");
  if (/(^|\/)(Search_Engines|Searching)(\/|$)/i.test(normalized)) categories.push("search");
  if (/(^|\/)(Travel|Travel_and_Tourism|Tourism|Hotels_and_Motels)(\/|$)/i.test(normalized)) categories.push("travel");
  if (/^Games(\/|$)/i.test(normalized) || /(^|\/)(Video_Games|Movies|Television|Comics|Entertainment)(\/|$)/i.test(normalized)) categories.push("entertainment");
  return [...new Set(categories)];
}

function addMatch(target, domain, rank) {
  const current = target.get(domain);
  if (current === undefined || rank < current) target.set(domain, rank);
}

function applyModelConflictResolutions(domains, path) {
  const resolutionData = JSON.parse(readFileSync(path, "utf8"));
  for (const resolution of resolutionData.resolutions ?? []) {
    if (!CATEGORY_IDS.includes(resolution.category)) fail(`Unknown resolution category: ${resolution.category}`);
    const matches = CATEGORY_IDS.filter((category) => domains[category].includes(resolution.domain));
    if (!matches.length) continue;
    if (!matches.includes(resolution.category)) fail(`Resolution target is not a source category for ${resolution.domain}`);
    for (const category of matches) {
      if (category !== resolution.category) {
        domains[category] = domains[category].filter((domain) => domain !== resolution.domain);
      }
    }
  }
  return {
    generatedAt: resolutionData.generatedAt,
    method: resolutionData.method,
    resolvedDomains: resolutionData.resolutions?.length ?? 0,
  };
}

function addCandidate(target, domain, category) {
  const categoryIndex = CATEGORY_IDS.indexOf(category);
  if (categoryIndex < 0) return;
  target.set(domain, (target.get(domain) ?? 0) | (1 << categoryIndex));
}

function normalizeDomain(input) {
  const value = input.trim().toLowerCase();
  if (!value || value.startsWith("#")) return undefined;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    const hostname = url.hostname.replace(/^www\d*\./, "").replace(/\.$/, "");
    if (!hostname || hostname.includes(":")) return undefined;
    return hostname;
  } catch {
    return undefined;
  }
}

function normalizeCurlieHomepage(input) {
  try {
    const url = new URL(input.trim());
    if (url.pathname !== "/" || url.search || url.hash) return undefined;
    return normalizeDomain(url.hostname);
  } catch {
    return undefined;
  }
}

async function listTarMembers(archive) {
  let output = "";
  await runTar(["-tzf", archive], (chunk) => { output += chunk; });
  return output.split(/\r?\n/).filter(Boolean);
}

async function readTarMemberLines(archive, member, handleLine) {
  const child = spawn("tar", ["-xOzf", archive, member], { stdio: ["ignore", "pipe", "pipe"] });
  let errorOutput = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { errorOutput += chunk; });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of lines) handleLine(line);
  const exitCode = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", resolveExit);
  });
  if (exitCode !== 0) fail(`Could not read ${member}: ${errorOutput.trim()}`);
}

async function runTar(tarArgs, onStdout) {
  const child = spawn("tar", tarArgs, { stdio: ["ignore", "pipe", "pipe"] });
  let errorOutput = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", onStdout);
  child.stderr.on("data", (chunk) => { errorOutput += chunk; });
  const exitCode = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", resolveExit);
  });
  if (exitCode !== 0) fail(errorOutput.trim() || "tar failed.");
}

function readArgs(input) {
  const result = {};
  for (let index = 0; index < input.length; index += 2) {
    const key = input[index]?.replace(/^--/, "");
    const value = input[index + 1];
    if (!key || !value) fail("Arguments must use --name <value> pairs.");
    result[key] = value;
  }
  return result;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
