import type { Category } from '../mission/types.js'
import type { HiConfig } from '../../config/schema.js'
import { providerPolicyView } from '../../opencode/native-adapter.js'
import type { ModelCapabilityProfile } from '../../contracts/model.js'

export type AvailableModel=ModelCapabilityProfile
export interface ModelFallbackReason{model:string;variant?:string;reason:string}
export interface ModelResolution{primary?:string;primaryVariant?:string;fallbacks:string[];fallbackVariants:Record<string,string|undefined>;reason:string[];fallbackReasons:ModelFallbackReason[];rejected:Array<{id:string;reason:string}>;scores?:Array<{model:string;score:number;expected_completion_cost:number;failure_penalty:number;success_credit:number}>}
export interface MissionModelFeedback{failures?:Record<string,number>;successes?:Record<string,number>;retries?:Record<string,number>}
export interface RuntimeModelCandidateStatus{ok:boolean;reason?:string}
const CATEGORY_TAG:Record<Category,string[]>={quick:['fast','cheap'],standard:['balanced'],deep:['reasoning','coding'],visual:['vision','coding'],critical:['reasoning','high-assurance']}
const EXPECTED:Record<Category,{turns:number;context:number}>={quick:{turns:2,context:.5},standard:{turns:4,context:1},deep:{turns:7,context:1.5},visual:{turns:5,context:1.2},critical:{turns:8,context:1.7}}
const VARIANT_PREFERENCE:Record<Category,string[]>={quick:['low','minimal','none'],standard:['medium','low','none'],deep:['high','xhigh','medium'],visual:['high','medium','xhigh'],critical:['xhigh','max','high']}
function providerOf(m:AvailableModel):string|undefined{return m.provider??(m.id.includes('/')?m.id.slice(0,m.id.indexOf('/')):undefined)}
function policyFilter(available:AvailableModel[],config:HiConfig,hostConfig?:Record<string,unknown>){
  const explicitAllowed=new Set(config.routing.allowedProviders),deniedModels=new Set(config.routing.deniedModels),native=providerPolicyView(hostConfig),rejected:Array<{id:string;reason:string}>=[],allowed:AvailableModel[]=[]
  for(const m of available){const provider=providerOf(m)
    if(deniedModels.has(m.id)){rejected.push({id:m.id,reason:'hi-denied-model'});continue}
    if(explicitAllowed.size&&(!provider||!explicitAllowed.has(provider))){rejected.push({id:m.id,reason:`hi-provider-not-allowed:${provider??'unknown'}`});continue}
    if(provider&&native.denied.has(provider)){rejected.push({id:m.id,reason:`opencode-provider-policy-deny:${provider}`});continue}
    if(native.allowed.size&&provider&&!native.allowed.has(provider)){rejected.push({id:m.id,reason:`opencode-provider-not-enabled:${provider}`});continue}
    if(m.writeCapable===false){rejected.push({id:m.id,reason:'not-write-capable'});continue}
    allowed.push(m)
  }
  return{allowed,rejected,nativePolicySources:native.source}
}
function uniqueRuntime(ids:string[],available:AvailableModel[]):string[]{const live=new Set(available.map(m=>m.id));return[...new Set(ids)].filter(id=>live.has(id))}
export function runtimeModelCandidateStatus(id:string,availableInput:AvailableModel[],config:HiConfig,hostConfig?:Record<string,unknown>):RuntimeModelCandidateStatus{
  if(id==='host-default'){
    if(config.routing.deniedModels.includes('host-default'))return{ok:false,reason:'hi-denied-model:host-default'}
    if(config.routing.allowedProviders.length)return{ok:false,reason:'host-default-disallowed-by-explicit-provider-allowlist'}
    const native=providerPolicyView(hostConfig);if(native.allowed.size)return{ok:false,reason:'host-default-disallowed-by-opencode-provider-allowlist'}
    return{ok:true}
  }
  const found=availableInput.find(m=>m.id===id);if(!found&&availableInput.length)return{ok:false,reason:'runtime-model-unavailable'}
  const candidate=found??{id,provider:providerOf({id}),writeCapable:true};const checked=policyFilter([candidate],config,hostConfig);if(checked.allowed.length)return{ok:true,reason:found?'runtime-model-available':'runtime-inventory-unavailable-pre-resolved-candidate'}
  return{ok:false,reason:checked.rejected[0]?.reason??'routing-policy-rejected'}
}
function chooseVariant(category:Category,model:AvailableModel|undefined,config:HiConfig,role?:string):string|undefined{if(!model?.variants?.length)return undefined;const rolePreferred=role&&model?config.routing.roleVariants?.[role]?.[model.id]:undefined;const preferred=[...(rolePreferred?[rolePreferred]:[]),...(config.routing.categoryVariants?.[category]??[]),...VARIANT_PREFERENCE[category]];for(const v of preferred)if(model.variants.includes(v))return v;return model.variants[0]}
export function resolveModel(category:Category,availableInput:AvailableModel[],config:HiConfig,explicit?:string,role?:string,hostConfig?:Record<string,unknown>,feedback:MissionModelFeedback={}):ModelResolution{
  const {allowed:available,rejected,nativePolicySources}=policyFilter(availableInput,config,hostConfig),reason:string[]=[],preferred:string[]=[]
  if(!availableInput.length){const deniedDefault=config.routing.deniedModels.includes('host-default');if(!deniedDefault&&!config.routing.allowedProviders.length){return{primary:'host-default',fallbacks:[],fallbackVariants:{},reason:['runtime inventory unavailable','policy permits host-default compatibility delegation'],fallbackReasons:[],rejected}}}
  if(explicit){if(available.some(m=>m.id===explicit)){preferred.push(explicit);reason.push('explicit override','runtime available','policy allowed')}else if(availableInput.some(m=>m.id===explicit))reason.push('explicit override rejected by routing/provider policy; fallback constrained to policy');else reason.push('explicit override unavailable; fallback allowed')}
  const projectModel=config.models?.mode==='fixed'&&config.models.default!=='auto'?config.models.default:config.models?.mode==='role-mapped'&&role?config.models.roles[role]:undefined
  if(!explicit&&projectModel){preferred.push(projectModel);reason.push(config.models?.mode==='fixed'?'project fixed-model override':`project role-model override:${role}`)}
  const roleConfigured=role?config.routing.roleModels[role]??[]:[];if(roleConfigured.length){preferred.push(...roleConfigured);reason.push(`role override:${role}`)}const categoryConfigured=config.routing.categoryModels[category]??[];if(categoryConfigured.length){preferred.push(...categoryConfigured);reason.push(`category override:${category}`)}
  const preferredLive=uniqueRuntime(preferred,available),wanted=CATEGORY_TAG[category],expected=EXPECTED[category]
  if(roleConfigured.length&&roleConfigured[0]&&!available.some(m=>m.id===roleConfigured[0]))reason.push(`role-primary-unavailable-or-policy-rejected:${roleConfigured[0]}`)
  // Recommended fast-path: if every preferred role/category-configured model
  // exists in inventory and at least one is present, treat the highest-scored
  // preferred model as primary without re-running scoring. Skip the
  // sort/round of all available models (no expensive reranking).
  const preferredAllAvailable=roleConfigured.length>0&&roleConfigured.every(id=>available.some(m=>m.id===id))
  if(preferredAllAvailable&&roleConfigured.length>0&&explicit===undefined&&categoryConfigured.length===0){
    const primary=preferredLive[0]
    const fallbacks=preferredLive.slice(1,1+config.routing.maxFallbacks)
    const byId=new Map(available.map(m=>[m.id,m]))
    const primaryVariant=chooseVariant(category,byId.get(primary),config,role)
    const fallbackVariants:Record<string,string|undefined>={}
    for(const id of fallbacks)fallbackVariants[id]=chooseVariant(category,byId.get(id),config,role)
    if(!reason.length)reason.push(`${category} category`)
    reason.push('recommended-fast-path:role-override-available,skip-scoring','write-capable','runtime available','routing policy allowed',primaryVariant?`variant:${primaryVariant}`:'variant:host/default',`fallbacks=${fallbacks.length}`)
    if(nativePolicySources.length)reason.push(`opencode-provider-policy:${nativePolicySources.join('+')}`)
    const fallbackReasons=fallbacks.map((model,i)=>({model,variant:fallbackVariants[model],reason:`fallback-${i+1}: role-configured alternative${fallbackVariants[model]?`; variant=${fallbackVariants[model]}`:''}`}))
    return{primary,primaryVariant,fallbacks,fallbackVariants,reason,fallbackReasons,rejected}
  }
  const scored=available.map(m=>{const tags=m.tags??[],tagScore=wanted.filter(t=>tags.includes(t)).length*4,quality=m.quality??0,cost=Math.max(0,m.cost??0),turns=Math.max(1,m.expectedTurns??expected.turns),context=Math.max(0,m.contextOverhead??expected.context),failures=Math.max(0,feedback.failures?.[m.id]??0),retries=Math.max(0,feedback.retries?.[m.id]??0),successes=Math.max(0,feedback.successes?.[m.id]??0),failurePenalty=(failures*1.75)+(retries*.85),successCredit=Math.min(2,successes*.35),retryMultiplier=1+(failures*.6)+(retries*.35),expectedCompletionCost=(cost+.08*turns+.2*context)*retryMultiplier,strategy=config.routing.strategy==='quality'?quality*2:config.routing.strategy==='cost'?-expectedCompletionCost*2:quality-expectedCompletionCost;return{model:m,score:tagScore+strategy-failurePenalty+successCredit,turns,context,expectedCompletionCost,failurePenalty,successCredit}}).sort((a,b)=>b.score-a.score)
  const ordered=[...new Set([...preferredLive,...scored.map(x=>x.model.id)])],primary=ordered[0],fallbacks=ordered.slice(1,1+config.routing.maxFallbacks),byId=new Map(available.map(m=>[m.id,m])),primaryVariant=chooseVariant(category,byId.get(primary),config,role),fallbackVariants:Record<string,string|undefined>={}
  for(const id of fallbacks)fallbackVariants[id]=chooseVariant(category,byId.get(id),config,role)
  if(!reason.length)reason.push(`${category} category`);reason.push('write-capable','runtime available','routing policy allowed',`${config.routing.strategy} scoring`,`expected-completion-cost-aware`,`current-mission-failure-history-aware`,primaryVariant?`variant:${primaryVariant}`:'variant:host/default',`fallbacks=${fallbacks.length}`);if(nativePolicySources.length)reason.push(`opencode-provider-policy:${nativePolicySources.join('+')}`)
  const fallbackReasons=fallbacks.map((model,i)=>({model,variant:fallbackVariants[model],reason:`fallback-${i+1}: policy-allowed alternate preserving ${category} capability after higher-ranked model${fallbackVariants[model]?`; variant=${fallbackVariants[model]}`:''}`}))
  return{primary,primaryVariant,fallbacks,fallbackVariants,reason,fallbackReasons,rejected,scores:scored.slice(0,12).map(x=>({model:x.model.id,score:Number(x.score.toFixed(4)),expected_completion_cost:Number(x.expectedCompletionCost.toFixed(4)),failure_penalty:Number(x.failurePenalty.toFixed(4)),success_credit:Number(x.successCredit.toFixed(4))}))}
}
