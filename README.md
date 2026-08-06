# Retentia v1.0

Retentia is a privacy-first Chrome extension that gives selected browser history a configurable expiration date. All processing happens locally.

## Features

- Exact URL, domain, wildcard, and regular-expression rules
- Configurable retention in minutes, hours, or days
- Priority resolution for overlapping rules
- Background cleanup with adjustable scan interval
- Dry-run simulator before deletion
- Local activity log and dashboard
- Quick rule creation from the popup
- Optional immediate deletion of existing history matched by a newly created rule
- Right-click **Create Retentia rule** action for URLs on Chrome's history page
- Light and dark themes
- Password-protected Retentia interface

## Development

```powershell
pnpm install
pnpm test
pnpm build
```

Load `dist` through `chrome://extensions` → **Developer mode** → **Load unpacked**.

### Preparing a release

Preview the next patch version without changing files:

```powershell
pnpm run release:dry-run
```

Prepare a patch, minor, or major release with a concise changelog entry:

```powershell
pnpm run release:patch -- --notes "Describe the completed change."
pnpm run release:minor -- --notes "Describe the completed feature set."
pnpm run release:major -- --notes "Describe the breaking change."
```

The release command synchronizes `package.json` and `public/manifest.json`, updates `CHANGELOG.md`, runs all tests and the production build, creates the versioned ZIP archive, and creates an annotated Git tag. Add `--no-commit` to skip the Git commit and tag.

## Privacy

Retentia uses the Chrome History API and local extension storage. It has no host permissions, analytics, remote services, or account system.

The activity log stores removal counts and timestamps only. It does not store deleted URLs or domains. Scan candidate URLs exist temporarily in memory while a simulation is visible but are stripped before the scan summary is saved. Retentia creates no separate history-log file on the filesystem. Retention rules necessarily retain the user-entered match pattern so the background engine can apply them.

The Retentia password is never stored directly. Retentia stores a salted PBKDF2-SHA-256 hash locally. A successful login unlocks the pinned popup and dashboard for the lifetime of the registered dashboard tab. Closing that tab clears the unlock session, so the next opening from the pinned extension icon requires the password again. Rules no longer require a second password prompt after Retentia is unlocked.

After repeated incorrect attempts, Retentia applies an increasing local delay. A forgotten-password reset removes the password, retention rules, activity log, and last scan summary. It never deletes browser history. The password lock is intended to discourage casual access; it is not a security boundary against someone with complete access to the Windows account, Chrome profile, or extension developer tools.

## Important behavior

Chrome deletes history by URL. A retention timer is therefore based on the URL's most recent visit. Revisiting a URL resets its timer, and deleting an expired URL removes that URL's recorded visits from Chrome history.
