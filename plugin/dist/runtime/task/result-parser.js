import { normalizeWorkerResult } from './contracts.js';
import { DEFAULT_CONTEXT_BUDGET, clipText } from '../context/budget.js';
function inlineValue(value) {
    const raw = value.trim();
    return raw.length >= 2 && raw.startsWith('`') && raw.endsWith('`') ? raw.slice(1, -1).trim() : raw;
}
function jsonArrayValue(value) {
    const raw = inlineValue(value);
    if (!raw || /^(?:none|null|n\/?a)$/i.test(raw))
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function stringListValue(value) { return jsonArrayValue(value).map(String); }
function issueValue(value) {
    const raw = inlineValue(value);
    if (!raw || /^(?:none|null|n\/?a|\[\])$/i.test(raw))
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed))
            return parsed.map(String);
    }
    catch { }
    return [raw];
}
function markdownWorkerResult(text) {
    if (!/(?:^|\n)\s*WorkerResult\s*:/i.test(text))
        return undefined;
    const fields = new Map();
    for (const line of text.split(/\r?\n/)) {
        const hit = line.match(/^\s*[-*]\s+(?:\*\*|__)?([a-z_]+)(?:\*\*|__)?\s*:\s*(.*)$/i);
        if (hit && !fields.has(hit[1].toLowerCase()))
            fields.set(hit[1].toLowerCase(), hit[2].trim());
    }
    const status = inlineValue(fields.get('status') ?? '').replace(/[ -]+/g, '_').toUpperCase();
    if (!status)
        return undefined;
    const summary = inlineValue(fields.get('summary') ?? '');
    const contextGap = inlineValue(fields.get('context_gap') ?? '').toLowerCase();
    const failureFinding = inlineValue(fields.get('failure_finding') ?? '').toLowerCase();
    // This fallback recovers only canonical task-state/provenance fields. Narrative
    // markdown under "evidence" is intentionally ignored so prose cannot become proof.
    return normalizeWorkerResult({
        status,
        summary: summary || 'Worker returned a labeled WorkerResult without a summary.',
        changed_files: stringListValue(fields.get('changed_files') ?? ''),
        scope_expansions: jsonArrayValue(fields.get('scope_expansions') ?? ''),
        evidence: [],
        open_issues: issueValue(fields.get('open_issues') ?? ''),
        needs_context: issueValue(fields.get('needs_context') ?? ''),
        context_gap: ['scope', 'iterative', 'none'].includes(contextGap) ? contextGap : undefined,
        failure_finding: ['ci-build', 'unknown-root-cause', 'none'].includes(failureFinding) ? failureFinding : undefined,
    });
}
export function parseWorkerResult(text) {
    const bounded = clipText(text, DEFAULT_CONTEXT_BUDGET.max_result_chars), fenced = bounded.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1], candidates = [fenced, bounded].filter(Boolean);
    for (const raw of candidates) {
        try {
            const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
            if (start >= 0 && end > start)
                return normalizeWorkerResult(JSON.parse(raw.slice(start, end + 1)));
        }
        catch { }
    }
    const markdown = markdownWorkerResult(bounded);
    if (markdown)
        return markdown;
    const status = bounded.match(/(?:^|\n)\s*(?:\*\*|__)?\s*STATUS\s*:\s*([A-Z_ -]+?)(?:\s*(?:\*\*|__))?\s*(?=\n|$)/i)?.[1]?.trim().replace(/[ -]+/g, '_'), summary = bounded.match(/(?:^|\n)\s*(?:\*\*|__)?\s*(?:SUMMARY|FINDINGS?)\s*:\s*(?:\*\*|__)?\s*([^\n]+)/i)?.[1]?.replace(/(?:\*\*|__)\s*$/, '').trim();
    if (status)
        return normalizeWorkerResult({ status, summary: summary ?? bounded.slice(0, 1000), open_issues: /USER_ACTION_REQUIRED/i.test(bounded) ? ['USER_ACTION_REQUIRED'] : [] });
    return normalizeWorkerResult({ status: 'FAILED', summary: bounded.slice(0, 1000), open_issues: ['Worker did not return parseable structured result'] });
}
