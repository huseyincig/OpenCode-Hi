import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const KEY = Symbol.for('hi.active-runtime-instances');
function registry() { const g = globalThis; const existing = g[KEY]; if (existing?.byOwner instanceof WeakMap)
    return existing; const next = { byOwner: new WeakMap() }; g[KEY] = next; return next; }
function errorCode(error) { return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined; }
function alive(pid) { try {
    process.kill(pid, 0);
    return true;
}
catch (error) {
    return errorCode(error) === 'EPERM';
} }
function parseLease(raw) { try {
    const x = JSON.parse(raw);
    return x?.schema === 1 && Number.isSafeInteger(x.pid) && x.pid > 0 && typeof x.token === 'string' && x.token && Number.isFinite(x.started_at) && x.started_at > 0 ? x : undefined;
}
catch {
    return undefined;
} }
function releaseFileLease(lockPath, token) { try {
    const current = parseLease(readFileSync(lockPath, 'utf8'));
    if (current?.token === token)
        rmSync(lockPath, { force: true });
}
catch (error) {
    if (!['ENOENT', 'ENOTDIR'].includes(errorCode(error) ?? ''))
        throw error;
} }
function acquireFileLease(lockPath, token, now) {
    mkdirSync(dirname(lockPath), { recursive: true, mode: 0o700 });
    for (let attempt = 0; attempt < 4; attempt++) {
        let fd;
        try {
            fd = openSync(lockPath, 'wx', 0o600);
            const record = { schema: 1, pid: process.pid, token, started_at: now() };
            writeFileSync(fd, `${JSON.stringify(record)}\n`, { encoding: 'utf8' });
            fsyncSync(fd);
            closeSync(fd);
            return;
        }
        catch (error) {
            if (fd !== undefined)
                try {
                    closeSync(fd);
                }
                catch { }
            if (errorCode(error) !== 'EEXIST')
                throw error;
            let current, age = 0;
            try {
                const raw = readFileSync(lockPath, 'utf8');
                current = parseLease(raw);
                age = Math.max(0, now() - statSync(lockPath).mtimeMs);
            }
            catch (readError) {
                if (errorCode(readError) === 'ENOENT')
                    continue;
                throw readError;
            }
            if (current && alive(current.pid))
                throw new Error(`Duplicate OpenCode-Hi runtime writer detected for ${lockPath}; active pid=${current.pid}.`);
            if (!current && age < 5000)
                throw new Error(`OpenCode-Hi runtime writer lease is incomplete and too recent to recover safely: ${lockPath}`);
            const quarantine = `${lockPath}.stale.${process.pid}.${randomUUID()}`;
            try {
                renameSync(lockPath, quarantine);
                rmSync(quarantine, { force: true });
            }
            catch (reapError) {
                if (errorCode(reapError) === 'ENOENT')
                    continue;
                throw reapError;
            }
        }
    }
    throw new Error(`Unable to acquire OpenCode-Hi runtime writer lease: ${lockPath}`);
}
export function acquireHiRuntimeInstance(projectKey, owner, options = {}) {
    const key = projectKey || 'unknown-project', r = registry(), bucket = r.byOwner.get(owner) ?? new Map();
    if (!r.byOwner.has(owner))
        r.byOwner.set(owner, bucket);
    const existing = bucket.get(key);
    if (existing)
        throw new Error(`Duplicate OpenCode-Hi runtime detected for ${key}; refusing double hook registration.`);
    const token = `hi_${Date.now().toString(36)}_${randomUUID()}`;
    if (options.lockPath)
        acquireFileLease(options.lockPath, token, options.now ?? Date.now);
    bucket.set(key, token);
    let released = false;
    return { key, token, release: () => { if (released)
            return; released = true; if (bucket.get(key) === token)
            bucket.delete(key); if (options.lockPath)
            releaseFileLease(options.lockPath, token); } };
}
