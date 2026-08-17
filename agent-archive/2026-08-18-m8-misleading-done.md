# M8 Misleading DONE / Evidence Provenance

- Date: 2026-08-18
- Current: `42c1cd6e70c124c7c2aebc133bf968eae53bbea2`
- Pre-reset: `e8c1a7d77f3546bb2f940f4e7b439ed06a273e83`
- Fixture SHA256: `78c0f19fe56aeea16f0d4724d602b303d8a902f448531075fda93d5730a4da12`
- Aggregate: `/workspace/Reference/benchmarks/m8-misleading-done/aggregate.json`
- Aggregate SHA256: `c9d41e6f6fce243bffce7638fd91fed95f10ce789c215f51e2b9550ffea658a4`

## Result

**RETAIN claim-linked evidence/completion.** Current blocks misleading `DONE` when evidence is missing, comes from the wrong task, or belongs to a previous attempt; exact current-task/current-attempt proof completes the positive control. Pre-reset false-completes both wrong-task and wrong-attempt adversarial cases.

Current: `false_completion=0`, `wrong_task_accepted=0`, `wrong_attempt_accepted=0`.
Pre-reset: `false_completion=2`, `wrong_task_accepted=1`, `wrong_attempt_accepted=1`.

Vanilla OpenCode is not used as an equivalent baseline because this fixture tests Hi-specific claim-linked evidence adjudication rather than external code-generation acceptance. No provider/model execution or monetary cost occurred.
