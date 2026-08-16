# One-time category model audit

On 2026-08-16, Retentia ran a local character-level neural-network ensemble
against the generated domain-category database. The analysis was performed
once during development and is not included in the extension.

## Inputs

- Normalized domain names already present in the generated database.
- Existing UT1 and Curlie category assignments only.
- No browser history, page content, URL paths, titles, user corrections, or
  network requests.

## Safety rule

The model never invents a category or introduces a new domain. It can resolve
only a domain already assigned to multiple source categories, and only when two
independent model runs agree with at least 0.95 confidence and a 0.30
probability margin. The selected category must already be one of that domain's
source assignments.

The audit found 1,729 conflicts among the five categories with sufficient
training evidence. It resolved 18 high-confidence conflicts. The remaining
conflicts are intentionally left ambiguous and therefore cannot trigger an
automatic category rule.

The static decisions are in `scripts/category-model-resolutions.json`. Run
`npm run data:resolve-category-conflicts` to apply them to an already generated
database, or use `npm run data:categories` to apply them during a future source
database rebuild.
