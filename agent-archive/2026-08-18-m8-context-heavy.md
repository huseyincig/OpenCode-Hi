# M8 Context-Heavy Bounded Investigation

- Date: 2026-08-18
- Current: `42c1cd6e70c124c7c2aebc133bf968eae53bbea2`
- Pre-reset: `e8c1a7d77f3546bb2f940f4e7b439ed06a273e83`
- Fixture SHA256: `171b8e7e8373aebbab0c6a462862c3339c410c5e897efb053d5b58800828a720`
- Aggregate: `/workspace/Reference/benchmarks/m8-context-heavy/aggregate.json`
- Aggregate SHA256: `348d4cb3b8cdbfd193a72bd11952b818d6c917c799b5c09ab30d1e9ff5f93539`

## Decision

**RETAIN scoped semantic/artifact/native-summary context; KEEP_REMOVED generic ProjectIntelligence injection.** Current preserves every required deterministic context marker while sending 3293 bytes versus pre-reset 4307 bytes. Pre-reset injected four objective-irrelevant same-file project-memory records; current sends none, a 23.54% handoff reduction on this exact fixture.

No provider/model inference or monetary cost occurred.
