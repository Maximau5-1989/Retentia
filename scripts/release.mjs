import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packagePath = resolve(root, "package.json");
const manifestPaths = {
  chrome: resolve(root, "manifests", "chrome.json"),
  firefox: resolve(root, "manifests", "firefox.json"),
};
const changelogPath = resolve(root, "CHANGELOG.md");
const releaseDirectory = resolve(root, "release");
const allowedBumps = new Set(["patch", "minor", "major"]);

const args = process.argv.slice(2);
const bump = args.find((argument) => allowedBumps.has(argument));
const dryRun = args.includes("--dry-run");
const noCommit = args.includes("--no-commit");
const notesIndex = args.indexOf("--notes");
const notes = notesIndex >= 0 ? args[notesIndex + 1]?.trim() : "";

if (!bump) {
  fail("Choose a version increment: patch, minor, or major.");
}

if (notesIndex >= 0 && !notes) {
  fail("--notes must be followed by a changelog description.");
}

const packageJson = readJson(packagePath);
const manifests = Object.fromEntries(
  Object.entries(manifestPaths).map(([browser, path]) => [browser, readJson(path)]),
);

for (const [browser, manifest] of Object.entries(manifests)) {
  if (packageJson.version !== manifest.version) {
    fail(`Version mismatch: package.json is ${packageJson.version}, ${browser}.json is ${manifest.version}.`);
  }
}

const nextVersion = incrementVersion(packageJson.version, bump);
const archivePaths = {
  chrome: resolve(releaseDirectory, `retentia-chrome-v${nextVersion}.zip`),
  firefox: resolve(releaseDirectory, `retentia-firefox-v${nextVersion}.zip`),
  firefoxSources: resolve(releaseDirectory, `retentia-firefox-v${nextVersion}-sources.zip`),
};
const releaseNotes = notes || "Prepared the next Retentia release.";

if (dryRun) {
  console.log(`Dry run: ${packageJson.version} -> ${nextVersion}`);
  console.log(`Chrome archive: ${archivePaths.chrome}`);
  console.log(`Firefox archive: ${archivePaths.firefox}`);
  console.log(`Firefox source archive: ${archivePaths.firefoxSources}`);
  console.log(`Git tag: v${nextVersion}`);
  console.log("No files were changed.");
  process.exit(0);
}

if (!notes) {
  fail('Provide release notes, for example: --notes "Added automated version management."');
}

for (const archivePath of Object.values(archivePaths)) {
  if (existsSync(archivePath)) {
    fail(`Release archive already exists: ${archivePath}`);
  }
}

if (!noCommit) {
  run("git", ["rev-parse", "--is-inside-work-tree"]);
  const existingTag = run("git", ["tag", "--list", `v${nextVersion}`], { capture: true });
  if (existingTag) {
    fail(`Git tag v${nextVersion} already exists.`);
  }
}

const originals = new Map([
  [packagePath, readFileSync(packagePath, "utf8")],
  ...Object.values(manifestPaths).map((path) => [path, readFileSync(path, "utf8")]),
  [changelogPath, readFileSync(changelogPath, "utf8")],
]);

try {
  packageJson.version = nextVersion;
  writeJson(packagePath, packageJson);
  for (const [browser, manifest] of Object.entries(manifests)) {
    manifest.version = nextVersion;
    writeJson(manifestPaths[browser], manifest);
  }

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const changelog = originals.get(changelogPath);
  const headingEnd = changelog.indexOf("\n", changelog.indexOf("# Changelog"));
  const entry = `\n## ${nextVersion} — ${date}\n\n- ${releaseNotes}\n`;
  writeFileSync(changelogPath, `${changelog.slice(0, headingEnd + 1)}${entry}${changelog.slice(headingEnd + 1)}`, "utf8");

  runPackageScript("check");
  mkdirSync(releaseDirectory, { recursive: true });
  createArchive(archivePaths.chrome, "dist/chrome");
  createArchive(archivePaths.firefox, "dist/firefox");
  createSourceArchive(archivePaths.firefoxSources);

  if (!noCommit) {
    run("git", ["add", "-A"]);
    run("git", ["commit", "-m", `Release Retentia v${nextVersion}`]);
    run("git", ["tag", "-a", `v${nextVersion}`, "-m", `Retentia v${nextVersion}`]);
  }

  console.log(`Retentia v${nextVersion} is ready.`);
  console.log(`Chrome archive: ${archivePaths.chrome}`);
  console.log(`Firefox archive: ${archivePaths.firefox}`);
  console.log(`Firefox source archive: ${archivePaths.firefoxSources}`);
  console.log(noCommit ? "Git commit and tag were skipped." : `Created commit and tag v${nextVersion}.`);
} catch (error) {
  for (const [path, contents] of originals) {
    writeFileSync(path, contents, "utf8");
  }
  for (const archivePath of Object.values(archivePaths)) {
    if (existsSync(archivePath)) rmSync(archivePath, { force: true });
  }
  fail(`Release preparation failed and version files were restored.\n${error.message}`);
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

function createArchive(destination, sourceDirectory) {
  if (process.platform !== "win32") {
    fail("ZIP creation currently requires Windows PowerShell.");
  }
  const escapedSource = resolve(root, sourceDirectory, "*").replaceAll("'", "''");
  const escapedDestination = destination.replaceAll("'", "''");
  const command = `Compress-Archive -Path '${escapedSource}' -DestinationPath '${escapedDestination}' -CompressionLevel Optimal`;
  run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command]);
}

function createSourceArchive(destination) {
  if (process.platform !== "win32") {
    fail("ZIP creation currently requires Windows PowerShell.");
  }
  const sourceEntries = [
    ".github",
    "assets",
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
  const escapedSources = sourceEntries
    .map((entry) => `'${resolve(root, entry).replaceAll("'", "''")}'`)
    .join(",");
  const escapedDestination = destination.replaceAll("'", "''");
  const command = `Compress-Archive -Path ${escapedSources} -DestinationPath '${escapedDestination}' -CompressionLevel Optimal`;
  run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command]);
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
