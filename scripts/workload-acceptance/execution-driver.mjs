import {createServer} from 'node:http'
import {createHash} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs'
import {dirname,join,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {spawnSync} from 'node:child_process'
import {createOpencodeClient} from '../../plugin/node_modules/@opencode-ai/sdk/dist/v2/client.js'
import {WorkloadAcceptanceHarness} from './harness-core.mjs'
import {OwnedProcessManager} from './process-owner.mjs'
import {selectTestModel} from './model-pool.mjs'
import {prepareOperatorControlRoot} from './isolation.mjs'
import {promptIdentity,oracleIdentity} from './workload-spec.mjs'
import {runHiddenOracle} from './oracle-runner.mjs'
import {assessHarnessLiveness} from './liveness-adapter.mjs'
import {executionObservation} from './execution-observation.mjs'
import {roleAcceptanceObservation} from './role-observation.mjs'
import {cleanupOwnedResources} from './cleanup.mjs'

const ROOT=resolve(fileURLToPath(new URL('../..',import.meta.url)))
const WROOT=join(ROOT,'.agent-work','workload-acceptance')
const RUNTIME_ROOT=join(WROOT,'runtime')
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const dataOf=x=>x&&typeof x==='object'&&'data' in x?x.data:x
const shaFile=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
const git=(args,cwd=ROOT)=>{const r=spawnSync('git',['-c',`safe.directory=${cwd}`,...args],{cwd,encoding:'utf8'});if(r.status!==0)throw new Error(String(r.stderr||`git ${args.join(' ')} failed`).trim());return r.stdout.trim()}

export function normalizeLiveModels(rows=[]){
  const out=[]
  for(const row of rows){
    if(!row||typeof row!=='object')continue
    const provider=String(row.providerID??row.provider_id??''),id=String(row.id??'')
    if(!provider||!id)continue
    const input=row.capabilities?.input??{},output=row.capabilities?.output??{},caps=[]
    if(input.text===true||output.text===true)caps.push('text')
    if(input.image===true||output.image===true)caps.push('image')
    if(input.audio===true||output.audio===true)caps.push('audio')
    if(input.video===true||output.video===true)caps.push('video')
    if(input.pdf===true)caps.push('pdf')
    out.push({id:`${provider}/${id}`,capabilities:caps,status:row.status??null})
  }
  return out
}
export function missionTerminalStatus(status){return ['completed','stopped','failed','waiting-user'].includes(String(status??''))}
export function modelIdentity(id){const at=id.indexOf('/');if(at<1||at===id.length-1)throw new Error(`INVALID_MODEL_ID:${id}`);return{providerID:id.slice(0,at),modelID:id.slice(at+1)}}
export async function freePort(){return await new Promise((resolvePort,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const a=s.address();const p=typeof a==='object'&&a?a.port:0;s.close(e=>e?reject(e):resolvePort(p))})})}
export function writeSourcePluginConfig(fixtureRoot){
  const config=join(fixtureRoot,'opencode.json')
  writeFileSync(config,JSON.stringify({plugin:[pathToFileURL(join(ROOT,'plugin','dist','plugin.js')).href]},null,2)+'\n')
  const info=join(fixtureRoot,'.git','info');mkdirSync(info,{recursive:true});writeFileSync(join(info,'exclude'),'opencode.json\n.opencode/\n')
  return config
}
function copySeed(seed,dest){rmSync(dest,{recursive:true,force:true});mkdirSync(dirname(dest),{recursive:true});const r=spawnSync('cp',['-a',seed,dest],{encoding:'utf8'});if(r.status!==0)throw new Error(`FIXTURE_COPY_FAILED:${r.stderr}`)}
function initFixtureGit(fixture){
  git(['init','-q'],fixture);git(['config','user.email','w-harness@invalid.local'],fixture);git(['config','user.name','W Acceptance Harness'],fixture);git(['add','-A'],fixture);git(['commit','-q','-m','fixture baseline'],fixture)
  return git(['rev-parse','HEAD'],fixture)
}
function findRuntimeState(stateRoot){
  const r=spawnSync('find',[stateRoot,'-path','*/projects/*/runtime-state.json','-type','f','-print','-quit'],{encoding:'utf8'});return r.status===0?r.stdout.trim():''
}
function readJsonMaybe(path){try{return JSON.parse(readFileSync(path,'utf8'))}catch{return undefined}}
function processAlive(pid){try{process.kill(Number(pid),0);return true}catch{return false}}
async function health(base){try{const r=await fetch(`${base}/global/health`,{signal:AbortSignal.timeout(2000)});return r.ok?await r.json():undefined}catch{return undefined}}
async function toolIds(base,directory){try{const u=new URL(`${base}/experimental/tool/ids`);u.searchParams.set('directory',directory);const r=await fetch(u,{signal:AbortSignal.timeout(3000)});if(!r.ok)return[];const x=dataOf(await r.json());return Array.isArray(x)?x:[]}catch{return[]}}
function hostStatusMap(payload){const raw=dataOf(payload);const out={};if(raw&&typeof raw==='object'&&!Array.isArray(raw))for(const [id,row] of Object.entries(raw)){const t=String(row?.type??'').toLowerCase();out[id]=t==='busy'||t==='retry'||t==='idle'?t:'unknown'}return out}
function roleRows(mission,selectedModel){
  const tasks=new Map((mission?.execution?.tasks??[]).map(t=>[t.id,t]))
  return (mission?.execution?.workers??[]).map(w=>{const t=tasks.get(w.task_id);return roleAcceptanceObservation({taskId:w.task_id,semantics:t?.semantics??[],requiredCapabilities:t?.required_capabilities??[],expectedRole:t?.role??w.role,actualRole:w.role,permissionProfile:w.permission_profile??null,methodologies:w.methodologies??[],tools:w.tools??[],evidenceOwner:w.id,selectedModel:w.model??selectedModel})})
}
function runtimeProjection(parentID,mission,serverRecord,statusMap){return executionObservation({sessionId:parentID,tasks:mission?.execution?.tasks??[],workers:mission?.execution?.workers??[],processes:[{process_id:'opencode-server',status:serverRecord?.status??'RUNNING',pid:serverRecord?.pid,pgid:serverRecord?.pgid,run_id:serverRecord?.run_id,workload_id:serverRecord?.workload_id}],terminalStatus:mission?.identity?.status??null})}

export async function executeWorkload(workloadId,{pollMs=1500}={}){
  const specPath=join(WROOT,workloadId,'spec.json'),spec=JSON.parse(readFileSync(specPath,'utf8')),promptPath=join(ROOT,spec.visiblePrompt),fixture=join(ROOT,spec.fixture.root),seed=join(ROOT,spec.fixture.resetProcedure.immutableSeed),oraclePath=join(ROOT,spec.hiddenOracle.path)
  if(spec.id!==workloadId)throw new Error('WORKLOAD_SPEC_ID_MISMATCH')
  const productHead=git(['rev-parse','HEAD']),originHead=git(['rev-parse','origin/dev']);if(productHead!==originHead)throw new Error('PRODUCT_ORIGIN_DIVERGED')
  const target=JSON.parse(readFileSync(join(ROOT,'package.json'),'utf8')).dependencies?.['@opencode-ai/sdk'];const exactBin=join(ROOT,'.agent-work','tools',`opencode-${target}`,'opencode')
  if(!existsSync(exactBin))throw new Error(`EXACT_OPENCODE_MISSING:${exactBin}`);const observed=spawnSync(exactBin,['--version'],{encoding:'utf8'}).stdout.trim();if(observed!==target)throw new Error(`EXACT_OPENCODE_VERSION_MISMATCH:${observed}:${target}`)
  const harness=new WorkloadAcceptanceHarness({stateRoot:RUNTIME_ROOT,productIdentity:{head:productHead,origin_dev:originHead,opencode:target,opencode_binary_sha256:shaFile(exactBin)},liveInventory:[],sessionProbe:async()=> 'unknown',processProbe:processAlive})
  const run=await harness.preflight(spec,{conditionFingerprint:`${productHead}:${target}:${spec.fixture.baseline.value}:${shaFile(promptPath)}:${shaFile(oraclePath)}`,prepareFixture:async()=>copySeed(seed,fixture)})
  if(run.disposition!=='READY_TO_EXECUTE')return run
  const {runId,lock,receipts}=run,runDir=join(RUNTIME_ROOT,workloadId,'runs',runId),controlRoot=prepareOperatorControlRoot(join(runDir,'operator-control'),fixture),scratch=join(controlRoot,'oracle-scratch'),hiState=join(controlRoot,'hi-state'),tmp=join(controlRoot,'tmp');for(const p of [scratch,hiState,tmp])mkdirSync(p,{recursive:true,mode:0o700})
  let serverRecord,pm,parentID,client,cleanupResult,finalMission,finalLiveness,selected
  const runMetaPath=join(runDir,'run-meta.json'),runtimeObservationPath=join(runDir,'runtime-observation.json')
  const writeMeta=patch=>{const current=readJsonMaybe(runMetaPath)??{schema:1,workload_id:workloadId,run_id:runId,predecessor_run_id:null,started_at:new Date().toISOString()};writeFileSync(runMetaPath,JSON.stringify({...current,...patch,updated_at:new Date().toISOString()},null,2)+'\n',{mode:0o600})}
  try{
    const fixtureHead=initFixtureGit(fixture);writeSourcePluginConfig(fixture)
    receipts.write('prompt-identity',promptIdentity(promptPath));receipts.write('oracle-identity',oracleIdentity({path:oraclePath,version:spec.hiddenOracle.version,fixtureIdentity:spec.fixture.baseline.value}))
    receipts.write('tool-preflight',{status:'PASS',exact_opencode:{path:exactBin,version:target,sha256:shaFile(exactBin)},plugin_entrypoint:join(ROOT,'plugin','dist','plugin.js'),fixture_git_head:fixtureHead})
    const port=await freePort(),base=`http://127.0.0.1:${port}`;pm=new OwnedProcessManager(runDir)
    serverRecord=await pm.spawn({runId,workloadId,command:exactBin,args:['serve','--hostname','127.0.0.1','--port',String(port),'--print-logs','--log-level','INFO'],cwd:fixture,env:{OPENCODE_HI_STATE_DIR:hiState,TMPDIR:tmp,TMP:tmp,TEMP:tmp},readiness:{kind:'probe',timeoutMs:30000,intervalMs:250,probe:async()=>{const h=await health(base);return h?.healthy===true&&h?.version===target}}})
    const ids=await toolIds(base,fixture);if(!ids.some(x=>String(x).startsWith('hi_')))throw new Error('HI_TOOL_SURFACE_NOT_LOADED')
    client=createOpencodeClient({baseUrl:base,directory:fixture})
    const models=dataOf(await client.v2.model.list({location:{directory:fixture}}))??[],live=normalizeLiveModels(Array.isArray(models)?models:models?.data??[]),pool=JSON.parse(readFileSync(join(WROOT,'model-pool.json'),'utf8')).models
    selected=selectTestModel({liveInventory:live,pool,requiredCapabilities:spec.requiredCapabilities})
    receipts.write('model-role-selection',{scope:'w-development-test-only',required_capabilities:spec.requiredCapabilities,selected_model:selected.model.id,eligible:selected.eligible,rejected:selected.rejected,reason:selected.reason})
    const mi=modelIdentity(selected.model.id),created=dataOf(await client.session.create({directory:fixture,title:`W acceptance ${workloadId} ${runId}`,model:{id:mi.modelID,providerID:mi.providerID}}));if(!created?.id)throw new Error('PARENT_SESSION_CREATE_FAILED');parentID=created.id
    writeMeta({status:'ACTIVE',product_sha:productHead,opencode_version:target,model:selected.model.id,parent_session_id:parentID,server:serverRecord,base_url:base,runtime_state:null})
    const prompt=readFileSync(promptPath,'utf8');const ack=await client.session.promptAsync({sessionID:parentID,directory:fixture,model:mi,parts:[{type:'text',text:prompt}]},{throwOnError:true});if(ack?.error)throw new Error(`PROMPT_ASYNC_REJECTED:${JSON.stringify(ack.error)}`)
    for(;;){
      const statuses=hostStatusMap(await client.session.status({directory:fixture})),children=dataOf(await client.session.children({sessionID:parentID,directory:fixture}))??[],statePath=findRuntimeState(hiState),state=statePath?readJsonMaybe(statePath):undefined,mission=state?.missions?.[0]
      const liveness=mission?assessHarnessLiveness(mission,{hostSessions:statuses}):{state:'RECONCILE',inflight:statuses[parentID]==='busy'||statuses[parentID]==='retry'?'YES':'UNKNOWN',destructive_recovery_allowed:false,reasons:['runtime-state-not-yet-observed']}
      const observation=runtimeProjection(parentID,mission,serverRecord,statuses);writeFileSync(runtimeObservationPath,JSON.stringify({schema:1,run_id:runId,observed_at:new Date().toISOString(),parent_session_id:parentID,child_sessions:(Array.isArray(children)?children:[]).map(x=>({id:x.id,parentID:x.parentID})),host_statuses:statuses,runtime_state:statePath||null,liveness,execution:observation},null,2)+'\n',{mode:0o600});writeMeta({runtime_state:statePath||null,parent_status:statuses[parentID]??'idle',child_session_ids:(Array.isArray(children)?children:[]).map(x=>x.id),liveness})
      if(missionTerminalStatus(mission?.identity?.status)){finalMission=mission;finalLiveness=liveness;break}
      if(liveness.state==='STALLED'&&liveness.inflight==='NO'&&liveness.destructive_recovery_allowed){finalMission=mission;finalLiveness=liveness;break}
      await sleep(pollMs)
    }
    receipts.write('execution',{parent_session_id:parentID,terminal_status:finalMission?.identity?.status??null,liveness:finalLiveness,observation:runtimeProjection(parentID,finalMission,serverRecord,{})})
    receipts.write('liveness',finalLiveness)
    receipts.write('role-acceptance',{observations:roleRows(finalMission,selected.model.id)})
    const oracle=await runHiddenOracle({oraclePath,fixtureRoot:fixture,harnessRoot:join(ROOT,'scripts','workload-acceptance'),command:process.execPath,args:[oraclePath],cwd:ROOT,env:{W_FIXTURE_ROOT:fixture,W_ORACLE_SCRATCH_ROOT:scratch},identity:receipts.read('oracle-identity').identity,fixtureIdentity:spec.fixture.baseline.value,timeoutMs:30000})
    let parsed;try{parsed=JSON.parse(oracle.stdout)}catch{parsed=null}const oraclePass=oracle.exit_code===0&&parsed?.failed===0
    receipts.write('oracle-result',{passed:oraclePass,exit_code:oracle.exit_code,signal:oracle.signal,stdout_sha256:oracle.stdout_sha256,stderr_sha256:oracle.stderr_sha256,result:parsed})
    const missionPass=finalMission?.identity?.status==='completed',stalled=finalLiveness?.state==='STALLED';let classification
    if(missionPass&&oraclePass)classification={result:'PASS',class:null,root_cause:null,product_repair_authorized:false}
    else if(stalled)classification={result:'FAIL',class:'INCONCLUSIVE',root_cause:'Canonical liveness declared STALLED with exact inflight NO; destructive replacement is not performed automatically by the common driver.',product_repair_authorized:false}
    else classification={result:'FAIL',class:'WORKLOAD_RESULT_FAILURE',root_cause:'Terminal workload result and/or hidden oracle did not pass. Oracle truth does not diagnose a product defect.',product_repair_authorized:false}
    receipts.write('classification',classification)
    for(const child of (dataOf(await client.session.children({sessionID:parentID,directory:fixture}))??[]))try{await client.session.delete({sessionID:child.id,directory:fixture})}catch{}
    try{await client.session.delete({sessionID:parentID,directory:fixture})}catch{}
    cleanupResult=await cleanupOwnedResources(runId,[{kind:'process',ownerRunId:runId,manager:pm,contract:serverRecord,options:{graceMs:1500}},{kind:'path',ownerRunId:runId,path:controlRoot,root:runDir},{kind:'lock',ownerRunId:runId,lock}])
    receipts.write('cleanup',{cleaned:cleanupResult.cleaned.map(x=>({kind:x.kind,path:x.path??null,pid:x.contract?.pid??null})),skipped:cleanupResult.skipped.length,quarantined:cleanupResult.quarantined})
    const success=missionPass&&oraclePass&&cleanupResult.quarantined.length===0;receipts.write('summary',{status:success?'PASS':'FAIL',workload_id:workloadId,product_sha:productHead,model:selected.model.id,parent_session_id:parentID,mission_status:finalMission?.identity?.status??null,oracle_pass:oraclePass,classification:classification.class,fixture_preserved:spec.cleanup?.preserveFixture===true})
    writeMeta({status:success?'TERMINAL_PASS':'TERMINAL_FAIL',ended_at:new Date().toISOString(),mission_status:finalMission?.identity?.status??null,oracle_pass:oraclePass,classification:classification.class,cleanup_quarantined:cleanupResult.quarantined.length})
    return{disposition:success?'TERMINAL_PASS':'TERMINAL_FAIL',run_id:runId,run_dir:runDir,parent_session_id:parentID,model:selected.model.id,mission_status:finalMission?.identity?.status??null,oracle_pass:oraclePass,classification:classification.class,cleanup_quarantined:cleanupResult.quarantined.length}
  }catch(error){
    writeMeta({status:'SUPERVISOR_ERROR',error:String(error?.stack??error)})
    if(parentID&&client)try{await client.session.abort({sessionID:parentID,directory:fixture})}catch{}
    const resources=[];if(serverRecord&&pm)resources.push({kind:'process',ownerRunId:runId,manager:pm,contract:serverRecord,options:{graceMs:1500}});if(existsSync(controlRoot))resources.push({kind:'path',ownerRunId:runId,path:controlRoot,root:runDir});resources.push({kind:'lock',ownerRunId:runId,lock});try{cleanupResult=await cleanupOwnedResources(runId,resources)}catch{}
    try{receipts.write('classification',{result:'FAIL',class:'HARNESS_DEFECT',root_cause:String(error?.message??error),product_repair_authorized:false})}catch{}
    try{receipts.write('cleanup',{error_cleanup:true,quarantined:cleanupResult?.quarantined??[]})}catch{}
    try{receipts.write('summary',{status:'FAIL',workload_id:workloadId,classification:'HARNESS_DEFECT',error:String(error?.message??error)})}catch{}
    throw error
  }
}
