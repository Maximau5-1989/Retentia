# Third-party category data

Retentia includes a generated offline domain-category database in
`src/shared/generated/category-domains.json`. The browser extension never
contacts the data providers. Only normalized domain names are included; source
URLs, titles, descriptions, popularity ranks, and browsing records are not
shipped or stored.

## Sources and attribution

- **UT1 Blacklists** — adult-domain categorization. Licensed under CC BY-SA
  4.0. Source: https://dsi.ut-capitole.fr/blacklists/
- **Curlie Directory** — general website categorization. Licensed under CC BY
  3.0. Required attribution: With content from Curlie.org - the largest
  human-edited directory of the web. Contribute by submitting a website or
  becoming an editor. Source: https://curlie.org/
- **Google Chrome UX Report (CrUX)** — popularity filtering. Licensed under CC
  BY 4.0. Source: https://developer.chrome.com/docs/crux/
- **CrUX Cache** — MIT-licensed distribution mirror used to retrieve the
  Google CrUX dataset. Source: https://github.com/lonetis/crux-cache

The generated domain database is distributed under CC BY-SA 4.0. This data
license applies to the generated database, not to Retentia's original source
code.

## Generation method

1. UT1 adult domains and Curlie category assignments are normalized locally.
2. Curlie entries are accepted only when they point to a domain homepage. This
   prevents a single page on a multi-purpose host from categorizing the entire
   host.
3. Candidate domains are intersected with the July 2026 global CrUX dataset.
4. Results are ordered by CrUX popularity bucket and then alphabetically.
5. Each Retentia category is capped at 50,000 domains.
6. Domains assigned to multiple categories remain ambiguous unless Retentia's
   existing URL and title signals resolve the conflict.

The database can be regenerated without machine-specific paths:

```powershell
npm run data:categories -- --ut1 <adult.tar.gz> --curlie <curlie.tar.gz> --crux <crux-directory-or-csv.gz>
```

## Included domain counts

- Social media: 111
- Webshops: 18,226
- News: 9,589
- Streaming: 26
- Search engines: 169
- Travel: 28,161
- Entertainment & gaming: 6,461
- 18+: 46,021
