# opencode-agent-orchestration-kit

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository currently verified as `jcarlosrodicio/opencode-agent-orchestration-kit`.
- Role in constitution: agent/role/workflow/contract reference.

## Source surfaces inspected

- `opencode/opencode.json`
- `opencode/AGENTS.md`
- `opencode/agents/lead.md`
- `developer.md`, `researcher.md`, `specifier.md`, `reviewer.md`, `review_coordinator.md`, `scoper.md`, `debugger.md`
- `opencode/docs/ai/harness/agents.md`
- `opencode/docs/ai/harness/orchestration-contracts.json`
- `opencode/scripts/check-harness.mjs`

## Verified source facts

- Host agent frontmatter carries real mode/permission/delegation configuration.
- Separate machine-readable orchestration contract declares agents, commands, routing rules, retry policies, workflows, barriers, required evidence and completion authority.
- Harness checker validates contract IDs/catalogs and compares agent mode/permission/delegation declarations with frontmatter.
- Agent contracts use structured Task Contract, Result Contract and Verification Envelope conventions.
- General reviewer is final review authority while focused review agents/coordinator remain partial/non-final.
- Role-specific model slots are explicit in OpenCode config.

## Useful engineering patterns

- Canonical portable contract + host projection + mechanical parity validation.
- Completion authority/barriers/retry/evidence should be machine-readable where stable.
- Agent role boundaries should be stronger than persona prose: permissions and delegation graph are executable.
- Long-running handoff state should be compact/durable rather than transcript-dependent.

## Foreign / accidental semantics to reject

- Fixed slash-command workflow catalog and source role names are product-specific and must not define Hi ontology.
- Hi should not duplicate policy across large prompts and separate contracts; prompts should be generated/validated projections where possible.
- Agent count/specialization from the kit is not automatically the minimum-sufficient Hi topology.

## Hi mapping

- Direct evidence for a canonical RoleContract and Workflow/ExecutionPlanContract layer.
- Hi can go further by making prompt/frontmatter/runtime all projections or consumers of one contract rather than validating two hand-maintained truths forever.
