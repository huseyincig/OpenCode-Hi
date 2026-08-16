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
            if (unit.attempt && unit.attempt.executionUnitId !== unit.id)
                reasons.push(`attempt-unit-mismatch:${unit.id}`);
        }
    }
    for (const edge of graph.edges) {
        const target = graph.nodes.find(node => node.id === edge.to);
        if (target && !target.dependencies.includes(edge.from))
            reasons.push(`orphan-edge:${edge.from}->${edge.to}`);
    }
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
