import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { runtimeStatePath } from '../storage/locations.js';
import { validateMissionEnvelope } from '../mission/validators.js';
export const RUNTIME_STATE_SCHEMA = 10;
function isRecord(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
const STATE_KEYS = new Set(['schema', 'updated_at', 'runtime', 'missions']);
const RUNTIME_KEYS = new Set(['boot_id', 'started_at', 'clean_shutdown', 'last_saved_at', 'previous_boot_id']);
function finiteTimestamp(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
function bootID() { return `boot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`; }
function errorCode(error) { return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined; }
function syncDirectory(path) {
    let fd;
    try {
        fd = openSync(path, 'r');
        fsyncSync(fd);
    }
    catch (error) {
        if (!['EPERM', 'EACCES', 'ENOTSUP', 'EINVAL', 'EISDIR'].includes(errorCode(error) ?? ''))
            throw error;
    }
    finally {
        if (fd !== undefined)
            closeSync(fd);
    }
}
function atomicReplace(path, content, bootId) {
    const parent = dirname(path), tmp = `${path}.${process.pid}.${bootId}.${randomUUID()}.tmp`;
    let fd;
    try {
        fd = openSync(tmp, 'wx', 0o600);
        writeFileSync(fd, content, { encoding: 'utf8' });
        fsyncSync(fd);
        closeSync(fd);
        fd = undefined;
        renameSync(tmp, path);
        syncDirectory(parent);
    }
    catch (error) {
        if (fd !== undefined)
            try {
                closeSync(fd);
            }
            catch { }
        ;
        try {
            rmSync(tmp, { force: true });
        }
        catch { }
        ;
        throw error;
    }
}
export class RuntimePersistence {
    path;
    bootId = bootID();
    startedAt = Date.now();
    previousBootId;
    lastLoadReport = { targetSchema: RUNTIME_STATE_SCHEMA, loaded: 0 };
    constructor(projectRoot) { this.path = runtimeStatePath(projectRoot); }
    load() {
        if (!existsSync(this.path)) {
            this.lastLoadReport = { targetSchema: RUNTIME_STATE_SCHEMA, loaded: 0 };
            return [];
        }
        try {
            const parsed = JSON.parse(readFileSync(this.path, 'utf8'));
            if (!isRecord(parsed))
                throw new Error('runtime state is not an object');
            if (Object.keys(parsed).some(key => !STATE_KEYS.has(key)) || Object.keys(parsed).length !== STATE_KEYS.size)
                throw new Error('runtime state envelope keys invalid');
            if (!finiteTimestamp(parsed.updated_at))
                throw new Error('runtime state updated_at invalid');
            const schema = Number(parsed.schema);
            if (schema !== RUNTIME_STATE_SCHEMA)
                throw new Error(`unsupported runtime-state schema ${String(parsed.schema)}`);
            if (!Array.isArray(parsed.missions))
                throw new Error('missions is not an array');
            const missions = [], sessionIDs = new Set(), missionIDs = new Set();
            for (let index = 0; index < parsed.missions.length; index++) {
                const mission = parsed.missions[index];
                if (!validateMissionEnvelope(mission))
                    throw new Error(`invalid mission state at index ${index}`);
                if (sessionIDs.has(mission.identity.session_id))
                    throw new Error(`duplicate persisted session identity ${mission.identity.session_id}`);
                if (missionIDs.has(mission.identity.mission_id))
                    throw new Error(`duplicate persisted mission identity ${mission.identity.mission_id}`);
                sessionIDs.add(mission.identity.session_id);
                missionIDs.add(mission.identity.mission_id);
                missions.push(mission);
            }
            const runtime = parsed.runtime;
            if (!isRecord(runtime) || Object.keys(runtime).some(key => !RUNTIME_KEYS.has(key)) || !['boot_id', 'started_at', 'clean_shutdown', 'last_saved_at'].every(key => Object.prototype.hasOwnProperty.call(runtime, key)) || typeof runtime.boot_id !== 'string' || !runtime.boot_id || typeof runtime.clean_shutdown !== 'boolean' || !finiteTimestamp(runtime.started_at) || !finiteTimestamp(runtime.last_saved_at) || (runtime.previous_boot_id !== undefined && (typeof runtime.previous_boot_id !== 'string' || !runtime.previous_boot_id)))
                throw new Error('runtime envelope invalid');
            this.previousBootId = runtime.boot_id;
            this.lastLoadReport = { sourceSchema: schema, targetSchema: RUNTIME_STATE_SCHEMA, loaded: missions.length, previousBootId: runtime.boot_id, uncleanShutdown: runtime.clean_shutdown === false };
            return missions;
        }
        catch (error) {
            this.lastLoadReport = { targetSchema: RUNTIME_STATE_SCHEMA, loaded: 0, error: String(error) };
            return [];
        }
    }
    save(missions, cleanShutdown = false) {
        const sessionIDs = new Set(), missionIDs = new Set();
        for (let index = 0; index < missions.length; index++) {
            const mission = missions[index], sessionID = mission?.identity?.session_id, missionID = mission?.identity?.mission_id;
            if (typeof sessionID === 'string' && sessionIDs.has(sessionID))
                throw new Error(`refusing to persist duplicate session identity ${sessionID}`);
            if (typeof missionID === 'string' && missionIDs.has(missionID))
                throw new Error(`refusing to persist duplicate mission identity ${missionID}`);
            if (!validateMissionEnvelope(mission))
                throw new Error(`refusing to persist invalid mission state at index ${index}`);
            sessionIDs.add(mission.identity.session_id);
            missionIDs.add(mission.identity.mission_id);
        }
        mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
        const now = Date.now();
        const payload = { schema: RUNTIME_STATE_SCHEMA, updated_at: now, runtime: { boot_id: this.bootId, started_at: this.startedAt, clean_shutdown: cleanShutdown, last_saved_at: now, previous_boot_id: this.previousBootId }, missions };
        atomicReplace(this.path, `${JSON.stringify(payload, null, 2)}\n`, this.bootId);
    }
    markRunning(missions) { this.save(missions, false); }
    markCleanShutdown(missions) { this.save(missions, true); }
}
