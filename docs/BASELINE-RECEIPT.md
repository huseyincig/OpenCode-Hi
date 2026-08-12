# v58 Baseline Receipt

Canonical source baseline required by the OpenCode-Hi 0.1.x implementation contract:

- Product: OpenCode-HHC-Orchestrator
- Version: 2.0.10-v58
- Required commit: `c4ded95d7ab58efab0efba398560f5b0cc1c9f94`
- Supplied source archive SHA-256: `078965b0ea4584a6241cf23327c658ba9c4701ae5ea06378b9c519f0baed9bfd`
- GitHub connector commit verification: commit exists and is titled `release: OpenCode HHC Orchestrator 2.0.10 v58`.
- Independent network re-clone/tree comparison: `ENVIRONMENT_BLOCKED` in the implementation sandbox because direct DNS/network access is unavailable.

Pristine local validation before OpenCode-Hi feature work:

- Python validation suite: **41/41 PASS**
- Runtime Node suite (canonical `plugin/` working directory): **358/358 PASS**
- `scripts/validate.py`: **PASS** (`version=2.0.10 roles=8 skills=29 product=OHO docs=5`)

A root-working-directory manual Node invocation produced five relative-path failures. Re-running the same test files from their canonical `plugin/` working directory passed 358/358, so those root invocation failures are classified as harness/cwd misuse rather than baseline product defects.
