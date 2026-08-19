// Default profile is `balanced` (matches DEFAULT_HI_CONFIG.profile.balanced).
// Lower threshold → more specialist dispatch; higher threshold → fewer.
function thresholdFrom(value) {
    return value === 'low' ? 1 : value === 'medium' ? 2 : 3;
}
export function routeCapabilities(intent, profile = { specialistThreshold: 'medium', reviewThreshold: 'medium' }) {
    const caps = [...new Set(intent.requiredCapabilities)];
    const has = (name) => caps.includes(name);
    const specialistT = thresholdFrom(profile.specialistThreshold);
    const reviewT = thresholdFrom(profile.reviewThreshold);
    if (has('security-review')) {
        if (intent.taskKind === 'review')
            return { role: 'security-reviewer', category: 'critical', capabilities: caps, reason: ['structured security-review capability dominates this review task'] };
        return { role: 'coder', category: 'critical', capabilities: caps, reason: ['security-sensitive implementation remains write-capable; independent security review is a separate obligation'] };
    }
    if (has('visual-qa') && intent.taskKind === 'review') {
        return { role: 'visual-qa', category: 'visual', capabilities: caps, reason: ['structured visual-qa capability dominates this review task'] };
    }
    const reviewDominant = intent.taskKind === 'review' || has('review') || has('qa-review') || has('independent-review');
    const implementationDominant = intent.taskKind === 'implementation' || intent.taskKind === 'bug-fix' || has('implementation');
    if (intent.taskKind === 'diagnosis')
        return { role: 'repository-explorer', category: intent.scope === 'repo-wide' ? 'deep' : 'standard', capabilities: caps, reason: ['structured diagnosis task is read-only root-cause analysis'] };
    if (reviewDominant && !implementationDominant) {
        if (reviewT <= 1)
            return { role: 'qa-reviewer', category: intent.risk === 'high' ? 'critical' : 'standard', capabilities: caps, reason: ['structured review capability dominates task'] };
        if (intent.risk === 'high' || has('qa-review') || has('independent-review'))
            return { role: 'qa-reviewer', category: intent.risk === 'high' ? 'critical' : 'standard', capabilities: caps, reason: ['structured review capability requires specialist'] };
    }
    const designDominant = has('design-exploration');
    if (designDominant) {
        if (specialistT <= 2)
            return { role: 'architect', category: intent.risk === 'high' ? 'critical' : 'deep', capabilities: caps, reason: ['structured design capability justifies architect'] };
    }
    if (intent.taskKind === 'performance' && intent.scope === 'repo-wide')
        return { role: 'architect', category: 'deep', capabilities: caps, reason: ['repo-wide performance analysis requires architecture-level system context'] };
    if (intent.scope === 'repo-wide' && intent.taskKind !== 'implementation')
        return { role: 'repository-explorer', category: intent.risk === 'high' ? 'critical' : 'deep', capabilities: caps, reason: ['repo-wide non-implementation task starts with bounded repository context'] };
    const base = { role: 'coder', category: intent.scope === 'local' && intent.risk === 'low' ? 'quick' : intent.risk === 'high' ? 'critical' : 'standard', capabilities: caps, reason: ['default child implementation path'] };
    if (intent.risk === 'low' && intent.scope === 'local' && has('verification')) {
        const trimmed = caps.filter(c => c !== 'review' && c !== 'verification');
        return { role: 'coder', category: 'quick', capabilities: trimmed.length ? trimmed : caps, reason: [...base.reason, 'deterministic-evidence-skips-qa-reviewer'] };
    }
    return base;
}
