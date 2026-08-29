import { HI_METHODOLOGY_SIGNAL_CATALOG } from '../../generated/methodology-policy.js';
import { normalizeBoundedProjectPath } from '../../contracts/common.js';
import { isConstraintAtomDraft } from '../../contracts/constraint-atom.js';
import { verificationCaseValidationError } from '../../contracts/verification-case.js';
export const SEMANTIC_CAPABILITIES = ['implementation', 'repository-analysis', 'review', 'verification', 'independent-review', 'security-review', 'visual-qa', 'design-exploration', 'multi-stream-delegation', 'source-verification', 'external-research', 'documentation', 'test-authoring', 'qa-review', 'dependency-change', 'interactive-process', 'mcp'];
export const SEMANTIC_EXTERNAL_ACTIONS = ['git-push', 'release-create', 'package-publish', 'deploy'];
export const SEMANTIC_VERIFICATION_KINDS = ['targeted-tests', 'typecheck', 'lint', 'build', 'changed-surface-sanity', 'visual-check', 'review-evidence'];
const READ_ONLY_TASK_WRITE_CAPABILITIES = new Set(['implementation', 'documentation', 'test-authoring', 'dependency-change']);
function conflictingWriteCapabilities(taskKind, capabilities, kind) { return taskKind === kind ? [...new Set(capabilities.filter(cap => READ_ONLY_TASK_WRITE_CAPABILITIES.has(cap)))] : []; }
export function diagnosisWriteCapabilities(taskKind, capabilities) { return conflictingWriteCapabilities(taskKind, capabilities, 'diagnosis'); }
export function reviewWriteCapabilities(taskKind, capabilities) { return conflictingWriteCapabilities(taskKind, capabilities, 'review'); }
export function releaseReadinessWriteCapabilities(taskKind, scope, capabilities) { return taskKind === 'release-readiness' && scope !== 'external' ? [...new Set(capabilities.filter(cap => READ_ONLY_TASK_WRITE_CAPABILITIES.has(cap)))] : []; }
export function semanticTaskCapabilityConsistencyError(taskKind, capabilities, scope = 'local', mutationTargets = []) {
    const diagnosis = diagnosisWriteCapabilities(taskKind, capabilities);
    if (diagnosis.length)
        return `task_kind=diagnosis is read-only root cause/no fix and cannot include write capability(s): ${diagnosis.join(', ')}; use task_kind=bug-fix, implementation, or performance when a material change is requested`;
    const review = reviewWriteCapabilities(taskKind, capabilities);
    if (review.length)
        return `task_kind=review is read-only findings/reporting and cannot include write capability(s): ${review.join(', ')}; use task_kind=bug-fix, implementation, or performance when remediation or another material change is requested`;
    const release = releaseReadinessWriteCapabilities(taskKind, scope, capabilities);
    if (release.length)
        return `local task_kind=release-readiness is read-only inspection/verification and cannot include repository write capability(s): ${release.join(', ')}; use task_kind=bug-fix, implementation, or performance when local release preparation requires material changes`;
    if (!mutationTargets.length)
        return undefined;
    if (taskKind === 'diagnosis')
        return 'task_kind=diagnosis is read-only root cause/no fix and cannot declare non-empty mutation_targets; use bug-fix, implementation, or performance for a material write outcome';
    if (taskKind === 'review')
        return 'task_kind=review is read-only findings/reporting and cannot declare non-empty mutation_targets; use bug-fix, implementation, or performance for remediation';
    if (taskKind === 'release-readiness' && scope !== 'external')
        return 'local task_kind=release-readiness is read-only inspection/verification and cannot declare non-empty mutation_targets; use bug-fix, implementation, or performance for local release changes';
    const writes = [...new Set(capabilities.filter(cap => READ_ONLY_TASK_WRITE_CAPABILITIES.has(cap)))];
    if (!writes.length)
        return 'non-empty mutation_targets require at least one write capability: implementation, documentation, test-authoring, or dependency-change';
    return undefined;
}
export function assertSemanticTaskCapabilityConsistency(taskKind, capabilities, scope = 'local', mutationTargets = []) { const issue = semanticTaskCapabilityConsistencyError(taskKind, capabilities, scope, mutationTargets); if (issue)
    throw new Error(issue); }
const PATH = /((?:[\w@.-]+\/[\w@./-]+|[\w@.-]+\.(?:tsx|jsx|json|scss|html|yaml|toml|sql|ts|js|py|go|rs|php|md|txt|css|yml)))(?![\w.-])/gi;
const HTTP_TARGET = /^https?:\/\/[^\s]+$/i;
const TECHNICAL_VERIFIER_PATTERNS = [
    ['targeted-tests', /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:(?:run\s+)?test(?:\b|:))|node\s+--test\b|(?:python(?:3)?\s+-m\s+)?pytest\b|vitest\b|jest\b|go\s+test\b|cargo\s+test\b|dotnet\s+test\b|mvnw?\s+[^`\n;]*\btest\b|(?:gradle|\.\/gradlew)\s+[^`\n;]*\btest\b)/i],
    ['typecheck', /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:(?:run\s+)?(?:typecheck|type-check|check:types?)(?:\b|:))|(?:npx\s+)?tsc\b|(?:python(?:3)?\s+-m\s+)?(?:mypy|pyright)\b)/i],
    ['lint', /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:(?:run\s+)?lint(?:\b|:))|(?:npx\s+)?eslint\b|(?:python(?:3)?\s+-m\s+)?ruff(?:\s+check)?\b)/i],
    ['build', /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:(?:run\s+)?build(?:\b|:))|cargo\s+check\b|go\s+build\b|dotnet\s+build\b)/i],
    ['changed-surface-sanity', /\b(?:npm|pnpm|yarn|bun)\s+(?:(?:run\s+)?check(?:\b|:))/i],
];
function trimTerminalProseDots(value) { let end = value.length; while (end > 0 && value[end - 1] === '.')
    end--; return value.slice(0, end); }
export function technicalTargets(text) { return [...text.matchAll(PATH)].map(m => trimTerminalProseDots(m[1])).filter(Boolean).slice(0, 12); }
export function technicalVerificationKinds(text) { return TECHNICAL_VERIFIER_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([kind]) => kind); }
/**
 * Reconcile model-proposed verification with mechanically observable user intent.
 * The host primary may recommend checks, but a bounded low/medium-risk read-only review
 * does not inherit code-test/build ceremony unless the user named an executable verifier.
 */
export function resolveAdaptiveVerificationAssessment(assessment, userText, repo) {
    const explicitUserVerification = technicalVerificationKinds(userText);
    const boundedExplicit = explicitUserVerification.length > 0 && assessment.scope === 'local' && ['low', 'medium'].includes(assessment.risk) && assessment.task_kind !== 'release-readiness';
    if (boundedExplicit)
        return { assessment: { ...assessment, likely_verification: [...explicitUserVerification], user_verification: [...explicitUserVerification], verification_ceiling: true }, explicitUserVerification, ceilingApplied: true, policy: 'explicit-user-verifier' };
    const boundedCapabilitySurface = ['local', 'multi-file'].includes(assessment.scope) && ['low', 'medium'].includes(assessment.risk) && assessment.task_kind !== 'release-readiness' && repo !== undefined;
    if (boundedCapabilitySurface) {
        const repoKinds = new Set(repo.likelyVerification.flatMap(kind => { const normalized = kind.toLowerCase().trim(); if (['test', 'pytest', 'go test', 'cargo test'].includes(normalized))
            return ['targeted-tests']; if (normalized === 'check')
            return ['changed-surface-sanity']; if (['typecheck', 'lint', 'build'].includes(normalized))
            return [normalized]; return []; }));
        if (repoKinds.size) {
            const technicalKinds = new Set(['targeted-tests', 'typecheck', 'lint', 'build', 'changed-surface-sanity']);
            const explicitStructured = new Set(assessment.user_verification ?? []);
            const filtered = assessment.likely_verification.filter(kind => explicitStructured.has(kind) || !technicalKinds.has(kind) || repoKinds.has(kind));
            assessment = { ...assessment, likely_verification: [...new Set(filtered)] };
        }
    }
    const boundedVisualCapabilitySurface = ['local', 'multi-file'].includes(assessment.scope) && ['low', 'medium'].includes(assessment.risk) && assessment.task_kind !== 'release-readiness' && assessment.required_capabilities.includes('visual-qa') && assessment.likely_verification.includes('visual-check') && repo !== undefined && repo.markers.includes('.opencode/');
    if (boundedVisualCapabilitySurface) {
        const repoKinds = new Set(repo.likelyVerification.map(kind => kind === 'test' ? 'targeted-tests' : kind));
        const reviewKinds = assessment.task_kind === 'review' ? ['review-evidence'] : [], likelyVerification = [...reviewKinds, ...assessment.likely_verification.filter(kind => kind === 'visual-check' || kind === 'review-evidence' || repoKinds.has(kind))];
        return { assessment: { ...assessment, likely_verification: [...new Set(likelyVerification)] }, explicitUserVerification, ceilingApplied: false, policy: 'local-capability-surface' };
    }
    const boundedReview = assessment.task_kind === 'review' && assessment.scope === 'local' && ['low', 'medium'].includes(assessment.risk);
    if (boundedReview) {
        const surfaceSpecific = assessment.likely_verification.filter(kind => kind === 'visual-check');
        const likelyVerification = [...new Set(['review-evidence', ...surfaceSpecific])];
        return { assessment: { ...assessment, likely_verification: likelyVerification, user_verification: [], verification_ceiling: false }, explicitUserVerification: [], ceilingApplied: false, policy: 'minimum-sufficient-review' };
    }
    return { assessment, explicitUserVerification, ceilingApplied: false, policy: 'assessment' };
}
export function semanticTargets(value, max = 20) {
    const out = [];
    for (const raw of stringList(value, max)) {
        if (HTTP_TARGET.test(raw)) {
            out.push(raw);
            continue;
        }
        const exact = normalizeBoundedProjectPath(raw);
        if (exact && technicalTargets(raw).some(x => x === raw || x === exact)) {
            out.push(exact);
            continue;
        }
        for (const candidate of technicalTargets(raw)) {
            const path = normalizeBoundedProjectPath(candidate);
            if (path)
                out.push(path);
        }
    }
    return [...new Set(out)].slice(0, max);
}
function testLikeTarget(path) { return /(^|\/)(?:test|tests|__tests__)(?:\/|$)|\.(?:test|spec)\.[^/]+$/i.test(path); }
export function materialSemanticTargets(assessment) { const verificationOwnsTests = assessment.likely_verification.includes('targeted-tests') && !assessment.intent_signals.includes('intent.tdd'), surface = assessment.mutation_targets ?? assessment.likely_targets; return surface.filter(path => !(verificationOwnsTests && testLikeTarget(path))); }
function normalizedDirectiveText(text) { return text.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim(); }
function preservationContextForPath(text, path) {
    const target = path.toLowerCase();
    let from = 0;
    while (from < text.length) {
        const at = text.indexOf(target, from);
        if (at < 0)
            break;
        const before = text.slice(Math.max(0, at - 120), at).trim(), after = text.slice(at + target.length, Math.min(text.length, at + target.length + 120)).trim();
        const deniedBefore = /(?:^|\b)(?:do not|don't|must not|never)\s+(?:modify|edit|change|write|update|touch|overwrite|replace)(?:\s+the)?\s*$/.test(before) || /(?:^|\b)without\s+(?:modifying|editing|changing|writing|updating|touching|overwriting|replacing)(?:\s+the)?\s*$/.test(before);
        const preserveBefore = /(?:^|\b)(?:keep|leave|preserve)(?:\s+the)?\s*$/.test(before);
        const preservedAfter = /^(?:unchanged|unmodified|untouched|intact)\b/.test(after) || /^(?:at|as)\s+(?:the\s+)?(?:exact\s+)?(?:tracked\s+)?baseline\b/.test(after) || /^(?:must|should)\s+(?:remain|stay)\s+(?:unchanged|unmodified|untouched|intact)\b/.test(after);
        if (deniedBefore || preserveBefore || preservedAfter)
            return true;
        from = at + target.length;
    }
    return false;
}
/**
 * A path may be technically relevant without being an implementation target.
 * Keep explicit preservation / mutation-denial directives out of requiredTargets
 * while retaining the path in likelyTargets for context, safety and verification.
 */
export function preservationOnlyTargets(userText) {
    const text = normalizedDirectiveText(userText);
    if (!text)
        return [];
    return [...new Set(technicalTargets(userText).map(path => normalizeBoundedProjectPath(path)).filter((path) => Boolean(path) && preservationContextForPath(text, path)))];
}
export function userRequiredMaterialTargets(userText, assessment) {
    const material = new Set(materialSemanticTargets(assessment).map(path => normalizeBoundedProjectPath(path)).filter((path) => Boolean(path))), preserved = new Set(preservationOnlyTargets(userText));
    const explicit = technicalTargets(userText).map(path => normalizeBoundedProjectPath(path)).filter((path) => Boolean(path));
    return [...new Set(explicit.filter(path => material.has(path) && !preserved.has(path)))];
}
export function provisionalIntent(text, repo) {
    const objective = text.trim().replace(/\s+/g, ' '), targets = technicalTargets(text), explicitVerification = technicalVerificationKinds(text);
    const avoid = ['unnecessary-agents', 'unnecessary-skills', 'full-chat-child-context', 'unrequested-external-effects'];
    if (repo?.ecosystems.length)
        avoid.push(`ignore-repo-ecosystem:${repo.ecosystems.join('+')}`);
    return { objective, likelyTargets: targets.length ? targets : undefined, taskKind: 'unclassified', scope: 'local', risk: 'medium', ambiguity: 'resolvable', dependencyClass: 'unknown', requiredCapabilities: [], requestedExternalActions: [], likelyVerification: explicitVerification, avoid };
}
function stringList(value, max = 40) { return Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string').map(x => String(x).trim()).filter(Boolean))].slice(0, max) : []; }
function enumList(value, allowed, max = 40, field = 'semantic_enum') { const items = stringList(value, max), set = new Set(allowed), unknown = items.filter(x => !set.has(x)); if (unknown.length)
    throw new Error(`unsupported ${field} value(s): ${unknown.join(', ')}`); return items; }
function requestUnitIdList(value, max = 24) { if (value === undefined)
    return []; if (!Array.isArray(value) || value.some(item => typeof item !== 'string'))
    throw new Error('nonvisual_request_units must be an array of RU id strings (for example [\"ru1\"])'); const items = stringList(value, max), invalid = items.filter(id => !/^ru[1-9][0-9]*$/.test(id)); if (invalid.length)
    throw new Error(`invalid nonvisual_request_units id(s): ${invalid.join(', ')}`); return items; }
function capabilityRequestUnitMap(value) { if (value === undefined)
    return {}; if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('capability_request_units must be an object mapping capability names to RU id arrays'); const out = {}, allowed = new Set(SEMANTIC_CAPABILITIES); for (const [cap, raw] of Object.entries(value)) {
    if (!allowed.has(cap))
        throw new Error(`capability_request_units contains unsupported capability: ${cap}`);
    if (!Array.isArray(raw) || raw.length === 0 || raw.some(item => typeof item !== 'string'))
        throw new Error(`capability_request_units.${cap} must be a non-empty RU id array`);
    const ids = [...new Set(raw.map(x => String(x).trim()).filter(Boolean))];
    const invalid = ids.filter(id => !/^ru[1-9][0-9]*$/.test(id));
    if (invalid.length)
        throw new Error(`capability_request_units.${cap} contains invalid RU id(s): ${invalid.join(', ')}`);
    out[cap] = ids;
} return out; }
function semanticVerificationCase(value, index) { let candidate = value; if (value && typeof value === 'object' && !Array.isArray(value)) {
    const raw = value;
    if (typeof raw.id === 'string') {
        let id = raw.id.trim().toLowerCase();
        if (/^vc-[a-z0-9_-]+$/.test(id))
            id = `vc_${id.slice(3)}`;
        if (/^vc_[a-z0-9_-]+$/.test(id))
            id = `vc_${id.slice(3).replace(/_/g, '-')}`;
        candidate = { ...raw, id };
    }
} const issue = verificationCaseValidationError(candidate); if (issue)
    throw new Error(`verification_cases[${index}]: ${issue}`); return candidate; }
function intentSignalList(value) {
    const items = stringList(value, 40), invalid = items.filter(name => {
        const spec = HI_METHODOLOGY_SIGNAL_CATALOG[name];
        return !name.startsWith('intent.') || !spec?.producers.includes('intent');
    });
    if (invalid.length)
        throw new Error(`unsupported semantic intent signal(s): ${invalid.join(', ')}`);
    return items;
}
export function parseSemanticIntentAssessment(raw) {
    const x = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!x || typeof x !== 'object' || Array.isArray(x))
        throw new Error('semantic assessment must be a JSON object');
    const v = x, allowedKeys = new Set(['material', 'message_kind', 'task_kind', 'scope', 'risk', 'ambiguity', 'dependency_class', 'required_capabilities', 'requested_external_actions', 'likely_verification', 'user_verification', 'verification_ceiling', 'verification_cases', 'nonvisual_request_units', 'capability_request_units', 'likely_targets', 'mutation_targets', 'intent_signals', 'suppressed_intent_signals', 'constraint_atoms']), unknownKeys = Object.keys(v).filter(key => !allowedKeys.has(key));
    if (unknownKeys.length) {
        const hint = unknownKeys.includes('visual_request_units') ? '; use top-level verification_cases[] and nonvisual_request_units as RU id strings' : '';
        throw new Error(`unsupported semantic assessment key(s): ${unknownKeys.join(', ')}${hint}`);
    }
    const taskKinds = ['implementation', 'bug-fix', 'diagnosis', 'review', 'performance', 'release-readiness'];
    const scopes = ['local', 'multi-file', 'repo-wide', 'external', 'multi-stream'];
    const risks = ['low', 'medium', 'high', 'authority-boundary'];
    const ambiguities = ['none', 'resolvable', 'contract-critical'];
    const dependencies = ['independent', 'sequential', 'external-gated', 'unknown', 'independent-multi'];
    const take = (name, allowed) => { const value = String(v[name] ?? ''); if (!allowed.includes(value))
        throw new Error(`${name} must be one of ${allowed.join(', ')}`); return value; };
    if (typeof v.material !== 'boolean')
        throw new Error('material must be boolean');
    const messageKinds = ['mission', 'amendment', 'constraint', 'verification', 'stop', 'resume', 'non-material'];
    const messageKind = take('message_kind', messageKinds);
    if (messageKind === 'non-material' && v.material !== false)
        throw new Error('non-material message must set material=false');
    if (messageKind !== 'non-material' && v.material !== true)
        throw new Error('material message kind must set material=true');
    const risk = take('risk', risks), externalActions = enumList(v.requested_external_actions, SEMANTIC_EXTERNAL_ACTIONS, 8, 'requested_external_actions');
    if (externalActions.length && risk !== 'authority-boundary')
        throw new Error('requested_external_actions require risk=authority-boundary');
    if (v.verification_ceiling !== undefined && typeof v.verification_ceiling !== 'boolean')
        throw new Error('verification_ceiling must be boolean');
    const inferredVerification = enumList(v.likely_verification, SEMANTIC_VERIFICATION_KINDS, 12, 'likely_verification'), userVerification = enumList(v.user_verification, SEMANTIC_VERIFICATION_KINDS, 12, 'user_verification'), verificationCeiling = v.verification_ceiling === true;
    if (verificationCeiling && !userVerification.length)
        throw new Error('verification_ceiling requires at least one explicit user_verification kind');
    const effectiveVerification = verificationCeiling ? userVerification : [...new Set([...userVerification, ...inferredVerification])];
    const requiredCapabilities = enumList(v.required_capabilities, SEMANTIC_CAPABILITIES, 40, 'required_capabilities'), capabilityRequestUnits = capabilityRequestUnitMap(v.capability_request_units);
    for (const cap of Object.keys(capabilityRequestUnits))
        if (!requiredCapabilities.includes(cap))
            requiredCapabilities.push(cap);
    if (messageKind === 'amendment' && ['implementation', 'bug-fix', 'performance'].includes(String(v.task_kind ?? '')) && !requiredCapabilities.includes('implementation'))
        throw new Error('message_kind=amendment for material implementation change requires required_capabilities to include implementation; use verification or resume when no implementation outcome is added/changed');
    const semanticSignals = intentSignalList(v.intent_signals);
    if (semanticSignals.includes('intent.external-source') && !requiredCapabilities.includes('external-research'))
        requiredCapabilities.push('external-research');
    if (semanticSignals.includes('intent.documentation') && !requiredCapabilities.includes('documentation'))
        requiredCapabilities.push('documentation');
    if (effectiveVerification.includes('visual-check') && !requiredCapabilities.includes('visual-qa'))
        requiredCapabilities.push('visual-qa');
    const taskKind = take('task_kind', taskKinds), scope = take('scope', scopes);
    const assessment = {
        material: v.material, message_kind: messageKind,
        task_kind: taskKind, scope, risk, ambiguity: take('ambiguity', ambiguities), dependency_class: take('dependency_class', dependencies),
        required_capabilities: requiredCapabilities, requested_external_actions: externalActions, likely_verification: effectiveVerification, user_verification: userVerification, verification_ceiling: verificationCeiling, verification_cases: Array.isArray(v.verification_cases) ? v.verification_cases.slice(0, 16).map((item, index) => semanticVerificationCase(item, index)) : [], nonvisual_request_units: requestUnitIdList(v.nonvisual_request_units), capability_request_units: capabilityRequestUnits, likely_targets: semanticTargets(v.likely_targets, 20), ...(v.mutation_targets === undefined ? {} : { mutation_targets: semanticTargets(v.mutation_targets, 20) }),
        intent_signals: semanticSignals, suppressed_intent_signals: intentSignalList(v.suppressed_intent_signals),
        constraint_atoms: Array.isArray(v.constraint_atoms) ? v.constraint_atoms.slice(0, 20).map(item => { if (!isConstraintAtomDraft(item))
            throw new Error('invalid constraint_atoms entry'); return item; }) : [],
    };
    if (assessment.mutation_targets) {
        const likely = new Set(assessment.likely_targets), outside = assessment.mutation_targets.filter(path => !likely.has(path));
        if (outside.length)
            throw new Error(`mutation_targets must be a subset of likely_targets: ${outside.join(', ')}`);
    }
    assertSemanticTaskCapabilityConsistency(taskKind, requiredCapabilities, scope, assessment.mutation_targets ?? []);
    if (messageKind !== 'constraint' && assessment.constraint_atoms.length)
        throw new Error('constraint_atoms are allowed only for message_kind=constraint');
    const visualRequired = assessment.likely_verification.includes('visual-check');
    if (visualRequired && !assessment.verification_cases.length && !['resume', 'constraint'].includes(messageKind))
        throw new Error('visual-check requires non-empty top-level verification_cases[]');
    if (!visualRequired && assessment.verification_cases.length)
        throw new Error('verification_cases require visual-check');
    if (!visualRequired && assessment.nonvisual_request_units.length)
        throw new Error('nonvisual_request_units are only used to partition visual-check request traces; when visual-check is absent set nonvisual_request_units=[]');
    const caseIDs = assessment.verification_cases.map(c => c.id);
    if (new Set(caseIDs).size !== caseIDs.length)
        throw new Error('verification_cases ids must be unique');
    const materialTargets = materialSemanticTargets(assessment), localSequential = assessment.scope === 'local' && assessment.dependency_class === 'sequential', boundedSingleMaterialTarget = assessment.scope === 'multi-file' && assessment.ambiguity === 'none' && assessment.dependency_class === 'sequential' && materialTargets.length === 1 && assessment.likely_verification.length > 0 && !assessment.required_capabilities.some(cap => ['multi-stream-delegation', 'source-verification', 'dependency-change', 'design-exploration'].includes(cap));
    const materialChange = ['implementation', 'bug-fix', 'performance'].includes(assessment.task_kind), resolvedMultiFile = materialChange && assessment.scope === 'multi-file' && assessment.ambiguity === 'none', resolvedLocal = materialChange && assessment.scope === 'local' && assessment.ambiguity === 'none';
    if (resolvedMultiFile && materialTargets.length < 2 && !boundedSingleMaterialTarget)
        throw new Error('multi-file ambiguity=none material change requires at least two material targets');
    if (resolvedLocal && materialTargets.length > 1 && !assessment.intent_signals.includes('intent.tdd'))
        throw new Error('local ambiguity=none material change cannot declare multiple material targets');
    return localSequential || boundedSingleMaterialTarget ? { ...assessment, scope: 'local', dependency_class: 'independent' } : assessment;
}
export function assessedIntent(current, assessment) {
    const initialMission = assessment.message_kind === 'mission';
    return { ...current, likelyTargets: assessment.likely_targets.length ? assessment.likely_targets : (initialMission ? undefined : current.likelyTargets), mutationTargets: assessment.mutation_targets === undefined ? (initialMission ? undefined : current.mutationTargets) : [...assessment.mutation_targets], taskKind: assessment.task_kind, scope: assessment.scope, risk: assessment.risk, ambiguity: assessment.ambiguity, dependencyClass: assessment.scope === 'local' && assessment.dependency_class === 'sequential' ? 'independent' : assessment.dependency_class, requiredCapabilities: [...assessment.required_capabilities], requestedExternalActions: [...assessment.requested_external_actions], likelyVerification: [...assessment.likely_verification], verificationCases: (assessment.verification_cases ?? []).length ? (assessment.verification_cases ?? []).map(c => ({ ...c, required_browser_actions: [...c.required_browser_actions], ...(c.source_units?.length ? { source_units: [...c.source_units] } : {}) })) : (assessment.message_kind === 'resume' || assessment.message_kind === 'constraint' ? current.verificationCases : []) };
}
