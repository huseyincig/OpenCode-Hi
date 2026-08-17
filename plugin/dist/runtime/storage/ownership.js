import { join, resolve } from 'node:path';
function safeSegment(value) {
    const v = value.trim();
    if (!v || v === '.' || v === '..' || v.includes('/') || v.includes('\\') || !/[A-Za-z0-9]/.test(v))
        throw new Error(`Unsafe storage segment: ${value}`);
    return v.replace(/[^A-Za-z0-9._-]+/g, '-');
}
export function hiProjectRoot(projectRoot) { return join(resolve(projectRoot), '.opencode', 'hi'); }
export function projectPolicyPath(projectRoot, name) { return join(hiProjectRoot(projectRoot), 'policy', `${safeSegment(name)}.json`); }
export function projectMethodologyCandidatePath(projectRoot, id) { return join(hiProjectRoot(projectRoot), 'project-intelligence', 'methodology-candidates', `${safeSegment(id)}.json`); }
export function durableArtifactPath(projectRoot, kind, id) { return join(hiProjectRoot(projectRoot), 'artifacts', safeSegment(kind), `${safeSegment(id)}.json`); }
export function durableArtifactBinaryPath(projectRoot, kind, id, extension) { return join(hiProjectRoot(projectRoot), 'artifacts', safeSegment(kind), `${safeSegment(id)}.${safeSegment(extension).replace(/^\.+/, '')}`); }
export function projectMethodologyPolicyDir(projectRoot) { return join(hiProjectRoot(projectRoot), 'policy', 'methodologies'); }
export function projectMethodologyPolicyPath(projectRoot, name) { return join(projectMethodologyPolicyDir(projectRoot), `${safeSegment(name)}.json`); }
export function projectMethodologyProvenanceDir(projectRoot) { return join(hiProjectRoot(projectRoot), 'provenance', 'methodologies'); }
export function projectMethodologyProvenancePath(projectRoot, name) { return join(projectMethodologyProvenanceDir(projectRoot), `${safeSegment(name)}.json`); }
export function projectSkillRoot(projectRoot, skillName) { return join(resolve(projectRoot), '.opencode', 'skills', safeSegment(skillName)); }
