import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
function projectKey(projectRoot) {
    return createHash('sha256').update(resolve(projectRoot)).digest('hex').slice(0, 24);
}
export function hiStateRoot(projectRoot) {
    const explicit = process.env.OPENCODE_HI_STATE_DIR;
    if (explicit)
        return join(resolve(explicit), 'projects', projectKey(projectRoot));
    const xdg = process.env.XDG_STATE_HOME;
    if (xdg)
        return join(resolve(xdg), 'opencode-hi', 'projects', projectKey(projectRoot));
    const local = process.env.LOCALAPPDATA;
    if (local)
        return join(resolve(local), 'OpenCode-Hi', 'state', 'projects', projectKey(projectRoot));
    return join(homedir(), '.local', 'state', 'opencode-hi', 'projects', projectKey(projectRoot));
}
export function runtimeStatePath(projectRoot) {
    return join(hiStateRoot(projectRoot), 'runtime-state.json');
}
export function runtimeInstanceLockPath(projectRoot) {
    return join(hiStateRoot(projectRoot), 'runtime-instance.lock');
}
