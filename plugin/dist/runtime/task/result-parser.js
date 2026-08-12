import { normalizeWorkerResult } from './contracts.js';
import { DEFAULT_CONTEXT_BUDGET, clipText } from '../context/budget.js';
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
    const status = bounded.match(/(?:^|\n)\s*STATUS\s*:\s*([A-Z_ -]+)/i)?.[1]?.trim().replace(/[ -]+/g, '_'), summary = bounded.match(/(?:^|\n)\s*(?:SUMMARY|FINDINGS?)\s*:\s*([^\n]+)/i)?.[1]?.trim();
    if (status)
        return normalizeWorkerResult({ status, summary: summary ?? bounded.slice(0, 1000), open_issues: /USER_ACTION_REQUIRED/i.test(bounded) ? ['USER_ACTION_REQUIRED'] : [] });
    return normalizeWorkerResult({ status: 'FAILED', summary: bounded.slice(0, 1000), open_issues: ['Worker did not return parseable structured result'] });
}
