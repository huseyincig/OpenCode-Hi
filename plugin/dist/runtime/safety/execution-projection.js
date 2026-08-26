const MAX_INPUT_CHARS = 131_072;
const MAX_DEPTH = 8;
const MAX_FRAGMENTS = 96;
const MAX_WORK_UNITS = 524_288;
const CACHE_MAX = 96;
const CACHE = new Map();
const CHILD_CAPABLE_HEADS = new Set(['sudo', 'env', 'nice', 'nohup', 'command', 'builtin', 'time', 'sh', 'bash', 'zsh', 'dash', 'powershell', 'powershell.exe', 'pwsh', 'pwsh.exe', 'eval', 'source', '.', 'find', 'xargs', 'parallel', 'awk', 'gawk', 'nawk', 'mawk', 'python', 'python3', 'node', 'perl', 'ruby']);
function pushUncertainty(state, reason) { state.uncertainty.add(reason); }
function charge(state, n) { state.units += Math.max(0, n); if (state.units <= MAX_WORK_UNITS)
    return true; pushUncertainty(state, 'execution-projection-work-budget-exceeded'); return false; }
function trimBounded(text) { return text.trim().slice(0, MAX_INPUT_CHARS); }
function detectDialect(source) {
    const s = source.trim();
    if (/^(?:Remove-Item|Write-Output|Get-Item|Set-Item|New-Item|Copy-Item|Move-Item|Start-Process|Invoke-Expression)\b/i.test(s))
        return 'powershell';
    if (/^&\s*\{/.test(s) || /\b-(?:Recurse|Force|LiteralPath|Path)\b/i.test(s) && /\bRemove-Item\b/i.test(s))
        return 'powershell';
    return 'posix';
}
function tokenDynamic(token) { return Boolean(token && /(?:\$\(|`|<\(|>\(|\$\{|\$[A-Za-z_0-9@*?])/.test(token)); }
function hasActiveDynamicSyntax(source) {
    let quote, escape = false;
    for (let i = 0; i < source.length; i++) {
        const ch = source[i], next = source[i + 1];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === '\\' && quote !== "'") {
            escape = true;
            continue;
        }
        if (quote) {
            if (ch === quote)
                quote = undefined;
            if (quote === "'")
                continue;
        }
        else if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === '`' || ch === '$' && (next === '(' || next === '{' || /[A-Za-z_0-9@*?]/.test(next ?? '')) || (ch === '<' || ch === '>') && next === '(')
            return true;
    }
    return false;
}
function shellTokens(source) {
    const out = [];
    let cur = '', quote, escape = false;
    const flush = () => { if (cur) {
        out.push(cur);
        cur = '';
    } };
    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        if (escape) {
            cur += ch;
            escape = false;
            continue;
        }
        if (ch === '\\' && quote !== "'") {
            const next = source[i + 1];
            if (quote === '"' && !['$', '`', '"', '\\', '\n', '\r'].includes(next ?? '')) {
                cur += '\\';
                continue;
            }
            if (!quote && /^[A-Za-z]:/.test(cur)) {
                cur += '\\';
                continue;
            }
            escape = true;
            continue;
        }
        if (quote) {
            if (ch === quote)
                quote = undefined;
            else
                cur += ch;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (/\s/.test(ch)) {
            flush();
            continue;
        }
        cur += ch;
    }
    flush();
    return out;
}
function stripAssignmentPrefix(tokens) { let i = 0; while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i]))
    i++; return tokens.slice(i); }
function simpleExecutableHead(source) { const re = /\S+/g; for (let match = re.exec(source); match; match = re.exec(source)) {
    const token = match[0];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token))
        continue;
    return token.toLowerCase();
} return undefined; }
function childCapableHead(head) { return Boolean(head && (CHILD_CAPABLE_HEADS.has(head) || /^python\d+(?:\.\d+)*$/.test(head))); }
function transparentChild(tokens) {
    let i = 0;
    const wrapper = tokens[i]?.toLowerCase();
    if (wrapper === 'sudo') {
        i++;
        while (i < tokens.length && tokens[i].startsWith('-')) {
            const opt = tokens[i++];
            if (['-u', '--user', '-g', '--group', '-h', '--host', '-C', '--chdir'].includes(opt) && i < tokens.length)
                i++;
        }
        return tokens.slice(i);
    }
    if (wrapper === 'env') {
        i++;
        while (i < tokens.length) {
            const t = tokens[i];
            if (t === '-i' || t === '--ignore-environment') {
                i++;
                continue;
            }
            if (t === '-u' || t === '--unset') {
                i += 2;
                continue;
            }
            if (t.startsWith('-')) {
                i++;
                continue;
            }
            if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) {
                i++;
                continue;
            }
            break;
        }
        return tokens.slice(i);
    }
    if (['nice', 'nohup', 'command', 'builtin', 'time'].includes(wrapper ?? '')) {
        i++;
        while (i < tokens.length && tokens[i].startsWith('-'))
            i++;
        return tokens.slice(i);
    }
    return undefined;
}
function quotedHeredocMask(source, state, depth, cwdRisk) {
    if (!source.includes('<<'))
        return source;
    const chars = [...source], lines = source.split(/\n/);
    let offset = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex], newlineLen = lineIndex < lines.length - 1 ? 1 : 0;
        const matches = [...line.matchAll(/<<(-)?\s*(?:(['"])([^'"\n]+)\2|([A-Za-z_][A-Za-z0-9_]*))/g)];
        if (!matches.length) {
            offset += line.length + newlineLen;
            continue;
        }
        const match = matches[0], delimiter = match[3] ?? match[4], quoted = Boolean(match[2]), stripTabs = Boolean(match[1]);
        if (!delimiter) {
            offset += line.length + newlineLen;
            continue;
        }
        let bodyStart = offset + line.length + newlineLen, searchLine = lineIndex + 1, bodyEnd = bodyStart, delimiterEnd = bodyStart, found = false;
        while (searchLine < lines.length) {
            const candidate = stripTabs ? lines[searchLine].replace(/^\t+/, '') : lines[searchLine];
            const lineStart = bodyEnd;
            const len = lines[searchLine].length + (searchLine < lines.length - 1 ? 1 : 0);
            if (candidate.trim() === delimiter) {
                delimiterEnd = lineStart + len;
                found = true;
                break;
            }
            bodyEnd += len;
            searchLine++;
        }
        if (!found) {
            pushUncertainty(state, 'unterminated-heredoc');
            break;
        }
        const body = source.slice(bodyStart, bodyEnd);
        if (!quoted)
            scanNestedCarriers(body, 'posix', depth, cwdRisk, state);
        for (let i = bodyStart; i < delimiterEnd; i++)
            if (chars[i] !== '\n' && chars[i] !== '\r')
                chars[i] = ' ';
        lineIndex = searchLine;
        offset = delimiterEnd;
    }
    return chars.join('');
}
function findBalanced(source, start, open, close) {
    let depth = 1, quote, escape = false;
    for (let i = start; i < source.length; i++) {
        const ch = source[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === '\\' && quote !== "'") {
            escape = true;
            continue;
        }
        if (quote) {
            if (ch === quote)
                quote = undefined;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === open)
            depth++;
        else if (ch === close) {
            depth--;
            if (depth === 0)
                return { inner: source.slice(start, i), end: i };
        }
    }
    return undefined;
}
function findBacktick(source, start) { let escape = false; for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (escape) {
        escape = false;
        continue;
    }
    if (ch === '\\') {
        escape = true;
        continue;
    }
    if (ch === '`')
        return { inner: source.slice(start, i), end: i };
} return undefined; }
function scanNestedCarriers(source, dialect, depth, cwdRisk, state) {
    if (dialect === 'posix' && !source.includes('$(') && !source.includes('`') && !source.includes('<(') && !source.includes('>('))
        return;
    if (dialect === 'powershell' && !source.includes('$('))
        return;
    if (depth >= MAX_DEPTH) {
        pushUncertainty(state, 'nested-execution-depth-exceeded');
        return;
    }
    let quote, escape = false;
    for (let i = 0; i < source.length; i++) {
        const ch = source[i], next = source[i + 1], next2 = source[i + 2];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === '\\' && quote !== "'") {
            escape = true;
            continue;
        }
        if (quote) {
            if (ch === quote) {
                quote = undefined;
                continue;
            }
            if (quote === "'")
                continue;
        }
        else if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (dialect === 'powershell' && ch === '`') {
            i++;
            continue;
        }
        if (ch === '$' && next === '(') {
            if (next2 === '(') {
                const arithmetic = findBalanced(source, i + 3, '(', ')');
                if (!arithmetic) {
                    pushUncertainty(state, 'unterminated-arithmetic-expansion');
                    return;
                }
                scanNestedCarriers(arithmetic.inner, dialect, depth + 1, cwdRisk, state);
                i = arithmetic.end;
                continue;
            }
            const nested = findBalanced(source, i + 2, '(', ')');
            if (!nested) {
                pushUncertainty(state, 'unterminated-command-substitution');
                return;
            }
            scanProgram(nested.inner, dialect, depth + 1, 'command-substitution', cwdRisk, state);
            i = nested.end;
            continue;
        }
        if (dialect === 'posix' && (ch === '<' || ch === '>') && next === '(') {
            const nested = findBalanced(source, i + 2, '(', ')');
            if (!nested) {
                pushUncertainty(state, 'unterminated-process-substitution');
                return;
            }
            scanProgram(nested.inner, 'posix', depth + 1, 'process-substitution', cwdRisk, state);
            i = nested.end;
            continue;
        }
        if (dialect === 'posix' && ch === '`') {
            const nested = findBacktick(source, i + 1);
            if (!nested) {
                pushUncertainty(state, 'unterminated-backtick-substitution');
                return;
            }
            scanProgram(nested.inner, 'posix', depth + 1, 'backtick', cwdRisk, state);
            i = nested.end;
            continue;
        }
    }
}
function splitSegments(source, dialect, initialCwd, state) {
    if (!/[;&|\n'"]/.test(source)) {
        const text = source.trim();
        return text ? [{ text, cwdRisk: initialCwd }] : [];
    }
    const segments = [];
    let start = 0, quote, escape = false, cwdRisk = initialCwd;
    const emit = (end) => { const text = source.slice(start, end).trim(); if (text) {
        segments.push({ text, cwdRisk });
        cwdRisk = nextCwdRisk(text, dialect, cwdRisk);
    } };
    for (let i = 0; i < source.length; i++) {
        const ch = source[i], next = source[i + 1];
        if (escape) {
            escape = false;
            continue;
        }
        if (dialect === 'powershell' && ch === '`') {
            escape = true;
            continue;
        }
        if (ch === '\\' && dialect === 'posix' && quote !== "'") {
            escape = true;
            continue;
        }
        if (quote) {
            if (ch === quote)
                quote = undefined;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === '&' && next === '&' || ch === '|' && next === '|') {
            emit(i);
            i++;
            start = i + 1;
            continue;
        }
        if (ch === ';' || ch === '|' || ch === '\n') {
            emit(i);
            start = i + 1;
            continue;
        }
    }
    emit(source.length);
    if (quote)
        pushUncertainty(state, `unterminated-${dialect}-quote`);
    return segments;
}
function cwdTargetRisk(target, dialect) {
    if (!target || tokenDynamic(target) && !['~', '$HOME', '${HOME}'].includes(target))
        return 'unknown';
    const normalized = target.replaceAll('\\', '/');
    if (['~', '$HOME', '${HOME}'].includes(target) || normalized.startsWith('~/') || normalized.startsWith('$HOME/') || normalized.startsWith('${HOME}/'))
        return 'home';
    if (dialect === 'powershell') {
        if (/^[A-Za-z]:\/?$/.test(normalized))
            return 'root';
        if (/^[A-Za-z]:\/(?:Windows|Users|Program Files|ProgramData)(?:\/|$)/i.test(normalized))
            return 'system';
        if (/^[A-Za-z]:\//.test(normalized))
            return 'stable';
        return 'unknown';
    }
    if (normalized === '/')
        return 'root';
    if (/^\/(?:etc|usr|var|boot|root|home|bin|sbin|lib|proc|sys|dev|run|opt)(?:\/|$)/.test(normalized))
        return 'system';
    return normalized.startsWith('/') ? 'stable' : 'unknown';
}
function nextCwdRisk(text, dialect, current) {
    const tokens = stripAssignmentPrefix(shellTokens(text)), head = tokens[0]?.toLowerCase();
    const locationHeads = dialect === 'powershell' ? ['set-location', 'push-location', 'cd', 'chdir', 'sl', 'pushd'] : ['cd', 'pushd'];
    if (!locationHeads.includes(head ?? ''))
        return current;
    return cwdTargetRisk(tokens[1], dialect);
}
function fragmentDynamic(text) {
    if (!/[$`]|[<>]\(/.test(text))
        return false;
    const tokens = stripAssignmentPrefix(shellTokens(text));
    if (!tokens.length)
        return false;
    const executable = tokens.join(' ');
    if (!hasActiveDynamicSyntax(executable))
        return false;
    const head = tokens[0];
    if (tokenDynamic(head))
        return true;
    if (/^rm\b[^;&|\n]*\s(?:-[^\s]*[rR][^\s]*|--recursive)\b/i.test(executable))
        return true;
    if (/^git\s+reset\b/i.test(executable))
        return true;
    return false;
}
function addFragment(text, dialect, origin, depth, cwdRisk, state) {
    const bounded = trimBounded(text);
    if (!bounded)
        return;
    if (state.fragments.length >= MAX_FRAGMENTS) {
        pushUncertainty(state, 'execution-fragment-limit-exceeded');
        return;
    }
    if (!state.fragments.some(x => x.text === bounded && x.dialect === dialect && x.origin === origin && x.depth === depth && x.cwdRisk === cwdRisk))
        state.fragments.push({ text: bounded, dialect, origin, depth, cwdRisk, dynamic: fragmentDynamic(bounded) });
}
function xargsChild(tokens) {
    let i = 1;
    const valueOptions = new Set(['-L', '-n', '-P', '-s', '-a', '-E', '-R', '-S', '-e', '-d', '-J', '--max-args', '--max-procs', '--max-chars', '--arg-file', '--eof', '--delimiter', '--max-lines', '--process-slot-var']);
    while (i < tokens.length) {
        const token = tokens[i];
        if (token === '--') {
            i++;
            break;
        }
        if (!token.startsWith('-') || token === '-')
            break;
        if (token === '-I') {
            i += 2;
            continue;
        }
        if (token.startsWith('-I') && token.length > 2) {
            i++;
            continue;
        }
        if (token === '--replace') {
            i++;
            continue;
        }
        if (token.startsWith('--replace=')) {
            i++;
            continue;
        }
        if (valueOptions.has(token)) {
            i += 2;
            continue;
        }
        i++;
    }
    return i < tokens.length ? tokens.slice(i) : undefined;
}
function findStartingTargets(tokens) {
    const out = [];
    let i = 1;
    while (i < tokens.length && ['-H', '-P'].includes(tokens[i]))
        i++;
    if (tokens[i] === '--')
        i++;
    while (i < tokens.length) {
        const token = tokens[i];
        if (!token || token.startsWith('-') || ['!', '(', ')'].includes(token))
            break;
        out.push(token);
        i++;
    }
    return out.length ? out : ['.'];
}
function deriveFindChildren(tokens, depth, cwdRisk, state) {
    const targets = findStartingTargets(tokens);
    if (tokens.includes('-delete'))
        for (const target of targets.slice(0, 8))
            addFragment(`rm -rf ${target}`, 'posix', 'embedded-execution', depth + 1, cwdRisk, state);
    for (let i = 1; i < tokens.length; i++) {
        const primary = tokens[i];
        if (!['-exec', '-execdir', '-ok', '-okdir'].includes(primary))
            continue;
        let end = i + 1;
        while (end < tokens.length && ![';', '+'].includes(tokens[end]))
            end++;
        const childTokens = tokens.slice(i + 1, end);
        if (childTokens.length) {
            const childCwd = ['-execdir', '-okdir'].includes(primary) ? 'unknown' : cwdRisk;
            for (const target of targets.slice(0, 8)) {
                const child = childTokens.map(token => token.includes('{}') ? token.replaceAll('{}', target) : token).join(' ');
                scanProgram(child, 'posix', depth + 1, 'embedded-execution', childCwd, state);
            }
        }
        i = end;
    }
}
function inlineInterpreterSource(tokens, head) {
    const normalized = (head ?? '').replace(/^.*[\\/]/, '').toLowerCase(), python = /^python(?:\d+(?:\.\d+)*)?$/.test(normalized);
    const flags = python ? new Set(['-c']) : normalized === 'node' ? new Set(['-e', '--eval', '-p', '--print']) : normalized === 'perl' ? new Set(['-e', '-E']) : normalized === 'ruby' ? new Set(['-e']) : undefined;
    if (!flags)
        return;
    for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        if (flags.has(token))
            return tokens[i + 1];
        if (normalized === 'node' && token.startsWith('--eval='))
            return token.slice('--eval='.length);
        if ((python || normalized === 'perl' || normalized === 'ruby') && token.length > 2 && flags.has(token.slice(0, 2)))
            return token.slice(2);
    }
    return;
}
function literalExecutionSink(code, head) {
    const normalized = (head ?? '').replace(/^.*[\\/]/, '').toLowerCase();
    const pattern = /^python/.test(normalized) ? /\b(?:os\.system|subprocess\.(?:run|call|Popen|check_call|check_output))\s*\(\s*(["'])(.*?)\1/s : normalized === 'node' ? /\b(?:execSync|exec|spawnSync|spawn)\s*\(\s*(["'])(.*?)\1/s : /\b(?:system|exec)\s*\(\s*(["'])(.*?)\1/s;
    return pattern.exec(code)?.[2];
}
function deriveInterpreterChildren(tokens, head, depth, cwdRisk, state) {
    const code = inlineInterpreterSource(tokens, head);
    if (code === undefined)
        return;
    const child = literalExecutionSink(code, head);
    if (child !== undefined) {
        scanProgram(child, 'posix', depth + 1, 'embedded-execution', cwdRisk, state);
        return;
    }
    const sink = /\b(?:system|exec|execSync|spawn|spawnSync|popen|subprocess|child_process|eval)\b/i.test(code), danger = /\brm\b|\bgit\b|\bRemove-Item\b|\b(?:delete|destroy|mkfs|dd)\b/i.test(code);
    if (sink && danger)
        pushUncertainty(state, 'dynamic-interpreter-execution-source');
}
function parallelJobs(tokens) {
    let marker = tokens.indexOf(':::');
    if (marker < 0)
        return [];
    let start = 1;
    while (start < marker && tokens[start].startsWith('-')) {
        const option = tokens[start++];
        if (['-j', '--jobs', '--timeout', '--delay', '--wd', '--workdir'].includes(option) && start < marker)
            start++;
    }
    const template = tokens.slice(start, marker);
    if (!template.length)
        return [];
    const groups = [];
    let group = [];
    for (let i = marker + 1; i < tokens.length; i++) {
        if (tokens[i] === ':::') {
            groups.push(group);
            group = [];
        }
        else
            group.push(tokens[i]);
    }
    groups.push(group);
    if (groups.some(x => !x.length))
        return [];
    let jobs = [[]];
    for (const groupValues of groups) {
        const next = [];
        for (const job of jobs)
            for (const value of groupValues) {
                next.push([...job, value]);
                if (next.length >= 16)
                    break;
            }
        jobs = next;
        if (jobs.length >= 16)
            break;
    }
    const hasPlaceholder = template.some(token => /\{(?:-?\d+)?\}/.test(token));
    return jobs.slice(0, 16).map(job => { if (!hasPlaceholder)
        return [...template, ...job].join(' '); return template.map(token => token.replace(/\{(-?\d*)\}/g, (_m, index) => { if (index === '')
        return job[0] ?? ''; const n = Number(index); return n > 0 ? job[n - 1] ?? '' : job[job.length + n] ?? ''; })).join(' '); });
}
function deriveParallelChildren(tokens, depth, cwdRisk, state) {
    const jobs = parallelJobs(tokens);
    if (!jobs.length) {
        pushUncertainty(state, 'parallel-child-execution-unresolved');
        return;
    }
    for (const child of jobs)
        scanProgram(child, 'posix', depth + 1, 'embedded-execution', cwdRisk, state);
}
function decodePowerShellEncoded(value, state) {
    if (value.length > MAX_INPUT_CHARS * 2 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
        pushUncertainty(state, 'powershell-encoded-command-invalid');
        return;
    }
    const bytes = Buffer.from(value, 'base64');
    if (!bytes.length || bytes.length % 2 !== 0) {
        pushUncertainty(state, 'powershell-encoded-command-invalid');
        return;
    }
    const decoded = bytes.toString('utf16le').replace(/\u0000+$/g, '').trim();
    if (!decoded) {
        pushUncertainty(state, 'powershell-encoded-command-empty');
        return;
    }
    return decoded;
}
function deriveChildren(text, dialect, depth, cwdRisk, state) {
    if (depth >= MAX_DEPTH) {
        pushUncertainty(state, 'nested-execution-depth-exceeded');
        return;
    }
    const tokens = stripAssignmentPrefix(shellTokens(text));
    if (!tokens.length)
        return;
    const transparent = transparentChild(tokens);
    if (transparent?.length) {
        const child = transparent.join(' ');
        addFragment(child, dialect, 'transparent-wrapper', depth + 1, cwdRisk, state);
        deriveChildren(child, dialect, depth + 1, cwdRisk, state);
    }
    const head = (transparent?.[0] ?? tokens[0])?.toLowerCase(), args = transparent ?? tokens;
    if (['sh', 'bash', 'zsh', 'dash'].includes(head ?? '')) {
        const i = args.findIndex((x, index) => index > 0 && x === '-c');
        if (i >= 0 && args[i + 1])
            scanProgram(args[i + 1], 'posix', depth + 1, 'shell-wrapper', cwdRisk, state);
    }
    if (['powershell', 'powershell.exe', 'pwsh', 'pwsh.exe'].includes(head ?? '')) {
        const encoded = args.findIndex((x, index) => index > 0 && ['-encodedcommand', '-enc', '-e'].includes(x.toLowerCase()));
        if (encoded >= 0) {
            if (encoded + 2 !== args.length)
                pushUncertainty(state, 'powershell-encoded-command-shape');
            else {
                const decoded = decodePowerShellEncoded(args[encoded + 1], state);
                if (decoded)
                    scanProgram(decoded, 'powershell', depth + 1, 'shell-wrapper', cwdRisk, state);
            }
        }
        else {
            const i = args.findIndex((x, index) => index > 0 && ['-command', '-c'].includes(x.toLowerCase()));
            if (i >= 0 && args[i + 1])
                scanProgram(args.slice(i + 1).join(' '), 'powershell', depth + 1, 'shell-wrapper', cwdRisk, state);
        }
    }
    if (['cmd', 'cmd.exe'].includes(head ?? '')) {
        const i = args.findIndex((x, index) => index > 0 && ['/c', '/k'].includes(x.toLowerCase()));
        if (i >= 0 && args[i + 1])
            scanProgram(args.slice(i + 1).join(' '), 'powershell', depth + 1, 'shell-wrapper', cwdRisk, state);
    }
    if (['eval', 'source', '.'].includes(head ?? '')) {
        const source = args.slice(1).filter(x => x !== '--').join(' ');
        if (source) {
            if (hasActiveDynamicSyntax(source))
                pushUncertainty(state, 'dynamic-shell-execution-source');
            else
                scanProgram(source, 'posix', depth + 1, 'embedded-execution', cwdRisk, state);
        }
    }
    if (head === 'find')
        deriveFindChildren(args, depth, cwdRisk, state);
    if (head === 'xargs') {
        const childTokens = xargsChild(args);
        if (childTokens?.length) {
            const child = childTokens.join(' ');
            addFragment(child, dialect, 'pipeline-consumer', depth + 1, cwdRisk, state);
            const childHead = childTokens[0]?.toLowerCase(), ci = childTokens.findIndex((x, index) => index > 0 && x === '-c');
            if (['sh', 'bash', 'zsh', 'dash'].includes(childHead ?? '') && ci >= 0 && childTokens[ci + 1])
                scanProgram(childTokens[ci + 1], 'posix', depth + 2, 'shell-wrapper', cwdRisk, state);
            else
                deriveChildren(child, dialect, depth + 1, cwdRisk, state);
        }
    }
    if (head === 'parallel')
        deriveParallelChildren(args, depth, cwdRisk, state);
    if (['awk', 'gawk', 'nawk', 'mawk'].includes(head ?? ''))
        for (const match of text.matchAll(/\bsystem\s*\(\s*(["'])(.*?)\1\s*\)/g)) {
            const child = match[2];
            if (child)
                scanProgram(child, 'posix', depth + 1, 'embedded-execution', cwdRisk, state);
        }
    deriveInterpreterChildren(args, head, depth, cwdRisk, state);
    if (dialect === 'powershell')
        for (const match of text.matchAll(/&\s*\{([^{}]*)\}/g)) {
            const child = match[1];
            if (child)
                scanProgram(child, 'powershell', depth + 1, 'powershell-script-block', cwdRisk, state);
        }
}
function scanProgram(source, dialect, depth, origin, cwdRisk, state) {
    const bounded = source.slice(0, MAX_INPUT_CHARS);
    if (source.length > MAX_INPUT_CHARS)
        pushUncertainty(state, 'execution-input-truncated');
    if (!charge(state, bounded.length))
        return;
    if (depth > MAX_DEPTH) {
        pushUncertainty(state, 'nested-execution-depth-exceeded');
        return;
    }
    if (dialect === 'posix' && !/[;&|\n'"\\$`<>]/.test(bounded)) {
        const text = bounded.trim();
        if (!text)
            return;
        if (state.fragments.length >= MAX_FRAGMENTS) {
            pushUncertainty(state, 'execution-fragment-limit-exceeded');
            return;
        }
        if (!state.fragments.some(x => x.text === text && x.dialect === 'posix' && x.origin === origin && x.depth === depth && x.cwdRisk === cwdRisk))
            state.fragments.push({ text, dialect: 'posix', origin, depth, cwdRisk, dynamic: false });
        if (childCapableHead(simpleExecutableHead(text)))
            deriveChildren(text, 'posix', depth, cwdRisk, state);
        return;
    }
    const masked = dialect === 'posix' ? quotedHeredocMask(bounded, state, depth, cwdRisk) : bounded;
    scanNestedCarriers(masked, dialect, depth, cwdRisk, state);
    for (const segment of splitSegments(masked, dialect, cwdRisk, state)) {
        addFragment(segment.text, dialect, origin, depth, segment.cwdRisk, state);
        deriveChildren(segment.text, dialect, depth, segment.cwdRisk, state);
    }
}
function cloneProjection(value) { return { fragments: value.fragments.map(x => ({ ...x })), uncertain: value.uncertain, uncertainty: [...value.uncertainty], workUnits: value.workUnits }; }
export function projectExecutionSurface(command, dialect = 'auto') {
    const key = `${dialect}\u0000${command}`;
    const cached = CACHE.get(key);
    if (cached)
        return cloneProjection(cached);
    const state = { units: 0, uncertainty: new Set(), fragments: [] }, source = String(command ?? '');
    if (source.length > MAX_INPUT_CHARS)
        pushUncertainty(state, 'execution-input-truncated');
    scanProgram(source, dialect === 'auto' ? detectDialect(source) : dialect, 0, 'root', 'stable', state);
    const value = { fragments: state.fragments, uncertain: state.uncertainty.size > 0, uncertainty: [...state.uncertainty], workUnits: state.units };
    CACHE.set(key, value);
    if (CACHE.size > CACHE_MAX)
        CACHE.delete(CACHE.keys().next().value);
    return cloneProjection(value);
}
