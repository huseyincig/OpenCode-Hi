export type KnowledgeClass = 'PROJECT_KNOWLEDGE' | 'ARCHITECTURE_POLICY' | 'REUSABLE_METHODOLOGY' | 'TEMPORARY_EVIDENCE';
export type SkillIntegrationDecision = 'DIRECT_PORT' | 'ADAPT' | 'MERGE_INTO_EXISTING' | 'CLEAN_ROOM' | 'IDEA_ONLY' | 'REJECT';
export interface KnowledgeInput {
    kind?: string;
    text: string;
    requestedMutation?: boolean;
    overlapsExistingSkill?: boolean;
    reusable?: boolean;
    license?: 'permissive' | 'copyleft' | 'unknown';
    hasTriggerContract?: boolean;
}
export interface KnowledgeDecision {
    classification: KnowledgeClass;
    skillDecision?: SkillIntegrationDecision;
    mutate: boolean;
    reason: string[];
}
export declare function classifyKnowledge(input: KnowledgeInput): KnowledgeDecision;
