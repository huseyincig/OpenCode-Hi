import { verificationClaimsSatisfied, reviewClaimsSatisfied } from '../verification/policy.js';
import { syncMissionGates } from '../gates/gates.js';
import { missionRequiresPackagePublish, missionRequiresReleaseCreate } from '../safety/release-chain.js';
import { assessRequiredTargetCoverage } from '../task/diff-ownership.js';
export function evaluateCompletion(m, projectRoot) { const reasons = [], verification = verificationClaimsSatisfied(m, projectRoot), reviews = reviewClaimsSatisfied(m, projectRoot); syncMissionGates(m, projectRoot, { verification, review: reviews }); if (missionRequiresReleaseCreate(m)) {
    if (m.release.release_chain?.release?.outcome !== 'success')
        reasons.push('release-chain:release-not-completed');
    else if (!m.release.release_chain?.release?.remote_verified)
        reasons.push('release-chain:release-remote-unverified');
} if (missionRequiresPackagePublish(m)) {
    if (m.release.release_chain?.package?.outcome !== 'success')
        reasons.push('release-chain:package-not-published');
    else if (!m.release.release_chain?.package?.remote_verified)
        reasons.push('release-chain:package-remote-unverified');
} if (m.continuation.user_interrupted || m.identity.status === 'stopped')
    return { complete: false, reasons: ['user-stopped'] }; if (m.identity.semantic_assessment.status !== 'assessed')
    return { complete: false, reasons: ['semantic-assessment-pending'], next: 'CONTINUE' }; if (m.authority.human_decision?.status === 'OPEN' && m.authority.human_decision.semantic_type !== 'authority_request')
    return { complete: false, reasons: [`human-decision:${m.authority.human_decision.reason_code}`], next: 'USER_ACTION_REQUIRED' }; if (m.execution.workers.some(w => ['created', 'queued', 'starting', 'busy'].includes(w.status)))
    reasons.push('active-worker'); if (m.execution.tasks.some(t => ['created', 'queued', 'running', 'waiting'].includes(t.status)))
    reasons.push('pending-task'); if (m.execution.processes.some(p => p.status === 'RUNNING'))
    reasons.push('active-process'); if (m.execution.processes.some(p => p.status === 'ORPHANED'))
    reasons.push('orphan-process'); if (m.execution.processes.some(p => p.cleanup_state !== 'CLEANED' && p.status !== 'ORPHANED'))
    reasons.push('process-cleanup-pending'); if (m.execution.native_todos_incomplete > 0)
    reasons.push(`native-todos-incomplete:${m.execution.native_todos_incomplete}`); if (m.execution.blockers.length)
    reasons.push(`blockers:${m.execution.blockers.slice(0, 6).join('|')}`); if (m.methodology.methodology_needs.length)
    reasons.push(`methodology-needs:${[...new Set(m.methodology.methodology_needs.map(n => n.name))].slice(0, 6).join('|')}`); const uncoveredTargets = m.execution.obligations.filter(o => o.kind === 'implementation' && (o.requiredTargets?.length ?? 0) > 0).flatMap(o => assessRequiredTargetCoverage(o.requiredTargets ?? [], m.vcs.changed_files).missing.map(target => `${o.id}:${target}`)); if (uncoveredTargets.length)
    reasons.push(`required-targets-uncovered:${uncoveredTargets.join(',')}`); const open = m.execution.obligations.filter(o => o.status === 'open'); if (open.length)
    reasons.push(`open-obligations:${open.map(o => o.id).join(',')}`); const authorityGate = m.execution.gates.find(g => g.kind === 'user-authority' && g.status !== 'closed'); if (authorityGate)
    return { complete: false, reasons: [...reasons, `authority:${authorityGate.status}`], next: 'USER_ACTION_REQUIRED' }; const rollback = m.execution.gates.find(g => g.kind === 'rollback' && g.status !== 'closed'); if (rollback)
    return { complete: false, reasons: [...reasons, 'temporary-rollback-pending'], next: 'USER_ACTION_REQUIRED' }; const prereq = m.execution.gates.find(g => g.kind === 'prerequisite-task' && g.status !== 'closed'); if (prereq)
    reasons.push('prerequisite-task-pending'); if (m.execution.tasks.some(t => t.result?.status === 'FIX_REQUIRED' || t.result?.status === 'NEEDS_CONTEXT'))
    return { complete: false, reasons: [...reasons, 'worker-result-unreconciled'], next: 'RECONCILE' }; const openWork = m.execution.obligations.filter(o => o.status === 'open' && (o.kind === 'analysis' || o.kind === 'implementation')); if (openWork.length)
    return { complete: false, reasons, next: 'CONTINUE' }; if (!verification.ok)
    return { complete: false, reasons: [...reasons, `verification-claims-missing:${verification.missing.join(',')}`], next: 'VERIFY' }; if (!reviews.ok)
    return { complete: false, reasons: [...reasons, `review-claims-missing:${reviews.missing.join(',')}`], next: 'RECONCILE' }; return reasons.length ? { complete: false, reasons, next: 'CONTINUE' } : { complete: true, reasons: ['all-required-obligations-closed', 'no-pending-work', 'fresh-evidence', 'all-gates-closed'] }; }
