import { join, resolve } from 'node:path';
function safeSegment(value) {
    const v = value.trim();
    if (!v || v === '.' || v === '..' || v.includes('/') || v.includes('\\') || !/[A-Za-z0-9]/.test(v))
        throw new Error(`Unsafe storage segment: ${value}`);
    return v.replace(/[^A-Za-z0-9._-]+/g, '-');
}
export function hiProjectRoot(projectRoot) { return join(resolve(projectRoot), '.opencode', 'hi'); }
export function projectPolicyPath(projectRoot, name) { return join(hiProjectRoot(projectRoot), 'policy', `${safeSegment(name)}.json`); }
export function projectProvenancePath(projectRoot, name) { return join(hiProjectRoot(projectRoot), 'provenance', `${safeSegment(name)}.json`); }
export function projectIntelligencePath(projectRoot, id) { return join(hiProjectRoot(projectRoot), 'project-intelligence', 'patterns', `${safeSegment(id)}.json`); }
export function projectMethodologyCandidatePath(projectRoot, id) { return join(hiProjectRoot(projectRoot), 'project-intelligence', 'methodology-candidates', `${safeSegment(id)}.json`); }
export function durableArtifactPath(projectRoot, kind, id) { return join(hiProjectRoot(projectRoot), 'artifacts', safeSegment(kind), `${safeSegment(id)}.json`); }
export function projectSkillRoot(projectRoot, skillName) { return join(resolve(projectRoot), '.opencode', 'skills', safeSegment(skillName)); }
export function storageLocation(projectRoot, kind, name, secondary) {
    switch (kind) {
        case 'POLICY': return projectPolicyPath(projectRoot, name);
        case 'PROVENANCE': return projectProvenancePath(projectRoot, name);
        case 'PROJECT_INTELLIGENCE': return projectIntelligencePath(projectRoot, name);
        case 'PROJECT_METHODOLOGY_CANDIDATE': return projectMethodologyCandidatePath(projectRoot, name);
        case 'DURABLE_ARTIFACT':
            if (!secondary)
                throw new Error('Durable artifact id required');
            return durableArtifactPath(projectRoot, name, secondary);
        case 'PROJECT_SKILL': return projectSkillRoot(projectRoot, name);
    }
}
