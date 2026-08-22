/**
 * Bind canonical evidence to the exact current bytes of its bounded file scope.
 * Scope-state is an evidence freshness primitive, not a second filesystem owner.
 */
export declare function captureEvidenceScopeState(projectRoot: string, scope: string[]): string | undefined;
export declare function evidenceScopeStateIsCurrent(projectRoot: string, scope: string[], expected: string | undefined): boolean;
