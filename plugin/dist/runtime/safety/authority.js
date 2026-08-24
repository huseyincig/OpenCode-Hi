import { payloadHash } from './idempotency.js';
import { appendLedger } from '../ledger/ledger.js';
import { notePrivilegedReleaseOutcome } from './release-chain.js';
import { externalActionType, externalEffectCommand } from './command-classifier.js';
import { openHumanDecision, resolveHumanDecision } from '../human-decision/runtime.js';
import { redactDurableText } from '../privacy/boundary.js';
export const AUTHORITY_APPROVAL_TTL_MS = 5 * 60_000;
function freshAuthorityTimestamp(value, now = Date.now()) { return Number.isFinite(value) && value > 0 && now >= value && now - value <= AUTHORITY_APPROVAL_TTL_MS; }
export function privilegedAction(command) { return externalEffectCommand(command); }
export function actionContract(command, cwd) { const action_type = externalActionType(command); if (!action_type)
    throw new Error('Hi authority contract: command is not a canonical external action.'); const target = { cwd: cwd ?? '', command: command.trim() }, action = `cwd=${target.cwd}\ncommand=${target.command}`, hash = payloadHash(action); return { authority_id: `auth_${hash.slice(0, 20)}`, action_type, target, action, hash, requested_by: 'mission-parent', required_reason: 'privileged-external-effect', one_shot: true }; }
function durableAction(action) { return redactDurableText(action); }
function authorityObligation(m, hash) { return m.execution.obligations.find(x => x.id === `o-authority-${hash.slice(0, 10)}` && x.kind === 'authority' && x.status === 'open'); }
export function isAuthorized(m, command, cwd) { const c = actionContract(command, cwd), a = m.authority.authority?.approved; return Boolean(a && a.hash === c.hash && freshAuthorityTimestamp(a.approved_at)); }
export function claimAuthorizedAction(m, command, cwd) {
    const c = actionContract(command, cwd), a = m.authority.authority;
    if (a?.executing)
        return a.executing.hash === c.hash ? 'duplicate' : 'conflict';
    if (a?.pending)
        return a.pending.hash === c.hash ? 'duplicate' : 'conflict';
    if (a?.approved && a.approved.hash !== c.hash)
        return 'conflict';
    if ((a?.completed_hashes ?? []).includes(c.hash))
        return 'duplicate';
    return 'new';
}
export function beginAuthorizedAction(m, command, cwd) {
    const c = actionContract(command, cwd), a = m.authority.authority;
    if (a?.executing)
        throw new Error(`Hi authority boundary: unresolved privileged action ${a.executing.hash} already owns the execution slot.`);
    if (a?.pending)
        throw new Error(`Hi authority boundary: pending privileged action ${a.pending.hash} must resolve before execution can begin.`);
    if (a?.approved && a.approved.hash !== c.hash)
        throw new Error(`Hi authority boundary: approved privileged action ${a.approved.hash} conflicts with requested action ${c.hash}.`);
    if ((a?.completed_hashes ?? []).includes(c.hash))
        throw new Error('Hi idempotency guard: this exact privileged action is already completed.');
    let o = authorityObligation(m, c.hash);
    if (!o) {
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
    }
    m.authority.authority = { ...(a ?? {}), pending: undefined, approved: undefined, executing: { hash: c.hash, action: durableAction(c.action), started_at: Date.now() } };
    m.identity.status = 'active';
    appendLedger(m, 'authority.execution.started', { payload: { hash: c.hash, authority: 'opencode-native-permission' } });
}
export function completeAuthorizedActionByHash(m, hash, outcome, detail, commandForRelease) { const executing = m.authority.authority?.executing; if (!executing || executing.hash !== hash)
    return false; if (outcome === 'unknown') {
    appendLedger(m, 'authority.execution.uncertain', { payload: { hash, detail: detail?.slice(0, 240), retry: 'forbidden-until-user-reconciliation' } });
    openHumanDecision(m, { semantic_type: 'authority_request', reason_code: 'authority-execution-uncertain', summary: 'The exact privileged action has an unknown execution outcome and must be reconciled before any retry.', response_schema: { kind: 'authority-protocol', protocol: 'reconcile-action-outcome' }, authority_ref: hash });
    return false;
} m.authority.authority = { ...m.authority.authority, executing: undefined }; if (outcome === 'success') {
    const completed = m.authority.authority.completed_hashes ?? [];
    m.authority.authority.completed_hashes = [...new Set([...completed, hash])].slice(-64);
    const o = authorityObligation(m, hash);
    if (o) {
        o.status = 'closed';
        o.closedAt = Date.now();
    }
    if (commandForRelease)
        notePrivilegedReleaseOutcome(m, commandForRelease, 'success');
    appendLedger(m, 'authority.execution.completed', { payload: { hash, detail: detail?.slice(0, 240) } });
    return true;
} if (commandForRelease)
    notePrivilegedReleaseOutcome(m, commandForRelease, 'failure'); appendLedger(m, 'authority.execution.failed', { payload: { hash, detail: detail?.slice(0, 240), retry: 'new-explicit-action-contract-required' } }); openHumanDecision(m, { semantic_type: 'authority_request', reason_code: 'authority-execution-failed', summary: 'The privileged action failed; any retry requires a new exact action contract.', response_schema: { kind: 'authority-protocol', protocol: 'new-exact-action-contract' }, authority_ref: hash }); return false; }
export function completeAuthorizedAction(m, command, cwd, outcome, detail) { const c = actionContract(command, cwd); return completeAuthorizedActionByHash(m, c.hash, outcome, detail); }
export function requireAuthority(m, command, cwd) {
    const c = actionContract(command, cwd);
    let a = m.authority.authority;
    if (a?.executing)
        throw new Error('Hi authority boundary: another privileged external action has an unresolved execution outcome. Reconcile it before requesting a new action.');
    if (a?.approved && !freshAuthorityTimestamp(a.approved.approved_at)) {
        a = { ...a, approved: undefined };
        m.authority.authority = a;
        appendLedger(m, 'authority.approval.invalidated', { payload: { reason: 'approval-expired-before-new-request' } });
    }
    let o = authorityObligation(m, c.hash);
    if (!o) {
        o = { id: `o-authority-${c.hash.slice(0, 10)}`, kind: 'authority', summary: `External privileged action ${c.hash.slice(0, 10)} explicitly authorized and completed`, status: 'open' };
        m.execution.obligations.push(o);
        appendLedger(m, 'obligation.opened', { payload: { obligation: o.id, kind: 'authority', hash: c.hash } });
    }
    if (a?.pending && a.pending.hash !== c.hash)
        throw new Error(`Hi authority boundary: another exact privileged action ${a.pending.hash} is already pending user authority; resolve or invalidate it before requesting ${c.hash}.`);
    if (a?.approved && a.approved.hash !== c.hash)
        throw new Error(`Hi authority boundary: approved exact privileged action ${a.approved.hash} must be consumed or invalidated before requesting ${c.hash}.`);
    const pending = a?.pending ?? { hash: c.hash, action: durableAction(c.action), created_at: Date.now() };
    m.authority.authority = { ...(a ?? {}), approved: undefined, pending };
    const d = openHumanDecision(m, { semantic_type: 'authority_request', reason_code: 'authority-approval-required', summary: `Exact privileged action ${c.hash.slice(0, 12)} requires explicit authority before execution.`, response_schema: { kind: 'authority-protocol', protocol: 'approve-exact-action' }, authority_ref: c.hash });
    throw new Error(`Hi authority boundary: explicit approval required for exact action contract ${c.hash}. Submit the structured authority response ${JSON.stringify({ decision_id: d.decision_id, authority_ref: c.hash, response: 'approve' })}. Generic continuation or approval prose does not authorize privileged actions. Action was not executed.`);
}
function authorityProtocolMatches(m, input, protocol) { const d = m.authority.human_decision; return Boolean(d && d.status === 'OPEN' && d.semantic_type === 'authority_request' && d.response_schema.kind === 'authority-protocol' && d.response_schema.protocol === protocol && d.decision_id === input.decision_id && d.authority_ref === input.authority_ref); }
export function approvePendingAuthority(m, input) { if (!input || typeof input !== 'object' || Array.isArray(input))
    return false; const r = input, p = m.authority.authority?.pending; if (r.response !== 'approve' || !p || p.hash !== r.authority_ref || !authorityProtocolMatches(m, r, 'approve-exact-action'))
    return false; if (!freshAuthorityTimestamp(p.created_at)) {
    m.authority.authority = { ...m.authority.authority, pending: undefined, approved: undefined };
    resolveHumanDecision(m, 'authority-request-expired');
    appendLedger(m, 'authority.request.expired', { payload: { hash: p.hash, decision_id: r.decision_id } });
    return false;
} m.authority.authority = { ...m.authority.authority, pending: undefined, approved: { hash: p.hash, approved_at: Date.now() } }; resolveHumanDecision(m, 'authority-approved'); m.identity.status = 'active'; appendLedger(m, 'authority.approved', { payload: { hash: p.hash, decision_id: r.decision_id, protocol: 'approve-exact-action' } }); return true; }
export function resolveUncertainAuthority(m, input) { if (!input || typeof input !== 'object' || Array.isArray(input))
    return false; const r = input, e = m.authority.authority?.executing; if (!e || e.hash !== r.authority_ref || !authorityProtocolMatches(m, r, 'reconcile-action-outcome'))
    return false; const command = e.action.match(/(?:^|\n)command=([^\n]*)/)?.[1] ?? ''; if (r.response === 'success') {
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
    appendLedger(m, 'authority.execution.user-confirmed', { payload: { hash: e.hash, outcome: 'success', decision_id: r.decision_id } });
    return true;
} if (r.response === 'failure') {
    m.authority.authority = { ...m.authority.authority, executing: undefined };
    if (command)
        notePrivilegedReleaseOutcome(m, command, 'failure');
    resolveHumanDecision(m, 'authority-outcome-confirmed-failure');
    appendLedger(m, 'authority.execution.user-confirmed', { payload: { hash: e.hash, outcome: 'failure', decision_id: r.decision_id, retry: 'new-exact-action-contract-required' } });
    openHumanDecision(m, { semantic_type: 'authority_request', reason_code: 'authority-retry-contract-required', summary: 'The prior privileged action is confirmed failed; any retry requires a new exact action contract.', response_schema: { kind: 'authority-protocol', protocol: 'new-exact-action-contract' }, authority_ref: e.hash });
    return true;
} return false; }
