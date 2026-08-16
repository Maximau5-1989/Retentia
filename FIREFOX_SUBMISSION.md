# Firefox submission notes

Retentia's Firefox package targets Firefox Desktop 140 or newer. The Firefox build intentionally omits the Chrome history-page context menu because Firefox's privileged History interface does not expose extension context menus. The popup, dashboard, rules, category classifier, simulator, scheduled cleanup, themes, password protection, backups, and diagnostics remain available.

## Reproducible build

Use Node.js 24 and pnpm 11.16.0:

```powershell
pnpm install --frozen-lockfile
pnpm run check
pnpm dlx web-ext@10.5.0 lint --source-dir dist/firefox --no-input
```

The Firefox extension is written to `dist/firefox`. Do not regenerate `src/shared/generated/category-domains.json`; the reviewed generated database is committed and its sources are documented in `THIRD_PARTY_DATA.md`.

Firefox versions and release notes are independent from Chrome. The reviewed Firefox history is recorded in `changelogs/firefox.md`, and `pnpm run release:firefox:patch -- --notes "..."` creates matching `retentia-firefox-v<version>.zip` and `retentia-firefox-v<version>-sources.zip` files after all shared tests and both browser builds pass.

## Data handling

Retentia does not collect or transmit extension data. Browser history, rules, settings, authentication records, scan summaries, and sanitized diagnostic entries remain in local extension storage. External project, privacy-policy, attribution, support, and bug-report links open only after an explicit user action.

## Expected validator warnings

Mozilla's validator reports one Firefox-for-Android compatibility warning because this package is desktop-only and therefore omits `browser_specific_settings.gecko_android`. It also reports two `innerHTML` warnings in the bundled React DOM runtime. Retentia's source does not use `innerHTML` or React's `dangerouslySetInnerHTML`; these generic code paths are part of the unmodified React 19.2.8 dependency recorded in `pnpm-lock.yaml`.
