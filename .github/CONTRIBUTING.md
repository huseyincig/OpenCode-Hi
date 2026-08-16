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
- Push, tag, publish, deploy, paid actions and other external effects remain explicit authority-gated operations.

## Documentation ownership

Public documentation is intentionally small: one current page per product area. Generated support/config/release facts come from machine owners where available. Run `npm run docs:check` to regenerate and validate public projections. Historical/local engineering notes are not product truth owners.

## Verification

Use the smallest sufficient focused proof while editing. Before a coherent checkpoint, run the repository gates appropriate to the change; the canonical combined Node/documentation/source check is:

```sh
npm run check
```

Run the Python acceptance suite as well when the changed boundary is covered there:

```sh
python -m pytest -q tests/test_hi.py
```

Host-dependent support needs exact T3 evidence. A future release/publication must be proven against its exact unchanged source/ref; if source changes, affected proof must be rerun. Real publication requires T4 and explicit authority.
