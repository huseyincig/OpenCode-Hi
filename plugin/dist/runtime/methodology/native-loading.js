import { methodologyCatalogEntry, methodologyLimits } from './catalog.js';
export function requestedMethodologyName(args) {
    if (!args || typeof args !== 'object')
        return undefined;
    const value = args;
    for (const key of ['name', 'skill', 'skill_name', 'skillName']) {
        const candidate = value[key];
        if (typeof candidate === 'string' && candidate.trim())
            return candidate.trim();
    }
    return undefined;
}
export function assertChildMethodologyLoad(worker, name) {
    const allowed = new Set(worker?.selected_methodologies ?? []);
    if (!allowed.has(name))
        throw new Error(`Hi child methodology guard: '${name}' is outside this worker methodology allowlist.`);
}
export function assertParentMethodologyLoad(mission, name, projectRoot) {
    if (!methodologyCatalogEntry(name, projectRoot))
        throw new Error(`Hi methodology guard: '${name}' is not in the admitted methodology catalog.`);
    if (!mission.methodology_needs.some(need => need.name === name))
        throw new Error(`Hi methodology guard: '${name}' was not selected by Hi for this mission.`);
    if (!mission.parent_loaded_methodologies.includes(name) && mission.parent_loaded_methodologies.length >= methodologyLimits.hardMax) {
        throw new Error(`Hi methodology budget: parent session may load at most ${methodologyLimits.hardMax} distinct methodologies for one mission.`);
    }
}
export function recordParentMethodologyLoad(mission, name) {
    if (!mission.parent_loaded_methodologies.includes(name))
        mission.parent_loaded_methodologies.push(name);
}
export function recordChildMethodologyLoad(worker, name) {
    if (!worker)
        return;
    assertChildMethodologyLoad(worker, name);
    if (!worker.loaded_methodologies.includes(name))
        worker.loaded_methodologies.push(name);
}
