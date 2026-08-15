import { HI_METHODOLOGY_SIGNAL_CATALOG } from '../../generated/methodology-policy.js';
import { appendLedger } from '../ledger/ledger.js';
import { methodologyCatalogEntry, methodologiesForSignal } from './catalog.js';
function signalSpec(signal) { return HI_METHODOLOGY_SIGNAL_CATALOG[signal]; }
export function createMethodologyNeed(name, signal, producer, reason, extra = {}, projectRoot) {
    const policy = methodologyCatalogEntry(name, projectRoot);
    if (!policy)
        throw new Error('Unknown or non-admitted Hi methodology: ' + name);
    if (!policy.activationSignals.includes(signal))
        throw new Error('Hi methodology signal not allowed: ' + name + ' <- ' + signal);
    const spec = signalSpec(signal);
    if (!spec)
        throw new Error('Unknown Hi methodology signal: ' + signal);
    if (!spec.producers.includes(producer))
        throw new Error('Hi methodology producer not allowed: ' + name + ' <- ' + signal + '/' + producer);
    return { name, signal, trigger_source: spec.trigger_source, producer, reason: reason.slice(0, 600), created_at: Date.now(), ...extra };
}
function addNeed(mission, need) {
    const duplicate = mission.methodology.methodology_needs.some(existing => existing.name === need.name && existing.signal === need.signal && existing.producer === need.producer && existing.task_id === need.task_id && existing.obligation_id === need.obligation_id);
    if (duplicate)
        return false;
    mission.methodology.methodology_needs.push(need);
    appendLedger(mission, 'methodology.activated', { task_id: need.task_id, payload: { name: need.name, signal: need.signal, trigger_source: need.trigger_source, producer: need.producer, obligation_id: need.obligation_id, reason: need.reason } });
    return true;
}
export function activateMethodologySignal(mission, projectRoot, input) {
    const spec = signalSpec(input.signal);
    if (!spec)
        throw new Error('Unknown Hi methodology signal: ' + input.signal);
    const activated = [];
    for (const entry of methodologiesForSignal(input.signal, projectRoot)) {
        const need = createMethodologyNeed(entry.name, input.signal, input.producer, input.reason, { task_id: input.taskId, obligation_id: input.obligationId }, projectRoot);
        if (addNeed(mission, need))
            activated.push(entry.name);
    }
    return activated;
}
export function methodologyNames(needs) {
    return [...new Set(needs.map(item => item.name))];
}
export function bindMethodologyNeeds(mission, names, input) {
    const selected = new Set(names), obligations = [...new Set(input.obligationIds ?? [])];
    for (const need of mission.methodology.methodology_needs) {
        if (!selected.has(need.name) || need.task_id)
            continue;
        if (need.obligation_id && obligations.length && !obligations.includes(need.obligation_id))
            continue;
        need.task_id = input.taskId;
        if (!need.obligation_id && obligations.length === 1)
            need.obligation_id = obligations[0];
        appendLedger(mission, 'methodology.bound', { task_id: input.taskId, payload: { name: need.name, signal: need.signal, producer: need.producer, obligation_id: need.obligation_id } });
    }
}
export function bindParentMethodologyNeeds(mission, names, obligationId) {
    const selected = new Set(names);
    for (const need of mission.methodology.methodology_needs) {
        if (!selected.has(need.name) || need.task_id || need.obligation_id)
            continue;
        need.obligation_id = obligationId;
        appendLedger(mission, 'methodology.bound', { payload: { name: need.name, signal: need.signal, producer: need.producer, obligation_id: obligationId, owner: 'parent-direct' } });
    }
}
export function suppressIntentMethodologySignals(mission, signals, reason) {
    const suppressed = new Set(signals), removed = [];
    mission.methodology.methodology_needs = mission.methodology.methodology_needs.filter(need => {
        if (need.producer !== 'intent' || !suppressed.has(need.signal))
            return true;
        removed.push(need);
        return false;
    });
    for (const need of removed)
        appendLedger(mission, 'methodology.suppressed', { task_id: need.task_id, payload: { name: need.name, signal: need.signal, trigger_source: need.trigger_source, producer: need.producer, obligation_id: need.obligation_id, reason: reason.slice(0, 600) } });
    return [...new Set(removed.map(item => item.name))];
}
