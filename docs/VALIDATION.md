# Validation and Acceptance

OpenCode-Hi separates proof tiers so a convenient local PASS cannot masquerade as host or publication proof.

- **T0** — static/schema/generator/validator proof.
- **T1** — deterministic unit/contract proof.
- **T2** — in-process integration/runtime wiring proof.
- **T3** — exact-version real-host acceptance bound to source/host/platform.
- **T4** — real external publication/release proof under explicit authority.

## Canonical local gates

```bash
npm run check
python -m pytest -q tests/test_hi.py
```

`npm run check` builds/tests the runtime, runs architecture rules, regenerates/validates current documentation projections and runs the source validator. Python acceptance covers release/setup/data-contract and reconstruction invariants that are outside the Node runtime suite.

Fresh test counts belong to command output. Documentation must not preserve an old count as current status.

## Documentation parity

`npm run docs:check` regenerates and validates:

- product truth trace inventory;
- generated config reference;
- exact accepted host capability matrix;
- documentation lifecycle/ownership inventory;
- current documentation parity.

It fails on missing owners/paths, historical-as-current ownership, broken local links, stale capability/candidate language, version/package/product drift, npm availability drift and selected host/config/document contract omissions.

## External acceptance

A host claim must bind the exact OpenCode version/platform, exact Hi source, effective configuration, native plugin loading and the behavior under test. Mock/local protocol tests are not T3.

Release/publication proof must bind exact source/ref/artifacts and remote identity/integrity. Authentication or environment blockers remain explicit rather than lowering the gate.

Environment/harness failures are reported separately from product failures. Generated projections summarize canonical receipts but do not replace them as evidence.
