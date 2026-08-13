export interface ProjectMethodologyProvenance {
    schema: 1;
    type: 'hi-methodology-provenance';
    name: string;
    origin: 'project-learning' | 'explicit-user-request';
    evidence: string[];
    candidate_id?: string;
    skill_sha256: string;
    policy_sha256: string;
    created_at: number;
    validated_at: number;
}
export declare function projectMethodologyProvenancePath(projectRoot: string, name: string): string;
export declare function readProjectMethodologyProvenance(projectRoot: string, name: string): ProjectMethodologyProvenance | undefined;
