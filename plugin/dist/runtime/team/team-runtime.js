import { appendLedger } from '../ledger/ledger.js';
import { isHiChildRole, isHiReadOnlyChildRole } from '../roles/catalog.js';
import { isTeamContract } from '../../contracts/team.js';
function uid(p) { return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
function validTeamRole(role) { return isHiChildRole(role); }
function contractView(t) { return { team_id: t.team_id, mission_id: t.mission_id, generation: t.generation, member_task_refs: [...t.member_task_refs], member_role_refs: [...t.member_role_refs], capacity: t.capacity, status: t.status, created_at: t.created_at, shutdown_at: t.shutdown_at }; }
function assertTeam(t) { if (!isTeamContract(contractView(t)))
    throw new Error('Invalid TeamContract projection'); }
function assertTeamMissionBindings(m, t) {
    assertTeam(t);
    for (let i = 0; i < t.member_task_refs.length; i++) {
        const taskID = t.member_task_refs[i], role = t.member_role_refs[i], task = m.execution.tasks.find(x => x.id === taskID);
        if (!task || task.mission_id !== m.identity.mission_id || task.role !== role)
            throw new Error(`Invalid TeamContract member binding: ${role}:${taskID}`);
        const worker = t.worker_ids[i], runtimeWorker = worker ? m.execution.workers.find(x => x.id === worker) : undefined;
        if (!runtimeWorker || runtimeWorker.task_id !== taskID || runtimeWorker.parent_mission_id !== m.identity.mission_id || runtimeWorker.role !== role)
            throw new Error(`Invalid TeamContract worker projection: ${role}:${taskID}`);
    }
}
export class TeamRuntime {
    tasks;
    enabled;
    limits;
    #teams = new Map();
    constructor(tasks, enabled, limits) {
        this.tasks = tasks;
        this.enabled = enabled;
        this.limits = limits;
    }
    get(id) { return this.#teams.get(id); }
    list(missionID) { return [...this.#teams.values()].filter(t => t.mission_id === missionID); }
    active(teamID) {
        const t = this.#teams.get(teamID);
        if (!t || t.status !== 'active')
            throw new Error('Active team not found');
        if (Date.now() >= t.expires_at)
            throw new Error('Team wall-time expired; parent must shutdown/reconcile team');
        return t;
    }
    assertMissionOwner(m, t) { if (t.mission_id !== m.identity.mission_id)
        throw new Error('Team belongs to a different mission'); }
    assertCurrentMission(m, t) { this.assertMissionOwner(m, t); if (t.generation !== m.continuation.generation)
        throw new Error('Stale team generation; shutdown/reconcile the old team before continuing'); }
    async startMember(m, t, role, overrideModel, overrideVariant) {
        const readOnly = isHiReadOnlyChildRole(role), reviewScope = m.vcs.changed_files.length ? m.vcs.changed_files : (m.identity.intent.likelyTargets ?? []);
        const started = await this.tasks.start(m, { objective: `${t.objective}\nTeam perspective: ${role}. Report findings to parent; do not create another team.`, role, category: m.identity.risk === 'high' ? 'critical' : 'deep', scope: readOnly ? reviewScope : (m.identity.intent.likelyTargets ?? []), constraints: ['parent-mediated team', 'no nested team', 'bounded scope', 'compact evidence'], model: overrideModel, modelVariant: overrideVariant });
        t.worker_ids.push(started.worker_id);
        t.member_workers[role] = started.worker_id;
        t.member_task_refs.push(started.task_id);
        return started.worker_id;
    }
    async create(m, objective, members, memberModels) {
        if (!this.enabled())
            throw new Error('Team Mode disabled');
        if (this.list(m.identity.mission_id).some(t => t.status === 'active'))
            throw new Error('Nested or second active team is not allowed');
        const l = this.limits(), requested = [...new Set(members.map(x => x.trim()).filter(Boolean))], invalid = requested.filter(x => !validTeamRole(x));
        if (invalid.length)
            throw new Error(`Unknown Team Mode role(s): ${invalid.join(', ')}`);
        const unique = requested.slice(0, l.maxMembers);
        if (unique.length < 2)
            throw new Error('Team Mode requires at least two distinct members');
        const now = Date.now(), team = { team_id: uid('team'), mission_id: m.identity.mission_id, generation: m.continuation.generation, objective, status: 'active', member_role_refs: unique, member_task_refs: [], capacity: l.maxMembers, worker_ids: [], member_workers: {}, created_at: now, expires_at: now + l.maxWallMs };
        this.#teams.set(team.team_id, team);
        m.execution.execution_mode = 'team';
        appendLedger(m, 'team.created', { payload: { team_id: team.team_id, members: unique, capacity: team.capacity, expires_at: team.expires_at, member_models: memberModels ? Object.keys(memberModels).length : 0 } });
        try {
            for (const role of unique) {
                const override = memberModels?.[role];
                await this.startMember(m, team, role, override?.model, override?.variant);
            }
            assertTeamMissionBindings(m, team);
            return team;
        }
        catch (error) {
            for (const worker of [...team.worker_ids])
                try {
                    await this.tasks.cancel(m, worker);
                }
                catch { }
            this.#teams.delete(team.team_id);
            m.execution.execution_mode = 'single';
            appendLedger(m, 'team.create.rolled-back', { payload: { team_id: team.team_id, error: String(error) } });
            throw error;
        }
    }
    async addMember(m, teamID, role, overrideModel, overrideVariant) {
        const t = this.active(teamID);
        this.assertCurrentMission(m, t);
        const clean = role.trim();
        if (!clean)
            throw new Error('Member role required');
        if (!validTeamRole(clean))
            throw new Error(`Unknown Team Mode role: ${clean}`);
        if (t.member_role_refs.includes(clean))
            throw new Error('Member already exists');
        if (t.member_role_refs.length >= t.capacity)
            throw new Error('Team member limit reached');
        t.member_role_refs.push(clean);
        try {
            const worker_id = await this.startMember(m, t, clean, overrideModel, overrideVariant);
            assertTeamMissionBindings(m, t);
            appendLedger(m, 'team.member.added', { worker_id, payload: { team_id: teamID, member: clean } });
            return { member: clean, worker_id };
        }
        catch (e) {
            t.member_role_refs = t.member_role_refs.filter(x => x !== clean);
            delete t.member_workers[clean];
            throw e;
        }
    }
    async removeMember(m, teamID, role) {
        const t = this.active(teamID);
        this.assertCurrentMission(m, t);
        if (!t.member_role_refs.includes(role))
            return false;
        if (t.member_role_refs.length <= 2)
            throw new Error('Team Mode requires at least two members; shutdown the team instead');
        const worker = t.member_workers[role], taskID = worker ? m.execution.workers.find(w => w.id === worker)?.task_id : undefined;
        if (worker)
            await this.tasks.cancel(m, worker);
        t.member_role_refs = t.member_role_refs.filter(x => x !== role);
        delete t.member_workers[role];
        t.worker_ids = t.worker_ids.filter(x => x !== worker);
        if (taskID)
            t.member_task_refs = t.member_task_refs.filter(x => x !== taskID);
        assertTeamMissionBindings(m, t);
        appendLedger(m, 'team.member.removed', { worker_id: worker, payload: { team_id: teamID, member: role } });
        return true;
    }
    adoptSemanticGeneration(m) {
        let n = 0;
        for (const t of this.list(m.identity.mission_id)) {
            if (t.status !== 'active')
                continue;
            t.generation = m.continuation.generation;
            assertTeamMissionBindings(m, t);
            appendLedger(m, 'team.semantic-paused', { payload: { team_id: t.team_id, generation: m.continuation.generation } });
            n++;
        }
        return n;
    }
    async shutdown(m, teamID, reason = 'explicit') {
        const t = this.#teams.get(teamID);
        if (!t)
            return false;
        this.assertMissionOwner(m, t);
        if (t.status === 'shutdown')
            return true;
        t.status = 'shutdown';
        t.shutdown_reason = reason;
        t.shutdown_at = Date.now();
        assertTeamMissionBindings(m, t);
        const workers = [...t.worker_ids];
        t.worker_ids = [];
        t.member_workers = {};
        if (m.identity.mission_id === t.mission_id && m.execution.execution_mode === 'team')
            m.execution.execution_mode = 'single';
        appendLedger(m, reason === 'expired' ? 'team.expired' : 'team.shutdown', { payload: { team_id: teamID, reason, workers: workers.length } });
        for (const worker of workers)
            try {
                await this.tasks.cancel(m, worker);
            }
            catch (error) {
                appendLedger(m, 'team.member.cancel.failed', { worker_id: worker, payload: { team_id: teamID, reason, error: String(error) } });
            }
        return true;
    }
    async expireMission(m, now = Date.now()) { for (const t of this.list(m.identity.mission_id))
        if (t.status === 'active' && (t.generation !== m.continuation.generation || now >= t.expires_at))
            await this.shutdown(m, t.team_id, t.generation !== m.continuation.generation ? 'stale-generation' : 'expired'); }
    async reconcileMission(m) {
        for (const t of this.list(m.identity.mission_id)) {
            if (t.status !== 'active')
                continue;
            if (t.generation !== m.continuation.generation) {
                await this.shutdown(m, t.team_id, 'stale-generation');
                continue;
            }
            const activeWorkers = t.worker_ids.map(id => m.execution.workers.find(w => w.id === id)).filter(Boolean).filter((w) => !['completed', 'failed', 'cancelled'].includes(w.status));
            if (activeWorkers.length >= 2)
                continue;
            if (activeWorkers.length === 0) {
                await this.shutdown(m, t.team_id, 'members-terminal');
                continue;
            }
            const remaining = activeWorkers.map((w) => w.id);
            t.status = 'shutdown';
            t.shutdown_reason = 'insufficient-active-members';
            t.shutdown_at = Date.now();
            assertTeamMissionBindings(m, t);
            t.worker_ids = [];
            t.member_workers = {};
            if (m.execution.execution_mode === 'team')
                m.execution.execution_mode = 'single';
            appendLedger(m, 'team.degraded', { payload: { team_id: t.team_id, reason: 'insufficient-active-members', remaining_workers: remaining } });
        }
    }
    async shutdownMission(m) { for (const t of this.list(m.identity.mission_id))
        if (t.status === 'active')
            await this.shutdown(m, t.team_id); }
}
