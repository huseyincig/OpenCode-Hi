import type { ModelCapabilityProfile, ModelQuirkHints } from '../../contracts/model.js';
export interface ModelQuirkProfile extends ModelQuirkHints {
    source: 'capability-profile' | 'technical-model-id-fallback' | 'none';
}
export declare function modelQuirks(model: string | undefined, profile?: ModelCapabilityProfile): ModelQuirkProfile;
