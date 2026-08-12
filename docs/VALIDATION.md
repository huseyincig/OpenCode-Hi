# Verification

Local validation proves source/in-process behavior only. It does not prove an exact Git install or external OpenCode runtime.

Required local gates include TypeScript build, complete Node tests, Python validation tests, source validator, deterministic release build, manifest/SBOM/hash checks, and ownership-aware setup lifecycle tests. External release evidence must bind the exact OpenCode version/platform, exact OpenCode-Hi candidate, effective configuration, native plugin loading, model routing, permission behavior, and clean-consumer installation.

Environment failures are recorded separately from product failures. Mocked behavior is never represented as real external verification.
