import { type ArtifactContract, type ArtifactPrivacyClass } from '../../contracts/artifact.js';
export type DurableContextArtifact = ArtifactContract;
export declare class ContextArtifactStore {
    #private;
    readonly projectRoot?: string | undefined;
    constructor(projectRoot?: string | undefined);
    add(kind: string, summary: string, content: string, sourceFiles?: string[], options?: {
        producer?: string;
        privacyClass?: ArtifactPrivacyClass;
        consumerRefs?: string[];
    }): ArtifactContract;
    get(id: string): ArtifactContract | undefined;
    invalidateChanged(files: string[]): number;
}
