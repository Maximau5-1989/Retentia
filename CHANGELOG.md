# Changelog

## 1.4.2 — 2026-08-07

- Added one disabled default rule for every built-in category in Rules while preserving existing user rules.

## 1.4.1 — 2026-08-07

- Removed unnecessary module preload hints that Chrome reported as cross-world extension resource mismatches.

## 1.4.0 — 2026-08-07

- Added protected websites, independent category controls, rule conflict detection, and privacy-safe backup and restore.

## 1.3.0 — 2026-08-06

- Added ready-to-use default category rules, confirmed immediate cleanup of expired categorized history, and local per-domain category overrides.

## 1.2.0 — 2026-08-06

- Added a privacy-safe full-history category scanner with aggregate category and visit counts.

## 1.1.0 — 2026-08-06

- Added local opt-in category presets for social media, webshops, news, streaming, search engines, travel, and entertainment and gaming.

## 1.0.9 — 2026-08-06

- Added automated GitHub Actions quality checks for every push and pull request.

## 1.0.8 — 2026-08-06

- Added automated semantic versioning and release preparation.

## 1.0.7 — 2026-08-06

- Fixed the light-mode contrast of the onboarding headline and **Got it** button.
- Replaced per-URL deletion activity with aggregate removal counts.
- Stopped persisting simulator and scan candidate URLs in the last-scan summary.
- Added automatic cleanup of URL details stored by older Retentia versions.
- Removed the domain-based **Most cleaned** overview in favor of a privacy-safe total.

## 1.0.6 — 2026-08-06

- Moved password authentication from the Rules view to the complete Retentia interface.
- Added a Chrome session-based unlock shared by the pinned popup and dashboard.
- Added immediate session locking when the registered Retentia dashboard tab closes.
- Removed the additional password prompt and five-minute lock from Rules.
- Fixed **Private by design** contrast in dark mode.

## 1.0.5 — 2026-08-06

- Fixed unreadable warning and rule-lock panels in light mode by coupling dark styles exclusively to Retentia's selected theme.
- Replaced the hard-coded sidebar version with the active Chrome manifest version.
- Simplified the rules overview to show only each rule name, enabled state, and management actions.

## 1.0.4 — 2026-08-06

- Added a **Create Retentia rule** context-menu action for links on Chrome's history page.
- Added a secure handoff from Chrome History to the password-protected rule editor.
- Added automatic exact-URL prefilling while preserving user confirmation of the retention period and save action.

## 1.0.3 — 2026-08-06

- Added an optional immediate history cleanup when creating a retention rule.
- Added the option to both the dashboard rule form and quick-rule popup.
- Added an explicit irreversible-action confirmation before existing matching URLs are removed.
- Added individual local activity entries for URLs removed during rule creation.

## 1.0.2 — 2026-08-06

- Added a five-minute maximum rule-management unlock session.
- Added immediate relocking when the dashboard closes or reloads.
- Prevented rule data from loading into the dashboard before authentication.
- Added progressive delays after five incorrect password attempts.
- Added authenticated password changes.
- Added a forgotten-password reset that removes protected Retentia data but never browser history.
- Added clear in-product communication about the password lock's local security boundaries.

## 1.0.1 — 2026-08-06

- Added exact URL, domain, wildcard, and regex retention rules.
- Added priority handling for overlapping rules.
- Added scheduled local history cleanup.
- Added dry-run simulator and explicit manual-cleanup confirmation.
- Added popup quick rules, dashboard, onboarding, statistics, activity log, and settings.
- Added Chrome Manifest V3 packaging and privacy documentation.
- Added persistent light and dark themes with a top-right theme switcher.
- Added first-run password creation and password-protected rule management.
- Added PBKDF2-SHA-256 password hashing with a unique local salt.
