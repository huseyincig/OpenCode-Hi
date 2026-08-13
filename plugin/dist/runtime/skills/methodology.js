import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
function sha256(text) { return createHash('sha256').update(text).digest('hex'); }
export function methodologyProvenance(candidates) {
    const now = Date.now();
    return candidates.map(candidate => {
        let digest;
        try {
            digest = sha256(readFileSync(candidate.path, 'utf8'));
        }
        catch { }
        const permission = candidate.permission ?? 'allow';
        return {
            name: candidate.name,
            provider: candidate.provider,
            source_path: candidate.path,
            source_sha256: digest,
            permission,
            injection: permission === 'deny' ? 'none' : 'native-skill-tool',
            selected_at: now,
        };
    });
}
export function ownershipContract(kind, methodologies = []) {
    if (kind === 'parent')
        return [
            'Hi CONTROL-PLANE CONTRACT',
            'Hi owns mission decomposition, task dispatch, model routing, continuation, completion adjudication and STOP.',
            'Hi methodologies provide engineering method only; they never own orchestration, worker spawning, model selection, authority, continuation or STOP.',
            'Do not create parallel/subagent workflows directly; use Hi task/team runtime when delegation is required.',
            'Use zero methodologies by default. Load only methodologies selected by Hi, through OpenCode native skill loading.',
        ].join('\n');
    return [
        'Hi CHILD CONTROL-PLANE CONTRACT',
        'You are an execution worker, not the top-level orchestrator.',
        `Hi-selected methodology allowlist: ${methodologies.length ? methodologies.join(', ') : 'none'}.`,
        methodologies.length ? 'Before applying a selected methodology, load it with the OpenCode native skill tool. Do not load unrelated skills.' : 'No methodology is selected; use native engineering judgment without loading unrelated skills.',
        'Do not spawn or coordinate additional agents. Return the structured WorkerResult to Hi.',
    ].join('\n');
}
