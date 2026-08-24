import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { EvidenceItem, MethodologyObservation, MissionState, WorkerState } from '../mission/types.js'
import { methodologyCandidateAssessment, methodologyCandidateDigest, methodologyCandidateID, validProjectMethodologyCandidate, withDerivedMethodologyLearning, type ProjectMethodologyCandidate } from './methodology-candidate.js'
import { hiProjectRoot, projectMethodologyCandidatePath } from '../storage/ownership.js'
import { appendLedger } from '../ledger/ledger.js'
import { activateMethodologySignal } from '../methodology/activation.js'
import { methodologyCatalog } from '../methodology/catalog.js'
import { readProjectMethodologyProvenance } from '../methodology/provenance.js'

export class ProjectMethodologyLearningStore{
  readonly #items=new Map<string,ProjectMethodologyCandidate>()
  constructor(readonly projectRoot:string){this.#load()}
  #load():void{const dir=join(hiProjectRoot(this.projectRoot),'project-intelligence','methodology-candidates');if(!existsSync(dir))return;for(const entry of readdirSync(dir,{withFileTypes:true})){if(!entry.isFile()||!entry.name.endsWith('.json'))continue;try{const raw=JSON.parse(readFileSync(join(dir,entry.name),'utf8'));if(validProjectMethodologyCandidate(raw)&&entry.name===`${raw.id}.json`)this.#items.set(raw.id,withDerivedMethodologyLearning(raw))}catch{}}}
  #persist(item:ProjectMethodologyCandidate):void{const path=projectMethodologyCandidatePath(this.projectRoot,item.id);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(withDerivedMethodologyLearning(item),null,2)+'\n','utf8')}
  all():ProjectMethodologyCandidate[]{return [...this.#items.values()].map(withDerivedMethodologyLearning)}
  observe(mission:MissionState,worker:WorkerState,observation:MethodologyObservation,resultEvidence:readonly Pick<EvidenceItem,'id'|'kind'>[]):ProjectMethodologyCandidate|undefined{
    const byKind=new Map<string,string[]>();for(const item of resultEvidence){const kind=String(item.kind).trim().toLowerCase(),id=String(item.id).trim();if(!kind||!id)continue;const ids=byKind.get(kind)??[];if(!ids.includes(id))ids.push(id);byKind.set(kind,ids)}const referenced=[...new Set(observation.evidence.flatMap(ref=>byKind.get(String(ref).trim().toLowerCase())??[]))].slice(0,12)
    if(!referenced.length){appendLedger(mission,'project-methodology.observation-rejected',{task_id:worker.task_id,worker_id:worker.id,payload:{key:observation.key,reason:'observation evidence kinds have no exact canonical Evidence receipt'}});return undefined}
    const id=methodologyCandidateID(observation),contractSha=methodologyCandidateDigest(observation),now=Date.now(),existing=this.#items.get(id)
    let item:ProjectMethodologyCandidate=existing??{schema:1,id,key:observation.key,contract_sha256:contractSha,procedure:observation.procedure,trigger:observation.trigger,do_not_trigger:observation.do_not_trigger,exit_condition:observation.exit_condition,state:'CANDIDATE',observations:[],created_at:now,updated_at:now}
    if(item.state==='ARCHIVED')return withDerivedMethodologyLearning(item)
    const taskKey=`${mission.identity.mission_id}:${worker.task_id}`
    if(!item.observations.some(o=>`${o.mission_id}:${o.task_id}`===taskKey))item.observations.push({mission_id:mission.identity.mission_id,task_id:worker.task_id,worker_id:worker.id,evidence:referenced,observed_at:now,outcome:'helpful'})
    const independentTasks=new Set(item.observations.map(o=>`${o.mission_id}:${o.task_id}`)).size
    if(independentTasks>=2)item.state='READY'
    item.updated_at=now;item=withDerivedMethodologyLearning(item);this.#items.set(id,item);this.#persist(item)
    const assessment=methodologyCandidateAssessment(item,now),event=assessment.eligible?'project-methodology.candidate-ready':'project-methodology.observed'
    appendLedger(mission,event,{task_id:worker.task_id,worker_id:worker.id,payload:{candidate_id:item.id,key:item.key,observations:item.observations.length,independent_tasks:independentTasks,state:item.state,positive:assessment.positive,negative:assessment.negative,posterior_confidence:assessment.posterior_confidence,effective_confidence:assessment.effective_confidence,freshness:assessment.freshness,admission:assessment.reason}})
    if(assessment.eligible){const covered=methodologyCatalog(this.projectRoot).filter(entry=>entry.provider==='project').some(entry=>readProjectMethodologyProvenance(this.projectRoot,entry.name)?.candidate_id===item.id);if(covered)appendLedger(mission,'project-methodology.candidate-covered',{task_id:worker.task_id,worker_id:worker.id,payload:{candidate_id:item.id,key:item.key}});else activateMethodologySignal(mission,this.projectRoot,{signal:'project.methodology-gap',producer:'project-intelligence',reason:`Repeated evidence-backed reusable HOW candidate '${item.key}' passed independent-evidence, confidence and freshness admission gates and requires methodology authoring/admission review.`})}
    return withDerivedMethodologyLearning(item)
  }
}
