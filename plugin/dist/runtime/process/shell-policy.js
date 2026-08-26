import { projectExecutionSurface } from '../safety/execution-projection.js';
import { gitCommandParts } from '../safety/command-classifier.js';
const INTERACTIVE = [/\bssh\b(?!.*\s-[^\n]*T)/i, /\bpasswd\b/i, /\b(?:npm|pnpm|yarn)\s+login\b/i, /\bgh\s+auth\s+login\b/i, /\baz\s+login\b/i, /\bgcloud\s+(?:auth\s+)?login\b/i, /\baws\s+(?:sso\s+login|configure\s+sso|login)\b/i, /\bselect\s+/i];
const CATASTROPHIC_FILESYSTEM = [
    /(?:^|[;&|]\s*)shred\s+[^;|&]*(?:\/dev\/|\/etc\/|\/home\/|~\/|\$HOME)/i,
    /(?:^|[;&|]\s*)mkfs(?:\.[A-Za-z0-9_-]+)?\s/i,
    /(?:^|[;&|]\s*)dd\s+[^;|&]*\bof=\/dev\//i,
];
const IRREVERSIBLE_EXTERNAL = [
    /\bgh\s+repo\s+delete\b/i,
    /\b(?:npm|pnpm|yarn)\s+unpublish\b/i,
    /\bterraform\s+destroy\b/i,
    /\b(?:aws|gcloud|az)\b[^;|&]*\b(?:delete|destroy|terminate)\b/i,
];
const SECRET_SENSITIVE = [
    /\b(?:password|passwd|secret|token|api[_-]?key)\s*=\s*[^\s$][^\s]*/i,
    /\bAuthorization:\s*Bearer\s+[A-Za-z0-9._~+\/-]{12,}/i,
];
const SHORT_PASSWORD_COMMANDS = new Set(['mysql', 'mariadb', 'mysqldump', 'mariadb-dump', 'mysqladmin', 'mariadb-admin', 'sshpass']);
function commandBasename(value) { return (value ?? '').replace(/^['"]|['"]$/g, '').replace(/^.*[\\/]/, '').toLowerCase(); }
function isPlainSecretValue(value) {
    if (!value)
        return false;
    const normalized = value.replace(/^['"]|['"]$/g, '');
    return Boolean(normalized && !/[${}`]/.test(normalized) && !/^<[^>]+>$/.test(normalized) && normalized !== '<HI_REDACTED_SECRET>');
}
function hasPlaintextSecretFlag(text) {
    const tokens = executableWords(text);
    if (!tokens.length)
        return false;
    for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        const long = /^--(?:password|secret|token|api[_-]?key)(?:=(.*))?$/i.exec(token);
        if (long && isPlainSecretValue(long[1] ?? tokens[i + 1]))
            return true;
    }
    const command = commandBasename(tokens[0]), args = tokens.slice(1), shortPassword = SHORT_PASSWORD_COMMANDS.has(command) || (['docker', 'podman'].includes(command) && commandBasename(args[0]) === 'login');
    if (!shortPassword)
        return false;
    for (let i = 0; i < args.length; i++) {
        const token = args[i];
        if (token === '-p' && isPlainSecretValue(args[i + 1]))
            return true;
        if (/^-p.+/.test(token) && isPlainSecretValue(token.slice(2)))
            return true;
    }
    return false;
}
function words(text) { return text.trim().split(/\s+/).filter(Boolean); }
function executableWords(text) { const tokens = words(text); let i = 0; while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i]))
    i++; return tokens.slice(i); }
function executableText(text) { return executableWords(text).join(' '); }
function rmAssessment(fragment) {
    const tokens = executableWords(fragment.text);
    if (tokens[0]?.toLowerCase() !== 'rm')
        return;
    let recursive = false, force = false, i = 1;
    for (; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === '--') {
            i++;
            break;
        }
        if (!token.startsWith('-') || token === '-')
            break;
        if (token === '--recursive')
            recursive = true;
        else if (token === '--force')
            force = true;
        else {
            if (/[rR]/.test(token.slice(1)))
                recursive = true;
            if (/f/.test(token.slice(1)))
                force = true;
        }
    }
    if (!recursive)
        return;
    const targets = tokens.slice(i);
    if (!targets.length)
        return 'dynamic';
    for (const raw of targets) {
        const target = raw.replace(/^['"]|['"]$/g, '');
        if (/^(?:\/$|\/(?:etc|usr|var|boot|root|home)(?:\/|$)|~\/?(?:$|\/)|\$HOME(?:\/|$)|\$\{HOME\}(?:\/|$)|\.\.(?:\/|$)|\*(?:\/|$))/.test(target))
            return 'catastrophic';
        if ((target === '.' || target === './') && fragment.cwdRisk !== 'stable')
            return 'catastrophic';
        if (target === '.' || target === './')
            return 'catastrophic';
        if (/(?:\$\(|`|<\(|>\(|\$\{|\$[A-Za-z_0-9@*?])/.test(target))
            return 'dynamic';
    }
    for (const raw of targets) {
        const target = raw.replace(/^['"]|['"]$/g, ''), absolute = target.startsWith('/') || /^[A-Za-z]:[\\/]/.test(target);
        if (!absolute && ['root', 'home', 'system'].includes(fragment.cwdRisk))
            return 'catastrophic';
        if (!absolute && fragment.cwdRisk === 'unknown')
            return 'dynamic';
    }
    if (force && fragment.origin === 'pipeline-consumer')
        return 'dynamic';
    return;
}
function boundedGitClean(text) {
    const tokens = executableWords(text), marker = tokens.indexOf('--');
    if (marker < 0 || marker === tokens.length - 1)
        return false;
    return tokens.slice(marker + 1).every(path => /^\.\/[A-Za-z0-9_.@/-]+$/.test(path) && path !== './' && !path.includes('/../') && !path.endsWith('/..'));
}
function gitAssessment(fragment) {
    const text = executableText(fragment.text), parts = gitCommandParts(fragment.text), sub = parts.sub, rest = parts.rest;
    if (!/^git\s+/i.test(text))
        return;
    if (/^git\s+reset\b/i.test(text)) {
        if (fragment.dynamic)
            return 'dynamic';
        if (/(?:^|\s)--(?:hard|merge|keep)(?:\s|$)/i.test(text))
            return 'destructive';
    }
    if (/^git\s+clean\b/i.test(text) && /(?:^|\s)-(?:[^\s]*f[^\s]*)(?:\s|$)|(?:^|\s)--force(?:\s|$)/i.test(text) && !boundedGitClean(text))
        return 'destructive';
    if (/^git\s+checkout\s+--(?:\s|$)/i.test(text))
        return 'destructive';
    if (/^git\s+restore\b/i.test(text)) {
        const staged = /(?:^|\s)--staged(?:\s|$)/i.test(text), worktree = /(?:^|\s)--worktree(?:\s|$)/i.test(text);
        if (!staged || worktree)
            return 'destructive';
    }
    if (sub === 'branch' && (rest.includes('-D') || rest.includes('--delete') && rest.includes('--force')))
        return 'destructive';
    if (sub === 'stash' && ['drop', 'clear'].includes(rest[0] ?? ''))
        return 'destructive';
    if (sub === 'tag' && rest.some(x => x === '-d' || x === '--delete'))
        return 'destructive';
    if (sub === 'reflog' && rest[0] === 'delete')
        return 'destructive';
    if (sub === 'worktree' && rest[0] === 'remove' && rest.some(x => x === '-f' || x === '--force' || /^-[^-]*f/.test(x)))
        return 'destructive';
    if (sub === 'rm' && rest.some(x => x === '-f' || x === '--force' || /^-[^-]*f/.test(x)))
        return 'destructive';
    return;
}
function powershellAssessment(fragment) {
    const text = fragment.text.trim();
    if (fragment.dialect !== 'powershell' || !/^Remove-Item\b/i.test(text) || !/(?:^|\s)-(?:Recurse|r)(?:\s|$)/i.test(text))
        return;
    const tokens = words(text), targets = tokens.slice(1).filter(token => !token.startsWith('-'));
    if (!targets.length)
        return 'dynamic';
    for (const raw of targets) {
        const target = raw.replace(/^['"]|['"]$/g, '');
        if (/(?:\$\(|`|\$\{|\$[A-Za-z_])/.test(target))
            return 'dynamic';
        if (['.', './', '~', '$HOME', '${HOME}', '/'].includes(target))
            return 'destructive';
        if (/^[A-Za-z]:[\\/]?$/.test(target) || /^[A-Za-z]:[\\/](?:Windows|Users|Program Files|ProgramData)(?:[\\/]|$)/i.test(target))
            return 'destructive';
        if (/^\/(?:etc|usr|var|boot|root|home)(?:\/|$)/i.test(target))
            return 'destructive';
    }
    for (const raw of targets) {
        const target = raw.replace(/^['"]|['"]$/g, ''), absolute = target.startsWith('/') || /^[A-Za-z]:[\\/]/.test(target);
        if (!absolute && ['root', 'home', 'system'].includes(fragment.cwdRisk))
            return 'destructive';
        if (!absolute && fragment.cwdRisk === 'unknown')
            return 'dynamic';
    }
    return;
}
function windowsCmdAssessment(fragment) {
    const tokens = words(fragment.text), head = tokens[0]?.toLowerCase();
    if (!['rmdir', 'rd', 'del', 'erase'].includes(head ?? ''))
        return;
    const recursive = tokens.slice(1).some(token => /^\/s$/i.test(token));
    if (!recursive)
        return;
    const targets = tokens.slice(1).filter(token => !/^\/[A-Za-z]+$/.test(token));
    if (!targets.length)
        return 'dynamic';
    for (const raw of targets) {
        const target = raw.replace(/^['"]|['"]$/g, '').replaceAll('/', '\\');
        if (/%[A-Za-z_][A-Za-z0-9_]*%|![A-Za-z_][A-Za-z0-9_]*!/.test(target))
            return 'dynamic';
        if (target === '.' || target === '.\\' || target.startsWith('..\\'))
            return 'destructive';
        if (/^[A-Za-z]:\\?$/.test(target) || /^[A-Za-z]:\\(?:Windows|Users|Program Files|ProgramData)(?:\\|$)/i.test(target))
            return 'destructive';
        const absolute = /^[A-Za-z]:\\/.test(target) || /^\\\\/.test(target);
        if (!absolute && ['root', 'home', 'system'].includes(fragment.cwdRisk))
            return 'destructive';
        if (!absolute && fragment.cwdRisk === 'unknown')
            return 'dynamic';
    }
    return;
}
function dynamicDestructiveShape(fragment) {
    if (!fragment.dynamic)
        return false;
    const text = fragment.text;
    return /\brm\b|\bgit\s+reset\b|\bRemove-Item\b|(?:^|\s)-[A-Za-z]*[rR][A-Za-z]*f[A-Za-z]*(?:\s|$)|\b(?:push|publish|delete|destroy)\b/i.test(text);
}
function userAction(command, reason, reasonCode) { return { decision: 'USER_ACTION_REQUIRED', command, reason, human_decision_type: 'operational_action', reason_code: reasonCode }; }
export function evaluateShellCommand(command) {
    const c = command.trim();
    if (!c)
        return { decision: 'DENY', command: c, reason: 'empty command' };
    if (/^\s*yes\s*\|/i.test(c) || /\|\s*yes\s*$/i.test(c))
        return { decision: 'DENY', command: c, reason: 'blanket approval bypass is forbidden' };
    const projection = projectExecutionSurface(c);
    if (projection.uncertain && /(?:\brm\b|\bgit\b|\bRemove-Item\b|\b(?:push|publish|delete|destroy|mkfs|dd)\b)/i.test(c))
        return userAction(c, `bounded execution projection is uncertain (${projection.uncertainty.join(', ')}); potentially destructive execution is not admitted`, 'shell-execution-uncertain');
    for (const fragment of projection.fragments) {
        const text = fragment.text, executable = fragment.dialect === 'posix' ? executableText(text) : text;
        if (INTERACTIVE.some(r => r.test(text)))
            return { decision: 'USER_ACTION_REQUIRED', command: c, reason: 'interactive credential or terminal flow requires real user interaction', human_decision_type: 'credential_action', reason_code: 'interactive-shell' };
        if (SECRET_SENSITIVE.some(r => r.test(text)) || hasPlaintextSecretFlag(text))
            return { decision: 'USER_ACTION_REQUIRED', command: c, reason: 'plaintext secret-sensitive command requires explicit user action and safer credential handling', human_decision_type: 'credential_action', reason_code: 'secret-sensitive-shell' };
        const rm = rmAssessment(fragment);
        if (rm === 'catastrophic')
            return userAction(c, 'catastrophic recursive filesystem mutation requires explicit user action', 'destructive-filesystem-action');
        if (rm === 'dynamic')
            return userAction(c, 'recursive filesystem mutation has a dynamically resolved target and requires explicit reconciliation', 'dynamic-destructive-target');
        const git = gitAssessment(fragment);
        if (git === 'destructive')
            return userAction(c, 'destructive Git worktree/index rewrite requires explicit user action', 'destructive-git-action');
        if (git === 'dynamic')
            return userAction(c, 'destructive Git operation contains dynamically resolved execution syntax', 'dynamic-destructive-git');
        const ps = powershellAssessment(fragment);
        if (ps === 'destructive')
            return userAction(c, 'recursive PowerShell filesystem mutation requires explicit user action', 'destructive-filesystem-action');
        if (ps === 'dynamic')
            return userAction(c, 'PowerShell filesystem mutation has dynamically resolved execution syntax', 'dynamic-destructive-target');
        const win = windowsCmdAssessment(fragment);
        if (win === 'destructive')
            return userAction(c, 'recursive Windows filesystem mutation requires explicit user action', 'destructive-filesystem-action');
        if (win === 'dynamic')
            return userAction(c, 'Windows filesystem mutation has a dynamically resolved target and requires explicit reconciliation', 'dynamic-destructive-target');
        if (fragment.origin === 'pipeline-consumer' && /^rm\s+(?:-[^\s]*[rR][^\s]*|--recursive)(?:\s|$)/i.test(text))
            return userAction(c, 'pipeline-derived recursive delete target is runtime-dependent and requires explicit user action', 'dynamic-destructive-target');
        if (CATASTROPHIC_FILESYSTEM.some(r => r.test(executable)))
            return userAction(c, 'catastrophic filesystem mutation requires explicit user action', 'destructive-filesystem-action');
        if (IRREVERSIBLE_EXTERNAL.some(r => r.test(executable)))
            return userAction(c, 'irreversible external deletion/destruction requires explicit user action', 'irreversible-external-action');
        if (dynamicDestructiveShape(fragment))
            return userAction(c, 'dynamically constructed destructive execution cannot be proven bounded', 'dynamic-execution-uncertain');
    }
    if (/^npm\s+init\b(?!.*\s-y\b)/i.test(c) && projection.fragments.length === 1 && projection.fragments[0].origin === 'root')
        return { decision: 'REWRITE', command: c.replace(/\bnpm\s+init\b/i, 'npm init -y'), reason: 'known safe non-interactive form' };
    return { decision: 'ALLOW', command: c, reason: 'bounded non-interactive execution projection admitted' };
}
