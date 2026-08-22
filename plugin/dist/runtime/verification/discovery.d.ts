export interface TargetedVerificationPlan {
    target: string;
    packageRoot: string;
    testFiles: string[];
    commands: string[];
    reason: string;
}
export declare function discoverTargetedVerification(root: string, targets: string[]): TargetedVerificationPlan[];
export declare function targetedVerificationHint(root: string, targets: string[]): string | undefined;
export interface VerificationRouteProjection {
    evidenceKind: 'targeted-tests' | 'typecheck' | 'lint' | 'build' | 'changed-surface-sanity';
    command: string;
    source: 'targeted-test' | 'package-script';
    packageRoot: string;
}
/**
 * Read-only projection of deterministic repo-native verification routes.
 * Targeted tests stay narrow; a generic full test suite is never invented when
 * no nearby deterministic test exists. Static/build/check scripts are surfaced
 * only when the owning package actually declares a usable script.
 */
export declare function discoverVerificationRoutes(root: string, targets: string[]): VerificationRouteProjection[];
