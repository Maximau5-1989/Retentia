# Chrome changelog

## 2.3.0 - 2026-08-16

- Applied the one-time local neural-network audit to resolve 18 high-confidence conflicts in Chrome's offline category database. Remaining uncertain source conflicts stay unresolved so they cannot trigger automatic category rules.

## 2.2.0 — 2026-08-16

- Added browser-specific packaging while preserving Retentia's existing Chrome behavior and history-page context menu. Chrome and Firefox packages now use independently validated manifests and build outputs.

## 2.1.0 — 2026-08-15

- Replaced Retentia's technical browser confirmation prompts with consistent light- and dark-mode dialogs for cleanup, rule deletion, category activation, backup restore, protection changes, log clearing, and security reset actions. Destructive dialogs now explain their exact scope, show relevant counts where available, focus Cancel by default, and support keyboard navigation and screen readers.

## 2.0.0 — 2026-08-15

- Refined the dashboard and popup with clearer navigation, responsive layouts, searchable and collapsible category results, collapsible rule forms, richer protection status, improved settings spacing, palette-aligned review panels, consistent notifications, and improved keyboard and screen-reader accessibility. New rules now focus on complete domains and specific URLs, while existing wildcard and regular-expression rules remain supported as legacy advanced rules. Hardened rule input normalization, settings bounds, concurrent activity writes, password error handling, scan-limit disclosure, popup session locking, and single-tab navigation. Removed the temporary password-bypass testing mode. Added a privacy-safe local crash log, user-initiated diagnostic reports, direct GitHub bug reporting, one-time update notes, a permanent in-app changelog, and a direct What's new link beside the version. A fresh installation opens Overview once, while updates and later Chrome startups do not.

## 1.9.1 — 2026-08-15

- Added persistent local user classifications for every scanned domain, including a safe uncategorized override for false positives and expanded possible-match review controls.

## 1.9.0 — 2026-08-15

- Added a privacy-preserving offline popular-domain database for every category, including 46,021 18+ domains, with conflict-safe classification and documented attribution.

## 1.8.0 — 2026-08-15

- Expanded category coverage and made local classification stricter for ambiguous or single-source signals.

## 1.7.1 — 2026-08-08

- Fixed the public privacy policy URL and documentation links.
