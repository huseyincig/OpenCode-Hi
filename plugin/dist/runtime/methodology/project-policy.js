import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGED_HI_AGENTS } from '../../generated/agent-config.js';
import { HI_METHODOLOGY_EXIT_REQUIREMENTS, HI_METHODOLOGY_SIGNAL_CATALOG } from '../../generated/methodology-policy.js';
import { readProjectMethodologyProvenance } from './provenance.js';
import { readProjectMethodologyCandidate } from '../project-intelligence/methodology-candidate.js';
const ROLE_IDS = new Set(Object.keys(PACKAGED_HI_AGENTS));
function digest(text) { return createHash('sha256').update(text).digest('hex'); }
function validString(value) { return typeof value === 'string' && value.trim().length > 0; }
function validStringList(value) { return Array.isArray(value) && value.length > 0 && value.every(validString); }
function validStringArray(value) { return Array.isArray(value) && value.every(validString); }
function parsePolicy(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return undefined;
    const value = raw;
    if (value.schema !== 1 || value.type !== 'hi-project-methodology')
        return undefined;
    if (typeof value.name !== 'string' || !/^hi-project-[a-z0-9-]+$/.test(value.name))
        return undefined;
    if (typeof value.enabled !== 'boolean')
        return undefined;
    for (const key of ['purpose', 'trigger', 'do_not_trigger', 'exit_condition'])
        if (!validString(value[key]))
            return undefined;
    if (!validStringList(value.preferred_roles) || !validStringList(value.compatible_roles) || !validStringList(value.activation_signals) || !validStringList(value.exit_requirements))
        return undefined;
    const preferredRoles = value.preferred_roles, compatibleRoles = value.compatible_roles, activationSignals = value.activation_signals, exitRequirements = value.exit_requirements;
    if (!preferredRoles.every((role) => compatibleRoles.includes(role)))
        return undefined;
    if (!compatibleRoles.every(role => ROLE_IDS.has(role)))
        return undefined;
    if (!activationSignals.every((signal) => Object.prototype.hasOwnProperty.call(HI_METHODOLOGY_SIGNAL_CATALOG, signal)))
        return undefined;
    if (!exitRequirements.every((item) => HI_METHODOLOGY_EXIT_REQUIREMENTS.includes(item)))
        return undefined;
    if (!['low', 'normal', 'high'].includes(String(value.priority)))
        return undefined;
    if (!['low', 'medium', 'high'].includes(String(value.context_cost)))
        return undefined;
    if (!['low', 'medium', 'high'].includes(String(value.execution_cost)))
        return undefined;
    if (typeof value.weight !== 'number' || !Number.isFinite(value.weight) || value.weight <= 0 || value.weight > 1)
        return undefined;
    if (!['low', 'medium', 'high'].includes(String(value.composition_cost)))
        return undefined;
    if (!validStringArray(value.useful_coexistence) || !validStringArray(value.conflicts) || !validStringArray(value.resource_requirements))
        return undefined;
    if (![...value.useful_coexistence, ...value.conflicts].every(name => /^hi-[a-z0-9-]+$/.test(name)))
        return undefined;
    if (!['manual', 'project-intelligence'].includes(String(value.admission)))
        return undefined;
    return value;
}
function skillContract(text) {
    const fm = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!fm)
        return undefined;
    const name = fm[1].match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1]?.trim();
    const description = fm[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
    const trigger = text.match(/^- \*\*Trigger:\*\*\s*(.+)$/m)?.[1]?.trim();
    const doNotTrigger = text.match(/^- \*\*Do not trigger:\*\*\s*(.+)$/m)?.[1]?.trim();
    const exitCondition = text.match(/^- \*\*Exit condition:\*\*\s*(.+)$/m)?.[1]?.trim();
    if (!name || !description || !trigger || !doNotTrigger || !exitCondition)
        return undefined;
    return { name, description, trigger, doNotTrigger, exitCondition };
}
export function projectMethodologyPolicyDir(projectRoot) { return join(projectRoot, '.opencode', 'hi', 'policy', 'methodologies'); }
export function discoverProjectMethodologyPolicies(projectRoot) {
    const dir = projectMethodologyPolicyDir(projectRoot);
    if (!existsSync(dir))
        return [];
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.json'))
            continue;
        try {
            const policyPath = join(dir, entry.name), policyText = readFileSync(policyPath, 'utf8'), policy = parsePolicy(JSON.parse(policyText));
            if (!policy || entry.name !== `${policy.name}.json` || !policy.enabled)
                continue;
            const skillPath = join(projectRoot, '.opencode', 'skills', policy.name, 'SKILL.md');
            if (!existsSync(skillPath))
                continue;
            const skillText = readFileSync(skillPath, 'utf8'), contract = skillContract(skillText);
            if (!contract || contract.name !== policy.name || contract.description !== policy.purpose || contract.trigger !== policy.trigger || contract.doNotTrigger !== policy.do_not_trigger || contract.exitCondition !== policy.exit_condition)
                continue;
            const provenance = readProjectMethodologyProvenance(projectRoot, policy.name);
            if (!provenance || provenance.name !== policy.name || provenance.skill_sha256 !== digest(skillText) || provenance.policy_sha256 !== digest(policyText))
                continue;
            if (provenance.origin === 'project-learning') {
                const candidate = readProjectMethodologyCandidate(projectRoot, provenance.candidate_id);
                if (!candidate || candidate.state !== 'READY')
                    continue;
            }
            out.push(policy);
        }
        catch { }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}
export function projectMethodologyPolicy(projectRoot, name) {
    return discoverProjectMethodologyPolicies(projectRoot).find((item) => item.name === name);
}
