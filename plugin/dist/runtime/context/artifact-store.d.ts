import { type ArtifactContract, type ArtifactPrivacyClass } from '../../contracts/artifact.js';
export declare class ContextArtifactStore {
    #private;
    readonly projectRoot?: string | undefined;
    constructor(projectRoot?: string | undefined);
    addBinary(kind: string, summary: string, bytes: Uint8Array, options: {
        extension: string;
        mediaType: string;
        producer?: string;
        privacyClass?: ArtifactPrivacyClass;
        consumerRefs?: string[];
    }): ArtifactContract;
    add(kind: string, summary: string, content: string, sourceFiles?: string[], options?: {
        producer?: string;
        privacyClass?: ArtifactPrivacyClass;
        consumerRefs?: string[];
    }): ArtifactContract;
    get(id: string): ArtifactContract | undefined;
    getBinary(id: string): {
        mime: string;
        filename: string;
        bytes: Uint8Array;
    } | undefined;
    bindConsumer(id: string, consumerRef: string): ArtifactContract | undefined;
    invalidateChanged(files: string[]): number;
}
