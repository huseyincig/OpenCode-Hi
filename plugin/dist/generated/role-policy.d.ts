export declare const HI_ROLE_CONTRACTS: readonly [{
    readonly id: "manager";
    readonly purpose: "Read-only primary coordinator that uses the minimum sufficient team";
    readonly roleClass: "primary";
    readonly useWhen: readonly ["coordination is primary and direct repository mutation should remain delegated"];
    readonly doNotUseWhen: readonly ["clear work is better completed directly by working-manager"];
    readonly readOnly: true;
    readonly reviewer: false;
    readonly repositoryWriteAuthority: "none";
    readonly obligationAuthority: readonly [];
    readonly delegation: {
        readonly mayDelegate: true;
        readonly allowedRoleRefs: readonly ["coder", "architect", "repository-explorer", "researcher", "technical-writer", "test-engineer", "qa-reviewer", "security-reviewer", "visual-qa"];
    };
    readonly permissionProfileRef: "primary-manager";
}, {
    readonly id: "working-manager";
    readonly purpose: "Directly completes small and medium work, delegating only when material";
    readonly roleClass: "primary";
    readonly useWhen: readonly ["clear work can be completed directly with bounded delegation when needed"];
    readonly doNotUseWhen: readonly ["the configured primary policy explicitly requires read-only manager coordination"];
    readonly readOnly: false;
    readonly reviewer: false;
    readonly repositoryWriteAuthority: "scoped";
    readonly obligationAuthority: readonly [];
    readonly delegation: {
        readonly mayDelegate: true;
        readonly allowedRoleRefs: readonly ["coder", "architect", "repository-explorer", "researcher", "technical-writer", "test-engineer", "qa-reviewer", "security-reviewer", "visual-qa"];
    };
    readonly permissionProfileRef: "primary-working-manager";
}, {
    readonly id: "coder";
    readonly purpose: "Implements scoped production changes, refactors, and bug fixes";
    readonly roleClass: "child";
    readonly useWhen: readonly ["scoped implementation, refactor, or bug-fix work requires production repository mutation"];
    readonly doNotUseWhen: readonly ["the task is documentation authoring, test authoring, external research, review-only, exploration-only, or architecture-only"];
    readonly readOnly: false;
    readonly reviewer: false;
    readonly repositoryWriteAuthority: "scoped";
    readonly obligationAuthority: readonly ["implementation", "analysis", "verification"];
    readonly delegation: {
        readonly mayDelegate: false;
        readonly allowedRoleRefs: readonly [];
    };
    readonly permissionProfileRef: "child-coder";
}, {
    readonly id: "architect";
    readonly purpose: "Read-only architecture, contract, and data-model design specialist";
    readonly roleClass: "child";
    readonly useWhen: readonly ["architecture or contract design materially changes a subsystem or durable boundary"];
    readonly doNotUseWhen: readonly ["local implementation can proceed without architecture judgment"];
    readonly readOnly: true;
    readonly reviewer: false;
    readonly repositoryWriteAuthority: "none";
    readonly obligationAuthority: readonly ["analysis", "verification"];
    readonly delegation: {
        readonly mayDelegate: false;
        readonly allowedRoleRefs: readonly [];
    };
    readonly permissionProfileRef: "child-readonly-web";
}, {
    readonly id: "repository-explorer";
    readonly purpose: "Maps only the repository context needed for the current decision";
    readonly roleClass: "child";
    readonly useWhen: readonly ["repository scope, ownership, symbols, or dependencies are materially uncertain"];
    readonly doNotUseWhen: readonly ["required repository context is already known and fresh"];
    readonly readOnly: true;
    readonly reviewer: false;
    readonly repositoryWriteAuthority: "none";
    readonly obligationAuthority: readonly ["analysis", "verification"];
    readonly delegation: {
        readonly mayDelegate: false;
        readonly allowedRoleRefs: readonly [];
    };
    readonly permissionProfileRef: "child-repository-explorer";
}, {
    readonly id: "researcher";
    readonly purpose: "Researches external references and synthesizes source-provenance evidence";
    readonly roleClass: "child";
    readonly useWhen: readonly ["external documentation, specifications, retained references, or upstream implementations must be researched"];
    readonly doNotUseWhen: readonly ["the required evidence is entirely repository-local or the task requires repository mutation"];
    readonly readOnly: true;
    readonly reviewer: false;
    readonly repositoryWriteAuthority: "none";
    readonly obligationAuthority: readonly ["research", "analysis", "verification"];
    readonly delegation: {
        readonly mayDelegate: false;
        readonly allowedRoleRefs: readonly [];
    };
    readonly permissionProfileRef: "child-researcher";
}, {
    readonly id: "technical-writer";
    readonly purpose: "Authors and maintains documentation within documentation-bounded repository surfaces";
    readonly roleClass: "child";
    readonly useWhen: readonly ["README, docs, API documentation, changelog, or other documentation source must be authored or corrected"];
    readonly doNotUseWhen: readonly ["production implementation or test-source mutation is the primary task"];
    readonly readOnly: false;
    readonly reviewer: false;
    readonly repositoryWriteAuthority: "scoped";
    readonly obligationAuthority: readonly ["documentation", "verification"];
    readonly delegation: {
        readonly mayDelegate: false;
        readonly allowedRoleRefs: readonly [];
    };
    readonly permissionProfileRef: "child-technical-writer";
}, {
    readonly id: "test-engineer";
    readonly purpose: "Authors test sources and performs targeted test execution for the assigned behavior";
    readonly roleClass: "child";
    readonly useWhen: readonly ["test-source mutation, adversarial test construction, or specialized targeted test execution is required"];
    readonly doNotUseWhen: readonly ["only an already-known deterministic verifier needs to be executed or production implementation is the primary mutation"];
    readonly readOnly: false;
    readonly reviewer: false;
    readonly repositoryWriteAuthority: "scoped";
    readonly obligationAuthority: readonly ["test-authoring", "verification"];
    readonly delegation: {
        readonly mayDelegate: false;
        readonly allowedRoleRefs: readonly [];
    };
    readonly permissionProfileRef: "child-test-engineer";
}, {
    readonly id: "qa-reviewer";
    readonly purpose: "Independently reviews diffs, tests, and acceptance criteria for regressions";
    readonly roleClass: "child";
    readonly useWhen: readonly ["material regression or independent quality review is required"];
    readonly doNotUseWhen: readonly ["deterministic low-risk evidence is sufficient without an independent reviewer"];
    readonly readOnly: true;
    readonly reviewer: true;
    readonly repositoryWriteAuthority: "none";
    readonly obligationAuthority: readonly ["review", "verification"];
    readonly delegation: {
        readonly mayDelegate: false;
        readonly allowedRoleRefs: readonly [];
    };
    readonly permissionProfileRef: "child-readonly-offline";
}, {
    readonly id: "security-reviewer";
    readonly purpose: "Reviews real security-boundary changes through data flow and authority";
    readonly roleClass: "child";
    readonly useWhen: readonly ["a material security, trust, credential, permission, input, supply-chain, or external-action boundary changed"];
    readonly doNotUseWhen: readonly ["no material security boundary changed"];
    readonly readOnly: true;
    readonly reviewer: true;
    readonly repositoryWriteAuthority: "none";
    readonly obligationAuthority: readonly ["review", "verification"];
    readonly delegation: {
        readonly mayDelegate: false;
        readonly allowedRoleRefs: readonly [];
    };
    readonly permissionProfileRef: "child-readonly-web";
}, {
    readonly id: "visual-qa";
    readonly purpose: "Verifies UI changes with browser, responsive, console, and network evidence";
    readonly roleClass: "child";
    readonly useWhen: readonly ["UI, CSS, DOM, rendering, accessibility, or visual interaction materially changed"];
    readonly doNotUseWhen: readonly ["no visual surface changed"];
    readonly readOnly: true;
    readonly reviewer: true;
    readonly repositoryWriteAuthority: "none";
    readonly obligationAuthority: readonly ["review", "verification"];
    readonly delegation: {
        readonly mayDelegate: false;
        readonly allowedRoleRefs: readonly [];
    };
    readonly permissionProfileRef: "child-visual";
}];
export declare const HI_ROLE_IDS: readonly ["manager", "working-manager", "coder", "architect", "repository-explorer", "researcher", "technical-writer", "test-engineer", "qa-reviewer", "security-reviewer", "visual-qa"];
export declare const HI_ROLE_PRIMARY_IDS: readonly ["manager", "working-manager"];
export declare const HI_ROLE_CHILD_IDS: readonly ["coder", "architect", "repository-explorer", "researcher", "technical-writer", "test-engineer", "qa-reviewer", "security-reviewer", "visual-qa"];
export declare const HI_ROLE_READ_ONLY_CHILD_IDS: readonly ["architect", "repository-explorer", "researcher", "qa-reviewer", "security-reviewer", "visual-qa"];
export declare const HI_ROLE_REVIEWER_IDS: readonly ["qa-reviewer", "security-reviewer", "visual-qa"];
export type HiRole = typeof HI_ROLE_IDS[number];
export type HiPrimaryRole = typeof HI_ROLE_PRIMARY_IDS[number];
export type HiChildRole = typeof HI_ROLE_CHILD_IDS[number];
export type HiRoleContract = typeof HI_ROLE_CONTRACTS[number];
