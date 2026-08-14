import { isSafeProjectFileSourceRef } from './common.js';
import { createHash } from 'node:crypto';
export const SEMANTIC_CONTEXT_SYMBOL_KINDS = ['interface', 'type', 'class', 'function', 'enum'];
const KEYS = new Set(['id', 'source_ref', 'source_hash', 'language_adapter', 'symbols', 'relationships', 'selected_ranges', 'consumer_task_ref', 'budget', 'created_at', 'text']);
const SYMBOL_KEYS = new Set(['kind', 'name', 'signature', 'start', 'end']);
const REL_KEYS = new Set(['kind', 'source_symbol', 'target_symbol']);
const RANGE_KEYS = new Set(['start', 'end']);
const BUDGET_KEYS = new Set(['max_chars', 'used_chars']);
const KINDS = new Set(SEMANTIC_CONTEXT_SYMBOL_KINDS);
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function finite(v) { return typeof v === 'number' && Number.isFinite(v); }
function validRange(v) { return record(v) && Object.keys(v).every(k => RANGE_KEYS.has(k)) && finite(v.start) && finite(v.end) && v.start >= 0 && v.end > v.start; }
function validSymbol(v) { return record(v) && Object.keys(v).every(k => SYMBOL_KEYS.has(k)) && typeof v.kind === 'string' && KINDS.has(v.kind) && typeof v.name === 'string' && Boolean(v.name) && typeof v.signature === 'string' && Boolean(v.signature) && finite(v.start) && finite(v.end) && v.start >= 0 && v.end > v.start; }
function validRelationship(v) { return record(v) && Object.keys(v).every(k => REL_KEYS.has(k)) && typeof v.kind === 'string' && Boolean(v.kind) && typeof v.source_symbol === 'string' && Boolean(v.source_symbol) && typeof v.target_symbol === 'string' && Boolean(v.target_symbol); }
export function semanticContextId(input) {
    const ranges = input.selected_ranges.map(r => `${r.start}:${r.end}`).join(',');
    return `sc_${createHash('sha256').update(`${input.consumer_task_ref}\0${input.source_ref}\0${input.source_hash}\0${ranges}`).digest('hex').slice(0, 20)}`;
}
export function isSemanticContextContract(v) {
    if (!record(v) || !Object.keys(v).every(k => KEYS.has(k)) || typeof v.id !== 'string' || !/^sc_[a-f0-9]{20}$/.test(v.id) || !isSafeProjectFileSourceRef(v.source_ref) || typeof v.source_hash !== 'string' || !/^[a-f0-9]{64}$/.test(v.source_hash) || v.language_adapter !== 'typescript' || !Array.isArray(v.symbols) || !v.symbols.every(validSymbol) || !Array.isArray(v.relationships) || !v.relationships.every(validRelationship) || !Array.isArray(v.selected_ranges) || !v.selected_ranges.every(validRange) || typeof v.consumer_task_ref !== 'string' || !v.consumer_task_ref || !record(v.budget) || !Object.keys(v.budget).every(k => BUDGET_KEYS.has(k)) || !finite(v.budget.max_chars) || !finite(v.budget.used_chars) || v.budget.max_chars < 0 || v.budget.used_chars < 0 || v.budget.used_chars > v.budget.max_chars || !finite(v.created_at) || v.created_at <= 0 || typeof v.text !== 'string')
        return false;
    const ranges = v.selected_ranges;
    if (v.symbols.length !== ranges.length || v.symbols.some((s, i) => s.start !== ranges[i]?.start || s.end !== ranges[i]?.end))
        return false;
    if (v.id !== semanticContextId({ consumer_task_ref: v.consumer_task_ref, source_ref: v.source_ref, source_hash: v.source_hash, selected_ranges: ranges }))
        return false;
    if (v.text.length !== v.budget.used_chars)
        return false;
    const names = new Set(v.symbols.map(s => s.name));
    if (v.relationships.some(r => !names.has(r.source_symbol) || !names.has(r.target_symbol)))
        return false;
    return true;
}
