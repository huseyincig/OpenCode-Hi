export declare const HI_PERMISSION_PROFILES: readonly [{
    readonly id: "primary-manager";
    readonly rules: readonly [{
        readonly capability: "edit";
        readonly action: "deny";
    }, {
        readonly capability: "bash";
        readonly action: "deny";
        readonly pattern: "*";
    }, {
        readonly capability: "external_directory";
        readonly action: "deny";
    }, {
        readonly capability: "task";
        readonly action: "deny";
    }, {
        readonly capability: "todowrite";
        readonly action: "allow";
    }, {
        readonly capability: "lsp";
        readonly action: "deny";
    }, {
        readonly capability: "question";
        readonly action: "allow";
    }, {
        readonly capability: "webfetch";
        readonly action: "allow";
    }, {
        readonly capability: "websearch";
        readonly action: "allow";
    }, {
        readonly capability: "scout";
        readonly action: "allow";
    }];
    readonly safetyClass: "primary-readonly";
    readonly mayBeWidenedByLowerLayer: false;
    readonly hostMappingRequirements: readonly ["opencode.permission"];
}, {
    readonly id: "primary-working-manager";
    readonly rules: readonly [{
        readonly capability: "read";
        readonly action: "allow";
        readonly pattern: "*";
    }, {
        readonly capability: "read";
        readonly action: "deny";
        readonly pattern: "*.env";
    }, {
        readonly capability: "read";
        readonly action: "deny";
        readonly pattern: "*.env.*";
    }, {
        readonly capability: "read";
        readonly action: "allow";
        readonly pattern: "*.env.example";
    }, {
        readonly capability: "edit";
        readonly action: "allow";
    }, {
        readonly capability: "glob";
        readonly action: "allow";
    }, {
        readonly capability: "grep";
        readonly action: "allow";
    }, {
        readonly capability: "lsp";
        readonly action: "allow";
    }, {
        readonly capability: "bash";
        readonly action: "ask";
        readonly pattern: "*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git status*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git diff*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git log*";
    }, {
        readonly capability: "external_directory";
        readonly action: "deny";
    }, {
        readonly capability: "task";
        readonly action: "deny";
    }, {
        readonly capability: "todowrite";
        readonly action: "allow";
    }, {
        readonly capability: "question";
        readonly action: "allow";
    }, {
        readonly capability: "webfetch";
        readonly action: "allow";
    }, {
        readonly capability: "websearch";
        readonly action: "allow";
    }, {
        readonly capability: "scout";
        readonly action: "allow";
    }];
    readonly safetyClass: "scoped-write";
    readonly mayBeWidenedByLowerLayer: false;
    readonly hostMappingRequirements: readonly ["opencode.permission"];
}, {
    readonly id: "child-coder";
    readonly rules: readonly [{
        readonly capability: "read";
        readonly action: "allow";
        readonly pattern: "*";
    }, {
        readonly capability: "read";
        readonly action: "deny";
        readonly pattern: "*.env";
    }, {
        readonly capability: "read";
        readonly action: "deny";
        readonly pattern: "*.env.*";
    }, {
        readonly capability: "read";
        readonly action: "allow";
        readonly pattern: "*.env.example";
    }, {
        readonly capability: "edit";
        readonly action: "allow";
    }, {
        readonly capability: "glob";
        readonly action: "allow";
    }, {
        readonly capability: "grep";
        readonly action: "allow";
    }, {
        readonly capability: "lsp";
        readonly action: "allow";
    }, {
        readonly capability: "bash";
        readonly action: "ask";
        readonly pattern: "*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git status*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git diff*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git log*";
    }, {
        readonly capability: "task";
        readonly action: "deny";
    }, {
        readonly capability: "question";
        readonly action: "deny";
    }, {
        readonly capability: "external_directory";
        readonly action: "deny";
    }, {
        readonly capability: "webfetch";
        readonly action: "deny";
    }, {
        readonly capability: "websearch";
        readonly action: "deny";
    }];
    readonly safetyClass: "scoped-write";
    readonly mayBeWidenedByLowerLayer: false;
    readonly hostMappingRequirements: readonly ["opencode.permission"];
}, {
    readonly id: "child-readonly-web";
    readonly rules: readonly [{
        readonly capability: "read";
        readonly action: "allow";
        readonly pattern: "*";
    }, {
        readonly capability: "read";
        readonly action: "deny";
        readonly pattern: "*.env";
    }, {
        readonly capability: "read";
        readonly action: "deny";
        readonly pattern: "*.env.*";
    }, {
        readonly capability: "read";
        readonly action: "allow";
        readonly pattern: "*.env.example";
    }, {
        readonly capability: "edit";
        readonly action: "deny";
    }, {
        readonly capability: "glob";
        readonly action: "allow";
    }, {
        readonly capability: "grep";
        readonly action: "allow";
    }, {
        readonly capability: "lsp";
        readonly action: "allow";
    }, {
        readonly capability: "bash";
        readonly action: "ask";
        readonly pattern: "*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git status*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git diff*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git log*";
    }, {
        readonly capability: "task";
        readonly action: "deny";
    }, {
        readonly capability: "question";
        readonly action: "deny";
    }, {
        readonly capability: "external_directory";
        readonly action: "deny";
    }, {
        readonly capability: "webfetch";
        readonly action: "allow";
    }, {
        readonly capability: "websearch";
        readonly action: "allow";
    }];
    readonly safetyClass: "child-readonly";
    readonly mayBeWidenedByLowerLayer: false;
    readonly hostMappingRequirements: readonly ["opencode.permission"];
}, {
    readonly id: "child-readonly-offline";
    readonly rules: readonly [{
        readonly capability: "read";
        readonly action: "allow";
        readonly pattern: "*";
    }, {
        readonly capability: "read";
        readonly action: "deny";
        readonly pattern: "*.env";
    }, {
        readonly capability: "read";
        readonly action: "deny";
        readonly pattern: "*.env.*";
    }, {
        readonly capability: "read";
        readonly action: "allow";
        readonly pattern: "*.env.example";
    }, {
        readonly capability: "edit";
        readonly action: "deny";
    }, {
        readonly capability: "glob";
        readonly action: "allow";
    }, {
        readonly capability: "grep";
        readonly action: "allow";
    }, {
        readonly capability: "lsp";
        readonly action: "allow";
    }, {
        readonly capability: "bash";
        readonly action: "ask";
        readonly pattern: "*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git status*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git diff*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git log*";
    }, {
        readonly capability: "task";
        readonly action: "deny";
    }, {
        readonly capability: "question";
        readonly action: "deny";
    }, {
        readonly capability: "external_directory";
        readonly action: "deny";
    }, {
        readonly capability: "webfetch";
        readonly action: "deny";
    }, {
        readonly capability: "websearch";
        readonly action: "deny";
    }];
    readonly safetyClass: "child-readonly";
    readonly mayBeWidenedByLowerLayer: false;
    readonly hostMappingRequirements: readonly ["opencode.permission"];
}, {
    readonly id: "child-repository-explorer";
    readonly rules: readonly [{
        readonly capability: "read";
        readonly action: "allow";
        readonly pattern: "*";
    }, {
        readonly capability: "read";
        readonly action: "deny";
        readonly pattern: "*.env";
    }, {
        readonly capability: "read";
        readonly action: "deny";
        readonly pattern: "*.env.*";
    }, {
        readonly capability: "read";
        readonly action: "allow";
        readonly pattern: "*.env.example";
    }, {
        readonly capability: "edit";
        readonly action: "deny";
    }, {
        readonly capability: "glob";
        readonly action: "allow";
    }, {
        readonly capability: "grep";
        readonly action: "allow";
    }, {
        readonly capability: "lsp";
        readonly action: "allow";
    }, {
        readonly capability: "bash";
        readonly action: "ask";
        readonly pattern: "*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git status*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git diff*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git log*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git ls-files*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "rg *";
    }, {
        readonly capability: "task";
        readonly action: "deny";
    }, {
        readonly capability: "question";
        readonly action: "deny";
    }, {
        readonly capability: "external_directory";
        readonly action: "deny";
    }, {
        readonly capability: "webfetch";
        readonly action: "deny";
    }, {
        readonly capability: "websearch";
        readonly action: "deny";
    }];
    readonly safetyClass: "child-readonly";
    readonly mayBeWidenedByLowerLayer: false;
    readonly hostMappingRequirements: readonly ["opencode.permission"];
}, {
    readonly id: "child-visual";
    readonly rules: readonly [{
        readonly capability: "read";
        readonly action: "allow";
        readonly pattern: "*";
    }, {
        readonly capability: "read";
        readonly action: "deny";
        readonly pattern: "*.env";
    }, {
        readonly capability: "read";
        readonly action: "deny";
        readonly pattern: "*.env.*";
    }, {
        readonly capability: "read";
        readonly action: "allow";
        readonly pattern: "*.env.example";
    }, {
        readonly capability: "edit";
        readonly action: "deny";
    }, {
        readonly capability: "glob";
        readonly action: "allow";
    }, {
        readonly capability: "grep";
        readonly action: "allow";
    }, {
        readonly capability: "bash";
        readonly action: "ask";
        readonly pattern: "*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git status*";
    }, {
        readonly capability: "bash";
        readonly action: "allow";
        readonly pattern: "git diff*";
    }, {
        readonly capability: "task";
        readonly action: "deny";
    }, {
        readonly capability: "question";
        readonly action: "deny";
    }, {
        readonly capability: "external_directory";
        readonly action: "deny";
    }, {
        readonly capability: "lsp";
        readonly action: "deny";
    }, {
        readonly capability: "webfetch";
        readonly action: "deny";
    }, {
        readonly capability: "websearch";
        readonly action: "deny";
    }];
    readonly safetyClass: "child-readonly";
    readonly mayBeWidenedByLowerLayer: false;
    readonly hostMappingRequirements: readonly ["opencode.permission"];
}];
export type HiPermissionProfileID = typeof HI_PERMISSION_PROFILES[number]['id'];
