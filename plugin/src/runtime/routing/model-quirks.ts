import type { ModelCapabilityProfile,ModelQuirkHints } from '../../contracts/model.js'

export interface ModelQuirkProfile extends ModelQuirkHints{source:'capability-profile'|'technical-model-id-fallback'|'none'}

export function modelQuirks(model:string|undefined,profile?:ModelCapabilityProfile):ModelQuirkProfile{
  if(profile?.quirks)return{...profile.quirks,source:'capability-profile'}
  const id=(model??'').toLowerCase()
  const compact=/mini|flash|haiku|small/.test(id)||undefined
  const explicit=/reason|o[1-9]|deep|sonnet|opus/.test(id)||undefined
  if(compact||explicit)return{compactInstructionSensitive:compact,avoidLongNestedPlans:compact,explicitToolBoundaries:explicit,source:'technical-model-id-fallback'}
  return{source:'none'}
}
