function canonical(kind) { const k = kind.toLowerCase().trim(); if (/^(pytest|go test|cargo test|npm test|pnpm test|bun test|tests?|targeted-tests)$/.test(k) || /test|pytest|vitest|jest|spec/.test(k))
    return 'targeted-tests'; if (/typecheck|tsc|mypy|pyright/.test(k))
    return 'typecheck'; if (/lint|eslint|ruff/.test(k))
    return 'lint'; if (/build|compile|cargo check/.test(k))
    return 'build'; return k; }
export function verificationPolicyFor(intent) { const independentReview = intent.risk === 'high' || intent.requiredCapabilities.includes('independent-review') || intent.requiredCapabilities.includes('security-review'); return { requiredKinds: [...new Set(intent.likelyVerification.map(canonical))], requireFresh: true, requireReview: independentReview, allowWorkerReportedEvidence: intent.risk !== 'high' }; }
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
    const repoKinds = repo?.likelyVerification ?? [], staticKind = repoKinds.find(x => /typecheck|check|lint/i.test(x)), buildKind = repoKinds.find(x => /build/i.test(x));
    if (sensitive || m.risk === 'high') {
        if (staticKind)
            added.push(canonical(staticKind));
        if (buildKind)
            added.push(canonical(buildKind));
    }
    else if (expanded && actual.length > 1 && staticKind)
        added.push(canonical(staticKind));
    const before = new Set(m.verification_policy.requiredKinds.map(canonical));
    for (const k of added)
        before.add(k);
    const next = [...before], addedKinds = next.filter(k => !m.verification_policy.requiredKinds.map(canonical).includes(k));
    const riskEscalated = sensitive && m.risk !== 'high' && m.risk !== 'authority-boundary';
    if (riskEscalated) {
        m.risk = 'high';
        m.intent.risk = 'high';
        m.verification_policy.requireReview = true;
    }
    if (dependencyChanged) {
        m.intent.requiredCapabilities = [...new Set([...m.intent.requiredCapabilities, 'dependency-change', 'security-review'])];
        m.verification_policy.requireReview = true;
        if (!m.obligations.some(o => o.kind === 'review' && o.status === 'open' && o.summary.includes('Dependency graph changed')))
            m.obligations.push({ id: `o-dependency-review-${Date.now().toString(36)}`, kind: 'review', summary: 'Dependency graph changed; independent supply-chain/security review required', status: 'open' });
    }
    else if (riskEscalated && !m.obligations.some(o => o.kind === 'review' && o.status === 'open'))
        m.obligations.push({ id: `o-high-assurance-${Date.now().toString(36)}`, kind: 'review', summary: 'Changed surface entered a security/configuration-sensitive area; independent review required', status: 'open' });
    const changed = addedKinds.length > 0 || expanded || riskEscalated;
    if (changed) {
        m.verification_policy.requiredKinds = next;
        for (const o of m.obligations.filter(o => o.kind === 'verification' && o.status === 'open'))
            o.requiredEvidence = [...new Set([...(o.requiredEvidence ?? []).map(canonical), ...next])];
    }
    return { changed, addedKinds, scopeExpanded: expanded, riskEscalated, reason: dependencyChanged ? 'dependency-changed-surface' : sensitive ? 'sensitive-changed-surface' : expanded ? 'changed-surface-expanded' : 'verification-policy-unchanged' };
}
export function verificationEconomyInstruction(m) {
    const kinds = [...new Set(m.verification_policy.requiredKinds.map(canonical))];
    const required = kinds.join(', ') || 'changed-surface-sanity';
    if (m.intent.taskKind === 'release-readiness' || m.risk === 'high')
        return `Verification contract: ${required}. Use repo-native commands and satisfy these required kinds; prefer targeted tests first, then the required static/build checks. Do not substitute a cheap unrelated PASS for a missing required kind.`;
    if (m.intent.scope === 'local' && m.risk === 'low')
        return `Verification contract: ${required}. Use the smallest repo-native check that covers the changed surface. Prefer a targeted test or changed-surface sanity; do not run a full repository suite unless targeted verification is unavailable or the change proves broader than expected.`;
    return `Verification contract: ${required}. Use repo-native commands with minimum sufficient scope; broaden only when changed surface, dependency impact, or a failed targeted check justifies it.`;
}
function kindMatches(required, actual) { const r = canonical(required), a = canonical(actual); if (r === a)
    return true; if (r === 'changed-surface-sanity')
    return /build|lint|type|check|test|sanity|compile/.test(a); if (r === 'visual-check')
    return /visual|screenshot|browser|ui/.test(a); if (r === 'review-evidence')
    return a === 'review-evidence' || /^(?:code-review|security-review|regression-review|audit-findings?|review-findings?)$/.test(a); return false; }
export function verificationSatisfied(m, obligationID) { const p = m.verification_policy; if (p.requireFresh && !m.evidence.fresh)
    return { ok: false, missing: ['fresh-evidence'] }; const obligation = obligationID ? m.obligations.find(o => o.id === obligationID) : undefined, requiredKinds = [...new Set((obligation?.requiredEvidence?.length ? obligation.requiredEvidence : p.requiredKinds).map(canonical))]; const valid = m.evidence.items.filter(e => { if (e.invalidated_at || e.pass === false || e.outcome === 'failed' || e.outcome === 'environment-issue' || e.outcome === 'pending')
    return false; const workerSource = String(e.source ?? '').startsWith('worker:'); if (workerSource && !p.allowWorkerReportedEvidence && !String(e.source ?? '').includes(':reviewer'))
    return false; if (obligationID && workerSource && !e.obligation_ids?.includes(obligationID))
    return false; return true; }); const missing = requiredKinds.filter(required => !valid.some(e => kindMatches(required, e.kind))); if (p.requireReview) {
    const review = m.obligations.find(o => o.kind === 'review');
    if (!review || review.status !== 'closed')
        missing.push('review-obligation');
} return { ok: missing.length === 0, missing }; }
export function latestBlockingVerificationEvidence(m, obligationID) { const obligation = obligationID ? m.obligations.find(o => o.id === obligationID) : undefined, requiredKinds = [...new Set((obligation?.requiredEvidence?.length ? obligation.requiredEvidence : m.verification_policy.requiredKinds).map(canonical))], mutation = m.evidence.last_mutation_at ?? 0, current = [...m.evidence.items].filter(e => !e.invalidated_at && e.observed_at >= mutation).sort((a, b) => b.observed_at - a.observed_at); for (const e of current) {
    if (e.outcome !== 'environment-issue' && e.outcome !== 'failed')
        continue;
    const matched = requiredKinds.filter(r => kindMatches(r, e.kind));
    if (!matched.length)
        continue;
    const superseded = matched.every(r => current.some(candidate => candidate.observed_at > e.observed_at && candidate.outcome === 'passed' && candidate.pass !== false && kindMatches(r, candidate.kind)));
    if (!superseded)
        return e;
} return undefined; }
