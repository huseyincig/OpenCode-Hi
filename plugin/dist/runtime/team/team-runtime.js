import { appendLedger } from '../ledger/ledger.js';
import { isHiChildRole, isHiReadOnlyChildRole } from '../roles/catalog.js';
function uid(p) { return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
function validTeamRole(role) { return isHiChildRole(role); }
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
    active(teamID) { const t = this.#teams.get(teamID); if (!t || t.status !== 'active')
        throw new Error('Active team not found'); if (Date.now() >= t.expires_at)
        throw new Error('Team wall-time expired; parent must shutdown/reconcile team'); return t; }
    assertMissionOwner(m, t) { if (t.mission_id !== m.mission_id)
        throw new Error('Team belongs to a different mission'); }
    assertCurrentMission(m, t) { this.assertMissionOwner(m, t); if (t.mission_generation !== m.generation)
        throw new Error('Stale team generation; shutdown/reconcile the old team before continuing'); }
    async startMember(m, t, role, overrideModel, overrideVariant) { const readOnly = isHiReadOnlyChildRole(role), started = await this.tasks.start(m, { objective: `${t.objective}\nTeam perspective: ${role}. Report findings to parent; do not create another team.`, role, category: m.risk === 'high' ? 'critical' : 'deep', scope: readOnly ? [] : m.intent.likelyTargets, constraints: ['parent-mediated team', 'no nested team', 'bounded scope', 'compact evidence'], model: overrideModel, modelVariant: overrideVariant }); t.worker_ids.push(started.worker_id); t.member_workers[role] = started.worker_id; return started.worker_id; }
    async create(m, objective, members, memberModels) { if (!this.enabled())
        throw new Error('Team Mode disabled'); if (this.list(m.mission_id).some(t => t.status === 'active'))
        throw new Error('Nested or second active team is not allowed'); const l = this.limits(), requested = [...new Set(members.map(x => x.trim()).filter(Boolean))]; const invalid = requested.filter(x => !validTeamRole(x)); if (invalid.length)
        throw new Error(`Unknown Team Mode role(s): ${invalid.join(', ')}`); const unique = requested.slice(0, l.maxMembers); if (unique.length < 2)
        throw new Error('Team Mode requires at least two distinct members'); const now = Date.now(), team = { id: uid('team'), mission_id: m.mission_id, mission_generation: m.generation, objective, status: 'active', members: unique, worker_ids: [], member_workers: {}, messages: [], board: [], created_at: now, expires_at: now + l.maxWallMs, turn_count: 0 }; this.#teams.set(team.id, team); m.execution_mode = 'team'; appendLedger(m, 'team.created', { payload: { team_id: team.id, members: unique, expires_at: team.expires_at, member_models: memberModels ? Object.keys(memberModels).length : 0 } }); try {
        for (const role of unique) {
            const override = memberModels?.[role];
            await this.startMember(m, team, role, override?.model, override?.variant);
        }
        return team;
    }
    catch (error) {
        for (const worker of [...team.worker_ids])
            try {
                await this.tasks.cancel(m, worker);
            }
            catch { }
        this.#teams.delete(team.id);
        m.execution_mode = 'single';
        appendLedger(m, 'team.create.rolled-back', { payload: { team_id: team.id, error: String(error) } });
        throw error;
    } }
    async addMember(m, teamID, role, overrideModel, overrideVariant) { const t = this.active(teamID); this.assertCurrentMission(m, t); const clean = role.trim(); if (!clean)
        throw new Error('Member role required'); if (!validTeamRole(clean))
        throw new Error(`Unknown Team Mode role: ${clean}`); if (t.members.includes(clean))
        throw new Error('Member already exists'); if (t.members.length >= this.limits().maxMembers)
        throw new Error('Team member limit reached'); t.members.push(clean); try {
        const worker_id = await this.startMember(m, t, clean, overrideModel, overrideVariant);
        appendLedger(m, 'team.member.added', { worker_id, payload: { team_id: teamID, member: clean } });
        return { member: clean, worker_id };
    }
    catch (e) {
        t.members = t.members.filter(x => x !== clean);
        delete t.member_workers[clean];
        throw e;
    } }
    async removeMember(m, teamID, role) { const t = this.active(teamID); this.assertCurrentMission(m, t); if (!t.members.includes(role))
        return false; if (t.members.length <= 2)
        throw new Error('Team Mode requires at least two members; shutdown the team instead'); const worker = t.member_workers[role]; if (worker)
        await this.tasks.cancel(m, worker); t.members = t.members.filter(x => x !== role); delete t.member_workers[role]; t.worker_ids = t.worker_ids.filter(x => x !== worker); appendLedger(m, 'team.member.removed', { worker_id: worker, payload: { team_id: teamID, member: role } }); return true; }
    message(m, teamID, from, to, text, dedupeKey) { const t = this.active(teamID); this.assertCurrentMission(m, t); if ((from !== 'parent' && !t.members.includes(from)) || (!t.members.includes(to) && to !== 'parent' && to !== 'all'))
        throw new Error('Unknown team member'); const l = this.limits(), key = dedupeKey?.trim(); if (key) {
        const prior = t.messages.find(x => x.dedupe_key === key && x.from === from && x.to === to);
        if (prior) {
            appendLedger(m, 'team.message.duplicate-ignored', { payload: { team_id: teamID, message_id: prior.id, from, to, dedupe_key: key } });
            return prior;
        }
    } if (t.messages.length >= l.maxMessages)
        throw new Error('Team mailbox limit reached'); if (t.turn_count >= l.maxTurns)
        throw new Error('Team turn limit reached'); const msg = { id: uid('msg'), at: Date.now(), from, to, text: text.slice(0, 2000), dedupe_key: key || undefined, delivered_to: [], processed_by: [], reservations: {} }; t.messages.push(msg); t.turn_count++; appendLedger(m, 'team.message', { payload: { team_id: teamID, from, to, turn: t.turn_count } }); return msg; }
    inbox(m, teamID, member, since, limit = 12, replay = false) { const t = this.active(teamID); this.assertCurrentMission(m, t); if (member !== 'parent' && !t.members.includes(member))
        throw new Error('Unknown team member'); const now = Date.now(), after = Number.isFinite(since) ? Number(since) : 0, cap = Math.max(1, Math.min(24, Math.floor(limit))), ttl = 120000; for (const msg of t.messages) {
        const r = msg.reservations?.[member];
        if (r && r.expires_at <= now && !msg.processed_by?.includes(member))
            delete msg.reservations[member];
    } const eligible = t.messages.filter(x => x.at > after && (x.to === member || x.to === 'all') && !x.processed_by?.includes(member) && (replay || !x.reservations?.[member])).slice(0, cap); if (!replay)
        for (const msg of eligible) {
            msg.reservations ??= {};
            msg.reservations[member] = { reserved_at: now, expires_at: now + ttl };
            msg.delivered_to = [...new Set([...(msg.delivered_to ?? []), member])];
        } return eligible; }
    messageAck(m, teamID, member, messageID, processed = true) { const t = this.active(teamID); this.assertCurrentMission(m, t); if (member !== 'parent' && !t.members.includes(member))
        throw new Error('Unknown team member'); const msg = t.messages.find(x => x.id === messageID); if (!msg)
        return false; msg.reservations ??= {}; msg.processed_by ??= []; if (processed) {
        msg.processed_by = [...new Set([...msg.processed_by, member])];
        delete msg.reservations[member];
        appendLedger(m, 'team.message.processed', { payload: { team_id: teamID, message_id: messageID, member } });
    }
    else {
        delete msg.reservations[member];
        appendLedger(m, 'team.message.released', { payload: { team_id: teamID, message_id: messageID, member } });
    } return true; }
    boardUpsert(m, teamID, input) { const t = this.active(teamID); this.assertCurrentMission(m, t); if (input.owner && !t.members.includes(input.owner))
        throw new Error('Unknown board owner'); let item = input.id ? t.board.find(x => x.id === input.id) : undefined; const now = Date.now(); if (!item) {
        item = { id: uid('tb'), title: input.title.slice(0, 500), owner: input.owner, status: input.status ?? 'open', evidence: input.evidence?.slice(0, 8), updated_at: now };
        t.board.push(item);
    }
    else {
        item.title = input.title.slice(0, 500);
        item.owner = input.owner ?? item.owner;
        item.status = input.status ?? item.status;
        item.evidence = input.evidence?.slice(0, 8) ?? item.evidence;
        item.updated_at = now;
    } appendLedger(m, 'team.board.updated', { payload: { team_id: teamID, item_id: item.id, status: item.status, owner: item.owner } }); return item; }
    adoptSemanticGeneration(m) { let n = 0; for (const t of this.list(m.mission_id)) {
        if (t.status !== 'active')
            continue;
        t.mission_generation = m.generation;
        appendLedger(m, 'team.semantic-paused', { payload: { team_id: t.id, generation: m.generation } });
        n++;
    } return n; }
    async shutdown(m, teamID, reason = 'explicit') { const t = this.#teams.get(teamID); if (!t)
        return false; this.assertMissionOwner(m, t); if (t.status === 'shutdown')
        return true; t.status = 'shutdown'; t.shutdown_reason = reason; const workers = [...t.worker_ids]; t.worker_ids = []; t.member_workers = {}; if (m.mission_id === t.mission_id && m.execution_mode === 'team')
        m.execution_mode = 'single'; appendLedger(m, reason === 'expired' ? 'team.expired' : 'team.shutdown', { payload: { team_id: teamID, reason, workers: workers.length } }); for (const worker of workers)
        try {
            await this.tasks.cancel(m, worker);
        }
        catch (error) {
            appendLedger(m, 'team.member.cancel.failed', { worker_id: worker, payload: { team_id: teamID, reason, error: String(error) } });
        } return true; }
    async expireMission(m, now = Date.now()) { for (const t of this.list(m.mission_id))
        if (t.status === 'active' && (t.mission_generation !== m.generation || now >= t.expires_at))
            await this.shutdown(m, t.id, t.mission_generation !== m.generation ? 'stale-generation' : 'expired'); }
    async reconcileMission(m) { for (const t of this.list(m.mission_id)) {
        if (t.status !== 'active')
            continue;
        if (t.mission_generation !== m.generation) {
            await this.shutdown(m, t.id, 'stale-generation');
            continue;
        }
        const activeWorkers = t.worker_ids.map(id => m.workers.find(w => w.id === id)).filter(Boolean).filter((w) => !['completed', 'failed', 'cancelled'].includes(w.status));
        if (activeWorkers.length >= 2)
            continue;
        if (activeWorkers.length === 0) {
            await this.shutdown(m, t.id, 'members-terminal');
            continue;
        }
        const remaining = activeWorkers.map((w) => w.id);
        t.status = 'shutdown';
        t.shutdown_reason = 'insufficient-active-members';
        t.worker_ids = [];
        t.member_workers = {};
        if (m.execution_mode === 'team')
            m.execution_mode = 'single';
        appendLedger(m, 'team.degraded', { payload: { team_id: t.id, reason: 'insufficient-active-members', remaining_workers: remaining } });
    } }
    async shutdownMission(m) { for (const t of this.list(m.mission_id))
        if (t.status === 'active')
            await this.shutdown(m, t.id); }
}
