export type ContractStatus = 'DRAFT' | 'VALIDATED' | 'ADMITTED' | 'RETIRED';
export type LifecycleClass = 'CANONICAL' | 'DERIVED' | 'CACHE' | 'EPHEMERAL';
export type StorageScope = 'PROJECT' | 'GLOBAL' | 'RUNTIME';
export type Confidence = 'unknown' | 'low' | 'medium' | 'high';
export type CapabilityLevel = 'unknown' | 'low' | 'medium' | 'high';
export type TriStateCapability = 'unknown' | false | true;
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
export declare function hashesEqual(a: ContentHash, b: ContentHash): boolean;
