export interface ModelQuirkProfile {
    compactInstructionSensitive?: boolean;
    avoidLongNestedPlans?: boolean;
    explicitToolBoundaries?: boolean;
}
export declare function modelQuirks(model: string | undefined): ModelQuirkProfile;
