import { payloadHash } from './idempotency.js';
import { appendLedger } from '../ledger/ledger.js';
import { notePrivilegedReleaseOutcome } from './release-chain.js';
const PRIVILEGED = /\b(git\s+push|npm\s+publish|pnpm\s+publish|yarn\s+publish|bun\s+publish|docker\s+push|kubectl\s+(apply|delete)|terraform\s+apply|gh\s+release\s+create|deploy|vercel\s+deploy|netlify\s+deploy)\b/i;
const APPROVE = /^\s*(approve|approved|I approve|approve this action)\s*[.!]?\s*$/i;
const CONFIRM_SUCCESS = /^\s*(confirm action succeeded|action succeeded|I confirm the action succeeded)\s*[.!]?\s*$/i;
const CONFIRM_FAILURE = /^\s*(confirm action failed|action failed|I confirm the action failed)\s*[.!]?\s*$/i;
export function privilegedAction(command) { return PRIVILEGED.test(command); }
export function actionContract(command, cwd) { const action = `cwd=${cwd ?? ''}\ncommand=${command.trim()}`; return { action, hash: payloadHash(action) }; }
function authorityObligation(m, hash) { return m.obligations.find(x => x.id === `o-authority-${hash.slice(0, 10)}` && x.kind === 'authority' && x.status === 'open'); }
export function isAuthorized(m, command, cwd) { const c = actionContract(command, cwd); return m.authority?.approved?.hash === c.hash; }
export function claimAuthorizedAction(m, command, cwd) { const c = actionContract(command, cwd); if (m.authority?.executing?.hash === c.hash)
    return 'duplicate'; if ((m.authority?.completed_hashes ?? []).includes(c.hash))
    return 'duplicate'; return 'new'; }
export function consumeAuthority(m, command, cwd) { const c = actionContract(command, cwd); if (m.authority?.approved?.hash === c.hash)
    m.authority = { ...m.authority, approved: undefined }; }
export function beginAuthorizedAction(m, command, cwd) { const c = actionContract(command, cwd); let o = authorityObligation(m, c.hash); if (!o) {
    const generic = m.obligations.find(x => x.id === 'o-authority' && x.kind === 'authority' && x.status === 'open');
    if (generic) {
        generic.id = `o-authority-${c.hash.slice(0, 10)}`;
        generic.summary = `External privileged action ${c.hash.slice(0, 10)} authorized by OpenCode permission policy and completed`;
        o = generic;
    }
    else {
        o = { id: `o-authority-${c.hash.slice(0, 10)}`, kind: 'authority', summary: `External privileged action ${c.hash.slice(0, 10)} authorized by OpenCode permission policy and completed`, status: 'open' };
        m.obligations.push(o);
    }
    appendLedger(m, 'authority.bound-to-native-permission', { payload: { obligation: o.id, hash: c.hash } });
} m.authority = { ...(m.authority ?? {}), executing: { hash: c.hash, action: c.action, started_at: Date.now() }, approved: undefined }; m.status = 'active'; appendLedger(m, 'authority.execution.started', { payload: { hash: c.hash, authority: 'opencode-native-permission' } }); }
export function completeAuthorizedAction(m, command, cwd, outcome, detail) { const c = actionContract(command, cwd), executing = m.authority?.executing; if (!executing || executing.hash !== c.hash)
    return false; if (outcome === 'unknown') {
    m.status = 'waiting-user';
    appendLedger(m, 'authority.execution.uncertain', { payload: { hash: c.hash, detail: detail?.slice(0, 240), retry: 'forbidden-until-user-reconciliation' } });
    return false;
} m.authority = { ...m.authority, executing: undefined }; if (outcome === 'success') {
    const completed = m.authority.completed_hashes ?? [];
    m.authority.completed_hashes = [...new Set([...completed, c.hash])].slice(-64);
    const o = authorityObligation(m, c.hash);
    if (o) {
        o.status = 'closed';
        o.closedAt = Date.now();
    }
    appendLedger(m, 'authority.execution.completed', { payload: { hash: c.hash, detail: detail?.slice(0, 240) } });
    return true;
} m.status = 'waiting-user'; appendLedger(m, 'authority.execution.failed', { payload: { hash: c.hash, detail: detail?.slice(0, 240), retry: 'new-explicit-action-contract-required' } }); return false; }
export function requireAuthority(m, command, cwd) { const c = actionContract(command, cwd); let o = authorityObligation(m, c.hash); if (!o) {
    o = { id: `o-authority-${c.hash.slice(0, 10)}`, kind: 'authority', summary: `External privileged action ${c.hash.slice(0, 10)} explicitly authorized and completed`, status: 'open' };
    m.obligations.push(o);
    appendLedger(m, 'obligation.opened', { payload: { obligation: o.id, kind: 'authority', hash: c.hash } });
} m.authority = { ...(m.authority ?? {}), pending: { hash: c.hash, action: c.action, created_at: Date.now() } }; m.status = 'waiting-user'; appendLedger(m, 'user.action.required', { payload: { kind: 'authority', hash: c.hash, action: c.action } }); throw new Error(`Hi authority boundary: explicit approval required for exact action contract ${c.hash}. Reply with 'approve' to authorize this exact action. Generic continuation commands do not approve privileged actions. Action was not executed.`); }
export function approvePendingAuthority(m, text) { if (!APPROVE.test(text) || !m.authority?.pending)
    return false; const p = m.authority.pending; m.authority = { ...m.authority, pending: undefined, approved: { hash: p.hash, approved_at: Date.now() } }; m.status = 'active'; appendLedger(m, 'authority.approved', { payload: { hash: p.hash } }); return true; }
export function resolveUncertainAuthority(m, text) { const e = m.authority?.executing; if (!e)
    return false; const command = e.action.match(/(?:^|\n)command=([^\n]*)/)?.[1] ?? ''; if (CONFIRM_SUCCESS.test(text)) {
    const completed = m.authority?.completed_hashes ?? [];
    m.authority = { ...m.authority, executing: undefined, completed_hashes: [...new Set([...completed, e.hash])].slice(-64) };
    const o = authorityObligation(m, e.hash);
    if (o) {
        o.status = 'closed';
        o.closedAt = Date.now();
    }
    if (command)
        notePrivilegedReleaseOutcome(m, command, 'success');
    m.status = 'active';
    appendLedger(m, 'authority.execution.user-confirmed', { payload: { hash: e.hash, outcome: 'success' } });
    return true;
} if (CONFIRM_FAILURE.test(text)) {
    m.authority = { ...m.authority, executing: undefined };
    if (command)
        notePrivilegedReleaseOutcome(m, command, 'failure');
    m.status = 'waiting-user';
    appendLedger(m, 'authority.execution.user-confirmed', { payload: { hash: e.hash, outcome: 'failure', retry: 'new-exact-action-contract-required' } });
    return true;
} return false; }
