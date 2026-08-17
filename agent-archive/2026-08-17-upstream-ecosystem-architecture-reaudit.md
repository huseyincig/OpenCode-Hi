# Upstream + Ecosystem Architecture Re-Audit

Completed: 2026-08-17

## Result

Research gate closed by coverage saturation. Material first-party and third-party systems were inspected at source/test/issue depth sufficient for ownership and checkpoint decisions.

Durable audit outputs:
- `/workspace/Reference/upstream-audit/source-inventory.md`
- `/workspace/Reference/upstream-audit/capability-matrix.md`
- `/workspace/Reference/upstream-audit/ownership-matrix.md`
- `/workspace/Reference/upstream-audit/gap-differentiation-matrix.md`
- `/workspace/Reference/upstream-audit/compatibility-composition-model.md`
- `/workspace/Reference/upstream-audit/checkpoint-verdict.md`
- `/workspace/Reference/upstream-audit/benchmark-plan.md`
- `/workspace/Reference/upstream-audit/hi-source-mapping.md`

Project roadmap: `/workspace/OpenCode-Hi/ROADMAP.md`.

Checkpoint verdicts:
- `b034d308051d1405090beb4558dd8aa4b5eff470`: KEEP + EXTEND
- `ea1a71d04319ec3b6cec8f4173ea3a8d012f0b27`: REWORK; retain pure `planScheduling()` as an admission-policy component.

Key ownership decisions:
- Hi owns WorkGraph/execution identity/scheduler policy/progress/recovery/evidence/completion/mission authority.
- OpenCode/native/external systems own generic Session/tool/skill/model-catalog/worktree/process/browser/context-memory primitives when semantically sufficient.
- Generic memory, transcript compaction and browser automation engines are not Hi Core targets.
- Plugin/config ownership must be minimized; capability probes/adapters isolate stable/dev host evolution.
- Comparative benchmark design is required before superiority claims.

Focused checkpoint tests emitted 15 pass / 0 fail before the known host Node/libuv teardown assertion.
