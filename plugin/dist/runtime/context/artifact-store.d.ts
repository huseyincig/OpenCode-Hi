import { type ArtifactContract, type ArtifactPrivacyClass } from '../../contracts/artifact.js';
import { type CompressionArtifact } from '../../contracts/compression-artifact.js';
import type { ContextReferenceContract } from '../../contracts/context-reference.js';
export type DurableContextArtifact = ArtifactContract;
export declare class ContextArtifactStore {
    #private;
    readonly projectRoot?: string | undefined;
    constructor(projectRoot?: string | undefined);
    addCompression(sources: ContextReferenceContract[], summary: string, options: {
        consumerScope: string;
        modelIdentity: string;
        policyVersion?: string;
    }): CompressionArtifact;
    getCompression(id: string): CompressionArtifact | undefined;
    add(kind: string, summary: string, content: string, sourceFiles?: string[], options?: {
        producer?: string;
        privacyClass?: ArtifactPrivacyClass;
        consumerRefs?: string[];
    }): ArtifactContract;
    get(id: string): ArtifactContract | undefined;
    bindConsumer(id: string, consumerRef: string): ArtifactContract | undefined;
    invalidateChanged(files: string[]): number;
}
