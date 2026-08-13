# opencode-supermemory

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `supermemoryai/opencode-supermemory`
- Reference action: IDEA_ONLY

## Source surfaces inspected

- source/service inventory including `capture.ts`, `recall.ts`, `context.ts`, `entity-context.ts`, `compaction.ts`, `privacy.ts`, `result-merge.ts`, tests.

## Verified source facts

- Memory lifecycle is split into capture, recall, context/entity-context and compaction services.
- Privacy logic is a first-class service rather than an incidental prompt convention.
- Capture/recall and compaction have independent tests/services.

## Useful engineering patterns

- Memory is not one blob: capture, retrieval, compaction and privacy are separate owners.
- Optional memory should integrate at bounded context/compaction boundaries rather than become mission truth.

## Foreign / accidental semantics to reject

- Hi must not make remote semantic memory mandatory.
- Recalled memory is a hint/context source, never proof and never authority.
- Do not persist provider/private routing data merely because a memory service can store arbitrary text.

## Hi mapping

- Future optional memory adapter belongs below Context/Project Intelligence, with explicit provenance/freshness/privacy.
- Completion and Evidence must remain independent of recalled memory.
