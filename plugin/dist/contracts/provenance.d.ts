import { type ContentHash } from './common.js';
export type ProvenanceSourceType = 'builtin' | 'project' | 'external-source' | 'generated' | 'runtime-observation';
export interface FileHash {
    path: string;
    hash: ContentHash;
}
export interface ProvenanceRecord {
    sourceType: ProvenanceSourceType;
    sourceId: string;
    sourceRevision?: string;
    sourceHash?: ContentHash;
    transform?: string;
    owner: string;
    fileHashes?: FileHash[];
}
export declare function validateProvenanceRecord(value: unknown, field?: string): ProvenanceRecord;
export interface ProjectionSourceContract {
    id: string;
    hash: ContentHash;
}
export interface ProjectionReceipt {
    schemaVersion: 1;
    projectionSchema: string;
    sourceContracts: ProjectionSourceContract[];
    generatorId: string;
    generatorVersion: string;
    outputPath: string;
    outputHash: ContentHash;
}
export interface CreateProjectionReceiptInput {
    projectionSchema: string;
    sourceContracts: Array<{
        id: string;
        contract: unknown;
    }>;
    generatorId: string;
    generatorVersion: string;
    outputPath: string;
    outputContent: string;
}
export declare function createProjectionReceipt(input: CreateProjectionReceiptInput): ProjectionReceipt;
export declare function validateProjectionReceipt(value: unknown, field?: string): ProjectionReceipt;
export declare function projectionReceiptHash(receipt: ProjectionReceipt): ContentHash;
