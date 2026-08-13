import { existsSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
const DECL = /(?:^|\n)\s*(?:export\s+)?(?:declare\s+)?(interface|type|class|function|enum)\s+([A-Za-z_$][\w$]*)[^\n{=]*(?:=\s*[^\n;]+;?|\{)?/g;
export function extractTypeScriptSemanticContext(source, names = [], maxChars = 5000) {
    const wanted = new Set(names), symbols = [];
    for (const match of source.matchAll(DECL)) {
        const kind = match[1], name = match[2], rawStart = match.index ?? 0, start = source[rawStart] === '\n' ? rawStart + 1 : rawStart;
        if (wanted.size && !wanted.has(name))
            continue;
        let end = source.indexOf('\n', start);
        if (kind === 'interface' || kind === 'class' || kind === 'enum') {
            let depth = 0, seen = false;
            for (let i = start; i < source.length; i++) {
                if (source[i] === '{') {
                    depth++;
                    seen = true;
                }
                else if (source[i] === '}' && seen) {
                    depth--;
                    if (depth === 0) {
                        end = i + 1;
                        break;
                    }
                }
            }
        }
        if (end < 0)
            end = Math.min(source.length, start + 600);
        const signature = source.slice(start, end).trim();
        symbols.push({ kind, name, signature, start });
        if (symbols.reduce((n, s) => n + s.signature.length, 0) >= maxChars)
            break;
    }
    const text = symbols.map(s => s.signature).join('\n\n').slice(0, maxChars);
    return { symbols, text, sourceChars: source.length, contextChars: text.length };
}
export function typescriptSemanticContextForTargets(projectRoot, targets, maxChars = 3000) {
    const root = resolve(projectRoot), out = [];
    let used = 0;
    for (const target of [...new Set(targets)].slice(0, 6)) {
        if (!/\.tsx?$/i.test(target))
            continue;
        const full = resolve(root, target);
        if (full !== root && !full.startsWith(root + sep))
            continue;
        try {
            if (!existsSync(full) || !statSync(full).isFile() || statSync(full).size > 524288)
                continue;
            const source = readFileSync(full, 'utf8'), left = Math.max(0, maxChars - used);
            if (left < 128)
                break;
            const r = extractTypeScriptSemanticContext(source, [], Math.min(1400, left));
            if (!r.text)
                continue;
            const rel = relative(root, full).replace(/\\/g, '/'), entry = `semantic-typescript:${rel}\n${r.text}`;
            out.push(entry);
            used += entry.length;
        }
        catch { }
    }
    return out;
}
