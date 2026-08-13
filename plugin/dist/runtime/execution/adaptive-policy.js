function riskRank(risk) { return risk === 'low' ? 0 : risk === 'medium' ? 1 : risk === 'high' ? 2 : 3; }
export function decideAdaptiveExecution(intent, m) {
    const reasons = [];
    const coordination = intent.scope === 'repo-wide' || intent.scope === 'multi-stream' || intent.dependencyClass === 'sequential';
    const materialUncertainty = intent.ambiguity !== 'none' || intent.requiredCapabilities.includes('source-verification');
    const escalated = riskRank(intent.risk) >= 2 || Boolean(m && m.stagnation_count >= 2) || Boolean(m?.blockers.length);
    let path;
    if (escalated) {
        path = 'ESCALATED';
        reasons.push('risk/failure evidence justifies escalation');
    }
    else if (coordination) {
        path = 'PLANNED';
        reasons.push('real sequencing or cross-surface coordination is required');
    }
    else if (materialUncertainty) {
        path = 'EVIDENCE';
        reasons.push('decision-changing uncertainty requires bounded evidence');
    }
    else {
        path = 'DIRECT';
        reasons.push('clear reversible scope supports direct execution');
    }
    const executionDepth = path === 'DIRECT' ? 'minimal' : path === 'PLANNED' ? 'coordinated' : path === 'ESCALATED' ? 'escalated' : 'bounded';
    const contextDepth = intent.scope === 'local' ? 'local' : intent.scope === 'multi-file' ? 'targeted' : intent.scope === 'repo-wide' ? 'broad' : 'dependency-aware';
    const isolationDepth = intent.risk === 'authority-boundary' ? 'restricted' : intent.risk === 'high' ? 'worktree' : 'current-workspace';
    const multiRole = path === 'PLANNED' || path === 'ESCALATED';
    return { path, role: { mode: multiRole ? 'multi-role' : 'single-role', reason: multiRole ? 'coordination may require distinct logical roles' : 'one logical role is sufficient initially' }, capability: { model: path === 'ESCALATED' ? 'stronger-if-needed' : 'adaptive', tools: 'minimum-sufficient', reason: 'use the cheapest sufficient trajectory; capability availability alone is not activation' }, executionDepth, contextDepth, isolationDepth, reasons };
}
