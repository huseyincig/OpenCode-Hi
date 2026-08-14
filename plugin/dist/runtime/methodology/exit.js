import { HI_METHODOLOGY_EXIT_REQUIREMENT_CATALOG } from '../../generated/methodology-policy.js';
import { methodologyCatalogEntry } from './catalog.js';
import { appendLedger } from '../ledger/ledger.js';
import { verificationSatisfied } from '../verification/policy.js';
import { missionRequiresPackagePublish, missionRequiresReleaseCreate } from '../safety/release-chain.js';
import { discoverProjectMethodologyPolicies } from './project-policy.js';
function normScope(value) { return value.trim().replace(/\\/g, '/').replace(/^\.\//, ''); }
function passedEvidence(m, task, obligationId) {
    const mutation = m.execution.evidence.last_mutation_at ?? 0, taskScope = new Set((task?.scope ?? []).map(normScope).filter(Boolean));
    return m.execution.evidence.items.filter(e => {
        if (e.invalidated_at || !((e.outcome === 'passed') || e.pass === true) || e.observed_at < mutation)
            return false;
        if (!task && !obligationId)
            return true;
        if (task && e.task_id === task.id)
            return true;
        if (obligationId && e.obligation_ids?.includes(obligationId))
            return true;
        if (task && e.obligation_ids?.some(id => task.obligation_ids.includes(id)))
            return true;
        if (taskScope.size && (e.scope ?? []).some(file => taskScope.has(normScope(file))))
            return true;
        return false;
    });
}
function evidenceKinds(m, task, obligationId) {
    return new Set(passedEvidence(m, task, obligationId).map(e => String(e.kind).trim().toLowerCase()).filter(Boolean));
}
function hasEvidenceKind(m, task, kinds, obligationId) {
    const actual = evidenceKinds(m, task, obligationId);
    return kinds.some(kind => actual.has(kind));
}
function releaseEvidence(m) {
    if (missionRequiresPackagePublish(m))
        return m.release.release_chain?.package?.outcome === 'success' && m.release.release_chain.package.remote_verified === true;
    if (missionRequiresReleaseCreate(m))
        return m.release.release_chain?.release?.outcome === 'success' && m.release.release_chain.release.remote_verified === true;
    return m.release.release_chain?.quality?.verified === true;
}
function projectMethodologyNameFromArtifact(file) {
    const path = file.split('\\').join('/').replace(/^\.\//, '');
    const skill = path.match(/(?:^|\/)\.opencode\/skills\/(hi-project-[a-z0-9-]+)(?:\/|$)/)?.[1];
    if (skill)
        return skill;
    return path.match(/(?:^|\/)\.opencode\/hi\/(?:policy|provenance)\/methodologies\/(hi-project-[a-z0-9-]+)\.json$/)?.[1];
}
function methodologyAdmissionEvidence(task, projectRoot, result) {
    if (!projectRoot || !task)
        return false;
    const admitted = new Set(discoverProjectMethodologyPolicies(projectRoot).map(x => x.name));
    const files = result?.changed_files ?? task.result?.changed_files ?? [];
    return files.some(file => { const name = projectMethodologyNameFromArtifact(file); return Boolean(name && admitted.has(name)); });
}
export function methodologyExitCheck(m, name, input = {}) {
    const policy = methodologyCatalogEntry(name, input.projectRoot);
    if (!policy)
        return { ok: false, missing: [] };
    const task = input.task, result = input.result ?? task?.result, missing = [];
    for (const requirement of policy.exitRequirements) {
        const spec = HI_METHODOLOGY_EXIT_REQUIREMENT_CATALOG[requirement];
        if (input.scope && spec.scope !== input.scope)
            continue;
        let ok = false;
        switch (requirement) {
            case 'task-success':
                ok = result?.status === 'DONE' || Boolean(!task && input.obligationId && m.execution.obligations.some(o => o.id === input.obligationId && o.status === 'closed'));
                break;
            case 'no-open-issues':
                ok = (result?.open_issues?.length ?? 0) === 0;
                break;
            case 'context-resolved':
                ok = result?.status === 'DONE' && (result.needs_context?.length ?? 0) === 0;
                break;
            case 'decision-evidence':
                ok = hasEvidenceKind(m, task, ['decision-evidence']);
                break;
            case 'diagnostic-evidence':
                ok = hasEvidenceKind(m, task, ['diagnostic-evidence']);
                break;
            case 'measurement-evidence':
                ok = hasEvidenceKind(m, task, ['measurement-evidence']);
                break;
            case 'browser-evidence':
                ok = hasEvidenceKind(m, task, ['browser-evidence']);
                break;
            case 'visual-evidence':
                ok = hasEvidenceKind(m, task, ['visual-evidence']);
                break;
            case 'accessibility-evidence':
                ok = hasEvidenceKind(m, task, ['accessibility-evidence']);
                break;
            case 'source-provenance-evidence':
                ok = hasEvidenceKind(m, task, ['source-provenance-evidence']);
                break;
            case 'targeted-test-evidence':
                ok = hasEvidenceKind(m, task, ['targeted-tests']);
                break;
            case 'fresh-verification':
                ok = verificationSatisfied(m).ok;
                break;
            case 'review-evidence':
                ok = hasEvidenceKind(m, task, ['review-evidence'], input.obligationId);
                break;
            case 'release-evidence':
                ok = releaseEvidence(m);
                break;
            case 'methodology-admission':
                ok = methodologyAdmissionEvidence(task, input.projectRoot, result);
                break;
        }
        if (!ok)
            missing.push(requirement);
    }
    return { ok: missing.length === 0, missing };
}
export function reconcileMethodologyExits(m, projectRoot) {
    const resolved = [], remaining = [];
    for (const need of m.methodology.methodology_needs) {
        let task = need.task_id ? m.execution.tasks.find(t => t.id === need.task_id) : undefined;
        const taskWorkerId = task?.worker_id;
        let worker = taskWorkerId ? m.execution.workers.find(w => w.id === taskWorkerId) : undefined;
        if (!task) {
            worker = [...m.execution.workers].reverse().find(w => w.loaded_methodologies.includes(need.name) && w.status === 'completed');
            task = worker ? m.execution.tasks.find(t => t.id === worker.task_id) : undefined;
        }
        const childLoaded = Boolean(worker?.loaded_methodologies.includes(need.name)), parentLoaded = m.methodology.parent_loaded_methodologies.includes(need.name);
        if (!childLoaded && !parentLoaded) {
            remaining.push(need);
            continue;
        }
        const check = methodologyExitCheck(m, need.name, { task, worker, result: task?.result, projectRoot, obligationId: need.obligation_id });
        if (!check.ok) {
            remaining.push(need);
            continue;
        }
        resolved.push(need.name);
        appendLedger(m, 'methodology.resolved', { task_id: task?.id, payload: { name: need.name, signal: need.signal, trigger_source: need.trigger_source, producer: need.producer, obligation_id: need.obligation_id, reason: 'canonical exit requirements satisfied' } });
    }
    m.methodology.methodology_needs = remaining;
    return [...new Set(resolved)];
}
