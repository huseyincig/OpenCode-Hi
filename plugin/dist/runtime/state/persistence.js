import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { runtimeStatePath } from '../storage/locations.js';
import { validateMissionEnvelope } from '../mission/validators.js';
export const RUNTIME_STATE_SCHEMA = 10;
function isRecord(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function bootID() { return `boot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`; }
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
            const schema = Number(parsed.schema);
            if (schema !== RUNTIME_STATE_SCHEMA)
                throw new Error(`unsupported runtime-state schema ${String(parsed.schema)}`);
            if (!Array.isArray(parsed.missions))
                throw new Error('missions is not an array');
            const missions = [];
            for (let index = 0; index < parsed.missions.length; index++) {
                const mission = parsed.missions[index];
                if (!validateMissionEnvelope(mission))
                    throw new Error(`invalid mission state at index ${index}`);
                missions.push(mission);
            }
            const runtime = parsed.runtime;
            if (!isRecord(runtime) || typeof runtime.boot_id !== 'string' || typeof runtime.clean_shutdown !== 'boolean')
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
        mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
        const now = Date.now();
        const payload = { schema: RUNTIME_STATE_SCHEMA, updated_at: now, runtime: { boot_id: this.bootId, started_at: this.startedAt, clean_shutdown: cleanShutdown, last_saved_at: now, previous_boot_id: this.previousBootId }, missions };
        const tmp = `${this.path}.tmp`;
        writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
        renameSync(tmp, this.path);
    }
    markRunning(missions) { this.save(missions, false); }
    markCleanShutdown(missions) { this.save(missions, true); }
}
