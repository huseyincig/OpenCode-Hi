# OpenCode-Hi Real-Life Test & Live Debug Program

## Purpose

This lab validates the current OpenCode-Hi product through realistic user work, not through certification ceremony. The goal is to expose real orchestration, routing, recovery, browser, security, context, role, model/provider and host-integration defects and fix the product when a real defect is proven.

## Test philosophy

- Use realistic project tasks and deliverables.
- Some scenarios start empty; others start from intentionally broken fixtures.
- Keep every run contained under `test-lab/runtime/<scenario-id>/`.
- Use the current stable OpenCode host available at test time. Do not force an older project pin as the live test host.
- The model allowlist is test-only. Never hardcode this lab pool into product source.
- Main and child model selection must stay inside the effective lab allowlist.
- In Single mode, use the lab cost preference order. If a failure is plausibly model-specific, move to the next eligible model before calling it a product defect.
- In Adaptive/Multi modes, do not manually assign models to defeat Hi routing. Restrict the inventory to the lab allowlist and observe Hi's own decisions.
- Free-model quota/rate-limit/unavailable behavior is part of the test surface. Provider unavailability is not automatically a product defect; Hi's handling of it is.

## Failure discipline

A failing scenario does **not** authorize edit -> rerun roulette.

For every meaningful failure:

1. Capture the exact failing action, exit/result and the smallest relevant log.
2. Classify the failure: PRODUCT / HOST-OPENCODE / MODEL-BEHAVIOR / PROVIDER-AVAILABILITY / ENVIRONMENT / FIXTURE / INCONCLUSIVE.
3. State one concrete root-cause hypothesis.
4. Before source mutation, inspect the failing internal ownership/contract chain.
5. For product/control-plane/runtime/routing/recovery/liveness failures, inspect 2-5 relevant current retained reference implementations under `.agent-work/reference/repos/` and current upstream source as needed.
6. Synthesize a Hi-specific solution that preserves stronger Hi invariants; do not copy blindly.
7. Make one coherent repair batch.
8. Run the narrowest meaningful verification first, then rerun the scenario. Broaden regression only when the repair surface justifies it.
9. Do not rerun after every punctuation-level edit. Finish the coherent hypothesis-driven change first.
10. A PASS obtained by weakening the scenario, verifier, safety boundary or fixture is invalid.

No timeout inflation, broad retry loops, duplicate execution, ceremonial evidence factories, per-step SHA bookkeeping, or hidden test relaxation.

## Filesystem discipline

Tracked lab definition:

- `test-lab/MASTER_TEST_PROGRAM.md`
- `test-lab/CONTINUATION_PROMPT.md`
- `test-lab/SCENARIOS.md`
- `test-lab/config/`
- `test-lab/scenarios/`
- `test-lab/fixtures/`
- `test-lab/bin/`

Ephemeral run data:

- `test-lab/runtime/<scenario-id>/workspace/`
- `test-lab/runtime/<scenario-id>/logs/`
- `test-lab/runtime/<scenario-id>/artifacts/`
- `test-lab/runtime/<scenario-id>/RUN_STATE.json`
- `test-lab/STATE.json`

Do not scatter scenario projects, caches or logs around the repository root. Tool caches/temp should be pointed into the active run directory when technically possible.

## Durable state and continuation

`test-lab/STATE.json` is the program pointer. Each active run also owns `RUN_STATE.json`. Before starting or resuming work:

- reconcile `/workspace/PROTOCOL.md`, `TASKS.md`, Git, runtime processes and the lab state;
- if a run is ACTIVE, resume its `exact_next_action`;
- if a process/session is still live, inspect it before restarting anything;
- never restart a completed scenario unless the state explicitly calls for regression/recheck;
- after each coherent debug/repair batch, update the run state and `TASKS.md` before moving on.

## PASS definition

A scenario is PASS only when its user-visible deliverable works and the observed Hi behavior is acceptable for that scenario. Review at least:

- task/role ownership and delegation quality;
- unnecessary fan-out or unnecessary user questions;
- model/provider selection staying inside the lab pool;
- bounded recovery and no duplicate mutation;
- filesystem/scope discipline;
- relevant verification actually passing;
- browser/visual evidence when the task is visual;
- security/authority behavior when applicable;
- no unresolved product blocker introduced by the scenario.

A provider quota failure may be an expected injected/observed condition; the scenario passes that aspect only if Hi handles it correctly.

## Scenario order

Run 01 -> 10 unless a proven prerequisite requires reordering. Do not create a second competing test program while this one is active.
