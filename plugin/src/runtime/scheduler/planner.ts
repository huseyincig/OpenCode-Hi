import type {
  ExecutionUnit,
  SchedulingDecision,
  SchedulingReasonCode,
  SchedulingResourceBinding,
  SchedulingSnapshot,
  SchedulingUnitDecision,
  WorkNode,
} from '../../contracts/orchestration-core.js'

const ACTIVE_TASK_STATUSES=new Set(['running'])
const ACTIVE_ATTEMPT_STATUSES=new Set(['starting','busy'])
const TERMINAL_TASK_STATUSES=new Set(['completed','failed','cancelled'])
const CONFLICT_TASK_STATUSES=new Set(['created','queued','running','waiting'])
const MUTABLE_SHARED_HINT=/(migration|schema|lockfile|package-lock|pnpm-lock|yarn\.lock)/i

function norm(value:string):string{return value.trim().replace(/\\/g,'/').replace(/^\.\//,'').replace(/\/+$/,'')}
function sameSurface(a:string,b:string):boolean{const x=norm(a),y=norm(b);return Boolean(x&&y&&(x===y||x.startsWith(`${y}/`)||y.startsWith(`${x}/`)))}
function overlaps(a:string[],b:string[]):string[]{const out:string[]=[];for(const x of a)for(const y of b)if(sameSurface(x,y)){out.push(norm(x)===norm(y)?norm(x):`${norm(x)}~${norm(y)}`);break}return[...new Set(out)]}
function reason(code:SchedulingReasonCode,detail?:string){return detail===undefined?{code}:{code,detail}}
function resourceCapacity(snapshot:SchedulingSnapshot,unitID:string,binding:SchedulingResourceBinding|undefined):{ok:boolean;reason?:{code:SchedulingReasonCode;detail?:string}}{
  const running=snapshot.capacity.running.filter(item=>item.executionUnitId!==unitID)
  if(running.length>=snapshot.capacity.global)return{ok:false,reason:reason('global-capacity')}
  if(binding?.provider){const cap=snapshot.capacity.providers[binding.provider]??snapshot.capacity.global;if(running.filter(x=>x.provider===binding.provider).length>=cap)return{ok:false,reason:reason('provider-capacity',binding.provider)}}
  if(binding?.model){const cap=snapshot.capacity.models[binding.model]??snapshot.capacity.global;if(running.filter(x=>x.model===binding.model).length>=cap)return{ok:false,reason:reason('model-capacity',binding.model)}}
  return{ok:true}
}
function conflictDecision(snapshot:SchedulingSnapshot,unit:ExecutionUnit,nodeByID:Map<string,WorkNode>):{blocking:string[];reasons:Array<{code:SchedulingReasonCode;detail?:string}>}{
  const blocking:string[]=[],reasons:Array<{code:SchedulingReasonCode;detail?:string}>=[],candidateRead=snapshot.unitTraits[unit.id]?.readOnly??false
  for(const other of snapshot.graph.executionUnits){
    if(other.id===unit.id)continue
    const otherNode=nodeByID.get(other.workNodeId);if(!otherNode||!CONFLICT_TASK_STATUSES.has(otherNode.status))continue
    const unitNode=nodeByID.get(unit.workNodeId)!
    const otherPrecedes=otherNode.createdAt<unitNode.createdAt||(otherNode.createdAt===unitNode.createdAt&&other.id<unit.id)
    if(otherNode.status!=='running'&&!otherPrecedes)continue
    if(unit.dependencies.includes(other.workNodeId))continue
    const overlap=overlaps(other.scope,unit.scope),otherRead=snapshot.unitTraits[other.id]?.readOnly??false
    if(overlap.length&&!(candidateRead&&otherRead)){blocking.push(other.id);reasons.push(reason('mutable-surface-conflict',`${other.id}:${overlap.join(',')}`))}
    if(!candidateRead&&!otherRead&&other.scope.some(x=>MUTABLE_SHARED_HINT.test(x))&&unit.scope.some(y=>other.scope.some(x=>sameSurface(x,y)))){
      blocking.push(other.id);reasons.push(reason('shared-mutable-surface',other.id))
    }
  }
  return{blocking:[...new Set(blocking)],reasons}
}
function decideStaticUnit(snapshot:SchedulingSnapshot,unit:ExecutionUnit,nodeByID:Map<string,WorkNode>):SchedulingUnitDecision|undefined{
  const node=nodeByID.get(unit.workNodeId)
  if(!node)return{executionUnitId:unit.id,disposition:'BLOCKED_DEPENDENCY',reasons:[reason('unknown-dependency',unit.workNodeId)],blockingUnitIds:[],blockingDependencyIds:[unit.workNodeId]}
  if(TERMINAL_TASK_STATUSES.has(node.status))return{executionUnitId:unit.id,disposition:'TERMINAL',reasons:[reason('terminal-work',node.status)],blockingUnitIds:[],blockingDependencyIds:[]}
  if(ACTIVE_TASK_STATUSES.has(node.status)||Boolean(unit.attempt&&ACTIVE_ATTEMPT_STATUSES.has(unit.attempt.status)))return{executionUnitId:unit.id,disposition:'ACTIVE',reasons:[reason('already-active')],blockingUnitIds:[],blockingDependencyIds:[]}
  if(node.status==='blocked')return{executionUnitId:unit.id,disposition:'BLOCKED_STATE',reasons:[reason('task-blocked')],blockingUnitIds:[],blockingDependencyIds:[]}
  const unknown=unit.dependencies.filter(id=>!nodeByID.has(id))
  if(unknown.length)return{executionUnitId:unit.id,disposition:'BLOCKED_DEPENDENCY',reasons:unknown.map(id=>reason('unknown-dependency',id)),blockingUnitIds:[],blockingDependencyIds:unknown}
  const failed=unit.dependencies.filter(id=>nodeByID.get(id)?.status==='failed'),cancelled=unit.dependencies.filter(id=>nodeByID.get(id)?.status==='cancelled')
  if(failed.length||cancelled.length)return{executionUnitId:unit.id,disposition:'BLOCKED_DEPENDENCY',reasons:[...failed.map(id=>reason('dependency-failed',id)),...cancelled.map(id=>reason('dependency-cancelled',id))],blockingUnitIds:[],blockingDependencyIds:[...failed,...cancelled]}
  const incomplete=unit.dependencies.filter(id=>nodeByID.get(id)?.status!=='completed')
  if(incomplete.length)return{executionUnitId:unit.id,disposition:'WAITING_DEPENDENCY',reasons:incomplete.map(id=>reason('dependency-incomplete',id)),blockingUnitIds:[],blockingDependencyIds:incomplete}
  const conflict=conflictDecision(snapshot,unit,nodeByID)
  if(conflict.reasons.length)return{executionUnitId:unit.id,disposition:'DEFERRED_CONFLICT',reasons:conflict.reasons,blockingUnitIds:conflict.blocking,blockingDependencyIds:[]}
  return undefined
}

/**
 * Prepare graph-derived scheduling decisions once. The returned planner is pure and
 * call-scoped: only capacity.running may vary between invocations. No runtime state is cached.
 */
export function createSchedulingPlanner(snapshot:SchedulingSnapshot):(capacity?:SchedulingSnapshot['capacity'])=>SchedulingDecision{
  const nodeByID=new Map(snapshot.graph.nodes.map(node=>[node.id,node]))
  const staticDecisions=new Map<string,SchedulingUnitDecision|undefined>()
  const intrinsicActive=new Set<string>()
  for(const unit of snapshot.graph.executionUnits){
    if(ACTIVE_TASK_STATUSES.has(nodeByID.get(unit.workNodeId)?.status??'')||Boolean(unit.attempt&&ACTIVE_ATTEMPT_STATUSES.has(unit.attempt.status)))intrinsicActive.add(unit.id)
    staticDecisions.set(unit.id,decideStaticUnit(snapshot,unit,nodeByID))
  }
  return(capacity=snapshot.capacity)=>{
    const working:SchedulingSnapshot=capacity===snapshot.capacity?snapshot:{...snapshot,capacity}
    const active=new Set(intrinsicActive);for(const slot of capacity.running)active.add(slot.executionUnitId)
    const units=snapshot.graph.executionUnits.map(unit=>{
      const fixed=staticDecisions.get(unit.id);if(fixed)return fixed
      const activeOthers=active.size-(active.has(unit.id)?1:0)
      if(activeOthers>=capacity.topology)return{executionUnitId:unit.id,disposition:'DEFERRED_CAPACITY' as const,reasons:[reason('topology-capacity',String(capacity.topology))],blockingUnitIds:[],blockingDependencyIds:[]}
      const resource=resourceCapacity(working,unit.id,snapshot.resolvedResources[unit.id])
      if(!resource.ok)return{executionUnitId:unit.id,disposition:'DEFERRED_CAPACITY' as const,reasons:[resource.reason!],blockingUnitIds:[],blockingDependencyIds:[]}
      return{executionUnitId:unit.id,disposition:'RUNNABLE' as const,reasons:[reason('ready')],blockingUnitIds:[],blockingDependencyIds:[]}
    })
    return{missionId:snapshot.graph.missionId,units}
  }
}

/** Pure scheduling policy: no acquisition, queue mutation, host call, or session execution. */
export function planScheduling(snapshot:SchedulingSnapshot):SchedulingDecision{return createSchedulingPlanner(snapshot)()}
