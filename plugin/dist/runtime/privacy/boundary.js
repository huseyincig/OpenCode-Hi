const PATTERNS = [/\b(?:sk|pk)_[A-Za-z0-9_-]{16,}\b/g, /\b(?:ghp|github_pat)_[A-Za-z0-9_]{16,}\b/g, /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}\b/gi, /\b(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*["']?([^\s"']{8,})["']?/gi];
export function redactProviderContext(text) { const redactions = []; let providerText = text; let index = 0; for (const re of PATTERNS) {
    providerText = providerText.replace(re, (value) => { if (value.includes('<HI_REDACTED_'))
        return value; const id = `<HI_REDACTED_${++index}>`; redactions.push({ id, value, kind: 'secret' }); return id; });
} return { providerText, redactions }; }
export function restoreLocalText(text, redactions) { let out = text; for (const r of redactions)
    out = out.split(r.id).join(r.value); return out; }
export function containsPlaintextSecret(text, redactions) { return redactions.some(r => text.includes(r.value)); }
