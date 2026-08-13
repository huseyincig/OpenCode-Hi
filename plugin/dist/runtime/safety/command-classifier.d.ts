export type ExternalCommandKind = 'git-push' | 'package-publish' | 'gh-release-create' | 'docker-push' | 'kubectl-mutate' | 'terraform-apply' | 'vercel-deploy' | 'netlify-deploy' | 'other';
export interface CommandInvocation {
    exe?: string;
    args: string[];
    tokens: string[];
}
export declare function commandInvocations(command: string): CommandInvocation[];
export declare function commandTokens(command: string): string[];
export declare function gitInvocation(command: string, sub?: string): CommandInvocation | undefined;
export declare function gitCommandParts(command: string): {
    sub?: string;
    rest: string[];
    invocation?: CommandInvocation;
};
export declare function npmLikeCommandParts(command: string): {
    exe?: string;
    sub?: string;
    rest: string[];
    invocation?: CommandInvocation;
};
export declare function ghCommandParts(command: string): {
    sub?: string;
    rest: string[];
    invocation?: CommandInvocation;
};
export declare function classifyExternalCommand(command: string): {
    kind: ExternalCommandKind;
    tokens: string[];
    exe?: string;
    args: string[];
};
export declare function externalEffectCommand(command: string): boolean;
export declare function canonicalExternalCommand(command: string): boolean;
