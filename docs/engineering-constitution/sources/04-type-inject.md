# opencode-type-inject

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `kziemski/opencode-type-inject`
- Reference action: CLEAN_ROOM
- Reuse boundary: source structure/algorithm is reference; Hi semantic extraction remains independently implemented.

## Source surfaces inspected

- `.opencode/plugin/type-inject.ts`
- `.opencode/type-inject.config.ts` inventory
- tests and extraction support-library inventory.

## Verified source facts

- The plugin separates extractor, formatter, lookup and prioritizer responsibilities.
- It provides bounded type lookup/list tools and augments TypeScript read output after the native read tool.
- Type extraction is prioritized against a token budget; barrel files can be skipped.
- Read call identity is tracked between `tool.execute.before` and `tool.execute.after`.

## Useful engineering patterns

- Language-specific extraction should live behind a narrow extractor contract.
- Semantic enrichment needs an explicit token budget and prioritization step.
- Lookup and automatic injection are separate consumer modes.
- Hook correlation should use call identity instead of assuming global ordering.

## Foreign / accidental semantics to reject

- TypeScript-specific kinds must not enter Hi Core ontology.
- Automatic injection into every read is not automatically appropriate for Hi; task-scoped minimum-sufficient context remains the owner.

## Hi mapping

- Current Semantic Context is correctly file/task scoped; future `SemanticContextExtractor` contract should expose language, source hash, symbols/relationships, budget and freshness.
- Language adapters may implement TS/TSX extraction without making TS a Core assumption.
