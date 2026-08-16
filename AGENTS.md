# Retentia project instructions

## Versioning

- Use semantic versioning (`MAJOR.MINOR.PATCH`).
- Automatically increment the version for every completed functional change unless the user explicitly requests a specific version.
- Default to a PATCH increment for fixes and small additions, MINOR for backward-compatible feature sets, and MAJOR for breaking changes.
- Treat `manifests/chrome.json` and `manifests/firefox.json` as independent browser version sources; `package.json` has no product version.
- Increment only the browser target being released. Keep that target's manifest, in-app release notes, Markdown changelog, archive name, and browser-prefixed Git tag synchronized without changing the other browser's version history.
- Rebuild both browser targets for shared-code validation, but create a release archive only for the browser being released. Firefox releases also require a matching source archive for AMO review.
- Never leave an older archive as the apparent current release for the same browser; archive or remove it only when that action is clearly authorized.

## Quality

- Run tests and the production build before producing a release archive.
- Keep code, identifiers, comments, commits, and technical documentation in English.

## Communication

- Always number recommendations, improvement points, optional additions, and proposed follow-up features so the user can approve or reference them by number alone.
- Keep numbering stable within the same discussion; do not renumber an existing proposal list unless the user asks for a revised list.
