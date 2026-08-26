# Contributing

Keep changes small, evidence-backed, and aligned with canonical ownership. Do not reimplement an OpenCode native primitive or create a second Hi subsystem when an existing owner/port can absorb the responsibility correctly.

## Engineering rules

- Source, identifiers, comments, prompts, tests, fixtures, errors, logs, schemas and canonical technical docs are English. `docs/locales/tr/README.md` is a translation and must not invent behavior.
- Start from live source/contracts/runtime evidence, then update docs—not the reverse.
- Preserve canonical runtime ownership boundaries described in `docs/ARCHITECTURE.md`.
- Skill/Methodology activation defaults to zero; availability is not an instruction to load it.
- Prefer minimum-sufficient repository/context retrieval and bounded execution topology.
- Retry only when the next attempt is materially different and policy permits it.
- Preserve user dirty/staged/unrelated work. Do not use broad reset/stash/restore or `git add -A` as ownership shortcuts.
- External source reuse requires explicit source/license/ownership treatment before code is copied/adapted.
- Never commit secrets or provider/private runtime state.
- Normal product development is committed on `dev`; after the relevant verification passes, maintainers/authorized agents push each coherent development commit to `origin/dev` so the canonical development state is recoverable remotely. Pushes or promotions to `main`, tags, releases, npm publication, deploys, paid actions and other higher-impact external effects remain separately authority-gated.

## Documentation ownership

Public documentation is intentionally small: one current page per product area. Generated support/config/release facts come from machine owners where available. Run `npm run docs:check` to regenerate and validate public projections. Historical/local engineering notes are not product truth owners.

## Verification

Use the smallest sufficient focused proof while editing. Before a coherent material-development checkpoint, run the current product gate:

```sh
npm run check:product
```

For a complete current local checkpoint, run `npm run check`; it combines the product gate with the canonical Python validator and Python acceptance. The Python suite is also available independently as `npm run test:python`.

Host-dependent support and future release/publication proof remain release-specific. They must be regenerated against the exact candidate when that workflow is deliberately activated; ordinary development does not replay historical certification receipts.
