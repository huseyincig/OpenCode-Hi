import { projectExecutionSurface } from './execution-projection.js';
import { externalActionTypeFromTechnicalKind } from '../../contracts/external-action.js';
function shellWords(command) {
    const out = [];
    let cur = '', quote, escape = false;
    const flush = () => { if (cur) {
        out.push(cur);
        cur = '';
    } };
    for (let i = 0; i < command.length; i++) {
        const ch = command[i], next = command[i + 1];
        if (escape) {
            cur += ch;
            escape = false;
            continue;
        }
        if (ch === '\\' && quote !== "'") {
            // A host command may contain a native Windows drive path (C:\dir\file).
            // Treat its separators as path syntax rather than POSIX shell escapes.
            if (/^[A-Za-z]:/.test(cur)) {
                cur += ch;
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
        if (ch === '&' && next === '&') {
            flush();
            out.push('&&');
            i++;
            continue;
        }
        if (ch === '|' && next === '|') {
            flush();
            out.push('||');
            i++;
            continue;
        }
        if (ch === ';' || ch === '|' || ch === '\n') {
            flush();
            out.push(ch === '\n' ? ';' : ch);
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
function skipOption(tokens, i, valueOptions) { const t = tokens[i]; if (!t?.startsWith('-'))
    return i; if (t.includes('='))
    return i + 1; return valueOptions.has(t) ? Math.min(tokens.length, i + 2) : i + 1; }
function unwrap(tokens) {
    let i = 0;
    while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i]))
        i++;
    if (tokens[i] === 'sudo') {
        i++;
        while (i < tokens.length && tokens[i].startsWith('-'))
            i = skipOption(tokens, i, new Set(['-u', '--user', '-g', '--group', '-h', '--host', '-C', '--chdir']));
    }
    if (tokens[i] === 'env') {
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
    }
    return { exe: tokens[i], args: tokens.slice(i + 1), tokens };
}
function splitInvocations(command) {
    const out = [];
    for (const fragment of projectExecutionSurface(command).fragments) {
        const tokens = shellWords(fragment.text).filter(token => !['&&', '||', ';', '|'].includes(token));
        if (!tokens.length)
            continue;
        const inv = unwrap(tokens);
        if (inv.exe)
            out.push(inv);
    }
    return out;
}
export function commandInvocations(command) { return splitInvocations(command); }
export function commandTokens(command) { return shellWords(command); }
function subcommand(args, valueOptions) { const values = new Set(valueOptions); let i = 0; while (i < args.length && args[i].startsWith('-'))
    i = skipOption(args, i, values); return { sub: args[i], rest: args.slice(i + 1) }; }
export function gitInvocation(command, sub) { return commandInvocations(command).find(inv => inv.exe === 'git' && (!sub || subcommand(inv.args, ['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']).sub === sub)); }
export function gitCommandParts(command) { const inv = gitInvocation(command); if (!inv)
    return { rest: [] }; const p = subcommand(inv.args, ['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']); return { ...p, invocation: inv }; }
export function npmLikeCommandParts(command) {
    const inv = commandInvocations(command).find(x => ['npm', 'pnpm', 'bun'].includes(x.exe ?? '') || x.exe === 'yarn');
    if (!inv)
        return { rest: [] };
    if (inv.exe === 'yarn' && inv.args[0] === 'npm') {
        const p = subcommand(inv.args.slice(1), ['--registry', '--cwd']);
        return { exe: 'yarn', ...p, invocation: inv };
    }
    const p = subcommand(inv.args, ['--registry', '--prefix', '--workspace', '-w', '--filter', '--config', '--userconfig', '--cache', '--tag']);
    return { exe: inv.exe, ...p, invocation: inv };
}
export function ghCommandParts(command) {
    const inv = commandInvocations(command).find(x => x.exe === 'gh');
    if (!inv)
        return { rest: [] };
    const p = subcommand(inv.args, ['--repo', '-R', '--hostname', '--config-dir']);
    return { ...p, invocation: inv };
}
function classifyInvocation(inv) {
    const { exe, args } = inv;
    if (exe === 'git' && subcommand(args, ['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']).sub === 'push')
        return 'git-push';
    if (['npm', 'pnpm', 'bun'].includes(exe ?? '') && subcommand(args, ['--registry', '--prefix', '--workspace', '-w', '--filter', '--config', '--userconfig', '--cache', '--tag']).sub === 'publish')
        return 'package-publish';
    if (exe === 'yarn' && args[0] === 'npm' && subcommand(args.slice(1), ['--registry', '--cwd']).sub === 'publish')
        return 'package-publish';
    if (exe === 'gh') {
        const p = subcommand(args, ['--repo', '-R', '--hostname', '--config-dir']);
        if (p.sub === 'release' && subcommand(p.rest, []).sub === 'create')
            return 'gh-release-create';
    }
    if (exe === 'docker' && subcommand(args, ['--context', '-H', '--host', '--config', '--log-level']).sub === 'push')
        return 'docker-push';
    if (exe === 'kubectl' && ['apply', 'delete'].includes(subcommand(args, ['--context', '--namespace', '-n', '--kubeconfig', '--cluster', '--user']).sub ?? ''))
        return 'kubectl-mutate';
    if (exe === 'terraform' && subcommand(args, ['-chdir']).sub === 'apply')
        return 'terraform-apply';
    if (exe === 'vercel' && subcommand(args, ['--scope', '--cwd', '--token']).sub === 'deploy')
        return 'vercel-deploy';
    if (exe === 'netlify' && subcommand(args, ['--cwd', '--config']).sub === 'deploy')
        return 'netlify-deploy';
    return 'other';
}
export function classifyExternalCommand(command) { for (const inv of commandInvocations(command)) {
    const kind = classifyInvocation(inv);
    if (kind !== 'other')
        return { kind, tokens: inv.tokens, exe: inv.exe, args: inv.args };
} return { kind: 'other', tokens: commandTokens(command), exe: commandInvocations(command)[0]?.exe, args: commandInvocations(command)[0]?.args ?? [] }; }
export function externalEffectCommand(command) { return commandInvocations(command).some(inv => classifyInvocation(inv) !== 'other'); }
export function externalActionType(command) { return externalActionTypeFromTechnicalKind(classifyExternalCommand(command).kind); }
export function canonicalExternalCommand(command) {
    const invs = commandInvocations(command), hit = invs.find(inv => classifyInvocation(inv) !== 'other');
    if (!hit || invs.length !== 1)
        return false;
    const t = hit.tokens, kind = classifyInvocation(hit);
    if (kind === 'git-push')
        return t[0] === 'git' && t[1] === 'push';
    if (kind === 'package-publish')
        return (['npm', 'pnpm', 'bun'].includes(t[0] ?? '') && t[1] === 'publish') || (t[0] === 'yarn' && t[1] === 'npm' && t[2] === 'publish');
    if (kind === 'gh-release-create')
        return t[0] === 'gh' && t[1] === 'release' && t[2] === 'create';
    if (kind === 'docker-push')
        return t[0] === 'docker' && t[1] === 'push';
    if (kind === 'kubectl-mutate')
        return t[0] === 'kubectl' && ['apply', 'delete'].includes(t[1] ?? '');
    if (kind === 'terraform-apply')
        return t[0] === 'terraform' && t[1] === 'apply';
    if (kind === 'vercel-deploy')
        return t[0] === 'vercel' && t[1] === 'deploy';
    if (kind === 'netlify-deploy')
        return t[0] === 'netlify' && t[1] === 'deploy';
    return false;
}
