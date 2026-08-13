import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { methodologyCandidateDigest, methodologyCandidateID, validProjectMethodologyCandidate } from './methodology-candidate.js';
import { hiProjectRoot, projectMethodologyCandidatePath } from '../storage/ownership.js';
import { appendLedger } from '../ledger/ledger.js';
import { activateMethodologySignal } from '../methodology/activation.js';
import { methodologyCatalog } from '../methodology/catalog.js';
import { readProjectMethodologyProvenance } from '../methodology/provenance.js';
export class ProjectMethodologyLearningStore {
    projectRoot;
    #items = new Map();
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.#load();
    }
    #load() { const dir = join(hiProjectRoot(this.projectRoot), 'project-intelligence', 'methodology-candidates'); if (!existsSync(dir))
        return; for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.json'))
            continue;
        try {
            const raw = JSON.parse(readFileSync(join(dir, entry.name), 'utf8'));
            if (validProjectMethodologyCandidate(raw) && entry.name === `${raw.id}.json`)
                this.#items.set(raw.id, raw);
        }
        catch { }
    } }
    #persist(item) { const path = projectMethodologyCandidatePath(this.projectRoot, item.id); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(item, null, 2) + '\n', 'utf8'); }
    all() { return [...this.#items.values()].map(x => ({ ...x, observations: x.observations.map(o => ({ ...o, evidence: [...o.evidence] })) })); }
    observe(mission, worker, observation, resultEvidence) {
        const available = new Set(resultEvidence.map(item => String(item).trim().toLowerCase()).filter(Boolean));
        const referenced = [...new Set(observation.evidence.map(ref => String(ref).trim().toLowerCase()).filter(ref => available.has(ref)))].slice(0, 12);
        if (!referenced.length) {
            appendLedger(mission, 'project-methodology.observation-rejected', { task_id: worker.task_id, worker_id: worker.id, payload: { key: observation.key, reason: 'observation evidence kinds are not exactly bound to worker result evidence kinds' } });
            return undefined;
        }
        const id = methodologyCandidateID(observation), contractSha = methodologyCandidateDigest(observation), now = Date.now(), existing = this.#items.get(id);
        const item = existing ?? { schema: 1, id, key: observation.key, contract_sha256: contractSha, procedure: observation.procedure, trigger: observation.trigger, do_not_trigger: observation.do_not_trigger, exit_condition: observation.exit_condition, state: 'CANDIDATE', observations: [], created_at: now, updated_at: now };
        if (item.state === 'ARCHIVED')
            return item;
        const taskKey = `${mission.mission_id}:${worker.task_id}`;
        if (!item.observations.some(o => `${o.mission_id}:${o.task_id}` === taskKey))
            item.observations.push({ mission_id: mission.mission_id, task_id: worker.task_id, worker_id: worker.id, evidence: referenced, observed_at: now });
        const independentTasks = new Set(item.observations.map(o => `${o.mission_id}:${o.task_id}`)).size;
        if (independentTasks >= 2)
            item.state = 'READY';
        item.updated_at = now;
        this.#items.set(id, item);
        this.#persist(item);
        appendLedger(mission, item.state === 'READY' ? 'project-methodology.candidate-ready' : 'project-methodology.observed', { task_id: worker.task_id, worker_id: worker.id, payload: { candidate_id: item.id, key: item.key, observations: item.observations.length, independent_tasks: independentTasks, state: item.state } });
        if (item.state === 'READY') {
            const covered = methodologyCatalog(this.projectRoot).filter(entry => entry.provider === 'project').some(entry => readProjectMethodologyProvenance(this.projectRoot, entry.name)?.candidate_id === item.id);
            if (covered)
                appendLedger(mission, 'project-methodology.candidate-covered', { task_id: worker.task_id, worker_id: worker.id, payload: { candidate_id: item.id, key: item.key } });
            else
                activateMethodologySignal(mission, this.projectRoot, { signal: 'project.methodology-gap', producer: 'project-intelligence', reason: `Repeated evidence-backed reusable HOW candidate '${item.key}' requires methodology authoring/admission review.` });
        }
        return { ...item, observations: item.observations.map(o => ({ ...o, evidence: [...o.evidence] })) };
    }
}
