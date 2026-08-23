import { existsSync, mkdirSync, openSync, closeSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { MODEL_ROUTED_CHILD_ROLES, isModelRoutedChildRole } from "./schema.js";
export function projectSettingsPath(projectRoot) { return join(projectRoot, ".opencode", "hi", "policy", "routing.json"); }
export function hasProjectSettings(projectRoot) { return existsSync(projectSettingsPath(projectRoot)); }
function record(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function uniqueModels(value) { if (!Array.isArray(value))
    return []; return [...new Set(value.map(String).map(x => x.trim()).filter(Boolean))]; }
function boundedInteger(value, name) {
    if (value === undefined)
        return undefined;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 8)
        throw new Error(`${name} must be an integer in 1..8`);
    return Number(value);
}
function workModeFromTopology(value) { return value === "single-agent" ? "single" : value === "multi-agent" ? "multi" : "adaptive"; }
function topologyFromWorkMode(value) { return value === "single" ? "single-agent" : value === "multi" ? "multi-agent" : "adaptive"; }
export function readProjectSettingsDocument(projectRoot) {
    const path = projectSettingsPath(projectRoot);
    if (!existsSync(path))
        return { path, doc: { schema: 1, type: "hi-routing", routing: {} } };
    let doc;
    try {
        doc = JSON.parse(readFileSync(path, "utf8"));
    }
    catch (error) {
        throw new Error(`Cannot read Hi project settings: ${String(error)}`);
    }
    if (!record(doc) || doc.schema !== 1 || doc.type !== "hi-routing")
        throw new Error("Cannot update Hi project settings: unsupported routing shape");
    if (doc.routing !== undefined && !record(doc.routing))
        throw new Error("Cannot update Hi project settings: routing must be an object");
    if (doc.execution !== undefined && !record(doc.execution))
        throw new Error("Cannot update Hi project settings: execution must be an object");
    return { path, doc };
}
function atomicWrite(path, text) {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let fd;
    try {
        fd = openSync(tmp, "wx");
        writeFileSync(fd, text, "utf8");
        closeSync(fd);
        fd = undefined;
        renameSync(tmp, path);
    }
    finally {
        if (fd !== undefined)
            try {
                closeSync(fd);
            }
            catch { }
        ;
        if (existsSync(tmp))
            try {
                rmSync(tmp, { force: true });
            }
            catch { }
    }
}
export function applyProjectSettings(projectRoot, patch) {
    if (!record(patch))
        throw new Error("Hi settings patch must be an object");
    if (patch.workMode !== undefined && !["adaptive", "single", "multi"].includes(patch.workMode))
        throw new Error("workMode must be adaptive, single, or multi");
    const maxAgents = boundedInteger(patch.maxAgents, "maxAgents"), parallelism = boundedInteger(patch.parallelism, "parallelism");
    if (patch.roleModels !== undefined && !record(patch.roleModels))
        throw new Error("roleModels must be an object");
    const normalizedRolePatch = {};
    for (const [role, value] of Object.entries(patch.roleModels ?? {})) {
        if (!isModelRoutedChildRole(role))
            throw new Error(`Unsupported Hi child role: ${role}`);
        if (value === null) {
            normalizedRolePatch[role] = null;
            continue;
        }
        if (!Array.isArray(value))
            throw new Error(`Role models for ${role} must be an array or null`);
        const ids = uniqueModels(value);
        if (!ids.length)
            throw new Error(`Role models for ${role} cannot be empty; use null to return the role to automatic`);
        normalizedRolePatch[role] = ids;
    }
    const { path, doc } = readProjectSettingsDocument(projectRoot), routing = record(doc.routing) ? { ...doc.routing } : {}, execution = record(doc.execution) ? { ...doc.execution } : {}, existingModels = record(routing.roleModels) ? { ...routing.roleModels } : {}, roleModels = { ...existingModels };
    if (patch.resetRoleModels)
        for (const role of MODEL_ROUTED_CHILD_ROLES)
            delete roleModels[role];
    for (const [role, value] of Object.entries(normalizedRolePatch)) {
        if (value === null)
            delete roleModels[role];
        else
            roleModels[role] = value;
    }
    const priorAdaptiveRoles = Array.isArray(routing.adaptiveRoles) ? routing.adaptiveRoles.map(String) : [], foreignAdaptiveRoles = priorAdaptiveRoles.filter(role => !isModelRoutedChildRole(role)), automaticRoles = new Set(priorAdaptiveRoles.filter(isModelRoutedChildRole));
    if (patch.resetRoleModels)
        for (const role of MODEL_ROUTED_CHILD_ROLES)
            automaticRoles.add(role);
    for (const [role, value] of Object.entries(normalizedRolePatch)) {
        if (value === null)
            automaticRoles.add(role);
        else
            automaticRoles.delete(role);
    }
    const currentMode = workModeFromTopology(execution.topology), workMode = patch.workMode ?? currentMode;
    if (patch.workMode !== undefined)
        execution.topology = topologyFromWorkMode(workMode);
    if (maxAgents !== undefined)
        execution.maxAgents = maxAgents;
    if (parallelism !== undefined)
        execution.parallelism = parallelism;
    if (workMode === "single") {
        execution.maxAgents = 1;
        execution.parallelism = 1;
    }
    if (workMode === "multi") {
        if (Number(execution.maxAgents ?? 4) < 2)
            execution.maxAgents = 2;
        if (Number(execution.parallelism ?? 2) < 1)
            execution.parallelism = 1;
    }
    routing.roleModels = roleModels;
    routing.adaptiveRoles = [...foreignAdaptiveRoles, ...automaticRoles];
    routing.modelPolicy = Object.keys(roleModels).some(isModelRoutedChildRole) ? "manual" : "adaptive";
    const next = { ...doc, schema: 1, type: "hi-routing", execution, routing, applied_at: Date.now(), applied_by: "opencode-hi" };
    atomicWrite(path, JSON.stringify(next, null, 2) + "\n");
    return { path, workMode, execution: { topology: (execution.topology ?? "adaptive"), maxAgents: typeof execution.maxAgents === "number" ? execution.maxAgents : undefined, parallelism: typeof execution.parallelism === "number" ? execution.parallelism : undefined }, roleModels: Object.fromEntries(MODEL_ROUTED_CHILD_ROLES.flatMap(role => Array.isArray(roleModels[role]) ? [[role, uniqueModels(roleModels[role])]] : [])) };
}
