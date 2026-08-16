import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const releaseDirectory = resolve(root, "release");
const allowedTargets = new Set(["chrome", "firefox"]);
const allowedBumps = new Set(["patch", "minor", "major"]);
const targetConfig = {
  chrome: {
    manifestPath: resolve(root, "manifests", "chrome.json"),
    changelogPath: resolve(root, "changelogs", "chrome.md"),
  },
  firefox: {
    manifestPath: resolve(root, "manifests", "firefox.json"),
    changelogPath: resolve(root, "changelogs", "firefox.md"),
  },
};

const args = process.argv.slice(2);
const target = args[0];
const bump = args[1];
const dryRun = args.includes("--dry-run");
const noCommit = args.includes("--no-commit");
const notesIndex = args.indexOf("--notes");
const notes = notesIndex >= 0 ? args[notesIndex + 1]?.trim() : "";

if (!allowedTargets.has(target) || !allowedBumps.has(bump)) {
  fail("Choose a browser and version increment: chrome|firefox patch|minor|major.");
}

if (notesIndex >= 0 && !notes) {
  fail("--notes must be followed by a changelog description.");
}

const config = targetConfig[target];
const manifest = readJson(config.manifestPath);
const currentVersion = manifest.version;
const nextVersion = incrementVersion(currentVersion, bump);
const browserArchivePath = resolve(releaseDirectory, `retentia-${target}-v${nextVersion}.zip`);
const sourceArchivePath = target === "firefox"
  ? resolve(releaseDirectory, `retentia-firefox-v${nextVersion}-sources.zip`)
  : undefined;
const archivePaths = [browserArchivePath, sourceArchivePath].filter(Boolean);
const releaseNotes = notes || `Prepared the next ${targetLabel(target)} release.`;
const tagName = `retentia-${target}-v${nextVersion}`;

if (dryRun) {
  console.log(`Dry run (${target}): ${currentVersion} -> ${nextVersion}`);
  console.log(`${targetLabel(target)} archive: ${browserArchivePath}`);
  if (sourceArchivePath) console.log(`Firefox source archive: ${sourceArchivePath}`);
  console.log(`Git tag: ${tagName}`);
  console.log("No files were changed.");
  process.exit(0);
}

if (!notes) {
  fail('Provide release notes, for example: --notes "Describe the completed change."');
}

for (const archivePath of archivePaths) {
  if (existsSync(archivePath)) {
    fail(`Release archive already exists: ${archivePath}`);
  }
}

if (!noCommit) {
  run("git", ["rev-parse", "--is-inside-work-tree"]);
  const existingTag = run("git", ["tag", "--list", tagName], { capture: true });
  if (existingTag) {
    fail(`Git tag ${tagName} already exists.`);
  }
}

const originals = new Map([
  [config.manifestPath, readFileSync(config.manifestPath, "utf8")],
  [config.changelogPath, readFileSync(config.changelogPath, "utf8")],
]);

try {
  manifest.version = nextVersion;
  writeJson(config.manifestPath, manifest);

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const changelog = originals.get(config.changelogPath);
  const headingEnd = changelog.indexOf("\n");
  if (headingEnd < 0) fail(`Invalid changelog: ${config.changelogPath}`);
  const entry = `\n## ${nextVersion} — ${date}\n\n- ${releaseNotes}\n`;
  writeFileSync(config.changelogPath, `${changelog.slice(0, headingEnd + 1)}${entry}${changelog.slice(headingEnd + 1)}`, "utf8");

  runPackageScript("check");
  mkdirSync(releaseDirectory, { recursive: true });
  createArchive(browserArchivePath, `dist/${target}`);
  if (sourceArchivePath) createSourceArchive(sourceArchivePath);

  if (!noCommit) {
    run("git", ["add", "-A"]);
    run("git", ["commit", "-m", `Release Retentia ${targetLabel(target)} v${nextVersion}`]);
    run("git", ["tag", "-a", tagName, "-m", `Retentia ${targetLabel(target)} v${nextVersion}`]);
  }

  console.log(`Retentia ${targetLabel(target)} v${nextVersion} is ready.`);
  console.log(`${targetLabel(target)} archive: ${browserArchivePath}`);
  if (sourceArchivePath) console.log(`Firefox source archive: ${sourceArchivePath}`);
  console.log(noCommit ? "Git commit and tag were skipped." : `Created commit and tag ${tagName}.`);
} catch (error) {
  for (const [path, contents] of originals) {
    writeFileSync(path, contents, "utf8");
  }
  for (const archivePath of archivePaths) {
    if (existsSync(archivePath)) rmSync(archivePath, { force: true });
  }
  fail(`Release preparation failed and ${target} version files were restored.\n${error.message}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function incrementVersion(version, type) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) fail(`Unsupported semantic version: ${version}`);
  let [, major, minor, patch] = match.map(Number);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function targetLabel(targetName) {
  return targetName === "firefox" ? "Firefox" : "Chrome";
}

function createArchive(destination, sourceDirectory) {
  const sourcePath = resolve(root, sourceDirectory);
  createZipArchive(destination, sourcePath, readdirSync(sourcePath));
}

function createSourceArchive(destination) {
  const sourceEntries = [
    ".github",
    "assets",
    "changelogs",
    "docs",
    "manifests",
    "public",
    "scripts",
    "src",
    "AGENTS.md",
    "CHANGELOG.md",
    "dashboard.html",
    "FIREFOX_SUBMISSION.md",
    "LICENSE",
    "package.json",
    "pnpm-lock.yaml",
    "popup.html",
    "PRIVACY.md",
    "README.md",
    "THIRD_PARTY_DATA.md",
    "tsconfig.json",
    "vite.config.ts",
  ];
  createZipArchive(destination, root, sourceEntries);
}

function createZipArchive(destination, baseDirectory, entries) {
  // Windows Compress-Archive writes backslashes into ZIP entry names. AMO
  // rejects those archives, while bsdtar creates portable forward-slash paths.
  run("tar.exe", ["-a", "-c", "-f", destination, "-C", baseDirectory, ...entries]);
}

function run(command, commandArgs, options = {}) {
  const result = execFileSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  return typeof result === "string" ? result.trim() : "";
}

function runPackageScript(script) {
  if (!process.env.npm_execpath) {
    fail("Start this release command through pnpm.");
  }
  run(process.execPath, [process.env.npm_execpath, "run", script]);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
