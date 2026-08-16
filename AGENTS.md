# Retentia project instructions

## Versioning

- Use semantic versioning (`MAJOR.MINOR.PATCH`).
- Automatically increment the version for every completed functional change unless the user explicitly requests a specific version.
- Default to a PATCH increment for fixes and small additions, MINOR for backward-compatible feature sets, and MAJOR for breaking changes.
- Keep the version synchronized in `package.json`, `manifests/chrome.json`, `manifests/firefox.json`, `CHANGELOG.md`, and both browser-specific release archive names.
- Rebuild and recreate the release archive after each version change.
- Never leave an older release archive as the apparent current release; archive or remove it only when that action is clearly authorized.

## Quality

- Run tests and the production build before producing a release archive.
- Keep code, identifiers, comments, commits, and technical documentation in English.

## Communication

- Always number recommendations, improvement points, optional additions, and proposed follow-up features so the user can approve or reference them by number alone.
- Keep numbering stable within the same discussion; do not renumber an existing proposal list unless the user asks for a revised list.
