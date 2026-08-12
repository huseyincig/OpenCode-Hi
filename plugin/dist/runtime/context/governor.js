function compact(text, max) { return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 36))}\n[compressed ${text.length - max} chars]`; }
export function governContext(entries, options) {
    const beforeChars = entries.reduce((n, e) => n + e.text.length, 0);
    if (beforeChars <= options.maxChars)
        return { action: 'NOOP', entries: [...entries], removedIds: [], compressedIds: [], beforeChars, afterChars: beforeChars };
    const seen = new Set(), removedIds = [];
    const deduped = entries.filter(e => { if (e.contextClass !== 'PURGEABLE')
        return true; const key = `${e.kind}\0${e.text}`; if (seen.has(key)) {
        removedIds.push(e.id);
        return false;
    } seen.add(key); return true; });
    let current = deduped.reduce((n, e) => n + e.text.length, 0);
    const kept = [...deduped];
    for (let i = 0; i < kept.length && current > options.maxChars; i++)
        if (kept[i].contextClass === 'PURGEABLE') {
            current -= kept[i].text.length;
            removedIds.push(kept[i].id);
            kept.splice(i, 1);
            i--;
        }
    const compressedIds = [];
    const target = Math.max(128, options.compressToChars ?? 768);
    for (let i = 0; i < kept.length && current > options.maxChars; i++)
        if (kept[i].contextClass === 'COMPRESSIBLE' && kept[i].text.length > target) {
            const old = kept[i];
            const text = compact(old.text, target);
            current += text.length - old.text.length;
            kept[i] = { ...old, text };
            compressedIds.push(old.id);
        }
    return { action: 'REDUCED', entries: kept, removedIds: [...new Set(removedIds)], compressedIds, beforeChars, afterChars: current };
}
