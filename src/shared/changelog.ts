export interface ReleaseNotes {
  version: string;
  date: string;
  title: string;
  changes: readonly string[];
}

export const RELEASE_NOTES: readonly ReleaseNotes[] = [
  {
    version: "2.0.0",
    date: "2026-08-15",
    title: "A clearer, safer Retentia",
    changes: [
      "Refined the dashboard and popup with clearer navigation, responsive layouts, and single-tab behavior.",
      "Expanded local category classification with an offline popular-domain database, review panels, and user-controlled corrections.",
      "Simplified new rules to complete domains and specific URLs while preserving existing wildcard and regular-expression rules.",
      "Improved the simulator, protected websites, backups, privacy-safe reporting, and scan-limit guidance.",
      "Hardened rule validation, settings bounds, password handling, activity writes, and dashboard session locking.",
      "Added one-time update notes, a permanent in-app changelog, and a direct What's new link beside the version.",
    ],
  },
  { version: "1.9.1", date: "2026-08-15", title: "User-controlled classifications", changes: ["Added persistent local classifications for every scanned domain, including an uncategorized override for false positives."] },
  { version: "1.9.0", date: "2026-08-15", title: "Offline category database", changes: ["Bundled a privacy-preserving popular-domain database for every category, including 46,021 18+ domains."] },
  { version: "1.8.0", date: "2026-08-15", title: "Stricter classification", changes: ["Expanded category coverage and reduced ambiguous or single-source automatic matches."] },
  { version: "1.7.1", date: "2026-08-08", title: "Privacy policy availability", changes: ["Corrected the public privacy policy URL and documentation links."] },
];

export function getReleaseNotes(version: string | null | undefined): ReleaseNotes | undefined {
  return RELEASE_NOTES.find((release) => release.version === version);
}
