function riskRank(risk) { return risk === 'low' ? 0 : risk === 'medium' ? 1 : risk === 'high' ? 2 : 3; }
export function decideAdaptiveExecution(intent, m) {
    const reasons = [];
    const coordination = intent.scope === 'repo-wide' || intent.scope === 'multi-stream' || intent.dependencyClass === 'sequential';
    const materialUncertainty = intent.ambiguity !== 'none' || intent.requiredCapabilities.includes('source-verification');
    const escalated = riskRank(intent.risk) >= 2 || Boolean(m && m.continuation.stagnation_count >= 2) || Boolean(m?.execution.blockers.length);
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
    return { path, reasons };
}
