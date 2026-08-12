# Contributing

Keep changes small, evidence-backed, and aligned with existing ownership. Do not reimplement OpenCode native primitives or add a new subsystem when an existing OpenCode-Hi owner can cleanly absorb the responsibility.

## Development rules

- Source code, identifiers, comments, prompts, tests, fixtures, errors, logs, schemas, and technical documentation are English. `README.tr.md` is the Turkish translation of the canonical English README.
- Preserve mission, obligation, task, worker, evidence, authority, continuation, completion, and deterministic STOP semantics unless a deliberate change has regression coverage.
- Role, agent, model, topology, execution depth, context depth, and isolation depth are independent decisions.
- Skill activation defaults to zero. An available skill is not a checklist item.
- Prefer targeted repository retrieval; widen only when decision-changing evidence remains missing.
- Retry only when the next attempt is materially different.
- External source reuse requires an explicit license and ownership decision before source is copied or adapted.
- Never commit secrets or provider/private runtime state.
- Push, tag, publish, deploy, and release remain explicit user-authority actions.

## Verification

Use risk-proportional verification during development. Before candidate construction run the complete repository gates:

```sh
cd plugin && npm run build && npm test
cd ..
python -m pytest -q
python scripts/validate.py
```

Release-candidate evidence must be generated from one exact unchanged candidate. If source changes after candidate verification, rerun the affected gates.
