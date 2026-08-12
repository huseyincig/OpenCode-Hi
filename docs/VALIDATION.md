# Validation

Local validation proves source/in-process behavior only. External runtime validation must bind the exact OpenCode version/platform, exact OHO Git ref/hash and clean consumer project.

## Local gates

- TypeScript build + Node acceptance suite
- Python helper/release tests
- source validation
- deterministic release/SBOM/provenance checks
- native skill inventory/routing/default-zero tests
- worktree/path/tool-surface acceptance

## External gates

- clean consumer OHO install
- actual OpenCode child-session delegation
- effective role model/variant evidence
- permission/provider/runtime failure scenarios
- external A–H/native/flow acceptance
- real Windows runtime smoke

No historical receipt may be promoted to a current candidate PASS without exact-bound fresh evidence.


## 61-section forensic progress

`data/validation/forensic-61-progress.json` is the checkpoint source of truth for the Final Zero-Defect prompt. `COMPLETE_LOCAL` means locally verifiable work is complete; `PARTIAL_EXTERNAL` remains incomplete until a fresh external receipt exists. A checkpoint CLI PASS never promotes exact Git/real-provider/Windows release gates.
