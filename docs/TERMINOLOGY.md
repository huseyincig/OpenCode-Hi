# Terminology and Naming Audit

OpenCode-Hi 0.1.0 performs a terminology audit before final architecture freeze. The goal is clarity, technical accuracy, concise developer-facing naming, and removal of legacy HHC/OHO branding without creating cosmetic churn.

## Decisions

| Surface | Existing / inherited term | Decision | Canonical term | Rationale |
|---|---|---:|---|---|
| Product | OpenCode-Hi | KEEP | OpenCode-Hi | Canonical product identity. |
| Package | opencode-hi | KEEP | opencode-hi | Concise npm/plugin identity. |
| Private runtime workspace | opencode-hi-runtime | KEEP | opencode-hi-runtime | Internal package is private and technically descriptive. |
| Methodology namespace / OpenCode skill name | hhc-* | RENAME | hi-* | Legacy public brand removed; 27 built-in Hi methodologies use `hi-*`, while OpenCode native `skill` is only their primary-host lazy-loading primitive. |
| Tool namespace | hhc_* | RENAME | hi_* | Model-facing tools are consistently namespaced and do not shadow OpenCode-native tools. |
| Config policy | autonomy | REMOVE | executionPolicy | OpenCode-Hi does not support former-product config aliases. |
| Config values | basic / standard / powerful / smart / manual | RENAME | minimal / balanced / thorough / adaptive / manual | Removes vague/marketing terms and states execution intent directly. |
| Profile keys | basic / standard / powerful | REMOVE | minimal / balanced / thorough | Former-product profile keys are not interpreted by OpenCode-Hi. |
| CLI option | --autonomy | REMOVE | --execution-policy | Former-product CLI aliases are not accepted. |
| CLI lifecycle | plan / install / doctor / reconfigure / uninstall | KEEP | same | Familiar developer-tool conventions. |
| Mission | Mission / MissionState / MissionStore | KEEP | same | Mission is the user outcome contract; state/store names are precise. |
| Obligation | Obligation | KEEP | same | Precise representation of required unfinished work. |
| Task | MissionTask / TaskStatus | KEEP | same | Bounded executable work unit. |
| Worker | WorkerState / worker | KEEP | same | Runtime execution instance, deliberately distinct from role, agent template, and model. |
| Role | architect / coder / repository-explorer / qa-reviewer / security-reviewer / visual-qa | KEEP | same | Clear specialist responsibilities. |
| Primary role | working-manager | KEEP | working-manager | Distinguishes a write-capable primary from the read-only coordinating manager; rename would add churn without clearer semantics. |
| Primary role | manager | KEEP | manager | Familiar coordinating role name. |
| Team | Team Mode / hi_team_* | KEEP | same | Familiar developer concept; bounded multi-agent execution, not a separate control plane. |
| Public continuation concept | Autopilot | PUBLIC_ALIAS | Autopilot | Useful public shorthand for automatic continuation. It is not used as the internal implementation owner. |
| Internal continuation owner | runtime/autopilot/evaluator | RENAME | runtime/continuation/evaluator | Internal API now describes the actual responsibility: evaluate the next continuation decision. |
| Internal recovery | runtime/autopilot/recovery | RENAME | runtime/continuation/recovery | Recovery belongs to continuation control, not a branded subsystem. |
| Completion owner | adjudicateCompletion / completion/adjudicator | RENAME | evaluateCompletion / completion/evaluator | "Evaluator" is simpler and technically exact; authority adjudication remains a separate concern. |
| Telemetry | autopilot_recovery_* | RENAME | continuation_recovery_* | Metrics now match the internal owner. |
| Completion terminal | STOP | KEEP | STOP | Explicit authoritative terminal control-plane decision. |
| Human gate | USER_ACTION_REQUIRED | KEEP | USER_ACTION_REQUIRED | Machine-readable and unambiguous. |
| Execution paths | DIRECT / EVIDENCE / PLANNED / ESCALATED | KEEP | same | Precise control-plane paths. |
| Topology | single-agent / multi-agent | KEEP | same | Directly describes runtime topology. |
| Lifecycle | continuation | KEEP | continuation | Precise term for resuming an open mission. |
| Diagnostics | doctor | KEEP | doctor | Established developer-tool convention. |
| Legacy HHC / OHO names | HHC, OHO, old package/repo identifiers | REMOVE | none on living product surfaces | Allowed only for exact provenance, attribution, license obligations, or immutable historical receipts. |

## Public vs. Internal Boundary

Public documentation may say **Autopilot** to describe automatic continuation behavior. Internal source uses **Continuation Evaluator**, **Continuation Dispatcher**, and **Continuation Recovery**. OpenCode-Hi does not accept former-product config or CLI aliases. Canonical state, CLI output, docs, schemas, and telemetry use only OpenCode-Hi terminology.

Legacy compatibility mappings are intentionally absent. Source ancestry is recorded separately in provenance and does not create runtime compatibility.

## No Legacy Compatibility

OpenCode-Hi does not normalize former-product configuration. `autonomy`, `--autonomy`, `basic`, `powerful`, `smart`, `smart-select`, and `smartSelectRoles` are not supported inputs. Historical occurrences may exist only in provenance, attribution, license records, immutable receipts, or negative tests that prove rejection.

## Audit Rule

A rename is accepted only when it improves technical clarity, removes legacy branding, or prevents conceptual confusion. Familiar names such as `doctor`, `MissionState`, `WorkerState`, `Team Mode`, and `STOP` remain unchanged because renaming them would create churn without a material usability or architecture benefit.
