# OpenCode-Hi Skills

OpenCode-Hi packages 29 canonical `hi-*` methodology skills. Default active skill count is 0; typical work uses 0–1 and the hard bounded maximum is 3. Every migrated skill is calibrated with trigger, do-not-trigger, exit condition, role affinity, context/execution cost, composition behavior, escalation relationship, and verification relationship in `data/skill-profiles.json`.

Skills contain HOW methodology only. They never own routing, model selection, agent spawning, topology, authority, continuation, completion, or STOP.

Canonical skill names are the directories under `skills/hi-*`. Resource packages may include lazy `references/`, `scripts/`, `assets/`, and `examples/`; resource access is skill-scoped, indexed, realpath-confined, traversal-safe, and symlink-safe.
