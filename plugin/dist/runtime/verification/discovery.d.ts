export interface TargetedVerificationPlan {
    target: string;
    packageRoot: string;
    testFiles: string[];
    commands: string[];
    reason: string;
}
export declare function discoverTargetedVerification(root: string, targets: string[]): TargetedVerificationPlan[];
export declare function targetedVerificationHint(root: string, targets: string[]): string | undefined;
