# Firefox changelog

## 2.2.1 — 2026-08-16

- Made the local history classifier handle Firefox history items whose title is `null`, added a Firefox-specific scan safety limit, and made scan failures visible instead of leaving the page without results.
- Separated Firefox versioning, release notes, packages, and tags from Chrome so Firefox can be developed and released independently while both builds retain shared quality checks.

## 2.2.0 — 2026-08-16

- Added the initial Firefox Desktop build with Retentia's popup, dashboard, retention rules, local category classifier, simulator, automatic cleanup, themes, password protection, backups, and privacy-safe diagnostics.
- Used Firefox's supported background model, a stable add-on ID, and minimal permissions. The Chrome history-page shortcut is omitted because extensions cannot access Firefox's privileged History interface.
