import { HI_METHODOLOGY_LIMITS, HI_METHODOLOGY_POLICY, HI_METHODOLOGY_SIGNAL_CATALOG, type HiMethodologyExitRequirement, type HiMethodologyName, type HiMethodologySignalName, type HiMethodologyTriggerSource } from '../../generated/methodology-policy.js'
import { discoverProjectMethodologyPolicies, type ProjectMethodologyPolicy } from './project-policy.js'

export type HiMethodologyProvider='hi'|'project'

export interface HiMethodologyCatalogEntry{
  name:string
  provider:HiMethodologyProvider
  preferredRoles:string[]
  compatibleRoles:string[]
  activationSignals:HiMethodologySignalName[]
  triggerSources:HiMethodologyTriggerSource[]
  priority:'low'|'normal'|'high'
  contextCost:'low'|'medium'|'high'
  executionCost:'low'|'medium'|'high'
  exitRequirements:HiMethodologyExitRequirement[]
  weight:number
  compositionCost:'low'|'medium'|'high'
  usefulCoexistence:string[]
  conflicts:string[]
  resourceRequirements:string[]
}

function builtinEntry(item:(typeof HI_METHODOLOGY_POLICY)[number]):HiMethodologyCatalogEntry{
  return{
    name:item.name,
    provider:'hi',
    preferredRoles:[...item.preferredRoles],
    compatibleRoles:[...item.compatibleRoles],
    activationSignals:[...item.activationSignals],
    triggerSources:[...item.triggerSources],
    priority:item.priority,
    contextCost:item.contextCost,
    executionCost:item.executionCost,
    exitRequirements:[...item.exitRequirements],
    weight:item.weight,
    compositionCost:item.compositionCost,
    usefulCoexistence:[...item.usefulCoexistence],
    conflicts:[...item.conflicts],
    resourceRequirements:[...item.resourceRequirements],
  }
}

function projectEntry(item:ProjectMethodologyPolicy):HiMethodologyCatalogEntry{
  const activationSignals=[...item.activation_signals]
  const triggerSources=[...new Set(activationSignals.map(signal=>HI_METHODOLOGY_SIGNAL_CATALOG[signal].trigger_source))] as HiMethodologyTriggerSource[]
  return{
    name:item.name,
    provider:'project',
    preferredRoles:[...item.preferred_roles],
    compatibleRoles:[...item.compatible_roles],
    activationSignals,
    triggerSources,
    priority:item.priority,
    contextCost:item.context_cost,
    executionCost:item.execution_cost,
    exitRequirements:[...item.exit_requirements],
    weight:item.weight,
    compositionCost:item.composition_cost,
    usefulCoexistence:[...item.useful_coexistence],
    conflicts:[...item.conflicts],
    resourceRequirements:[...item.resource_requirements],
  }
}

const BUILTIN_ENTRIES=HI_METHODOLOGY_POLICY.map(builtinEntry)
const BUILTIN_BY_NAME=new Map(BUILTIN_ENTRIES.map(item=>[item.name,item]))

export function builtinMethodologyCatalog():HiMethodologyCatalogEntry[]{
  return BUILTIN_ENTRIES.map(item=>({...item,preferredRoles:[...item.preferredRoles],compatibleRoles:[...item.compatibleRoles],activationSignals:[...item.activationSignals],triggerSources:[...item.triggerSources],exitRequirements:[...item.exitRequirements],usefulCoexistence:[...item.usefulCoexistence],conflicts:[...item.conflicts],resourceRequirements:[...item.resourceRequirements]}))
}

export function methodologyCatalog(projectRoot?:string):HiMethodologyCatalogEntry[]{
  const builtins=builtinMethodologyCatalog()
  if(!projectRoot)return builtins
  const projects=discoverProjectMethodologyPolicies(projectRoot).map(projectEntry)
  const names=new Set(builtins.map(item=>item.name))
  return [...builtins,...projects.filter(item=>!names.has(item.name))]
}

export function methodologyCatalogEntry(name:string,projectRoot?:string):HiMethodologyCatalogEntry|undefined{
  const builtin=BUILTIN_BY_NAME.get(name as HiMethodologyName)
  if(builtin){
    if(projectRoot&&discoverProjectMethodologyPolicies(projectRoot).some(item=>item.name===name))return undefined
    return {...builtin,preferredRoles:[...builtin.preferredRoles],compatibleRoles:[...builtin.compatibleRoles],activationSignals:[...builtin.activationSignals],triggerSources:[...builtin.triggerSources],exitRequirements:[...builtin.exitRequirements],usefulCoexistence:[...builtin.usefulCoexistence],conflicts:[...builtin.conflicts],resourceRequirements:[...builtin.resourceRequirements]}
  }
  if(!projectRoot)return undefined
  const project=discoverProjectMethodologyPolicies(projectRoot).find(item=>item.name===name)
  return project?projectEntry(project):undefined
}

export const methodologyLimits=HI_METHODOLOGY_LIMITS


export function methodologiesForSignal(signal:HiMethodologySignalName,projectRoot?:string):HiMethodologyCatalogEntry[]{
  return methodologyCatalog(projectRoot).filter(item=>item.activationSignals.includes(signal))
}
