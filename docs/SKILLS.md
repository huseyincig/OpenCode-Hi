# HHC Native Skills

OHO ships 29 HHC-native methodology skills. They are child-specific, bounded and **default-zero**. Skills provide HOW; HHC runtime owns WHO/WHEN/MODEL/TASK/CONTINUE/STOP.

## Existing core methodologies (19)

- hhc-task-classification
- hhc-repository-analysis
- hhc-implementation-planning
- hhc-safe-refactoring
- hhc-test-strategy
- hhc-code-review
- hhc-regression-review
- hhc-security-review
- hhc-visual-qa
- hhc-accessibility-review
- hhc-browser-testing
- hhc-release-guardrails
- hhc-changelog-and-documentation
- hhc-debugging-root-cause
- hhc-api-contract-review
- hhc-database-migration
- hhc-dependency-change
- hhc-performance-analysis
- hhc-ci-build-recovery

## Added native methodologies (10)

- `hhc-source-driven-development` — version-sensitive official-source verification.
- `hhc-test-driven-development` — bounded RED/GREEN/REFACTOR behavior-first method.
- `hhc-review-feedback` — verify/reconcile reviewer findings before corrective work.
- `hhc-architecture-decisions` — compact durable ADR decisions.
- `hhc-iterative-retrieval` — incremental repo context acquisition.
- `hhc-design-discovery` — genuine ambiguity/design trade-off discovery without mandatory approval ceremony.
- `hhc-api-interface-design` — consumer-first API/interface boundary design.
- `hhc-workspace-isolation` — bounded worktree/workspace isolation while preserving user changes.
- `hhc-skill-authoring` — methodology-skill creation and routing validation.
- `hhc-adversarial-validation` — high-risk fresh-context disproof-oriented review.

## Economy invariants

- Default: 0 skill.
- Normal methodology need: 1 skill.
- Combined capability: 2 skills.
- Exceptional maximum: 3 skills.
- A skill may not spawn workers, own orchestration, choose models, approve authority, continue missions, or decide STOP.
