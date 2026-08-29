import { reviewFindingNeedsCorrection } from '../../contracts/review-finding.js';
import { normalizeBoundedProjectPath } from '../../contracts/common.js';
import { evidenceVerdictPassed } from '../../contracts/evidence-kinds.js';
import { appendLedger } from '../ledger/ledger.js';
import { evidenceClaimApplicability } from '../evidence/applicability.js';
export function reviewFindingReworkObligationId(findingID) { return `o-review-rework-${findingID}`; }
function currentAttemptFindingEvidenceAdmitted(m, task, worker, finding) {
    if (!finding.evidence_refs.length)
        return false;
    return finding.evidence_refs.every(kind => m.execution.evidence.items.some(item => item.task_id === task.id && item.kind === kind && !item.invalidated_at && evidenceVerdictPassed(item.pass, item.outcome) && item.producer_attempt?.worker_id === worker.id && item.producer_attempt.ordinal === worker.attempt && item.producer_attempt.generation === (worker.generation_at_spawn ?? m.continuation.generation) && evidenceClaimApplicability(m, item).applicable));
}
/**
 * Reviewer/verifier findings never grant mutation authority to the read-only task that found them.
 * A bounded, current-attempt, evidence-backed blocking introduced/worsened finding instead opens a distinct
 * implementation obligation. This preserves the failed review attempt as history while returning
 * corrective repository ownership to a canonical writer before fresh re-verification.
 */
export function materializeReviewFindingRework(m, task, worker, findings) {
    const opened = [];
    for (const finding of findings) {
        if (finding.reviewer_role !== worker.role || !reviewFindingNeedsCorrection(finding))
            continue;
        const targets = finding.scope.map(normalizeBoundedProjectPath);
        if (!targets.length || targets.some(target => !target)) {
            appendLedger(m, 'review.finding-rework-deferred', { task_id: task.id, worker_id: worker.id, payload: { finding: finding.id, reason: 'bounded-project-scope-required', scope: finding.scope.slice(0, 20) } });
            continue;
        }
        if (!currentAttemptFindingEvidenceAdmitted(m, task, worker, finding)) {
            appendLedger(m, 'review.finding-rework-deferred', { task_id: task.id, worker_id: worker.id, payload: { finding: finding.id, reason: 'current-attempt-canonical-evidence-required', evidence_refs: finding.evidence_refs.slice(0, 20) } });
            continue;
        }
        const id = reviewFindingReworkObligationId(finding.id), requiredTargets = [...new Set(targets)];
        const existing = m.execution.obligations.find(obligation => obligation.id === id);
        if (existing) {
            existing.requiredTargets = [...new Set([...(existing.requiredTargets ?? []), ...requiredTargets])];
            existing.summary = `Resolve reviewer finding ${finding.id}: ${finding.subject}`.slice(0, 1200);
            if (existing.status !== 'open') {
                existing.status = 'open';
                existing.closedAt = undefined;
                existing.blocker = undefined;
                appendLedger(m, 'obligation.reopened', { task_id: task.id, worker_id: worker.id, payload: { obligation: id, kind: 'implementation', source_finding: finding.id, owner: 'review-finding-rework' } });
            }
        }
        else {
            m.execution.obligations.push({ id, kind: 'implementation', summary: `Resolve reviewer finding ${finding.id}: ${finding.subject}`.slice(0, 1200), status: 'open', requiredTargets });
            appendLedger(m, 'obligation.opened', { task_id: task.id, worker_id: worker.id, payload: { obligation: id, kind: 'implementation', source_finding: finding.id, owner: 'review-finding-rework' } });
        }
        opened.push(id);
        appendLedger(m, 'review.finding-rework-opened', { task_id: task.id, worker_id: worker.id, payload: { finding: finding.id, obligation: id, causality: finding.causality, severity: finding.severity, blocking: finding.blocking, required_targets: requiredTargets } });
    }
    return [...new Set(opened)];
}
export function taskHasDelegatedReviewFindingRework(m, task) {
    const findings = task.result?.findings ?? [];
    return findings.some(finding => finding.reviewer_role === task.role && reviewFindingNeedsCorrection(finding) && m.execution.obligations.some(obligation => obligation.id === reviewFindingReworkObligationId(finding.id) && obligation.kind === 'implementation' && obligation.status === 'open'));
}
