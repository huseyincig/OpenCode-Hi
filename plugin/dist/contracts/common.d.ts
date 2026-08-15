export type StorageScope = 'PROJECT' | 'GLOBAL' | 'RUNTIME';
export type HashAlgorithm = 'sha256';
export interface ContentHash {
    algorithm: HashAlgorithm;
    value: string;
}
export declare class ContractValidationError extends Error {
    readonly field: string;
    constructor(field: string, message: string);
}
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function assertRecord(value: unknown, field: string): Record<string, unknown>;
export declare function assertStrictKeys(value: Record<string, unknown>, allowed: readonly string[], required: readonly string[], field: string): void;
export declare function assertNonEmptyString(value: unknown, field: string): string;
export declare function assertCanonicalId(value: unknown, field?: string): string;
export declare function assertPositiveInteger(value: unknown, field: string): number;
export declare function compareTechnicalId(a: string, b: string): number;
export declare function isSafeProjectFileSourceRef(value: unknown): value is string;
export declare function contentHash(value: string): ContentHash;
export declare function assertContentHash(value: unknown, field: string): ContentHash;
export declare function stableJson(value: unknown): string;
export declare function canonicalHash(value: unknown): ContentHash;
