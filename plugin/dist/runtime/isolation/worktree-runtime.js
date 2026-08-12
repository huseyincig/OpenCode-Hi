import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
function git(cwd, args) { const out = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: false }); if (out.status !== 0)
    throw new Error(`git ${args[0]} failed: ${String(out.stderr ?? '').trim()}`); return String(out.stdout ?? '').trim(); }
function safeBranch(branch) { const b = branch.trim(); if (!b || b.length > 160 || /[\s;&|`$<>\\]/.test(b) || b.startsWith('-') || b.includes('..') || b.includes('@{'))
    throw new Error('Unsafe worktree branch name'); return b; }
function confined(root, target) { const r = resolve(root), t = resolve(target); return t === r || t.startsWith(r + sep); }
export class WorktreeRuntime {
    repoRoot;
    worktreeRoot;
    #states = new Map();
    constructor(repoRoot, worktreeRoot) {
        this.repoRoot = repoRoot;
        this.worktreeRoot = worktreeRoot;
    }
    create(branchInput, baseRef = 'HEAD') { const branch = safeBranch(branchInput), root = resolve(this.worktreeRoot), path = resolve(root, branch.replace(/\//g, '__')); if (!confined(root, path))
        throw new Error('Worktree path escapes configured root'); mkdirSync(dirname(path), { recursive: true }); if (existsSync(path))
        throw new Error('Worktree path already exists'); git(this.repoRoot, ['rev-parse', '--is-inside-work-tree']); git(this.repoRoot, ['worktree', 'add', '-b', branch, path, baseRef]); const state = { branch, path, baseRef, createdAt: Date.now(), status: 'active' }; this.#states.set(branch, state); return { ...state }; }
    remove(branchInput) { const branch = safeBranch(branchInput), state = this.#states.get(branch); if (!state || state.status !== 'active')
        return false; git(this.repoRoot, ['worktree', 'remove', state.path, '--force']); state.status = 'removed'; if (existsSync(state.path))
        rmSync(state.path, { recursive: true, force: true }); return true; }
    get(branch) { const s = this.#states.get(branch); return s ? { ...s } : undefined; }
    list() { return [...this.#states.values()].map(x => ({ ...x })); }
}
