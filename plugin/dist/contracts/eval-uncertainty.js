const T95 = { 2: 12.706, 3: 4.303, 4: 3.182, 5: 2.776, 6: 2.571, 7: 2.447, 8: 2.365, 9: 2.306, 10: 2.262, 11: 2.228, 12: 2.201, 13: 2.179, 14: 2.160, 15: 2.145, 16: 2.131, 17: 2.120, 18: 2.110, 19: 2.101, 20: 2.093, 21: 2.086, 22: 2.080, 23: 2.074, 24: 2.069, 25: 2.064, 26: 2.060, 27: 2.056, 28: 2.052, 29: 2.048, 30: 2.045 };
const round = (n) => Number(n.toFixed(12));
function finite(n) { return typeof n === 'number' && Number.isFinite(n); }
export function sampleDistribution95(values) {
    if (!values.length || values.some(v => !finite(v) || v < 0))
        throw new Error('distribution requires non-empty finite non-negative samples');
    const n = values.length, mean = values.reduce((a, b) => a + b, 0) / n;
    if (n === 1)
        return { sample_count: 1, mean: round(mean), sample_stddev: 0, confidence_level: 0.95, confidence_interval_95: [round(mean), round(mean)] };
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1), std = Math.sqrt(variance), critical = n <= 30 ? (T95[n] ?? 2.045) : 1.96, margin = critical * (std / Math.sqrt(n));
    return { sample_count: n, mean: round(mean), sample_stddev: round(std), confidence_level: 0.95, confidence_interval_95: [round(Math.max(0, mean - margin)), round(mean + margin)] };
}
function band(k) { if (k < 0)
    return 'LESS_THAN_CHANCE'; if (k <= .2)
    return 'SLIGHT'; if (k <= .4)
    return 'FAIR'; if (k <= .6)
    return 'MODERATE'; if (k <= .8)
    return 'SUBSTANTIAL'; return 'ALMOST_PERFECT'; }
export function fleissKappaBinary(matrix) {
    if (!matrix.length)
        return { status: 'NOT_PROVIDED', item_count: 0, judge_count: 0 };
    const judgeCount = matrix[0]?.length ?? 0;
    if (judgeCount < 2 || matrix.some(row => row.length !== judgeCount || row.some(score => score !== 0 && score !== 1)))
        return { status: 'INSUFFICIENT', item_count: matrix.length, judge_count: judgeCount };
    const n = matrix.length, k = judgeCount;
    const agreements = matrix.map(row => { const ones = row.filter(x => x === 1).length, zeros = k - ones; return (ones * ones + zeros * zeros - k) / (k * (k - 1)); });
    const observed = agreements.reduce((a, b) => a + b, 0) / n, totalOnes = matrix.reduce((sum, row) => sum + row.filter(x => x === 1).length, 0), p1 = totalOnes / (n * k), p0 = 1 - p1, expected = p1 * p1 + p0 * p0, kappa = expected === 1 ? 1 : (observed - expected) / (1 - expected), value = round(Math.max(-1, Math.min(1, kappa)));
    return { status: 'MEASURED', item_count: n, judge_count: k, fleiss_kappa: value, band: band(value) };
}
export function evidenceFamilyDiversity(families) {
    const clean = families.map(x => String(x).trim()).filter(Boolean);
    if (!clean.length)
        return { status: 'NOT_PROVIDED', evidence_count: 0, unique_family_count: 0, largest_family_count: 0, largest_family_share: 0, families: {} };
    const counts = {};
    for (const family of clean)
        counts[family] = (counts[family] ?? 0) + 1;
    const largest = Math.max(...Object.values(counts)), unique = Object.keys(counts).length;
    return { status: clean.length < 2 ? 'INSUFFICIENT' : 'MEASURED', evidence_count: clean.length, unique_family_count: unique, largest_family_count: largest, largest_family_share: round(largest / clean.length), families: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))) };
}
export function buildEvalUncertaintyDiagnostics(input) {
    const judge = fleissKappaBinary(input.judge_scores ?? []), diversity = evidenceFamilyDiversity(input.evidence_families ?? []), flags = [];
    if (judge.status === 'INSUFFICIENT')
        flags.push('INSUFFICIENT_JUDGE_DATA');
    if (judge.status === 'MEASURED' && (judge.fleiss_kappa ?? 1) < .6)
        flags.push('JUDGE_DISAGREEMENT');
    if (diversity.status === 'INSUFFICIENT')
        flags.push('INSUFFICIENT_EVIDENCE_DIVERSITY');
    else if (diversity.status === 'MEASURED' && diversity.unique_family_count < 2)
        flags.push('LOW_EVIDENCE_FAMILY_DIVERSITY');
    return { advisory_only: true, wall_time_ms: sampleDistribution95(input.wall_times_ms), judge_agreement: judge, evidence_family_diversity: diversity, flags };
}
