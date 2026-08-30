import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs']);
const TEST_EXT = ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx', '.test.js', '.spec.js', '.test.jsx', '.spec.jsx', '.test.mjs', '.spec.mjs'];
function norm(p) { return p.replace(/\\/g, '/'); }
function within(root, p) { const r = norm(resolve(root)), x = norm(resolve(p)); return x === r || x.startsWith(r + '/'); }
function json(path) { try {
    return JSON.parse(readFileSync(path, 'utf8'));
}
catch {
    return undefined;
} }
function usableScript(value) { const s = String(value ?? '').trim(); return Boolean(s) && !/no test specified|not implemented|todo:?\s*(?:add|write).*test/i.test(s); }
function nearestPackageRoot(root, file) {
    let cur = dirname(resolve(root, file)), top = resolve(root);
    while (within(top, cur)) {
        if (existsSync(join(cur, 'package.json')) || existsSync(join(cur, 'pyproject.toml')) || existsSync(join(cur, 'go.mod')) || existsSync(join(cur, 'Cargo.toml')))
            return cur;
        const next = dirname(cur);
        if (next === cur)
            break;
        cur = next;
    }
    return top;
}
function manager(root) { let cur = root; for (let i = 0; i < 5; i++) {
    if (existsSync(join(cur, 'pnpm-lock.yaml')))
        return 'pnpm';
    if (existsSync(join(cur, 'yarn.lock')))
        return 'yarn';
    if (existsSync(join(cur, 'bun.lockb')) || existsSync(join(cur, 'bun.lock')))
        return 'bun';
    if (existsSync(join(cur, 'package-lock.json')))
        return 'npm';
    const next = dirname(cur);
    if (next === cur)
        break;
    cur = next;
} return 'npm'; }
function nodeTestCandidates(root, target) {
    const abs = resolve(root, target), dir = dirname(abs), ext = '.' + basename(abs).split('.').pop(), stem = basename(abs, ext), out = [];
    for (const suffix of TEST_EXT) {
        const p = join(dir, stem + suffix);
        if (existsSync(p))
            out.push(norm(relative(root, p)));
    }
    for (const folder of ['__tests__', 'tests', 'test']) {
        const d = join(dir, folder);
        if (!existsSync(d))
            continue;
        try {
            for (const ent of readdirSync(d, { withFileTypes: true }).slice(0, 200))
                if (ent.isFile() && (ent.name.startsWith(stem + '.') || ent.name.startsWith(stem + '-')) && /\.(?:test|spec)\.[^.]+$/.test(ent.name))
                    out.push(norm(relative(root, join(d, ent.name))));
        }
        catch { }
    }
    const parent = dirname(dir);
    for (const folder of ['__tests__', 'tests', 'test']) {
        const d = join(parent, folder);
        if (!existsSync(d))
            continue;
        try {
            for (const ent of readdirSync(d, { withFileTypes: true }).slice(0, 300))
                if (ent.isFile() && ent.name.includes(stem) && /\.(?:test|spec)\.[^.]+$/.test(ent.name))
                    out.push(norm(relative(root, join(d, ent.name))));
        }
        catch { }
    }
    return [...new Set(out)].slice(0, 6);
}
function pythonCandidates(root, target) { const abs = resolve(root, target), dir = dirname(abs), stem = basename(abs, '.py'), out = []; for (const p of [join(dir, `test_${stem}.py`), join(dir, `${stem}_test.py`), join(dir, 'tests', `test_${stem}.py`), join(dirname(dir), 'tests', `test_${stem}.py`)])
    if (existsSync(p))
        out.push(norm(relative(root, p))); return [...new Set(out)].slice(0, 6); }
function nodeCommand(repoRoot, pkgRoot, testFile) { const pkg = json(join(pkgRoot, 'package.json')), script = pkg?.scripts?.test; if (!usableScript(script))
    return undefined; const pm = manager(pkgRoot), pkgRel = norm(relative(repoRoot, pkgRoot)), testRel = norm(relative(pkgRoot, resolve(repoRoot, testFile))); if (pm === 'pnpm')
    return pkgRel ? `pnpm --dir ${pkgRel} test -- ${testRel}` : `pnpm test -- ${testRel}`; if (pm === 'yarn')
    return pkgRel ? `yarn --cwd ${pkgRel} test ${testRel}` : `yarn test ${testRel}`; if (pm === 'bun')
    return pkgRel ? `bun --cwd ${pkgRel} test ${testRel}` : `bun test ${testRel}`; return pkgRel ? `npm --prefix ${pkgRel} test -- ${testRel}` : `npm test -- ${testRel}`; }
export function discoverTargetedVerification(root, targets) {
    const repoRoot = resolve(root), plans = [];
    for (const raw of [...new Set(targets.map(norm))].slice(0, 12)) {
        if (!raw || raw.startsWith('..'))
            continue;
        const abs = resolve(repoRoot, raw);
        const ext = '.' + basename(abs).split('.').pop();
        if (!within(repoRoot, abs) || !existsSync(abs) || !CODE_EXT.has(ext))
            continue;
        const pkg = nearestPackageRoot(repoRoot, raw);
        let tests = [], commands = [];
        if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
            tests = nodeTestCandidates(repoRoot, raw);
            if (tests[0]) {
                const c = nodeCommand(repoRoot, pkg, tests[0]);
                if (c)
                    commands.push(c);
            }
        }
        else if (ext === '.py') {
            tests = pythonCandidates(repoRoot, raw);
            if (tests[0])
                commands.push(`python -m pytest ${tests[0]}`);
        }
        else if (ext === '.go') {
            const dirRel = norm(relative(pkg, dirname(abs))) || '.';
            commands.push(`go test ./${dirRel}`.replace('./.', './'));
        }
        else if (ext === '.rs' && existsSync(join(pkg, 'Cargo.toml'))) {
            commands.push('cargo test');
        }
        plans.push({ target: raw, packageRoot: norm(relative(repoRoot, pkg)) || '.', testFiles: tests, commands, reason: tests.length ? 'nearest deterministic test candidate' : 'no deterministic nearby test file found' });
    }
    return plans;
}
export function targetedVerificationHint(root, targets) { const plans = discoverTargetedVerification(root, targets); if (!plans.length)
    return undefined; const useful = plans.filter(p => p.commands.length || p.testFiles.length); const rows = (useful.length ? useful : plans).slice(0, 6).map(p => `${p.target} -> package=${p.packageRoot}; tests=${p.testFiles.join(', ') || 'none'}; command=${p.commands.join(' && ') || 'none'}; ${p.reason}`); return `TARGETED VERIFICATION DISCOVERY (deterministic hint; validate against repo scripts before execution): ${rows.join(' | ')}`; }
function packageScriptCommand(repoRoot, pkgRoot, script) {
    const pm = manager(pkgRoot), pkgRel = norm(relative(repoRoot, pkgRoot));
    if (pm === 'pnpm')
        return pkgRel ? `pnpm --dir ${pkgRel} ${script}` : `pnpm ${script}`;
    if (pm === 'yarn')
        return pkgRel ? `yarn --cwd ${pkgRel} ${script}` : `yarn ${script}`;
    if (pm === 'bun')
        return pkgRel ? `bun --cwd ${pkgRel} run ${script}` : `bun run ${script}`;
    return pkgRel ? `npm --prefix ${pkgRel} run ${script}` : `npm run ${script}`;
}
/**
 * Read-only projection of deterministic repo-native verification routes.
 * Targeted tests stay narrow; a generic full test suite is never invented when
 * no nearby deterministic test exists. Static/build/check scripts are surfaced
 * only when the owning package actually declares a usable script.
 */
export function discoverVerificationRoutes(root, targets) {
    const repoRoot = resolve(root), routes = [];
    for (const plan of discoverTargetedVerification(repoRoot, targets))
        for (const command of plan.commands)
            routes.push({ evidenceKind: 'targeted-tests', command, source: 'targeted-test', packageRoot: plan.packageRoot });
    const roots = new Set();
    if (existsSync(join(repoRoot, 'package.json')))
        roots.add(repoRoot);
    for (const target of [...new Set(targets.map(norm))].slice(0, 12)) {
        if (!target || target.startsWith('..'))
            continue;
        const abs = resolve(repoRoot, target);
        if (!within(repoRoot, abs))
            continue;
        const pkgRoot = nearestPackageRoot(repoRoot, target);
        if (existsSync(join(pkgRoot, 'package.json')))
            roots.add(pkgRoot);
    }
    const scriptKinds = { check: 'changed-surface-sanity', typecheck: 'typecheck', lint: 'lint', build: 'build' };
    for (const pkgRoot of roots) {
        const pkg = json(join(pkgRoot, 'package.json')), scripts = pkg?.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
        for (const [script, evidenceKind] of Object.entries(scriptKinds)) {
            if (!usableScript(scripts?.[script]))
                continue;
            routes.push({ evidenceKind, command: packageScriptCommand(repoRoot, pkgRoot, script), source: 'package-script', packageRoot: norm(relative(repoRoot, pkgRoot)) || '.' });
        }
    }
    // A Git worktree always has one deterministic, non-mutating changed-surface sanity route.
    // Project-specific checks remain repo-declared; this fallback only makes the minimum
    // verification policy executable when an operational/config-only sandbox has no package route.
    if (existsSync(join(repoRoot, '.git')))
        routes.push({ evidenceKind: 'changed-surface-sanity', command: 'git diff --check', source: 'git-sanity', packageRoot: '.' });
    return routes.filter((route, index, all) => all.findIndex(other => other.evidenceKind === route.evidenceKind && other.command === route.command) === index).slice(0, 12);
}
