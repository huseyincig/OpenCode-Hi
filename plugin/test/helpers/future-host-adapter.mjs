import {negotiateHostCapabilityContracts} from '../../dist/contracts/host-capability.js'

const contract=(id,status,{primitive,fallback,loss=[]}={})=>({id,host_id:'synthetic-future',status,verification_level:'OBSERVED',...(primitive?{native_primitive:primitive}:{}),adapter_entrypoint:'SyntheticFutureHostAdapter',...(fallback?{fallback}:{}),semantic_loss:loss,required_permissions:[],acceptance_ref:'plugin/test/future-host-adapter.test.mjs',forbidden_fake_behavior:`Synthetic future capability ${id} is fixture runtime truth only.`})

export function createAlienFutureRuntime(){
  const units=new Map(),events=[],models=[{vendor:'future-provider',name:'future-model',inputs:['text','image']}]
  return{
    units,events,models,
    lifecycle:{attach(fn){events.push(fn);return()=>events.splice(events.indexOf(fn),1)}},
    async launchUnit({ancestor,label,persona}){const key=`unit:${units.size+1}`;units.set(key,{key,ancestor,label,persona,phase:'quiescent',usage:{meter:{inTokens:0,outTokens:0,reasonTokens:0,cacheHit:0,cacheFill:0}}});return{key}},
    async enqueueWork({unitKey,payload}){const u=units.get(unitKey);if(!u)throw new Error('unknown unit');u.phase='running';u.payload=payload;u.phase='quiescent';u.usage={meter:{inTokens:11,outTokens:3,reasonTokens:1,cacheHit:2,cacheFill:0},priceMicros:25};for(const fn of events)fn({name:'unit.quiet',subject:{key:unitKey}});return{queued:true}},
    async haltUnit({unitKey}){const u=units.get(unitKey);if(!u)return{halted:false};u.phase='quiescent';return{halted:true}},
    async inspectUnit({unitKey}){return units.get(unitKey)},
    async listModels(){return models},
  }
}

export function createFutureAdapter(raw){
  const statusOf=phase=>phase==='running'?'busy':phase==='quiescent'?'idle':'unknown'
  const child={
    capabilities:{create:true,prompt:true,abort:true,status:true,diff:false,summarize:false,fork:false,structuredOutput:false},
    async create(req){const r=await raw.launchUnit({ancestor:req.parentSessionID,label:req.title,persona:req.role});return{child:{id:r.key},fork:{requested:Boolean(req.forkFromSession),nativeAvailable:false,used:false,...(req.forkFromSession?{reason:'future host has no inherited session clone'}:{})}}},
    async prompt(id,text){await raw.enqueueWork({unitKey:id,payload:{kind:'work',text}})},
    async abort(id){return(await raw.haltUnit({unitKey:id})).halted?'client':'unavailable'},
    async status(id){return statusOf((await raw.inspectUnit({unitKey:id}))?.phase)},
    async diff(){throw new Error('UNSUPPORTED_CAPABILITY: session-diff')},
    async summarize(){throw new Error('UNSUPPORTED_CAPABILITY: session-summarize')},
  }
  const contracts=negotiateHostCapabilityContracts([
    ['child-session-create','SUPPORTED',{primitive:'launchUnit'}],
    ['session-prompt','SUPPORTED',{primitive:'enqueueWork'}],
    ['session-abort','SUPPORTED',{primitive:'haltUnit'}],
    ['session-status','SUPPORTED',{primitive:'inspectUnit'}],
    ['provider-inventory','SUPPORTED',{primitive:'listModels'}],
    ['session-diff','DEGRADED',{fallback:'worker changed-file receipts',loss:['no native future-host diff primitive']}],
    ['structured-human-decision-transport','UNSUPPORTED',{loss:['future host exposes no direct structured decision opener']}],
    ['browser-execution','UNSUPPORTED',{loss:['future host fixture has no browser capability']}],
    ['process-lifecycle','DEGRADED',{fallback:'bounded foreground execution outside this fixture',loss:['no persistent future-host process owner']}],
    ['worker-runtime','SUPPORTED',{primitive:'launchUnit + enqueueWork + haltUnit'}],
  ].map(([id,status,opts])=>({source:'RUNTIME_TRUTH',contract:contract(id,status,opts)})))
  const host={
    capabilities:{contracts,degraded:contracts.filter(x=>x.status!=='SUPPORTED').map(x=>`${x.id}:${x.status.toLowerCase()}`)},
    getModels(){return raw.models.map(m=>({id:`${m.vendor}/${m.name}`,provider:m.vendor,connected:true,writeCapable:true,visionCapable:m.inputs.includes('image'),cost:0,quality:0,tags:[],variants:[]}))},
    async refreshRuntimeInventory(){await raw.listModels();return raw.models.length},
    async sessionStatus(id){return child.status(id)},
    async readAssistantResult(id){const u=await raw.inspectUnit({unitKey:id}),x=u?.usage?.meter;if(!x)return{text:''};return{text:'future done',model:{model:'future-provider/future-model'},usage:{token_source:'synthetic-future-unit',coverage:'assistant-message-reported',confidence:'exact',step_count:1,tokens:{input:x.inTokens,output:x.outTokens,reasoning:x.reasonTokens,cache_read:x.cacheHit,cache_write:x.cacheFill},...(typeof u.usage.priceMicros==='number'?{monetary:{usd:u.usage.priceMicros/1_000_000,source:'host-reported',confidence:'exact'}}:{})}}},
    async log(){},
  }
  return{child,host,contracts}
}
