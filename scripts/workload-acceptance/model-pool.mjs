export function expandTestPool(configured,liveInventory){
  const out=configured.map(x=>({...x})),seen=new Set(out.map(x=>x.id)),base=Math.max(0,...out.map(x=>Number(x.costRank)||0))+1000
  for(const model of [...liveInventory].filter(x=>x?.zeroCost===true&&!seen.has(x.id)).sort((a,b)=>a.id.localeCompare(b.id))){out.push({id:model.id,costRank:base+out.length});seen.add(model.id)}
  return out
}
export function selectTestModel({liveInventory,pool,requiredCapabilities=[]}){const live=new Map(liveInventory.map(x=>[x.id,x])),rejected=[];const eligible=[];for(const entry of pool){const model=live.get(entry.id);if(!model){rejected.push({id:entry.id,reason:'not-live'});continue}const caps=new Set(model.capabilities??[]),missing=requiredCapabilities.filter(x=>!caps.has(x));if(missing.length){rejected.push({id:entry.id,reason:'capability-mismatch',missing});continue}eligible.push({model,rank:Number(entry.costRank??Number.MAX_SAFE_INTEGER)})}eligible.sort((a,b)=>a.rank-b.rank||a.model.id.localeCompare(b.model.id));if(!eligible.length)throw new Error('NO_ELIGIBLE_TEST_MODEL');return{model:eligible[0].model,eligible:eligible.map(x=>x.model.id),rejected,reason:'capability-eligible-test-cost-order'}}

export function effectiveWModelIds(pool,liveInventory){
  const live=new Set((liveInventory??[]).map(x=>x?.id).filter(Boolean))
  return [...new Set((pool??[]).map(x=>x?.id).filter(id=>live.has(id)))]
}
