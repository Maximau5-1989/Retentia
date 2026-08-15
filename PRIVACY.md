# Retentia Privacy Policy

**Effective date:** August 15, 2026

Retentia is designed to process browser history locally on the user's device.

## Contact

Publisher: Max  
Email: wehaveamalfunction@gmail.com

## Data accessed

Retentia accesses browser history only to match URLs against retention rules and remove URLs whose configured retention period has expired. It also reads the active tab URL when the user explicitly creates a quick rule from the popup.

## Data stored

Retention rules, settings, count-only scan summaries, count-only activity entries, and privacy-safe crash diagnostics are stored in Chrome's local extension storage on the user's device. Activity and saved scan summaries do not contain deleted URLs or domains. Crash diagnostics contain timestamps and sanitized technical identifiers only. They do not contain URLs, domains, rule contents, passwords, raw error messages, or stack traces. URL candidates are held temporarily in memory while an active simulator result is displayed and are not included in the persisted scan summary.

Retentia does not create a separate browser-history log file on the filesystem. Retention rules necessarily store the URL, domain, wildcard, or regular-expression pattern entered by the user so the local background engine can apply that rule.

## Data transmission and sharing

Retentia does not transmit, sell, share, or remotely process browser history or other personal data. Retentia has no server, analytics, advertising, account system, or network permissions. The bug-report link opens GitHub only after the user clicks it. Retentia never automatically sends crash diagnostics. A diagnostic report is generated and downloaded only after explicit user action, and the user decides whether to attach it to a bug report.

## Data deletion

Users can clear the local activity log and local crash log from the dashboard. Uninstalling the extension removes its local extension data according to browser behavior. History removed by Retentia cannot be restored by the extension.

The forgotten-password reset deletes the locally stored password hash, retention rules, activity log, crash log, authentication-delay state, and last scan summary. It does not delete browser history.

## Password lock scope

The local password lock is designed to discourage casual access to rule management. It does not protect against a person with full access to the user's operating-system account, Chrome profile, local extension storage, or browser developer tools.

## Changes

If Retentia's data practices change, this policy and the extension's disclosures will be updated before release.
