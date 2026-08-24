export const WORKER_EVIDENCE_KINDS = ['targeted-tests', 'typecheck', 'lint', 'build', 'changed-surface-sanity', 'review-evidence', 'decision-evidence', 'diagnostic-evidence', 'measurement-evidence', 'browser-evidence', 'visual-evidence', 'accessibility-evidence', 'source-provenance-evidence'];
export const EVIDENCE_OUTCOMES = ['pending', 'passed', 'failed', 'environment-issue'];
/**
 * `outcome` is the canonical structured verdict when present. `pass` is a legacy
 * scalar compatibility projection only; it may agree with passed/failed or be
 * omitted, but it cannot contradict the richer outcome vocabulary.
 */
export function evidenceVerdictConsistent(pass, outcome) {
    if (pass === undefined || outcome === undefined)
        return true;
    return (outcome === 'passed' && pass === true) || (outcome === 'failed' && pass === false);
}
export function resolvedEvidenceOutcome(pass, outcome) {
    if (outcome !== undefined)
        return outcome;
    return pass === true ? 'passed' : pass === false ? 'failed' : undefined;
}
export function evidenceVerdictPassValue(pass, outcome) {
    const resolved = resolvedEvidenceOutcome(pass, outcome);
    return resolved === 'passed' ? true : resolved === 'failed' ? false : undefined;
}
export function evidenceVerdictPassed(pass, outcome) { return resolvedEvidenceOutcome(pass, outcome) === 'passed'; }
export function evidenceVerdictFailed(pass, outcome) { return resolvedEvidenceOutcome(pass, outcome) === 'failed'; }
