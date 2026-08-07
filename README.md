# Retentia

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
- Nested **Retentia** right-click menu on Chrome's history page with **Create new rule** and **Add to existing rule** actions
- Light and dark themes
- Password-protected Retentia interface

## Safety and configuration tools

- **Protected websites** always override retention rules and category cleanup, including for subdomains.
- Category presets can be activated, paused, and cleaned independently.
- The optional **18+** category uses a transparent local domain list, is disabled by default, and suggests immediate history removal.
- The local classification engine combines known domains, subdomains, URL structure, and Chrome's stored page title. It never opens websites or reads page content.
- Only high-confidence classifications can match an automatic category rule. Medium-confidence results remain uncategorized and are shown as possible matches for manual review.
- Possible category matches appear in dedicated review panels where a domain can be confirmed before category rules may use it.
- Rules automatically receives one disabled default rule for every built-in category without duplicating existing category rules.
- Rules can remove matching URLs immediately after a visit or after a configurable retention period.
- Existing rules can contain additional exact history URLs while retaining one shared name, timing, priority, and enabled state.
- The Rules view reports known overlaps and clearly identifies the winning rule.
- Configuration backups contain rules, settings, category overrides, and protected domains only. Passwords, activity totals, scan results, and browser history are excluded.
- An explicit, disabled-by-default Testing mode can temporarily bypass password prompts without removing the password. Testing mode is never exported in backups and turning it off immediately restores the lock.

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

Category classification runs entirely in memory. URL paths, queries, and Chrome's stored page titles can contribute to a confidence score, but classification details are discarded when the dashboard is closed or refreshed and are never written to the activity log.

The activity log stores removal counts and timestamps only. It does not store deleted URLs or domains. Scan candidate URLs exist temporarily in memory while a simulation is visible but are stripped before the scan summary is saved. Retentia creates no separate history-log file on the filesystem. Retention rules necessarily retain their user-entered match pattern and any exact URLs deliberately attached to them so the background engine can apply those rules.

The Retentia password is never stored directly. Retentia stores a salted PBKDF2-SHA-256 hash locally. A successful login unlocks the pinned popup and dashboard for the lifetime of the registered dashboard tab. Closing that tab clears the unlock session, so the next opening from the pinned extension icon requires the password again. Rules no longer require a second password prompt after Retentia is unlocked.

After repeated incorrect attempts, Retentia applies an increasing local delay. A forgotten-password reset removes the password, retention rules, activity log, and last scan summary. It never deletes browser history. The password lock is intended to discourage casual access; it is not a security boundary against someone with complete access to the Windows account, Chrome profile, or extension developer tools.

## Important behavior

Chrome deletes history by URL. A retention timer is therefore based on the URL's most recent visit. Revisiting a URL resets its timer, and deleting an expired URL removes that URL's recorded visits from Chrome history.
