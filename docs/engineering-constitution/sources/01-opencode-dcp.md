# opencode-dynamic-context-pruning

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `Opencode-DCP/opencode-dynamic-context-pruning`
- Reference action: CLEAN_ROOM
- Reuse boundary: AGPL source is architectural reference only; do not copy implementation into distributed Hi source.

## Source surfaces inspected

- `dcp.schema.json`
- `lib/strategies/deduplication.ts`
- strategy/compress file inventory and tests surfaced by repository search.

## Verified source facts

- Configuration is explicitly schema-bound with `additionalProperties: false` across nested sections.
- Context policies distinguish protected tools/files, manual-vs-automatic behavior, turn protection, model-specific limits, and compression thresholds.
- Deduplication is structural: tool name + normalized/sorted parameters form a signature; older equivalent calls are pruned while the newest is retained.
- Protected tool/file patterns bypass pruning.
- State tracks pruning rather than pretending source/session history was deleted.

## Useful engineering patterns

- Context reduction should operate on explicit structural identity, not prose similarity when a deterministic identity exists.
- Protected/compressible policy should be represented in schema and runtime state, not only instructions.
- Model-specific context constraints belong in a capability/config contract, with explicit precedence.
- Tests should include token/context behavior, protected boundaries, and compression grouping.

## Foreign / accidental semantics to reject

- Do not import DCP numeric defaults as universal Hi laws.
- Do not reproduce AGPL implementation.
- Hi should not expose every context strategy as user-facing config unless it has an executable consumer.

## Hi mapping

- `ContextGovernor` / native compaction bridge: structural protection and bounded retention.
- future ContextContract: source identity, priority/protection, budget, consumer, freshness, retention.
- future ConfigOptionContract: every context knob must name its executor effect.

## Open questions

- Whether Hi should add deterministic duplicate tool-output identity beyond current host compaction is deferred until runtime trace evidence shows material savings.
