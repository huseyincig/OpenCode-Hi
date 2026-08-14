import { payloadHash } from './idempotency.js';
import { appendLedger } from '../ledger/ledger.js';
import { notePrivilegedReleaseOutcome } from './release-chain.js';
import { externalActionType, externalEffectCommand } from './command-classifier.js';
import { openHumanDecision, resolveHumanDecision } from '../human-decision/runtime.js';
const APPROVE = /^\s*(approve|approved|I approve|approve this action)\s*[.!]?\s*$/i;
const CONFIRM_SUCCESS = /^\s*(confirm action succeeded|action succeeded|I confirm the action succeeded)\s*[.!]?\s*$/i;
const CONFIRM_FAILURE = /^\s*(confirm action failed|action failed|I confirm the action failed)\s*[.!]?\s*$/i;
export function privilegedAction(command) { return externalEffectCommand(command); }
export function actionContract(command, cwd) { const action_type = externalActionType(command); if (!action_type)
    throw new Error('Hi authority contract: command is not a canonical external action.'); const target = { cwd: cwd ?? '', command: command.trim() }, action = `cwd=${target.cwd}\ncommand=${target.command}`, hash = payloadHash(action); return { authority_id: `auth_${hash.slice(0, 20)}`, action_type, target, action, hash, requested_by: 'mission-parent', required_reason: 'privileged-external-effect', one_shot: true }; }
function authorityObligation(m, hash) { return m.execution.obligations.find(x => x.id === `o-authority-${hash.slice(0, 10)}` && x.kind === 'authority' && x.status === 'open'); }
export function isAuthorized(m, command, cwd) { const c = actionContract(command, cwd); return m.authority.authority?.approved?.hash === c.hash; }
export function claimAuthorizedAction(m, command, cwd) { const c = actionContract(command, cwd); if (m.authority.authority?.executing?.hash === c.hash)
    return 'duplicate'; if ((m.authority.authority?.completed_hashes ?? []).includes(c.hash))
    return 'duplicate'; return 'new'; }
export function consumeAuthority(m, command, cwd) { const c = actionContract(command, cwd); if (m.authority.authority?.approved?.hash === c.hash)
    m.authority.authority = { ...m.authority.authority, approved: undefined }; }
export function beginAuthorizedAction(m, command, cwd) { const c = actionContract(command, cwd); let o = authorityObligation(m, c.hash); if (!o) {
    const generic = m.execution.obligations.find(x => x.id === 'o-authority' && x.kind === 'authority' && x.status === 'open');
    if (generic) {
        generic.id = `o-authority-${c.hash.slice(0, 10)}`;
        generic.summary = `External privileged action ${c.hash.slice(0, 10)} authorized by OpenCode permission policy and completed`;
        o = generic;
    }
    else {
        o = { id: `o-authority-${c.hash.slice(0, 10)}`, kind: 'authority', summary: `External privileged action ${c.hash.slice(0, 10)} authorized by OpenCode permission policy and completed`, status: 'open' };
        m.execution.obligations.push(o);
    }
    appendLedger(m, 'authority.bound-to-native-permission', { payload: { obligation: o.id, hash: c.hash } });
} m.authority.authority = { ...(m.authority.authority ?? {}), executing: { hash: c.hash, action: c.action, started_at: Date.now() }, approved: undefined }; m.identity.status = 'active'; appendLedger(m, 'authority.execution.started', { payload: { hash: c.hash, authority: 'opencode-native-permission' } }); }
export function completeAuthorizedAction(m, command, cwd, outcome, detail) { const c = actionContract(command, cwd), executing = m.authority.authority?.executing; if (!executing || executing.hash !== c.hash)
    return false; if (outcome === 'unknown') {
    appendLedger(m, 'authority.execution.uncertain', { payload: { hash: c.hash, detail: detail?.slice(0, 240), retry: 'forbidden-until-user-reconciliation' } });
    openHumanDecision(m, { semantic_type: 'authority_request', reason_code: 'authority-execution-uncertain', summary: 'The exact privileged action has an unknown execution outcome and must be reconciled before any retry.', response_schema: { kind: 'authority-protocol', protocol: 'reconcile-action-outcome' }, authority_ref: c.hash });
    return false;
} m.authority.authority = { ...m.authority.authority, executing: undefined }; if (outcome === 'success') {
    const completed = m.authority.authority.completed_hashes ?? [];
    m.authority.authority.completed_hashes = [...new Set([...completed, c.hash])].slice(-64);
    const o = authorityObligation(m, c.hash);
    if (o) {
        o.status = 'closed';
        o.closedAt = Date.now();
    }
    appendLedger(m, 'authority.execution.completed', { payload: { hash: c.hash, detail: detail?.slice(0, 240) } });
    return true;
} appendLedger(m, 'authority.execution.failed', { payload: { hash: c.hash, detail: detail?.slice(0, 240), retry: 'new-explicit-action-contract-required' } }); openHumanDecision(m, { semantic_type: 'authority_request', reason_code: 'authority-execution-failed', summary: 'The privileged action failed; any retry requires a new exact action contract.', response_schema: { kind: 'authority-protocol', protocol: 'new-exact-action-contract' }, authority_ref: c.hash }); return false; }
export function requireAuthority(m, command, cwd) { const c = actionContract(command, cwd); let o = authorityObligation(m, c.hash); if (!o) {
    o = { id: `o-authority-${c.hash.slice(0, 10)}`, kind: 'authority', summary: `External privileged action ${c.hash.slice(0, 10)} explicitly authorized and completed`, status: 'open' };
    m.execution.obligations.push(o);
    appendLedger(m, 'obligation.opened', { payload: { obligation: o.id, kind: 'authority', hash: c.hash } });
} m.authority.authority = { ...(m.authority.authority ?? {}), pending: { hash: c.hash, action: c.action, created_at: Date.now() } }; openHumanDecision(m, { semantic_type: 'authority_request', reason_code: 'authority-approval-required', summary: `Exact privileged action ${c.hash.slice(0, 12)} requires explicit authority before execution.`, response_schema: { kind: 'authority-protocol', protocol: 'approve-exact-action' }, authority_ref: c.hash }); throw new Error(`Hi authority boundary: explicit approval required for exact action contract ${c.hash}. Reply with 'approve' to authorize this exact action. Generic continuation commands do not approve privileged actions. Action was not executed.`); }
export function approvePendingAuthority(m, text) { if (!APPROVE.test(text) || !m.authority.authority?.pending)
    return false; const p = m.authority.authority.pending; m.authority.authority = { ...m.authority.authority, pending: undefined, approved: { hash: p.hash, approved_at: Date.now() } }; resolveHumanDecision(m, 'authority-approved'); m.identity.status = 'active'; appendLedger(m, 'authority.approved', { payload: { hash: p.hash } }); return true; }
export function resolveUncertainAuthority(m, text) { const e = m.authority.authority?.executing; if (!e)
    return false; const command = e.action.match(/(?:^|\n)command=([^\n]*)/)?.[1] ?? ''; if (CONFIRM_SUCCESS.test(text)) {
    const completed = m.authority.authority?.completed_hashes ?? [];
    m.authority.authority = { ...m.authority.authority, executing: undefined, completed_hashes: [...new Set([...completed, e.hash])].slice(-64) };
    const o = authorityObligation(m, e.hash);
    if (o) {
        o.status = 'closed';
        o.closedAt = Date.now();
    }
    if (command)
        notePrivilegedReleaseOutcome(m, command, 'success');
    resolveHumanDecision(m, 'authority-outcome-confirmed-success');
    m.identity.status = 'active';
    appendLedger(m, 'authority.execution.user-confirmed', { payload: { hash: e.hash, outcome: 'success' } });
    return true;
} if (CONFIRM_FAILURE.test(text)) {
    m.authority.authority = { ...m.authority.authority, executing: undefined };
    if (command)
        notePrivilegedReleaseOutcome(m, command, 'failure');
    resolveHumanDecision(m, 'authority-outcome-confirmed-failure');
    appendLedger(m, 'authority.execution.user-confirmed', { payload: { hash: e.hash, outcome: 'failure', retry: 'new-exact-action-contract-required' } });
    openHumanDecision(m, { semantic_type: 'authority_request', reason_code: 'authority-retry-contract-required', summary: 'The prior privileged action is confirmed failed; any retry requires a new exact action contract.', response_schema: { kind: 'authority-protocol', protocol: 'new-exact-action-contract' }, authority_ref: e.hash });
    return true;
} return false; }
