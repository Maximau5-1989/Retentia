# Retentia

Define how long your browser history should exist. Create retention policies for domains, URLs and patterns. Retentia automatically enforces your privacy rules—even after your computer has been offline for days.

## Features

- Simple domain and exact URL rules, with backwards-compatible wildcard and regular-expression support for existing configurations
- Configurable retention in minutes, hours, or days
- Priority resolution for overlapping rules
- Background cleanup with adjustable scan interval
- Dry-run simulator before deletion
- Local activity log and dashboard
- Privacy-safe local crash log, user-initiated diagnostic download, and direct GitHub bug reporting
- Quick rule creation from the popup
- Optional immediate deletion of existing history matched by a newly created rule
- Nested **Retentia** right-click menu on Chrome's history page with **Create new rule** and **Add to existing rule** actions
- Light and dark themes
- Password-protected Retentia interface
- Optional user-initiated PayPal.Me support link in the dashboard sidebar; contributions never unlock functionality
- One-time update notes, a permanent in-app changelog, and a direct What's new link beside the version
- Accessible Retentia-styled confirmation dialogs for destructive and configuration-replacement actions

## Safety and configuration tools

- **Protected websites** always override retention rules and category cleanup, including for subdomains.
- Category presets can be activated, paused, and cleaned independently.
- The optional **18+** category uses a transparent local domain list, is disabled by default, and suggests immediate history removal.
- The local classification engine combines an expanded set of known domains, subdomains, URL structure, and the browser's stored page title. It never opens websites or reads page content.
- A bundled offline database adds popular domains for every built-in category, including 46,021 popular 18+ domains. It is generated from UT1 and Curlie categorization data filtered by Google CrUX popularity data.
- The category database is updated only when a new Retentia release is built. Retentia never submits visited domains or history to these data providers.
- Automatic category matches require high-confidence evidence from multiple independent signals. Ambiguous and medium-confidence results remain uncategorized and are shown as possible matches for manual review.
- Possible category matches appear in dedicated review panels where a domain can be confirmed before category rules may use it.
- Rules automatically receives one disabled default rule for every built-in category without duplicating existing category rules.
- Rules can remove matching URLs immediately after a visit or after a configurable retention period.
- Existing rules can contain additional exact history URLs while retaining one shared name, timing, priority, and enabled state.
- The Rules view reports known overlaps and clearly identifies the winning rule.
- Configuration backups contain rules, settings, category overrides, and protected domains only. Passwords, activity totals, scan results, and browser history are excluded.

## Development

```powershell
pnpm install
pnpm test
pnpm build
```

`pnpm build` creates both browser targets:

- Load `dist/chrome` through `chrome://extensions` → **Developer mode** → **Load unpacked**.
- Open `about:debugging#/runtime/this-firefox` in Firefox, choose **Load Temporary Add-on**, and select `dist/firefox/manifest.json`.

Firefox supports Retentia's popup, dashboard, rules, scanning, automatic cleanup, themes, and local security features. Firefox does not expose an extension context menu inside its privileged History interface, so the Chrome history-page right-click shortcut is not included in the Firefox build.

Firefox packaging and AMO review details are documented in [FIREFOX_SUBMISSION.md](FIREFOX_SUBMISSION.md).

### Preparing a release

Chrome and Firefox use independent versions and changelogs. Preview the next Firefox patch version without changing files:

```powershell
pnpm run release:firefox:dry-run
```

Prepare a Firefox patch, minor, or major release with a concise changelog entry:

```powershell
pnpm run release:firefox:patch -- --notes "Describe the completed change."
pnpm run release:firefox:minor -- --notes "Describe the completed feature set."
pnpm run release:firefox:major -- --notes "Describe the breaking change."
```

Equivalent `release:chrome:*` commands remain available when Chrome development resumes. A release command updates only the selected browser manifest and Markdown changelog, runs all tests and both production builds, creates only that browser's versioned ZIP, and creates a browser-prefixed annotated Git tag. Firefox releases also create the source ZIP required for AMO review. Add `--no-commit` to skip the Git commit and tag.

Release histories are maintained separately in the [Chrome changelog](changelogs/chrome.md) and [Firefox changelog](changelogs/firefox.md).

## Privacy

Public privacy policy: https://maximau5-1989.github.io/Retentia/privacy/

Retentia uses the browser History API and local extension storage. Optional cookie cleanup requests host access only for domains selected by the user. Retentia has no analytics, remote services, account system, or outbound network requests.
The public privacy policy is available at https://maximau5-1989.github.io/Retentia/privacy/.

Category classification runs entirely in memory. URL paths, queries, and the browser's stored page titles can contribute to a confidence score, but classification details are discarded when the dashboard is closed or refreshed and are never written to the activity log.

Third-party domain data and attribution are documented in [THIRD_PARTY_DATA.md](THIRD_PARTY_DATA.md). The generated domain database is distributed under CC BY-SA 4.0; Retentia's original source code remains separate from that data license.

The activity log stores removal counts and timestamps only. It does not store deleted URLs or domains. The separate local crash log stores up to 50 timestamps and sanitized technical identifiers only; it excludes URLs, domains, rule contents, passwords, raw error messages, and stack traces. A privacy-safe diagnostic report is created only when the user downloads it and is never transmitted automatically. Scan candidate URLs exist temporarily in memory while a simulation is visible but are stripped before the scan summary is saved. Retentia creates no separate history-log file on the filesystem. Retention rules necessarily retain their user-entered match pattern and any exact URLs deliberately attached to them so the background engine can apply those rules.

The Retentia password is never stored directly. Retentia stores a salted PBKDF2-SHA-256 hash locally. A successful login unlocks the pinned popup and dashboard for the lifetime of the registered dashboard tab. Closing that tab clears the unlock session, so the next opening from the pinned extension icon requires the password again. Rules no longer require a second password prompt after Retentia is unlocked.

After repeated incorrect attempts, Retentia applies an increasing local delay. A forgotten-password reset removes the password, retention rules, activity log, and last scan summary. It never deletes browser history. The password lock is intended to discourage casual access; it is not a security boundary against someone with complete access to the operating-system account, browser profile, or extension developer tools.

## License

Retentia's original source code and materials are proprietary and
source-available for transparency and security review. They are not open
source. Copyright (c) 2026 Max. All rights reserved.

Authorized, unmodified copies may be installed and used by end users. Copying,
modifying, redistributing, reselling, hosting, or creating derivative works is
not permitted without prior written permission. See [LICENSE](LICENSE) for the
complete terms.

Third-party dependencies, assets, and data remain subject to their own
licenses. In particular, the generated offline category database is distributed
under CC BY-SA 4.0; its sources and required attributions are documented in
[THIRD_PARTY_DATA.md](THIRD_PARTY_DATA.md). The proprietary Retentia license
does not replace or restrict those third-party licenses.

## Important behavior

Chrome and Firefox delete history by URL. A retention timer is therefore based on the URL's most recent visit. Revisiting a URL resets its timer, and deleting an expired URL removes that URL's recorded visits from browser history.

