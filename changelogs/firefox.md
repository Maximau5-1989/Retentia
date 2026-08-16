# Firefox changelog

## 2.3.1 - 2026-08-16

- Raised Firefox's minimum version to 142 so the declared no-data-collection permission is supported on Firefox for Android.

## 2.3.0 — 2026-08-16

- Applied a one-time local neural-network audit to resolve 18 high-confidence conflicts in the offline category database. The remaining uncertain source conflicts remain unresolved and cannot trigger automatic category rules.

## 2.2.2 — 2026-08-16

- Removed the What's new link beside the version number in the desktop and compact dashboard headers.

## 2.2.1 — 2026-08-16

- Made the local history classifier handle Firefox history items whose title is `null`, added a Firefox-specific scan safety limit, and made scan failures visible instead of leaving the page without results.
- Separated Firefox versioning, release notes, packages, and tags from Chrome so Firefox can be developed and released independently while both builds retain shared quality checks.

## 2.2.0 — 2026-08-16

- Added the initial Firefox Desktop build with Retentia's popup, dashboard, retention rules, local category classifier, simulator, automatic cleanup, themes, password protection, backups, and privacy-safe diagnostics.
- Used Firefox's supported background model, a stable add-on ID, and minimal permissions. The Chrome history-page shortcut is omitted because extensions cannot access Firefox's privileged History interface.
