import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packagePath = resolve(root, "package.json");
const manifestPath = resolve(root, "public", "manifest.json");
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
const manifest = readJson(manifestPath);

if (packageJson.version !== manifest.version) {
  fail(`Version mismatch: package.json is ${packageJson.version}, manifest.json is ${manifest.version}.`);
}

const nextVersion = incrementVersion(packageJson.version, bump);
const archivePath = resolve(releaseDirectory, `retentia-v${nextVersion}.zip`);
const releaseNotes = notes || "Prepared the next Retentia release.";

if (dryRun) {
  console.log(`Dry run: ${packageJson.version} -> ${nextVersion}`);
  console.log(`Archive: ${archivePath}`);
  console.log(`Git tag: v${nextVersion}`);
  console.log("No files were changed.");
  process.exit(0);
}

if (!notes) {
  fail('Provide release notes, for example: --notes "Added automated version management."');
}

if (existsSync(archivePath)) {
  fail(`Release archive already exists: ${archivePath}`);
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
  [manifestPath, readFileSync(manifestPath, "utf8")],
  [changelogPath, readFileSync(changelogPath, "utf8")],
]);

try {
  packageJson.version = nextVersion;
  manifest.version = nextVersion;
  writeJson(packagePath, packageJson);
  writeJson(manifestPath, manifest);

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
  createArchive(archivePath);

  if (!noCommit) {
    run("git", ["add", "-A"]);
    run("git", ["commit", "-m", `Release Retentia v${nextVersion}`]);
    run("git", ["tag", "-a", `v${nextVersion}`, "-m", `Retentia v${nextVersion}`]);
  }

  console.log(`Retentia v${nextVersion} is ready.`);
  console.log(`Archive: ${archivePath}`);
  console.log(noCommit ? "Git commit and tag were skipped." : `Created commit and tag v${nextVersion}.`);
} catch (error) {
  for (const [path, contents] of originals) {
    writeFileSync(path, contents, "utf8");
  }
  if (existsSync(archivePath)) {
    rmSync(archivePath, { force: true });
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

function createArchive(destination) {
  if (process.platform !== "win32") {
    fail("ZIP creation currently requires Windows PowerShell.");
  }
  const escapedDestination = destination.replaceAll("'", "''");
  const command = `Compress-Archive -Path 'dist\\*' -DestinationPath '${escapedDestination}' -CompressionLevel Optimal`;
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
