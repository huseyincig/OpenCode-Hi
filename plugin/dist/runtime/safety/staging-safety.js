import { appendLedger } from '../ledger/ledger.js';
function normFile(v) { return v.trim().replace(/\\/g, '/').replace(/^\.\//, ''); }
function splitLines(text) { return [...new Set(text.split(/\r?\n/).map(normFile).filter(Boolean))]; }
function commandText(output) { if (typeof output === 'string')
    return output; if (typeof output?.output === 'string')
    return output.output; if (typeof output?.stdout === 'string')
    return output.stdout; if (typeof output?.data === 'string')
    return output.data; return ''; }
export function isStagingInspection(command) { return /^\s*git\s+diff\s+(?:--cached|--staged)\s+--name-only(?:\s|$)/i.test(command); }
export function isGitStatusInspection(command) { return /^\s*git\s+status\s+(?:--porcelain(?:=v?1)?|-s|--short)(?:\s|$)/i.test(command); }
export function isGitCommit(command) { return /^\s*git\s+(?:-[^\s]+\s+)*commit(?:\s|$)/i.test(command); }
export function isGitTopologyMutation(command) { return /^\s*git\s+(?:switch|checkout|merge|rebase|cherry-pick)(?:\s|$)/i.test(command); }
export function broadGitStage(command) {
    const c = command.trim();
    if (!/^git\s+add(?:\s|$)/i.test(c))
        return false;
    return /(?:^|\s)(?:-A|--all|-u|--update|\.|\.\/|\*|:\/)(?:\s|$)/i.test(c) || /git\s+add\s+--?\s*\.\s*$/i.test(c);
}
export function commitStagesTrackedChanges(command) { return isGitCommit(command) && (/(?:^|\s)--all(?:\s|$)/i.test(command) || /(?:^|\s)-[a-z]*a[a-z]*(?:\s|$)/i.test(command)); }
export function commitHasDirectPathspec(command) { return isGitCommit(command) && (/(?:^|\s)(?:-o|--only|-i|--include)(?:\s|$)/i.test(command) || /\s--\s+\S/.test(command)); }
export function mutatesGitIndex(command) { return /^\s*git\s+(?:add|reset|rm|mv)(?:\s|$)/i.test(command) || /^\s*git\s+restore\b[^\n]*\s--staged(?:\s|$)/i.test(command); }
export function recordPreexistingUserBaseline(m, baseline) {
    if (!baseline || m.preexisting_user_baseline_captured)
        return;
    m.preexisting_user_changes = { ...baseline };
    m.preexisting_user_baseline_captured = true;
    appendLedger(m, 'user-diff.baseline-captured', { payload: { files: Object.keys(baseline).slice(0, 80), count: Object.keys(baseline).length, policy: 'first-mission-native-baseline' } });
}
export function recordStagingInspection(m, command, output) {
    if (!isStagingInspection(command))
        return;
    const files = splitLines(commandText(output));
    m.staging_safety = { verified_files: files, verified_at: Date.now(), source: command.slice(0, 180) };
    if (m.git_topology_pending && !m.git_topology_pending.ownership_captured) {
        const conflict = m.git_topology_pending.conflict_files ?? [];
        m.git_topology_owned_files = [...new Set([...files, ...conflict])];
        m.git_topology_pending.ownership_captured = true;
        appendLedger(m, 'git.topology.staged-owned', { payload: { files: m.git_topology_owned_files.slice(0, 80), operation: m.git_topology_pending.command.slice(0, 180), policy: 'first-cached-set-plus-known-conflicts' } });
    }
    appendLedger(m, 'git.staging.inspected', { payload: { files: files.slice(0, 80), count: files.length } });
}
function porcelainPaths(text) {
    const out = [];
    for (const raw of text.split(/\r?\n/)) {
        if (!raw.trim())
            continue;
        const body = raw.length >= 3 ? raw.slice(3).trim() : raw.trim();
        const target = body.includes(' -> ') ? body.split(' -> ').pop() : body;
        if (target)
            out.push(normFile(target.replace(/^"|"$/g, '')));
    }
    return [...new Set(out.filter(Boolean))];
}
export function recordGitStatusInspection(m, command, output) {
    if (!isGitStatusInspection(command))
        return;
    const text = commandText(output), files = porcelainPaths(text);
    m.git_topology_safety = { clean: files.length === 0, verified_files: files, verified_at: Date.now(), source: command.slice(0, 180) };
    appendLedger(m, 'git.worktree.inspected', { payload: { clean: files.length === 0, files: files.slice(0, 80), count: files.length } });
}
export function invalidateGitTopologyProof(m) { m.git_topology_safety = undefined; }
export function beginGitTopologyMutation(m, command) { m.git_topology_pending = { command: command.slice(0, 300), started_at: Date.now() }; m.git_topology_owned_files = []; appendLedger(m, 'git.topology.started', { payload: { command: command.slice(0, 180) } }); }
export function completeGitTopologyMutation(m, command, success, text) { if (!isGitTopologyMutation(command))
    return; if (success) {
    m.blockers = m.blockers.filter(b => !b.startsWith('git-topology-conflict:'));
    appendLedger(m, 'git.topology.completed', { payload: { command: command.slice(0, 180) } });
    return;
} if (/conflict|resolve all conflicts|fix conflicts|could not apply/i.test(text)) {
    const blocker = `git-topology-conflict:${command.trim().split(/\s+/).slice(0, 3).join('-')}`;
    if (!m.blockers.includes(blocker))
        m.blockers.push(blocker);
    const conflicts = [...text.matchAll(/(?:conflict[^\n]*?in|merge conflict in)\s+([^\s\r\n]+)/ig)].map(x => normFile(String(x[1] ?? '').replace(/[,:;]+$/, ''))).filter(Boolean);
    if (m.git_topology_pending)
        m.git_topology_pending.conflict_files = [...new Set([...(m.git_topology_pending.conflict_files ?? []), ...conflicts])];
    appendLedger(m, 'git.topology.conflict', { payload: { command: command.slice(0, 180), blocker, conflict_files: conflicts.slice(0, 40) } });
}
else
    appendLedger(m, 'git.topology.failed', { payload: { command: command.slice(0, 180) } }); }
export function clearGitTopologyOwnershipAfterCommit(m) { m.git_topology_pending = undefined; m.git_topology_owned_files = []; m.blockers = m.blockers.filter(b => !b.startsWith('git-topology-conflict:')); appendLedger(m, 'git.topology.reconciled', { payload: { reason: 'commit-completed' } }); }
export function assertSafeGitMutation(m, command) {
    const pre = new Set(Object.keys(m.preexisting_user_changes ?? {}).map(normFile));
    if (broadGitStage(command) && pre.size) {
        appendLedger(m, 'git.staging.blocked', { payload: { reason: 'broad-stage-with-preexisting-user-diff', command: command.slice(0, 180), user_files: [...pre].slice(0, 40) } });
        throw new Error(`HHC staging safety: broad git staging is blocked because pre-existing user changes exist (${[...pre].slice(0, 8).join(', ')}). Stage only HHC-owned files explicitly.`);
    }
    if (commitStagesTrackedChanges(command) && pre.size) {
        appendLedger(m, 'git.commit.blocked', { payload: { reason: 'commit-all-with-preexisting-user-diff', command: command.slice(0, 180) } });
        throw new Error('HHC staging safety: git commit -a/--all is blocked while pre-existing user changes exist. Stage only HHC-owned files explicitly and commit without -a.');
    }
    if (commitHasDirectPathspec(command)) {
        appendLedger(m, 'git.commit.blocked', { payload: { reason: 'direct-pathspec-bypasses-staged-proof', command: command.slice(0, 180) } });
        throw new Error('HHC staging safety: pathspec/--only/--include commit modes are blocked because they bypass the verified staged-set contract. Stage HHC-owned files explicitly, inspect `git diff --cached --name-only`, then use a normal commit.');
    }
    if (isGitTopologyMutation(command)) {
        if (pre.size) {
            appendLedger(m, 'git.topology.blocked', { payload: { reason: 'preexisting-user-diff', command: command.slice(0, 180), user_files: [...pre].slice(0, 40) } });
            throw new Error(`HHC merge/rebase safety: branch topology changes are blocked while pre-existing user changes exist (${[...pre].slice(0, 8).join(', ')}). Preserve/resolve those user-owned edits outside HHC before switch/checkout/merge/rebase/cherry-pick.`);
        }
        const proof = m.git_topology_safety;
        if (!proof || Date.now() - proof.verified_at > 120000) {
            appendLedger(m, 'git.topology.blocked', { payload: { reason: 'worktree-not-inspected', command: command.slice(0, 180) } });
            throw new Error('HHC merge/rebase safety: run `git status --porcelain` immediately before switch/checkout/merge/rebase/cherry-pick. Branch topology mutation is blocked until worktree cleanliness is verified.');
        }
        if (!proof.clean) {
            appendLedger(m, 'git.topology.blocked', { payload: { reason: 'worktree-dirty', command: command.slice(0, 180), files: proof.verified_files.slice(0, 40) } });
            throw new Error(`HHC merge/rebase safety: worktree is not clean (${proof.verified_files.slice(0, 8).join(', ')}). Commit or safely reconcile HHC-owned changes first; never absorb user-owned dirty state into a merge/rebase.`);
        }
        appendLedger(m, 'git.topology.allowed', { payload: { command: command.slice(0, 180), proof_age_ms: Date.now() - proof.verified_at } });
        return;
    }
    if (!isGitCommit(command))
        return;
    const proof = m.staging_safety;
    if (!proof || Date.now() - proof.verified_at > 120000) {
        appendLedger(m, 'git.commit.blocked', { payload: { reason: 'staging-not-verified' } });
        throw new Error('HHC staging safety: inspect the exact staged set with `git diff --cached --name-only` immediately before commit. Commit is blocked until staged ownership is verified.');
    }
    const owned = new Set([...(m.changed_files ?? []), ...(m.git_topology_owned_files ?? [])].map(normFile));
    const staged = proof.verified_files.map(normFile);
    const user = staged.filter(f => pre.has(f));
    const unrelated = staged.filter(f => !owned.has(f));
    if (user.length || unrelated.length) {
        appendLedger(m, 'git.commit.blocked', { payload: { reason: 'staged-files-not-hhc-owned', user_files: user.slice(0, 40), unrelated: unrelated.slice(0, 40), owned: [...owned].slice(0, 80) } });
        throw new Error(`HHC staging safety: commit contains staged files outside HHC-owned delta: ${[...new Set([...user, ...unrelated])].slice(0, 12).join(', ')}. Preserve pre-existing user changes and stage only HHC-owned files.`);
    }
    appendLedger(m, 'git.commit.allowed', { payload: { staged: staged.slice(0, 80), ownership: 'hhc-owned-only' } });
}
export function invalidateStagingProof(m) { m.staging_safety = undefined; }
