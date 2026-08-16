# Final System Certification

## Status

**PARTIAL** — OpenCode-Hi `0.1.1`.

This is an exact-evidence certification, not a marketing assertion. The certified source checkpoint is `2aa9e7287b55f6ae76579d7cab6cea7ce2042a2a` (tree `a4150bfb632762528e40fe327c04248e335d70d8`). The certification receipts are committed afterward as an attestation because a file cannot truthfully contain the hash of the same Git commit that contains that file.

## Evidence summary

- Package version: `0.1.1`.
- Schema: final certification v1.
- Exact host: OpenCode `1.18.18`, Linux/aarch64; Process, Workspace and Browser are `SUPPORTED_T3`.
- Platform: Linux current-source PASS; Windows current-source PENDING_EXTERNAL_CI.
- Architecture: 22/22 rules PASS.
- Security: 20/20 PASS. Authority: 18/18 PASS.
- Context / Project Intelligence: 12/12 PASS.
- Process / Workspace / Browser lifecycle: 61/61 PASS.
- Persistence / concurrency: 31/31 PASS. Git/VCS/path safety: 31/31 PASS.
- Fresh final gates: Python 118, Node 848, architecture 22, docs parity violations 0.
- Mutation: 15/15 compile-valid critical mutants killed; 0 survivors.
- Property/fuzz: 864 deterministic cases across 9/9 areas.
- Replay: 28 cases across 5/5 surfaces; nondeterministic drift 0.
- Failure injection: 12/12 required injections PASS; bounded terminal behavior.
- Install lifecycle: 14/14 PASS. Fresh packed consumer: 8/8 PASS, 31 Hi tools on exact OpenCode 1.18.18.
- Documentation parity: PASS, 0 violations.
- Known defects in audited scope: **0**.

## Evidence tiers

T0 = static/schema/lint/doc parity; T1 = deterministic unit/contract; T2 = integration/runtime wiring; T3 = exact-version real-host; T4 = real external publication/release. Lower tiers never certify higher-tier claims. See `data/validation/prompt-b-certification-evidence-tiers.json`.

## T3 receipts

- `data/validation/external-opencode-hi-0.1.1-process-1.18.18-head-0f35d83.json`
- `data/validation/external-opencode-hi-0.1.1-workspace-1.18.18-head-0f35d83.json`
- `data/validation/external-opencode-hi-0.1.1-browser-1.18.18-head-0f35d83.json`

## Release / T4

Current release status is machine-owned by `data/validation/release-status-0.1.1.json`. Current GitHub/npm T4 evidence is **pending**; no T4 claim is made before real publication and registry verification.

## Known unsupported capabilities and limitations

- Alternate host implementations are feasible by port contract but are not shipped or certified.
- Native structured HumanDecision UI opening is unsupported; bounded chat transport remains the truthful fallback.
- Current local T3 receipts are exact to OpenCode 1.18.18 on Linux/aarch64.
- Windows current-source acceptance is pending the exact-source CI run.
- T4 publication verification is pending.

## Blockers

- `current-source-windows-acceptance-pending-external-ci`
- `T4-current-release-publication-verification-pending`

## Canonical documentation index

Canonical ownership is machine-defined in `data/documentation-ownership.json`; current documentation inventory and hashes are in `data/validation/documentation-inventory.json`.

## Certification vocabulary

**PARTIAL** — do not label this release CERTIFIED until every blocker above is closed.

`ZERO KNOWN DEFECT` is scoped strictly to the audited Prompt B defect inventory and does not claim future defects are impossible. `DOCUMENTATION-SOURCE PARITY VERIFIED` is supported by the current documentation parity receipt.
