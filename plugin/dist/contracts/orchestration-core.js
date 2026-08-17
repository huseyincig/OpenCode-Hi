export function executionAttemptIdentity(input) {
    const attemptId = `${input.executionUnitId}:g${input.generation}:a${input.ordinal}`;
    return { executionUnitId: input.executionUnitId, attemptId, runId: `worker:${input.workerId}:g${input.generation}:a${input.ordinal}`, ordinal: input.ordinal, generation: input.generation };
}
export function sameExecutionAttempt(a, b) {
    return a.executionUnitId === b.executionUnitId && a.attemptId === b.attemptId && a.runId === b.runId && a.generation === b.generation;
}
export function sameExecutionAttemptFence(a, b) {
    return sameExecutionAttempt(a, b) && a.workerId === b.workerId && a.sessionId === b.sessionId;
}
function receiptPart(value) { return `${value.length}:${value}`; }
export function executionTransitionReceiptId(input) {
    return ['etr1', input.missionId, input.workNodeId, input.attempt.executionUnitId, input.attempt.attemptId, input.attempt.runId, String(input.attempt.generation), input.transition].map(receiptPart).join('|');
}
function dependencyCycles(nodes) {
    const dependencies = new Map(nodes.map(node => [node.id, node.dependencies.filter(dep => nodes.some(candidate => candidate.id === dep))]));
    const state = new Map(), stack = [], cycles = new Set();
    const visit = (id) => {
        const current = state.get(id) ?? 0;
        if (current === 2)
            return;
        if (current === 1) {
            const index = stack.lastIndexOf(id), cycle = index >= 0 ? [...stack.slice(index), id] : [id, id];
            cycles.add(cycle.join('->'));
            return;
        }
        state.set(id, 1);
        stack.push(id);
        for (const dep of dependencies.get(id) ?? [])
            visit(dep);
        stack.pop();
        state.set(id, 2);
    };
    for (const node of nodes)
        visit(node.id);
    return [...cycles].sort();
}
/** Mechanical graph invariants. Semantic policy belongs to planner/scheduler layers. */
export function validateWorkGraph(graph) {
    const reasons = [];
    const nodeIDs = graph.nodes.map(node => node.id), unitIDs = graph.executionUnits.map(unit => unit.id);
    if (new Set(nodeIDs).size !== nodeIDs.length)
        reasons.push('duplicate-work-node');
    if (new Set(unitIDs).size !== unitIDs.length)
        reasons.push('duplicate-execution-unit');
    const known = new Set(nodeIDs), unitsByNode = new Map();
    for (const unit of graph.executionUnits) {
        const list = unitsByNode.get(unit.workNodeId) ?? [];
        list.push(unit);
        unitsByNode.set(unit.workNodeId, list);
        if (unit.missionId !== graph.missionId)
            reasons.push(`unit-mission-mismatch:${unit.id}`);
        if (!known.has(unit.workNodeId))
            reasons.push(`unit-unknown-node:${unit.id}`);
    }
    const edgeKeys = new Set(graph.edges.map(edge => `${edge.from}\0${edge.to}\0${edge.kind}`));
    if (edgeKeys.size !== graph.edges.length)
        reasons.push('duplicate-dependency-edge');
    for (const edge of graph.edges) {
        if (edge.from === edge.to)
            reasons.push(`self-dependency:${edge.to}`);
        if (!known.has(edge.from) || !known.has(edge.to))
            reasons.push(`edge-unknown-node:${edge.from}->${edge.to}`);
    }
    for (const node of graph.nodes) {
        if (node.missionId !== graph.missionId)
            reasons.push(`node-mission-mismatch:${node.id}`);
        if (new Set(node.dependencies).size !== node.dependencies.length)
            reasons.push(`duplicate-node-dependency:${node.id}`);
        for (const dep of node.dependencies) {
            if (dep === node.id)
                reasons.push(`self-dependency:${node.id}`);
            if (!known.has(dep))
                reasons.push(`unknown-node-dependency:${node.id}:${dep}`);
            if (!edgeKeys.has(`${dep}\0${node.id}\0requires`))
                reasons.push(`missing-edge:${dep}->${node.id}`);
        }
        const units = unitsByNode.get(node.id) ?? [];
        if (units.length !== 1)
            reasons.push(`execution-unit-cardinality:${node.id}:${units.length}`);
        const unit = units[0];
        if (unit) {
            if (JSON.stringify(unit.dependencies) !== JSON.stringify(node.dependencies))
                reasons.push(`unit-dependency-drift:${unit.id}`);
            if (unit.attempt) {
                if (unit.attempt.executionUnitId !== unit.id)
                    reasons.push(`attempt-unit-mismatch:${unit.id}`);
                if (unit.attempt.ordinal < 0 || !Number.isInteger(unit.attempt.ordinal))
                    reasons.push(`attempt-ordinal-invalid:${unit.id}`);
                if (unit.attempt.generation < 1 || !Number.isInteger(unit.attempt.generation))
                    reasons.push(`attempt-generation-invalid:${unit.id}`);
                if (!unit.attempt.attemptId || !unit.attempt.runId)
                    reasons.push(`attempt-identity-missing:${unit.id}`);
                const expected = executionAttemptIdentity({ executionUnitId: unit.id, workerId: unit.attempt.workerId, ordinal: unit.attempt.ordinal, generation: unit.attempt.generation });
                if (!sameExecutionAttempt(unit.attempt, expected))
                    reasons.push(`attempt-identity-drift:${unit.id}`);
            }
        }
    }
    for (const edge of graph.edges) {
        const target = graph.nodes.find(node => node.id === edge.to);
        if (target && !target.dependencies.includes(edge.from))
            reasons.push(`orphan-edge:${edge.from}->${edge.to}`);
    }
    const delta = graph.progress.delta;
    if (delta) {
        const counts = [delta.evidenceAdded, delta.evidenceInvalidated, delta.dependencyCompletions, delta.changedFiles];
        if (counts.some(value => !Number.isInteger(value) || value < 0))
            reasons.push('progress-delta-count-invalid');
        if (!Array.isArray(delta.signals) || delta.signals.some(value => typeof value !== 'string'))
            reasons.push('progress-delta-signals-invalid');
    }
    for (const cycle of dependencyCycles(graph.nodes))
        reasons.push(`dependency-cycle:${cycle}`);
    return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}
export function isCapabilityResolution(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const item = value;
    return typeof item.capability === 'string' && item.capability.length > 0
        && ['NATIVE', 'HYBRID', 'HI_OWNED', 'UNAVAILABLE'].includes(String(item.implementation))
        && typeof item.available === 'boolean'
        && Array.isArray(item.semanticLoss) && item.semanticLoss.every(x => typeof x === 'string')
        && Array.isArray(item.reason) && item.reason.every(x => typeof x === 'string')
        && (item.implementation !== 'UNAVAILABLE' || item.available === false);
}
export function createSchedulerLifecycleState(missionId) {
    return { missionId, revision: 0, nextTicket: 1, reservations: [] };
}
export function schedulerReservationId(input) {
    return ['sr1', input.missionId, input.workNodeId, input.attempt.executionUnitId, input.attempt.attemptId, input.attempt.runId, String(input.attempt.generation)].map(receiptPart).join('|');
}
export function isSchedulerLifecycleState(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const state = value;
    if (typeof state.missionId !== 'string' || !state.missionId || !Number.isInteger(state.revision) || Number(state.revision) < 0 || !Number.isInteger(state.nextTicket) || Number(state.nextTicket) < 1 || !Array.isArray(state.reservations))
        return false;
    const ids = new Set(), units = new Set(), tickets = new Set();
    for (const raw of state.reservations) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            return false;
        const item = raw, attempt = item.attempt, resource = item.resource;
        if (typeof item.reservationId !== 'string' || !item.reservationId || typeof item.missionId !== 'string' || item.missionId !== state.missionId || typeof item.workNodeId !== 'string' || !item.workNodeId || typeof item.executionUnitId !== 'string' || !item.executionUnitId || typeof item.workerId !== 'string' || !item.workerId)
            return false;
        if (!['RESERVED', 'RUNNING', 'SETTLING', 'RECONCILING'].includes(String(item.phase)) || !Number.isInteger(item.ticket) || Number(item.ticket) < 1 || typeof item.reservedAt !== 'number' || !Number.isFinite(item.reservedAt) || typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt))
            return false;
        if (item.hostExecutionId !== undefined && (typeof item.hostExecutionId !== 'string' || !item.hostExecutionId))
            return false;
        if (['RUNNING', 'SETTLING'].includes(String(item.phase)) && typeof item.hostExecutionId !== 'string')
            return false;
        if (item.phase === 'RESERVED' && item.hostExecutionId !== undefined)
            return false;
        if (Number(item.updatedAt) < Number(item.reservedAt))
            return false;
        if (!attempt || typeof attempt.executionUnitId !== 'string' || typeof attempt.attemptId !== 'string' || typeof attempt.runId !== 'string' || !Number.isInteger(attempt.ordinal) || Number(attempt.ordinal) < 0 || !Number.isInteger(attempt.generation) || Number(attempt.generation) < 1)
            return false;
        const expectedAttempt = executionAttemptIdentity({ executionUnitId: String(attempt.executionUnitId), workerId: String(item.workerId), ordinal: Number(attempt.ordinal), generation: Number(attempt.generation) });
        if (!sameExecutionAttempt(attempt, expectedAttempt) || attempt.executionUnitId !== item.executionUnitId)
            return false;
        const expectedReservation = schedulerReservationId({ missionId: String(item.missionId), workNodeId: String(item.workNodeId), attempt: expectedAttempt });
        if (item.reservationId !== expectedReservation)
            return false;
        if (!resource || Array.isArray(resource) || (resource.provider !== undefined && typeof resource.provider !== 'string') || (resource.model !== undefined && typeof resource.model !== 'string'))
            return false;
        const ticket = Number(item.ticket);
        if (ids.has(String(item.reservationId)) || units.has(String(item.executionUnitId)) || tickets.has(ticket))
            return false;
        ids.add(String(item.reservationId));
        units.add(String(item.executionUnitId));
        tickets.add(ticket);
    }
    if (tickets.size && Math.max(...tickets) >= Number(state.nextTicket))
        return false;
    return true;
}
