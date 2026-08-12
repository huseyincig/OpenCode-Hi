# OpenCode HHC Orchestrator Threat Model

- HHC-T01 recursive orchestration — child control-plane guard; nested teams rejected.
- HHC-T02 premature completion — runtime-owned CompletionAdjudicator.
- HHC-T03 stale evidence — mutation invalidates earlier evidence.
- HHC-T04 user stop ignored — `user_interrupted` dominates idle continuation.
- HHC-T05 unavailable skill silently assumed — discovery + preflight; missing skill means no injection.
- HHC-T06 unmanaged config overwrite — ownership-aware installer with before hashes.
- HHC-T07 privileged action without authority — exact action contract hash + explicit approval.
- HHC-T08 duplicate background task — worker fingerprint + spawn promise deduplication.
- HHC-T09 stale approval reuse — approval is bound to exact action contract hash.
- HHC-T10 provider/model fallback escapes policy — model resolution only from runtime inventory and bounded fallbacks.

The executable test matrix is intentionally deferred to the external test/debug environment.
