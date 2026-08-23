import { evidenceClaimApplicability } from '../evidence/applicability.js';
import { evidenceScopeStateIsCurrent } from '../evidence/scope-state.js';
import { hasFreshPassedEvidence } from '../evidence/freshness.js';
const VERIFICATION_KIND_ALIASES = { test: 'targeted-tests', tests: 'targeted-tests', 'targeted-tests': 'targeted-tests', pytest: 'targeted-tests', 'go test': 'targeted-tests', 'cargo test': 'targeted-tests', 'npm test': 'targeted-tests', 'pnpm test': 'targeted-tests', 'bun test': 'targeted-tests', vitest: 'targeted-tests', jest: 'targeted-tests', spec: 'targeted-tests', typecheck: 'typecheck', tsc: 'typecheck', mypy: 'typecheck', pyright: 'typecheck', lint: 'lint', eslint: 'lint', ruff: 'lint', build: 'build', compile: 'build', 'cargo check': 'build', check: 'changed-surface-sanity', sanity: 'changed-surface-sanity', 'changed-surface-sanity': 'changed-surface-sanity', 'visual-check': 'visual-check', 'visual-evidence': 'visual-evidence', 'review-evidence': 'review-evidence' };
function canonical(kind) { const k = kind.toLowerCase().trim(); return VERIFICATION_KIND_ALIASES[k] ?? k; }
export function verificationPolicyFor(intent) { const independentReview = intent.risk === 'high' || intent.requiredCapabilities.includes('independent-review') || intent.requiredCapabilities.includes('security-review'); return { requiredKinds: [...new Set(intent.likelyVerification.map(canonical))], requireFresh: true, requireReview: independentReview, allowWorkerReportedEvidence: false }; }
function normPath(p) { return p.trim().replace(/\\/g, '/').replace(/^\.\//, ''); }
function dependencySurface(files) { return files.some(raw => /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|requirements(?:-[^/]*)?\.txt|pyproject\.toml|poetry\.lock|cargo\.toml|cargo\.lock|go\.mod|go\.sum)(?:$|\/)/i.test(normPath(raw))); }
function sensitiveSurface(files) { return files.some(raw => { const p = normPath(raw).toLowerCase(); return /(^|\/)(auth|security|permission|oauth|session|credential|secrets?)(\/|\.|$)/.test(p) || /(migration|schema|database|dockerfile|compose\.ya?ml|package\.json|lock\.ya?ml|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.github\/workflows)/.test(p); }); }
function scopeExpanded(task, files) { const expected = task.scope.map(normPath).filter(Boolean); if (!files.length)
    return false; if (!expected.length)
    return files.length > 1; return files.map(normPath).some(f => !expected.some(e => f === e || f.startsWith(e.endsWith('/') ? e : e + '/') || e.startsWith(f.endsWith('/') ? f : f + '/'))); }
export function replanVerificationForChangedSurface(m, task, files, repo) {
    const actual = [...new Set(files.map(normPath).filter(Boolean))], expanded = scopeExpanded(task, actual), dependencyChanged = dependencySurface(actual), sensitive = sensitiveSurface(actual), added = [];
    if (!actual.length)
        return { changed: false, addedKinds: [], scopeExpanded: false, riskEscalated: false, reason: 'no-changed-files' };
    const repoKinds = repo?.likelyVerification ?? [], staticKind = repoKinds.find(x => ['typecheck', 'check', 'lint'].includes(x.toLowerCase().trim())), buildKind = repoKinds.find(x => x.toLowerCase().trim() === 'build');
    if (sensitive || m.identity.risk === 'high') {
        if (staticKind)
            added.push(canonical(staticKind));
        if (buildKind)
            added.push(canonical(buildKind));
    }
    else if (expanded && actual.length > 1 && staticKind)
        added.push(canonical(staticKind));
    const before = new Set(m.execution.verification_policy.requiredKinds.map(canonical));
    for (const k of added)
        before.add(k);
    const next = [...before], addedKinds = next.filter(k => !m.execution.verification_policy.requiredKinds.map(canonical).includes(k));
    const riskEscalated = sensitive && m.identity.risk !== 'high' && m.identity.risk !== 'authority-boundary';
    if (riskEscalated) {
        m.identity.risk = 'high';
        m.identity.intent.risk = 'high';
        m.execution.verification_policy.requireReview = true;
    }
    if (dependencyChanged) {
        m.identity.intent.requiredCapabilities = [...new Set([...m.identity.intent.requiredCapabilities, 'dependency-change', 'security-review'])];
        m.execution.verification_policy.requireReview = true;
        if (!m.execution.obligations.some(o => o.kind === 'review' && o.status === 'open' && o.summary.includes('Dependency graph changed')))
            m.execution.obligations.push({ id: `o-dependency-review-${Date.now().toString(36)}`, kind: 'review', summary: 'Dependency graph changed; independent supply-chain/security review required', status: 'open' });
    }
    else if (riskEscalated && !m.execution.obligations.some(o => o.kind === 'review' && o.status === 'open'))
        m.execution.obligations.push({ id: `o-high-assurance-${Date.now().toString(36)}`, kind: 'review', summary: 'Changed surface entered a security/configuration-sensitive area; independent review required', status: 'open' });
    const changed = addedKinds.length > 0 || expanded || riskEscalated;
    if (changed) {
        m.execution.verification_policy.requiredKinds = next;
        for (const o of m.execution.obligations.filter(o => o.kind === 'verification' && o.status === 'open'))
            o.requiredEvidence = [...new Set([...(o.requiredEvidence ?? []).map(canonical), ...next])];
    }
    return { changed, addedKinds, scopeExpanded: expanded, riskEscalated, reason: dependencyChanged ? 'dependency-changed-surface' : sensitive ? 'sensitive-changed-surface' : expanded ? 'changed-surface-expanded' : 'verification-policy-unchanged' };
}
export function verificationEconomyInstruction(m) {
    const kinds = [...new Set(m.execution.verification_policy.requiredKinds.map(canonical))];
    const required = kinds.join(', ') || 'changed-surface-sanity';
    if (m.identity.intent.taskKind === 'release-readiness' || m.identity.risk === 'high')
        return `Verification contract: ${required}. Use repo-native commands and satisfy these required kinds; prefer targeted tests first, then the required static/build checks. Do not substitute a cheap unrelated PASS for a missing required kind.`;
    if (m.identity.intent.scope === 'local' && m.identity.risk === 'low')
        return `Verification contract: ${required}. Use the smallest repo-native check that covers the changed surface. Prefer a targeted test or changed-surface sanity; do not run a full repository suite unless targeted verification is unavailable or the change proves broader than expected.`;
    return `Verification contract: ${required}. Use repo-native commands with minimum sufficient scope; broaden only when changed surface, dependency impact, or a failed targeted check justifies it.`;
}
const STRONGER_EVIDENCE = { 'changed-surface-sanity': ['changed-surface-sanity', 'targeted-tests', 'typecheck', 'lint', 'build', 'visual-evidence'], 'visual-check': ['visual-check', 'visual-evidence'], 'review-evidence': ['review-evidence'] };
export function verificationKindSatisfiesRequirement(required, actual) { const r = canonical(required), a = canonical(actual); if (r === a)
    return true; return Boolean(STRONGER_EVIDENCE[r]?.includes(a)); }
export function verificationKindAdmittedForMission(m, actual) { const required = [...new Set(m.execution.verification_policy.requiredKinds.map(canonical))]; return required.length === 0 || required.some(kind => verificationKindSatisfiesRequirement(kind, actual)); }
function evidenceAllowedForVerification(m, e, obligationID, projectRoot) {
    // Legacy allowWorkerReportedEvidence remains schema-only. A worker claim never gains PASS authority.
    // Unclassified legacy evidence is accepted only when it was not worker-produced; new evidence should
    // declare its trusted observation class explicitly.
    if (e.trusted_source_class === undefined && String(e.source ?? '').startsWith('worker:'))
        return false;
    if (e.trusted_source_class === 'reviewer-observation' && projectRoot && !evidenceScopeStateIsCurrent(projectRoot, e.scope, e.scope_state_hash))
        return false;
    return evidenceClaimApplicability(m, e, obligationID).applicable;
}
function verificationResult(e) {
    if (e.outcome === 'passed' || e.pass === true)
        return 'passed';
    if (e.outcome === 'failed' || e.pass === false)
        return 'failed';
    if (e.outcome === 'environment-issue')
        return 'environment-issue';
    return 'pending';
}
export function verificationEnvelopeFor(m, obligationID, projectRoot) {
    const p = m.execution.verification_policy, obligation = obligationID ? m.execution.obligations.find(o => o.id === obligationID) : undefined;
    const requiredKinds = [...new Set((obligation?.requiredEvidence?.length ? obligation.requiredEvidence : p.requiredKinds).map(canonical))];
    const candidates = m.execution.evidence.items.filter(e => evidenceAllowedForVerification(m, e, obligationID, projectRoot));
    const checks = requiredKinds.map(kind => {
        const matching = candidates.filter(e => verificationKindSatisfiesRequirement(kind, e.kind)).sort((a, b) => b.observed_at - a.observed_at);
        if (!matching.length)
            return { kind, subject: obligation?.summary ?? m.identity.objective, result: 'not_run', evidence_refs: [], explanation: `No admissible evidence recorded for required verification kind: ${kind}` };
        const live = matching.filter(e => !e.invalidated_at), selected = live.length ? live : matching;
        const explicit = selected.find(e => e.outcome !== undefined || e.pass !== undefined);
        if (!explicit)
            return { kind, subject: obligation?.summary ?? m.identity.objective, result: 'pending', evidence_refs: selected.map(e => e.id).slice(0, 12), explanation: 'Evidence exists but no explicit verification outcome was recorded' };
        const result = verificationResult(explicit);
        return { kind, subject: obligation?.summary ?? m.identity.objective, result, evidence_refs: [explicit.id], explanation: result === 'passed' ? undefined : (explicit.reason ?? explicit.summary) };
    });
    const referencedEvidence = checks.flatMap(check => check.evidence_refs.map(ref => m.execution.evidence.items.find(e => e.id === ref)).filter((e) => Boolean(e)));
    const scope = [...new Set(referencedEvidence.flatMap(e => e.scope ?? []))].slice(0, 100);
    const requiredEvidenceFresh = checks.length === 0 ? hasFreshPassedEvidence(m.execution.evidence.items) : checks.every(check => {
        if (check.result !== 'passed' || check.evidence_refs.length === 0)
            return false;
        return check.evidence_refs.some(ref => { const e = m.execution.evidence.items.find(item => item.id === ref); return Boolean(e && !e.invalidated_at); });
    });
    const freshness = p.requireFresh && !requiredEvidenceFresh ? 'stale' : 'fresh';
    const review = m.execution.obligations.find(o => o.kind === 'review'), independentReview = !p.requireReview || review?.status === 'closed';
    const limitations = [];
    if (freshness === 'stale')
        limitations.push('fresh-evidence-required');
    if (p.requireReview && !independentReview)
        limitations.push('independent-review-required');
    for (const check of checks)
        if (check.result !== 'passed')
            limitations.push(`${check.kind}:${check.result}`);
    return { checks, scope, freshness, limitations: [...new Set(limitations)], independent_review: independentReview };
}
export function verificationSatisfied(m, obligationID, projectRoot) {
    const envelope = verificationEnvelopeFor(m, obligationID, projectRoot), missing = [];
    const incompleteChecks = envelope.checks.filter(check => check.result !== 'passed');
    for (const check of incompleteChecks)
        missing.push(check.kind);
    if (!incompleteChecks.length && envelope.freshness === 'stale')
        missing.push('fresh-evidence');
    if (!envelope.independent_review)
        missing.push('review-obligation');
    return { ok: missing.length === 0, missing: [...new Set(missing)] };
}
export function verificationClaimsSatisfied(m, projectRoot) {
    const obligations = m.execution.obligations.filter(o => o.kind === 'verification');
    if (!obligations.length)
        return { ok: true, missing: [] };
    const missing = obligations.flatMap(o => verificationSatisfied(m, o.id, projectRoot).missing.map(item => `${o.id}:${item}`));
    return { ok: missing.length === 0, missing: [...new Set(missing)] };
}
export function reviewObligationSatisfied(m, obligationID, projectRoot) {
    const obligation = m.execution.obligations.find(o => o.id === obligationID && o.kind === 'review');
    if (!obligation)
        return { ok: false, reason: 'review-obligation-missing' };
    const evidence = [...m.execution.evidence.items].filter(e => canonical(e.kind) === 'review-evidence' && !e.invalidated_at && (e.outcome === 'passed' || e.pass === true) && (!m.execution.verification_policy.requireReview || e.trusted_source_class === 'reviewer-observation') && evidenceAllowedForVerification(m, e, obligationID, projectRoot)).sort((a, b) => b.observed_at - a.observed_at);
    const exact = evidence[0];
    return exact ? { ok: true, evidence_id: exact.id } : { ok: false, reason: projectRoot ? 'fresh-current-scope-review-evidence-required' : 'fresh-claim-linked-review-evidence-required' };
}
export function reviewClaimsSatisfied(m, projectRoot) {
    const reviews = m.execution.obligations.filter(o => o.kind === 'review');
    if (!reviews.length)
        return { ok: !m.execution.verification_policy.requireReview, missing: m.execution.verification_policy.requireReview ? ['review-obligation-missing'] : [] };
    const missing = reviews.filter(o => !reviewObligationSatisfied(m, o.id, projectRoot).ok).map(o => o.id);
    return { ok: missing.length === 0, missing };
}
export function latestBlockingVerificationEvidence(m, obligationID) { const obligation = obligationID ? m.execution.obligations.find(o => o.id === obligationID) : undefined, requiredKinds = [...new Set((obligation?.requiredEvidence?.length ? obligation.requiredEvidence : m.execution.verification_policy.requiredKinds).map(canonical))], current = [...m.execution.evidence.items].filter(e => !e.invalidated_at && evidenceAllowedForVerification(m, e, obligationID)).sort((a, b) => b.observed_at - a.observed_at); for (const e of current) {
    if (e.outcome !== 'environment-issue' && e.outcome !== 'failed')
        continue;
    const matched = requiredKinds.filter(r => verificationKindSatisfiesRequirement(r, e.kind));
    if (!matched.length)
        continue;
    const superseded = matched.every(r => current.some(candidate => candidate.observed_at > e.observed_at && candidate.outcome === 'passed' && candidate.pass !== false && verificationKindSatisfiesRequirement(r, candidate.kind)));
    if (!superseded)
        return e;
} return undefined; }
