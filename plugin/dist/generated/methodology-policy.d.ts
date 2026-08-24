export declare const HI_METHODOLOGY_SIGNAL_CATALOG: {
    readonly "architecture.contract-ambiguity": {
        readonly producers: readonly ["architecture"];
        readonly trigger_source: "contract-ambiguity";
    };
    readonly "architecture.dependency-structure": {
        readonly producers: readonly ["architecture"];
        readonly trigger_source: "dependency-structure";
    };
    readonly "context.iterative-gap": {
        readonly producers: readonly ["context"];
        readonly trigger_source: "context-gap";
    };
    readonly "context.scope-gap": {
        readonly producers: readonly ["context"];
        readonly trigger_source: "context-gap";
    };
    readonly "failure.ci-build": {
        readonly producers: readonly ["runtime-failure"];
        readonly trigger_source: "failure-signal";
    };
    readonly "failure.unknown-root-cause": {
        readonly producers: readonly ["runtime-failure"];
        readonly trigger_source: "failure-signal";
    };
    readonly "intent.accessibility": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.adversarial": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.api-contract-review": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.api-design": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.architecture-decision": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "design-decision";
    };
    readonly "intent.browser": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.ci-failure": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "failure-signal";
    };
    readonly "intent.code-review": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.database-migration": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.debugging": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "failure-signal";
    };
    readonly "intent.dependency-change": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.design-discovery": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.documentation": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.external-source": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "external-source-need";
    };
    readonly "intent.methodology-authoring": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.performance": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "performance-signal";
    };
    readonly "intent.planning": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "dependency-structure";
    };
    readonly "intent.refactor": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.regression-review": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.release": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "release-boundary";
    };
    readonly "intent.review-feedback": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "human-feedback";
    };
    readonly "intent.scope-unknown": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.security-review": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.tdd": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "intent.test-strategy": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "verification-need";
    };
    readonly "intent.visual-qa": {
        readonly producers: readonly ["intent"];
        readonly trigger_source: "task-intent";
    };
    readonly "project.methodology-gap": {
        readonly producers: readonly ["project-intelligence"];
        readonly trigger_source: "project-learning";
    };
    readonly "release.boundary": {
        readonly producers: readonly ["release"];
        readonly trigger_source: "release-boundary";
    };
    readonly "risk.security": {
        readonly producers: readonly ["risk"];
        readonly trigger_source: "risk-escalation";
    };
    readonly "surface.contract": {
        readonly producers: readonly ["changed-surface"];
        readonly trigger_source: "changed-surface";
    };
    readonly "surface.dependency": {
        readonly producers: readonly ["changed-surface"];
        readonly trigger_source: "changed-surface";
    };
    readonly "surface.migration": {
        readonly producers: readonly ["changed-surface"];
        readonly trigger_source: "changed-surface";
    };
    readonly "surface.security": {
        readonly producers: readonly ["changed-surface"];
        readonly trigger_source: "changed-surface";
    };
    readonly "surface.ui-markup": {
        readonly producers: readonly ["changed-surface"];
        readonly trigger_source: "changed-surface";
    };
    readonly "surface.ui-visual": {
        readonly producers: readonly ["changed-surface"];
        readonly trigger_source: "changed-surface";
    };
    readonly "verification.regression": {
        readonly producers: readonly ["verification"];
        readonly trigger_source: "verification-need";
    };
    readonly "verification.review": {
        readonly producers: readonly ["verification"];
        readonly trigger_source: "verification-need";
    };
    readonly "verification.strategy": {
        readonly producers: readonly ["verification"];
        readonly trigger_source: "verification-need";
    };
    readonly "verification.visual": {
        readonly producers: readonly ["verification"];
        readonly trigger_source: "verification-need";
    };
};
export type HiMethodologySignalName = keyof typeof HI_METHODOLOGY_SIGNAL_CATALOG;
export declare const HI_METHODOLOGY_TRIGGER_SOURCES: readonly ["failure-signal", "task-intent", "performance-signal", "release-boundary", "verification-need", "dependency-structure", "design-decision", "external-source-need", "human-feedback", "changed-surface", "context-gap", "risk-escalation", "contract-ambiguity", "project-learning"];
export type HiMethodologyTriggerSource = typeof HI_METHODOLOGY_TRIGGER_SOURCES[number];
export declare const HI_METHODOLOGY_PRODUCERS: readonly ["intent", "changed-surface", "verification", "runtime-failure", "context", "release", "risk", "architecture", "project-intelligence"];
export type HiMethodologyProducer = typeof HI_METHODOLOGY_PRODUCERS[number];
export declare const HI_METHODOLOGY_LIMITS: {
    readonly defaultActive: 0;
    readonly typicalMax: 1;
    readonly hardMax: 3;
};
export declare const HI_METHODOLOGY_EXIT_REQUIREMENT_CATALOG: {
    readonly "accessibility-evidence": {
        readonly owner: "evidence";
        readonly scope: "worker";
    };
    readonly "browser-evidence": {
        readonly owner: "evidence";
        readonly scope: "worker";
    };
    readonly "context-resolved": {
        readonly owner: "context";
        readonly scope: "worker";
    };
    readonly "decision-evidence": {
        readonly owner: "evidence";
        readonly scope: "worker";
    };
    readonly "diagnostic-evidence": {
        readonly owner: "evidence";
        readonly scope: "worker";
    };
    readonly "fresh-verification": {
        readonly owner: "verification";
        readonly scope: "mission";
    };
    readonly "measurement-evidence": {
        readonly owner: "evidence";
        readonly scope: "worker";
    };
    readonly "methodology-admission": {
        readonly owner: "project-intelligence";
        readonly scope: "mission";
    };
    readonly "no-open-issues": {
        readonly owner: "worker-result";
        readonly scope: "worker";
    };
    readonly "release-evidence": {
        readonly owner: "release-chain";
        readonly scope: "mission";
    };
    readonly "review-evidence": {
        readonly owner: "review";
        readonly scope: "mission";
    };
    readonly "source-provenance-evidence": {
        readonly owner: "evidence";
        readonly scope: "worker";
    };
    readonly "targeted-test-evidence": {
        readonly owner: "evidence";
        readonly scope: "worker";
    };
    readonly "task-success": {
        readonly owner: "worker-result";
        readonly scope: "worker";
    };
    readonly "visual-evidence": {
        readonly owner: "evidence";
        readonly scope: "worker";
    };
};
export declare const HI_METHODOLOGY_EXIT_REQUIREMENTS: readonly ["task-success", "no-open-issues", "context-resolved", "decision-evidence", "diagnostic-evidence", "measurement-evidence", "browser-evidence", "visual-evidence", "accessibility-evidence", "source-provenance-evidence", "targeted-test-evidence", "fresh-verification", "review-evidence", "release-evidence", "methodology-admission"];
export type HiMethodologyExitRequirement = typeof HI_METHODOLOGY_EXIT_REQUIREMENTS[number];
export declare const HI_METHODOLOGY_POLICY: readonly [{
    readonly activationSignals: readonly ["intent.accessibility", "surface.ui-markup"];
    readonly compatibleRoles: readonly ["visual-qa"];
    readonly compositionCost: "low";
    readonly conflicts: readonly [];
    readonly contextCost: "low";
    readonly doNotTrigger: "No user-facing UI surface changed.";
    readonly executionCost: "low";
    readonly exitCondition: "Accessibility risks are checked and actionable findings are resolved or recorded.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "accessibility-evidence"];
    readonly name: "hi-accessibility-review";
    readonly preferredRoles: readonly ["visual-qa"];
    readonly priority: "normal";
    readonly purpose: "Check user-interface changes for material accessibility regressions.";
    readonly resourceRequirements: readonly ["runtime-capability:browser-execution"];
    readonly trigger: "UI behavior or markup changed and accessibility can be affected.";
    readonly triggerSources: readonly ["task-intent", "changed-surface"];
    readonly usefulCoexistence: readonly ["hi-visual-qa"];
    readonly weight: 0.6;
}, {
    readonly activationSignals: readonly ["intent.adversarial"];
    readonly compatibleRoles: readonly ["qa-reviewer", "security-reviewer", "architect", "coder"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "Mechanical or low-risk work with direct evidence.";
    readonly executionCost: "medium";
    readonly exitCondition: "Material assumptions are challenged and findings are reconciled without an open blocking issue.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "review-evidence"];
    readonly name: "hi-adversarial-validation";
    readonly preferredRoles: readonly ["qa-reviewer"];
    readonly priority: "low";
    readonly purpose: "Run a bounded disproof-oriented challenge for high-stakes claims or decisions.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "Critical, security-sensitive, irreversible, or cross-boundary claim needs independent challenge.";
    readonly triggerSources: readonly ["task-intent"];
    readonly usefulCoexistence: readonly ["hi-security-review", "hi-code-review"];
    readonly weight: 0.35;
}, {
    readonly activationSignals: readonly ["intent.api-contract-review", "surface.contract"];
    readonly compatibleRoles: readonly ["qa-reviewer", "coder"];
    readonly compositionCost: "low";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "No externally or cross-module observable contract changed.";
    readonly executionCost: "medium";
    readonly exitCondition: "Consumers, errors, compatibility, serialization, and contract tests are reconciled.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "review-evidence"];
    readonly name: "hi-api-contract-review";
    readonly preferredRoles: readonly ["qa-reviewer"];
    readonly priority: "normal";
    readonly purpose: "Review changed APIs, events, schemas, and compatibility contracts.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "An implemented contract boundary changed.";
    readonly triggerSources: readonly ["task-intent", "changed-surface"];
    readonly usefulCoexistence: readonly ["hi-api-interface-design"];
    readonly weight: 0.6;
}, {
    readonly activationSignals: readonly ["intent.api-design", "architecture.contract-ambiguity"];
    readonly compatibleRoles: readonly ["architect", "coder"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "Pure implementation detail with no boundary consequence.";
    readonly executionCost: "medium";
    readonly exitCondition: "Inputs, outputs, errors, side effects, compatibility, and acceptance tests are explicit.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "decision-evidence"];
    readonly name: "hi-api-interface-design";
    readonly preferredRoles: readonly ["architect"];
    readonly priority: "normal";
    readonly purpose: "Design a stable interface from consumer requirements and compatibility constraints.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "A public/internal API, event, schema, command, or durable boundary is being created or materially changed.";
    readonly triggerSources: readonly ["task-intent", "contract-ambiguity"];
    readonly usefulCoexistence: readonly ["hi-api-contract-review", "hi-architecture-decisions"];
    readonly weight: 0.6;
}, {
    readonly activationSignals: readonly ["intent.architecture-decision"];
    readonly compatibleRoles: readonly ["architect"];
    readonly compositionCost: "low";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "Local/reversible implementation choice does not need durable rationale.";
    readonly executionCost: "low";
    readonly exitCondition: "Decision, credible alternatives, consequences, and evidence are recorded in the project convention.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "decision-evidence"];
    readonly name: "hi-architecture-decisions";
    readonly preferredRoles: readonly ["architect"];
    readonly priority: "low";
    readonly purpose: "Record durable architecture choices with evidence and consequences.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "A durable choice has credible alternatives and future maintenance consequences.";
    readonly triggerSources: readonly ["design-decision"];
    readonly usefulCoexistence: readonly ["hi-implementation-planning"];
    readonly weight: 0.35;
}, {
    readonly activationSignals: readonly ["intent.browser"];
    readonly compatibleRoles: readonly ["visual-qa"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "No browser surface is involved or browser tooling is unavailable.";
    readonly executionCost: "medium";
    readonly exitCondition: "Target routes/interactions are exercised and relevant console/network/visual evidence is captured.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "browser-evidence"];
    readonly name: "hi-browser-testing";
    readonly preferredRoles: readonly ["visual-qa"];
    readonly priority: "normal";
    readonly purpose: "Perform targeted browser validation using an authorized browser capability.";
    readonly resourceRequirements: readonly ["runtime-capability:browser-execution"];
    readonly trigger: "Changed behavior requires real browser interaction or rendering evidence.";
    readonly triggerSources: readonly ["task-intent"];
    readonly usefulCoexistence: readonly ["hi-visual-qa", "hi-accessibility-review"];
    readonly weight: 0.6;
}, {
    readonly activationSignals: readonly ["intent.documentation", "release.boundary"];
    readonly compatibleRoles: readonly ["working-manager", "coder"];
    readonly compositionCost: "low";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "Internal refactor/cosmetic rename with no user-visible effect.";
    readonly executionCost: "low";
    readonly exitCondition: "Canonical English documentation matches implemented behavior and translation does not add behavior.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues"];
    readonly name: "hi-changelog-and-documentation";
    readonly preferredRoles: readonly ["working-manager"];
    readonly priority: "low";
    readonly purpose: "Update user-facing documentation for observable behavior changes.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "A verified change affects users, installation, configuration, API, security, or supported behavior, or documentation/changelog alignment is explicitly requested.";
    readonly triggerSources: readonly ["task-intent", "release-boundary"];
    readonly usefulCoexistence: readonly ["hi-release-guardrails"];
    readonly weight: 0.35;
}, {
    readonly activationSignals: readonly ["intent.ci-failure", "failure.ci-build"];
    readonly compatibleRoles: readonly ["coder"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "No build/CI failure exists.";
    readonly executionCost: "medium";
    readonly exitCondition: "Failure class and root cause are identified, repaired when authorized, and the affected pipeline evidence is green or externally blocked.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "fresh-verification"];
    readonly name: "hi-ci-build-recovery";
    readonly preferredRoles: readonly ["coder"];
    readonly priority: "normal";
    readonly purpose: "Isolate the first real CI/build failure and repair its root cause.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "Build or CI fails or differs materially from local execution.";
    readonly triggerSources: readonly ["failure-signal"];
    readonly usefulCoexistence: readonly ["hi-debugging-root-cause", "hi-test-strategy"];
    readonly weight: 0.6;
}, {
    readonly activationSignals: readonly ["intent.code-review", "verification.review"];
    readonly compatibleRoles: readonly ["qa-reviewer", "security-reviewer"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "Tiny mechanical low-risk edits with direct targeted verification.";
    readonly executionCost: "medium";
    readonly exitCondition: "Actionable findings are resolved/rejected with evidence and scoped re-review closes prior findings.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "review-evidence"];
    readonly name: "hi-code-review";
    readonly preferredRoles: readonly ["qa-reviewer"];
    readonly priority: "low";
    readonly purpose: "Independently review meaningful diffs against intent, behavior, risk, and tests.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "A non-trivial code diff merits independent review.";
    readonly triggerSources: readonly ["task-intent", "verification-need"];
    readonly usefulCoexistence: readonly ["hi-regression-review", "hi-security-review"];
    readonly weight: 0.35;
}, {
    readonly activationSignals: readonly ["intent.database-migration", "surface.migration"];
    readonly compatibleRoles: readonly ["coder"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "high";
    readonly doNotTrigger: "No persistent schema/data transition.";
    readonly executionCost: "high";
    readonly exitCondition: "Ordering, compatibility, rollback, locking/volume risk, and migration evidence are sufficient.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "fresh-verification"];
    readonly name: "hi-database-migration";
    readonly preferredRoles: readonly ["coder"];
    readonly priority: "normal";
    readonly purpose: "Plan and validate safe schema/data migrations and transitional compatibility.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "Schema, migration, backfill, or persistent data compatibility changes.";
    readonly triggerSources: readonly ["task-intent", "changed-surface"];
    readonly usefulCoexistence: readonly ["hi-test-strategy", "hi-architecture-decisions"];
    readonly weight: 0.6;
}, {
    readonly activationSignals: readonly ["intent.debugging", "failure.unknown-root-cause"];
    readonly compatibleRoles: readonly ["coder"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "Cause is already direct and proven by local evidence.";
    readonly executionCost: "medium";
    readonly exitCondition: "Root cause is demonstrated or a precise external blocker is established; retries are materially different.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "diagnostic-evidence"];
    readonly name: "hi-debugging-root-cause";
    readonly preferredRoles: readonly ["coder"];
    readonly priority: "high";
    readonly purpose: "Turn a symptom into evidence-backed root cause through discriminating experiments.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "Failure cause is uncertain, repeated, or crosses boundaries.";
    readonly triggerSources: readonly ["failure-signal"];
    readonly usefulCoexistence: readonly ["hi-iterative-retrieval", "hi-ci-build-recovery"];
    readonly weight: 0.9;
}, {
    readonly activationSignals: readonly ["intent.dependency-change", "surface.dependency"];
    readonly compatibleRoles: readonly ["coder", "security-reviewer"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "No dependency surface changes.";
    readonly executionCost: "medium";
    readonly exitCondition: "Need, version/lock impact, compatibility, and appropriate verification are established.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "fresh-verification"];
    readonly name: "hi-dependency-change";
    readonly preferredRoles: readonly ["coder"];
    readonly priority: "normal";
    readonly purpose: "Evaluate and verify dependency/lockfile changes for necessity, compatibility, and security.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "A dependency or lockfile must be added, removed, or upgraded.";
    readonly triggerSources: readonly ["task-intent", "changed-surface"];
    readonly usefulCoexistence: readonly ["hi-security-review", "hi-test-strategy"];
    readonly weight: 0.6;
}, {
    readonly activationSignals: readonly ["intent.design-discovery", "architecture.contract-ambiguity"];
    readonly compatibleRoles: readonly ["architect", "visual-qa"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "Clear, low-risk, reversible implementation path exists.";
    readonly executionCost: "medium";
    readonly exitCondition: "Material ambiguity is resolved into explicit constraints without unnecessary approval ceremony.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "decision-evidence"];
    readonly name: "hi-design-discovery";
    readonly preferredRoles: readonly ["architect"];
    readonly priority: "low";
    readonly purpose: "Resolve material product/architecture ambiguity before expensive implementation.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "Multiple materially different designs remain after repository evidence is considered.";
    readonly triggerSources: readonly ["task-intent", "contract-ambiguity"];
    readonly usefulCoexistence: readonly ["hi-architecture-decisions", "hi-implementation-planning"];
    readonly weight: 0.35;
}, {
    readonly activationSignals: readonly ["intent.planning", "architecture.dependency-structure"];
    readonly compatibleRoles: readonly ["architect", "coder"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "Clear local task can be executed directly.";
    readonly executionCost: "low";
    readonly exitCondition: "Dependencies, ordered changes, acceptance, verification, and rollback needs are explicit enough to execute.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "decision-evidence"];
    readonly name: "hi-implementation-planning";
    readonly preferredRoles: readonly ["architect"];
    readonly priority: "low";
    readonly purpose: "Create the minimum dependency-oriented plan required for coordinated changes.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "Cross-module sequencing, migration, rollback, or coupled acceptance requires coordination.";
    readonly triggerSources: readonly ["dependency-structure"];
    readonly usefulCoexistence: readonly ["hi-architecture-decisions", "hi-test-strategy"];
    readonly weight: 0.35;
}, {
    readonly activationSignals: readonly ["context.iterative-gap"];
    readonly compatibleRoles: readonly ["repository-explorer", "architect"];
    readonly compositionCost: "low";
    readonly conflicts: readonly [];
    readonly contextCost: "low";
    readonly doNotTrigger: "Required context is already known and fresh.";
    readonly executionCost: "low";
    readonly exitCondition: "Task can execute or blocker is precise without further context expansion.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "context-resolved"];
    readonly name: "hi-iterative-retrieval";
    readonly preferredRoles: readonly ["repository-explorer"];
    readonly priority: "high";
    readonly purpose: "Grow repository context only when current evidence creates a concrete information need.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "Relevant symbols/paths are not known and bounded retrieval can reduce uncertainty.";
    readonly triggerSources: readonly ["context-gap"];
    readonly usefulCoexistence: readonly ["hi-repository-analysis"];
    readonly weight: 0.9;
}, {
    readonly activationSignals: readonly ["intent.performance"];
    readonly compatibleRoles: readonly ["qa-reviewer", "coder"];
    readonly compositionCost: "low";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "No measurable performance concern exists.";
    readonly executionCost: "high";
    readonly exitCondition: "Relevant baseline and after measurements support the conclusion without correctness regression.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "measurement-evidence"];
    readonly name: "hi-performance-analysis";
    readonly preferredRoles: readonly ["qa-reviewer"];
    readonly priority: "normal";
    readonly purpose: "Analyze measurable performance behavior and compare changes on the same workload.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "There is a performance target/regression or hot-path claim requiring evidence.";
    readonly triggerSources: readonly ["performance-signal"];
    readonly usefulCoexistence: readonly ["hi-test-strategy"];
    readonly weight: 0.6;
}, {
    readonly activationSignals: readonly ["intent.regression-review", "verification.regression"];
    readonly compatibleRoles: readonly ["qa-reviewer"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "Change is isolated with no dependent behavior.";
    readonly executionCost: "medium";
    readonly exitCondition: "Likely regressions are covered by existing or targeted tests; scope does not expand speculatively.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "review-evidence"];
    readonly name: "hi-regression-review";
    readonly preferredRoles: readonly ["qa-reviewer"];
    readonly priority: "normal";
    readonly purpose: "Check likely neighboring behavior affected by a changed contract or shared component.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "A change can plausibly affect existing consumers/shared behavior, or regression-focused review is explicitly requested.";
    readonly triggerSources: readonly ["task-intent", "verification-need"];
    readonly usefulCoexistence: readonly ["hi-code-review", "hi-test-strategy"];
    readonly weight: 0.6;
}, {
    readonly activationSignals: readonly ["intent.release", "release.boundary"];
    readonly compatibleRoles: readonly ["working-manager", "manager"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "high";
    readonly doNotTrigger: "Ordinary development not approaching a release boundary.";
    readonly executionCost: "high";
    readonly exitCondition: "Candidate evidence is exact-bound and external publication remains explicitly authorized.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "release-evidence"];
    readonly name: "hi-release-guardrails";
    readonly preferredRoles: readonly ["working-manager"];
    readonly priority: "normal";
    readonly purpose: "Verify release metadata, package integrity, evidence, and authority boundaries.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "A release candidate, package, tag, publish, or distribution step is being prepared.";
    readonly triggerSources: readonly ["release-boundary"];
    readonly usefulCoexistence: readonly ["hi-changelog-and-documentation", "hi-security-review"];
    readonly weight: 0.6;
}, {
    readonly activationSignals: readonly ["intent.scope-unknown", "context.scope-gap"];
    readonly compatibleRoles: readonly ["repository-explorer", "architect"];
    readonly compositionCost: "low";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "Known local scope already has fresh evidence.";
    readonly executionCost: "low";
    readonly exitCondition: "Relevant ownership and affected surface are known with remaining uncertainty explicit.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "context-resolved"];
    readonly name: "hi-repository-analysis";
    readonly preferredRoles: readonly ["repository-explorer"];
    readonly priority: "high";
    readonly purpose: "Map the minimum relevant files, symbols, dependencies, tests, and configuration.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "Task scope or ownership is unclear enough that repository inspection will change execution.";
    readonly triggerSources: readonly ["task-intent", "context-gap"];
    readonly usefulCoexistence: readonly ["hi-iterative-retrieval"];
    readonly weight: 0.9;
}, {
    readonly activationSignals: readonly ["intent.review-feedback"];
    readonly compatibleRoles: readonly ["coder", "qa-reviewer", "security-reviewer"];
    readonly compositionCost: "low";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "No external review findings need reconciliation.";
    readonly executionCost: "medium";
    readonly exitCondition: "Each finding is classified and actionable ones are fixed and scoped-verified.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "fresh-verification"];
    readonly name: "hi-review-feedback";
    readonly preferredRoles: readonly ["coder"];
    readonly priority: "normal";
    readonly purpose: "Validate review findings against current code and apply only evidence-backed corrections.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "Review/QA/security feedback proposes changes.";
    readonly triggerSources: readonly ["human-feedback"];
    readonly usefulCoexistence: readonly ["hi-code-review"];
    readonly weight: 0.6;
}, {
    readonly activationSignals: readonly ["intent.refactor"];
    readonly compatibleRoles: readonly ["coder", "working-manager"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "Behavior change is the primary task and no structural refactor is required.";
    readonly executionCost: "medium";
    readonly exitCondition: "Pre/post behavior evidence is equivalent and public contracts remain stable unless explicitly changed.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "fresh-verification"];
    readonly name: "hi-safe-refactoring";
    readonly preferredRoles: readonly ["coder"];
    readonly priority: "normal";
    readonly purpose: "Preserve behavior while making bounded structural changes.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "Refactor is explicitly requested or needed to enable a required change.";
    readonly triggerSources: readonly ["task-intent"];
    readonly usefulCoexistence: readonly ["hi-regression-review", "hi-test-strategy"];
    readonly weight: 0.6;
}, {
    readonly activationSignals: readonly ["intent.security-review", "surface.security", "risk.security"];
    readonly compatibleRoles: readonly ["security-reviewer"];
    readonly compositionCost: "low";
    readonly conflicts: readonly [];
    readonly contextCost: "high";
    readonly doNotTrigger: "No material security surface changed.";
    readonly executionCost: "high";
    readonly exitCondition: "Material threats are addressed or explicitly accepted with evidence; secrets are not exposed.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "review-evidence"];
    readonly name: "hi-security-review";
    readonly preferredRoles: readonly ["security-reviewer"];
    readonly priority: "normal";
    readonly purpose: "Review authority, secrets, trust boundaries, input handling, and attack surface proportionally.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "Security-sensitive code, permissions, credentials, external actions, or trust boundaries changed.";
    readonly triggerSources: readonly ["task-intent", "changed-surface", "risk-escalation"];
    readonly usefulCoexistence: readonly ["hi-adversarial-validation"];
    readonly weight: 0.6;
}, {
    readonly activationSignals: readonly ["intent.methodology-authoring", "project.methodology-gap"];
    readonly compatibleRoles: readonly ["coder"];
    readonly compositionCost: "low";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "One-off facts/evidence, project knowledge, control-plane policy, or an existing methodology already covers the need.";
    readonly executionCost: "medium";
    readonly exitCondition: "Methodology contract, role compatibility, admission policy, provenance, resources, and validation are coherent and non-duplicative.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "methodology-admission"];
    readonly name: "hi-methodology-authoring";
    readonly preferredRoles: readonly ["coder"];
    readonly priority: "low";
    readonly purpose: "Create or evolve reusable Hi methodologies from explicit demand or repeated project evidence.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "A reusable way of working is explicitly requested or repeated project evidence shows a methodology gap.";
    readonly triggerSources: readonly ["task-intent", "project-learning"];
    readonly usefulCoexistence: readonly ["hi-source-driven-development"];
    readonly weight: 0.35;
}, {
    readonly activationSignals: readonly ["intent.external-source"];
    readonly compatibleRoles: readonly ["repository-explorer", "architect", "coder"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "Task is fully internal and no external implementation evidence is relevant.";
    readonly executionCost: "medium";
    readonly exitCondition: "Source, license, primitive, ownership, reuse action, and test strategy are recorded before reuse.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "source-provenance-evidence"];
    readonly name: "hi-source-driven-development";
    readonly preferredRoles: readonly ["repository-explorer"];
    readonly priority: "high";
    readonly purpose: "Inspect authoritative source before adapting an external implementation or methodology.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "External repository/specification/implementation is material to the requested change.";
    readonly triggerSources: readonly ["external-source-need"];
    readonly usefulCoexistence: readonly ["hi-repository-analysis", "hi-security-review"];
    readonly weight: 0.9;
}, {
    readonly activationSignals: readonly ["intent.tdd"];
    readonly compatibleRoles: readonly ["coder"];
    readonly compositionCost: "low";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "Pure documentation, exploratory diagnosis, or test-first cost exceeds value.";
    readonly executionCost: "medium";
    readonly exitCondition: "Behavior is implemented with focused tests and no unnecessary test ceremony.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "targeted-test-evidence"];
    readonly name: "hi-test-driven-development";
    readonly preferredRoles: readonly ["coder"];
    readonly priority: "normal";
    readonly purpose: "Use a failing test first when behavior can be specified economically before implementation.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "New/changed behavior benefits from executable specification and a tight red-green-refactor loop.";
    readonly triggerSources: readonly ["task-intent"];
    readonly usefulCoexistence: readonly ["hi-test-strategy"];
    readonly weight: 0.6;
}, {
    readonly activationSignals: readonly ["intent.test-strategy", "verification.strategy"];
    readonly compatibleRoles: readonly ["qa-reviewer", "working-manager", "coder"];
    readonly compositionCost: "low";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "No behavior changed or verification policy is already explicit and fresh.";
    readonly executionCost: "medium";
    readonly exitCondition: "Required targeted/dependency/integration evidence is defined and executed without verification spiral.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "fresh-verification"];
    readonly name: "hi-test-strategy";
    readonly preferredRoles: readonly ["qa-reviewer"];
    readonly priority: "high";
    readonly purpose: "Choose risk-proportional verification at the narrowest sufficient boundaries.";
    readonly resourceRequirements: readonly [];
    readonly trigger: "Implementation changes require deciding what evidence is sufficient.";
    readonly triggerSources: readonly ["verification-need"];
    readonly usefulCoexistence: readonly ["hi-regression-review"];
    readonly weight: 0.9;
}, {
    readonly activationSignals: readonly ["intent.visual-qa", "surface.ui-visual", "verification.visual"];
    readonly compatibleRoles: readonly ["visual-qa"];
    readonly compositionCost: "medium";
    readonly conflicts: readonly [];
    readonly contextCost: "medium";
    readonly doNotTrigger: "No visual surface changed.";
    readonly executionCost: "medium";
    readonly exitCondition: "Relevant viewports/states are checked and visual defects are resolved or recorded.";
    readonly exitRequirements: readonly ["task-success", "no-open-issues", "visual-evidence"];
    readonly name: "hi-visual-qa";
    readonly preferredRoles: readonly ["visual-qa"];
    readonly priority: "normal";
    readonly purpose: "Validate changed visual output for layout, clipping, state, and responsive regressions.";
    readonly resourceRequirements: readonly ["runtime-capability:browser-execution"];
    readonly trigger: "Visual UI rendering/styling changed materially, or visual QA is explicitly requested.";
    readonly triggerSources: readonly ["task-intent", "changed-surface", "verification-need"];
    readonly usefulCoexistence: readonly ["hi-browser-testing", "hi-accessibility-review"];
    readonly weight: 0.6;
}];
export type HiMethodologyName = typeof HI_METHODOLOGY_POLICY[number]['name'];
