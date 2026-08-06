# Retentia Privacy Policy

**Effective date:** August 6, 2026

Retentia is designed to process browser history locally on the user's device.

## Data accessed

Retentia accesses browser history only to match URLs against retention rules and remove URLs whose configured retention period has expired. It also reads the active tab URL when the user explicitly creates a quick rule from the popup.

## Data stored

Retention rules, settings, count-only scan summaries, and count-only activity entries are stored in Chrome's local extension storage on the user's device. Activity and saved scan summaries do not contain deleted URLs or domains. URL candidates are held temporarily in memory while an active simulator result is displayed and are not included in the persisted scan summary.

Retentia does not create a separate browser-history log file on the filesystem. Retention rules necessarily store the URL, domain, wildcard, or regular-expression pattern entered by the user so the local background engine can apply that rule.

## Data transmission and sharing

Retentia does not transmit, sell, share, or remotely process browser history or other personal data. Version 1.0 has no server, analytics, advertising, account system, or network permissions.

## Data deletion

Users can clear the local activity log from the dashboard. Uninstalling the extension removes its local extension data according to browser behavior. History removed by Retentia cannot be restored by the extension.

The forgotten-password reset deletes the locally stored password hash, retention rules, activity log, authentication-delay state, and last scan summary. It does not delete browser history.

## Password lock scope

The local password lock is designed to discourage casual access to rule management. It does not protect against a person with full access to the user's operating-system account, Chrome profile, local extension storage, or browser developer tools.

## Changes

If Retentia's data practices change, this policy and the extension's disclosures will be updated before release.
