import {createServer} from 'node:http'
import {createHash} from 'node:crypto'
import {accessSync,chownSync,existsSync,lchownSync,lstatSync,mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync,constants as fsConstants} from 'node:fs'
import {dirname,join,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {spawnSync} from 'node:child_process'
import {createOpencodeClient} from '../../plugin/node_modules/@opencode-ai/sdk/dist/v2/client.js'
import {WorkloadAcceptanceHarness} from './harness-core.mjs'
import {OwnedProcessManager} from './process-owner.mjs'
import {expandTestPool,selectTestModel} from './model-pool.mjs'
import {prepareOperatorControlRoot} from './isolation.mjs'
import {assertHiddenOracle,assertWorkloadSpec,promptIdentity,oracleIdentity} from './workload-spec.mjs'
import {fixtureIdentity} from './fixture-manager.mjs'
import {runHiddenOracle} from './oracle-runner.mjs'
import {assessHarnessLiveness} from './liveness-adapter.mjs'
import {executionObservation} from './execution-observation.mjs'
import {roleAcceptanceObservation} from './role-observation.mjs'
import {cleanupOwnedResources} from './cleanup.mjs'
import {readEffectiveReceipt} from './receipts.mjs'
import {resolveCatalogEntry} from './catalog.mjs'

const ROOT=resolve(fileURLToPath(new URL('../..',import.meta.url)))
const WROOT=join(ROOT,'.agent-work','workload-acceptance')
const RUNTIME_ROOT=join(WROOT,'runtime')
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
export const W_PRIMARY_AGENT='working-manager'
const dataOf=x=>x&&typeof x==='object'&&'data' in x?x.data:x
const shaFile=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
const identityOptions=identity=>identity?{uid:identity.uid,gid:identity.gid,env:{...process.env,HOME:identity.home,USER:identity.name,LOGNAME:identity.name}}:{}
const git=(args,cwd=ROOT,identity)=>{const io=identityOptions(identity),r=spawnSync('git',['-c',`safe.directory=${cwd}`,...args],{cwd,encoding:'utf8',...io});if(r.status!==0)throw new Error(String(r.stderr||`git ${args.join(' ')} failed`).trim());return r.stdout.trim()}
export function resolveRuntimeIdentity(name=process.env.W_MODEL_RUNTIME_USER??'node'){
  const row=spawnSync('getent',['passwd',name],{encoding:'utf8'});if(row.status!==0||!row.stdout.trim())throw new Error(`MODEL_RUNTIME_USER_NOT_FOUND:${name}`)
  const parts=row.stdout.trim().split(':'),uid=Number(parts[2]),gid=Number(parts[3]),home=parts[5]
  if(!Number.isInteger(uid)||!Number.isInteger(gid)||!home)throw new Error(`MODEL_RUNTIME_IDENTITY_INVALID:${name}`)
  return{name,uid,gid,home}
}
export function assertOperatorRuntimeSeparation(oraclePath,identity){
  accessSync(oraclePath,fsConstants.R_OK)
  if(process.getuid?.()===identity.uid)throw new Error('MODEL_OPERATOR_UID_NOT_SEPARATED')
  const probe=spawnSync(process.execPath,['-e','require("node:fs").accessSync(process.argv[1],require("node:fs").constants.R_OK)',oraclePath],{stdio:'ignore',...identityOptions(identity)})
  if(probe.status===0)throw new Error('HIDDEN_ORACLE_READABLE_BY_MODEL_RUNTIME')
  return true
}

export function buildRuntimeEnvironment(identity,{hiState,tmp}){
  if(!identity?.name||!identity?.home||!hiState||!tmp)throw new Error('MODEL_RUNTIME_ENVIRONMENT_INVALID')
  return{HOME:identity.home,USER:identity.name,LOGNAME:identity.name,OPENCODE_HI_STATE_DIR:hiState,OPENCODE_EXPERIMENTAL_WORKSPACES:'true',TMPDIR:tmp,TMP:tmp,TEMP:tmp}
}

function containedPath(root,path){const base=resolve(root),target=resolve(path);return target===base||target.startsWith(base+'/')}
function commandEscapesFixture(command,fixture){
  if(/(^|\s)cd\s+\.\.(?:\s|$)/.test(command))return true
  for(const raw of command.match(/(?:^|[\s'"=])((?:\.\.\/|\/)[^\s'";|&()<>]*)/g)??[]){const token=raw.trim().replace(/^['"=]/,'');if(!token)continue;const target=token.startsWith('/')?token:resolve(fixture,token);if(!containedPath(fixture,target))return true}
  return false
}
export function classifyWPermissionRequest(request,{fixture,parentID,childSessionIDs=[]}){
  const owned=new Set([parentID,...childSessionIDs].filter(Boolean))
  if(!owned.has(request?.sessionID))return{action:'IGNORE',reason:'other-session'}
  if(request?.permission==='bash'){
    const command=String(request?.metadata?.command??'').trim()
    if(command&&!commandEscapesFixture(command,fixture))return{action:'ALLOW_ONCE',reason:'fixture-local-bash'}
    return{action:'REJECT_TERMINAL',reason:'bash-scope-escape-or-unclassified'}
  }
  return{action:'REJECT_TERMINAL',reason:`unexpected-permission:${String(request?.permission??'unknown')}`}
}
async function pendingPermissions(base,directory){const u=new URL(`${base}/permission`);u.searchParams.set('directory',directory);const r=await fetch(u,{signal:AbortSignal.timeout(3000)});if(!r.ok)throw new Error(`PERMISSION_LIST_FAILED:${r.status}`);const value=dataOf(await r.json());return Array.isArray(value)?value:[]}
async function replyPermission(base,directory,id,reply){const u=new URL(`${base}/permission/${encodeURIComponent(id)}/reply`);u.searchParams.set('directory',directory);const r=await fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reply}),signal:AbortSignal.timeout(3000)});if(!r.ok)throw new Error(`PERMISSION_REPLY_FAILED:${id}:${r.status}`);return true}
async function assertWPrimaryAgent(base,directory){const u=new URL(`${base}/agent`);u.searchParams.set('directory',directory);const r=await fetch(u,{signal:AbortSignal.timeout(3000)});if(!r.ok)throw new Error(`AGENT_INVENTORY_FAILED:${r.status}`);const rows=dataOf(await r.json()),agent=Array.isArray(rows)?rows.find(x=>x?.name===W_PRIMARY_AGENT):undefined;if(!agent||agent.mode!=='primary')throw new Error(`W_PRIMARY_AGENT_UNAVAILABLE:${W_PRIMARY_AGENT}`);const wildcard=(permission)=>[...(agent.permission??[])].filter(x=>x?.permission===permission&&x?.pattern==='*').at(-1)?.action;if(wildcard('external_directory')!=='deny')throw new Error('W_PRIMARY_AGENT_EXTERNAL_DIRECTORY_NOT_DENIED');if(!['ask','deny'].includes(wildcard('bash')))throw new Error('W_PRIMARY_AGENT_BASH_NOT_BOUNDED');return agent}
function setTreeOwnership(path,identity){const s=lstatSync(path);if(s.isSymbolicLink()){lchownSync(path,identity.uid,identity.gid);return}if(s.isDirectory())for(const name of readdirSync(path))setTreeOwnership(join(path,name),identity);chownSync(path,identity.uid,identity.gid)}
function prepareRuntimeSandbox(path,identity){mkdirSync(path,{recursive:true,mode:0o700});chownSync(path,identity.uid,identity.gid);return path}

export function normalizeLiveModels(rows=[]){
  const out=[]
  for(const row of rows){
    if(!row||typeof row!=='object')continue
    const provider=String(row.providerID??row.provider_id??''),id=String(row.id??'')
    if(!provider||!id)continue
    const input=row.capabilities?.input??{},output=row.capabilities?.output??{},caps=[]
    const has=(surface,key)=>Array.isArray(surface)?surface.includes(key):surface?.[key]===true
    if(has(input,'text')||has(output,'text'))caps.push('text')
    if(has(input,'image')||has(output,'image'))caps.push('image')
    if(has(input,'audio')||has(output,'audio'))caps.push('audio')
    if(has(input,'video')||has(output,'video'))caps.push('video')
    if(has(input,'pdf'))caps.push('pdf')
    const cost=row.cost,zeroCost=Boolean(cost&&cost.input===0&&cost.output===0&&[...function* values(x){if(typeof x==='number')yield x;else if(x&&typeof x==='object')for(const v of Object.values(x))yield* values(v)}(cost)].every(x=>x===0))
    out.push({id:`${provider}/${id}`,capabilities:caps,status:row.status??null,zeroCost})
  }
  return out
}
export function parseVerboseModelInventory(stdout){
  const rows=[],lines=String(stdout??'').split(/\r?\n/);let announced=null,buffer='',depth=0,inString=false,escaped=false
  const consume=line=>{for(const ch of line){if(escaped){escaped=false;continue}if(inString&&ch==='\\'){escaped=true;continue}if(ch==='"'){inString=!inString;continue}if(inString)continue;if(ch==='{')depth++;else if(ch==='}')depth--}}
  for(const line of lines){
    const trimmed=line.trim()
    if(!buffer&&/^[^\s/]+\/[^\s/]+$/.test(trimmed)){announced=trimmed;continue}
    if(announced&&!buffer&&trimmed.startsWith('{')){buffer=line;consume(line)}
    else if(buffer){buffer+=`\n${line}`;consume(line)}
    if(buffer&&depth===0&&!inString){const row=JSON.parse(buffer),id=`${row.providerID??''}/${row.id??''}`;if(id!==announced)throw new Error(`MODEL_INVENTORY_ID_MISMATCH:${announced}:${id}`);rows.push(row);announced=null;buffer=''}
  }
  if(buffer||announced||depth!==0||inString)throw new Error('MODEL_INVENTORY_TRUNCATED')
  return rows
}
export function readLiveModelInventory(exactBin,identity){
  const r=spawnSync(exactBin,['models','--verbose'],{encoding:'utf8',...identityOptions(identity),maxBuffer:64*1024*1024})
  if(r.status!==0)throw new Error(`MODEL_INVENTORY_FAILED:${String(r.stderr||'').trim()}`)
  return normalizeLiveModels(parseVerboseModelInventory(r.stdout))
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
function copySeed(seed,dest,identity){rmSync(dest,{recursive:true,force:true});mkdirSync(dirname(dest),{recursive:true});const r=spawnSync('cp',['-a',seed,dest],{encoding:'utf8'});if(r.status!==0)throw new Error(`FIXTURE_COPY_FAILED:${r.stderr}`);setTreeOwnership(dest,identity)}
function initFixtureGit(fixture,identity){
  git(['init','-q'],fixture,identity);git(['config','user.email','w-harness@invalid.local'],fixture,identity);git(['config','user.name','W Acceptance Harness'],fixture,identity);git(['add','-A'],fixture,identity);git(['commit','-q','-m','fixture baseline'],fixture,identity)
  return git(['rev-parse','HEAD'],fixture,identity)
}
function findRuntimeState(stateRoot){
  const r=spawnSync('find',[stateRoot,'-path','*/projects/*/runtime-state.json','-type','f','-print','-quit'],{encoding:'utf8'});return r.status===0?r.stdout.trim():''
}
function readJsonMaybe(path){try{return JSON.parse(readFileSync(path,'utf8'))}catch{return undefined}}

export function discoverTerminalPredecessor(stateRoot,workloadId){
  const runsRoot=join(stateRoot,workloadId,'runs')
  if(!existsSync(runsRoot))return null
  const candidates=[]
  for(const entry of readdirSync(runsRoot,{withFileTypes:true})){
    if(!entry.isDirectory())continue
    const runId=entry.name,receiptsRoot=join(runsRoot,runId,'receipts'),summaryPath=join(receiptsRoot,'summary.json')
    if(!existsSync(summaryPath))continue
    const read=name=>{const path=join(receiptsRoot,`${name}.json`);if(!existsSync(path))throw new Error(`TERMINAL_PREDECESSOR_RECEIPT_MISSING:${runId}:${name}`);return readEffectiveReceipt(receiptsRoot,name,runId)}
    const identity=read('run-identity'),lineage=read('lineage'),classification=read('classification'),cleanup=read('cleanup'),summary=read('summary')
    for(const [kind,row] of [['run-identity',identity],['lineage',lineage],['classification',classification],['cleanup',cleanup],['summary',summary]])if(row.run_id!==runId)throw new Error(`PREDECESSOR_RUN_ID_MISMATCH:${runId}:${kind}:${String(row.run_id)}`)
    if(identity.workload_id!==workloadId||summary.workload_id!==workloadId)throw new Error(`PREDECESSOR_WORKLOAD_ID_MISMATCH:${runId}`)
    if(!['PASS','FAIL'].includes(summary.status))throw new Error(`PREDECESSOR_SUMMARY_NOT_TERMINAL:${runId}:${String(summary.status)}`)
    if(Array.isArray(cleanup.quarantined)&&cleanup.quarantined.length)throw new Error(`PREDECESSOR_CLEANUP_QUARANTINED:${runId}`)
    const conditionFingerprint=lineage.condition_fingerprint??identity.condition_fingerprint
    if(typeof conditionFingerprint!=='string'||!conditionFingerprint)throw new Error(`PREDECESSOR_CONDITION_MISSING:${runId}`)
    const match=new RegExp(`^${workloadId}-([0-9a-z]+)-`).exec(runId)
    if(!match)throw new Error(`PREDECESSOR_RUN_ID_FORMAT_INVALID:${runId}`)
    const ordinal=Number.parseInt(match[1],36);if(!Number.isFinite(ordinal))throw new Error(`PREDECESSOR_RUN_ID_FORMAT_INVALID:${runId}`)
    let repairReceipt=null,repairPath=join(receiptsRoot,'repair.json')
    if(existsSync(repairPath)){
      const repair=readEffectiveReceipt(receiptsRoot,'repair',runId)
      if(repair.run_id!==runId||repair.predecessor_run_id!==runId)throw new Error(`PREDECESSOR_REPAIR_ID_MISMATCH:${runId}`)
      if(repair.verified===true)repairReceipt=repair
    }
    candidates.push({run_id:runId,condition_fingerprint:conditionFingerprint,repair_receipt:repairReceipt,summary_status:summary.status,classification:classification.class,ordinal})
  }
  candidates.sort((a,b)=>b.ordinal-a.ordinal||b.run_id.localeCompare(a.run_id))
  return candidates[0]??null
}
function processAlive(pid){try{process.kill(Number(pid),0);return true}catch{return false}}
async function health(base){try{const r=await fetch(`${base}/global/health`,{signal:AbortSignal.timeout(2000)});return r.ok?await r.json():undefined}catch{return undefined}}
async function toolIds(base,directory){try{const u=new URL(`${base}/experimental/tool/ids`);u.searchParams.set('directory',directory);const r=await fetch(u,{signal:AbortSignal.timeout(3000)});if(!r.ok)return[];const x=dataOf(await r.json());return Array.isArray(x)?x:[]}catch{return[]}}
function hostStatusMap(payload){const raw=dataOf(payload);const out={};if(raw&&typeof raw==='object'&&!Array.isArray(raw))for(const [id,row] of Object.entries(raw)){const t=String(row?.type??'').toLowerCase();out[id]=t==='busy'||t==='retry'||t==='idle'?t:'unknown'}return out}
function roleRows(mission,selectedModel){
  const tasks=new Map((mission?.execution?.tasks??[]).map(t=>[t.id,t]))
  return (mission?.execution?.workers??[]).map(w=>{const t=tasks.get(w.task_id);return roleAcceptanceObservation({taskId:w.task_id,semantics:t?.semantics??[],requiredCapabilities:t?.required_capabilities??[],expectedRole:t?.role??w.role,actualRole:w.role,permissionProfile:w.permission_profile??null,methodologies:w.methodologies??[],tools:w.tools??[],evidenceOwner:w.id,selectedModel:w.model??selectedModel})})
}
function runtimeProjection(parentID,mission,serverRecord,statusMap){return executionObservation({sessionId:parentID,tasks:mission?.execution?.tasks??[],workers:mission?.execution?.workers??[],processes:[{process_id:'opencode-server',status:serverRecord?.status??'RUNNING',pid:serverRecord?.pid,pgid:serverRecord?.pgid,run_id:serverRecord?.run_id,workload_id:serverRecord?.workload_id}],terminalStatus:mission?.identity?.status??null})}

export function requireReadyAdmission(run){
  if(run?.disposition!=='READY_TO_EXECUTE')throw new Error('READY_ADMISSION_DISPOSITION_INVALID')
  const runId=run.run_id
  if(typeof runId!=='string'||!runId.trim())throw new Error('READY_ADMISSION_RUN_ID_MISSING')
  const receiptRunId=run.receipts?.read?.('run-identity')?.run_id,lockRunId=run.lock?.runId
  if(receiptRunId!==runId||lockRunId!==runId)throw new Error(`READY_ADMISSION_RUN_ID_MISMATCH:${runId}:${String(receiptRunId)}:${String(lockRunId)}`)
  return{runId,lock:run.lock,receipts:run.receipts}
}

export function resolveExecutionContract(workloadId,spec){
  assertWorkloadSpec(spec)
  if(spec.id!==workloadId)throw new Error('WORKLOAD_SPEC_ID_MISMATCH')
  const promptPath=resolve(ROOT,spec.visiblePrompt),fixture=resolve(ROOT,spec.fixture.root),seed=resolve(ROOT,spec.fixture.seed),oraclePath=resolve(ROOT,spec.hiddenOracle.path)
  if(!existsSync(promptPath))throw new Error(`WORKLOAD_PROMPT_MISSING:${promptPath}`)
  if(!existsSync(seed))throw new Error(`WORKLOAD_FIXTURE_SEED_MISSING:${seed}`)
  if(!existsSync(oraclePath))throw new Error(`WORKLOAD_ORACLE_MISSING:${oraclePath}`)
  const seedIdentity=fixtureIdentity(seed)
  if(seedIdentity!==spec.fixture.baseline.value)throw new Error(`WORKLOAD_FIXTURE_SEED_BASELINE_MISMATCH:${seedIdentity}`)
  return{promptPath,fixture,seed,oraclePath,seedIdentity}
}

export async function executeWorkload(workloadId,{pollMs=1500}={}){
  const entry=resolveCatalogEntry(workloadId),spec=JSON.parse(readFileSync(entry.spec_path,'utf8')),{promptPath,fixture,seed,oraclePath,seedIdentity}=resolveExecutionContract(workloadId,spec)
  const productHead=git(['rev-parse','HEAD']),originHead=git(['rev-parse','origin/dev']);if(productHead!==originHead)throw new Error('PRODUCT_ORIGIN_DIVERGED')
  const target=JSON.parse(readFileSync(join(ROOT,'package.json'),'utf8')).dependencies?.['@opencode-ai/sdk'];const exactBin=join(ROOT,'.agent-work','tools',`opencode-${target}`,'opencode')
  if(!existsSync(exactBin))throw new Error(`EXACT_OPENCODE_MISSING:${exactBin}`);const observed=spawnSync(exactBin,['--version'],{encoding:'utf8'}).stdout.trim();if(observed!==target)throw new Error(`EXACT_OPENCODE_VERSION_MISMATCH:${observed}:${target}`)
  const runtimeIdentity=resolveRuntimeIdentity();assertHiddenOracle({oraclePath,fixtureRoot:fixture,harnessRoot:join(ROOT,'scripts','workload-acceptance')});assertOperatorRuntimeSeparation(oraclePath,runtimeIdentity)
  const harness=new WorkloadAcceptanceHarness({stateRoot:RUNTIME_ROOT,productIdentity:{head:productHead,origin_dev:originHead,opencode:target,opencode_binary_sha256:shaFile(exactBin)},liveInventory:[],sessionProbe:async()=> 'unknown',processProbe:processAlive})
  const conditionFingerprint=`${productHead}:${target}:${spec.fixture.baseline.value}:${shaFile(promptPath)}:${shaFile(oraclePath)}`,predecessor=discoverTerminalPredecessor(RUNTIME_ROOT,workloadId)
  const run=await harness.preflight(spec,{predecessor:predecessor?{run_id:predecessor.run_id,condition_fingerprint:predecessor.condition_fingerprint}:undefined,conditionFingerprint,repairReceipt:predecessor?.repair_receipt??undefined,prepareFixture:async()=>copySeed(seed,fixture,runtimeIdentity)})
  if(run.disposition!=='READY_TO_EXECUTE')return run
  const {runId,lock,receipts}=requireReadyAdmission(run),runDir=join(RUNTIME_ROOT,workloadId,'runs',runId)
  let controlRoot,scratch,runtimeSandbox,hiState,tmp,serverRecord,pm,parentID,client,cleanupResult,finalMission,finalLiveness,selected
  const runMetaPath=join(runDir,'run-meta.json'),runtimeObservationPath=join(runDir,'runtime-observation.json')
  const writeMeta=patch=>{const current=readJsonMaybe(runMetaPath)??{schema:1,workload_id:workloadId,run_id:runId,predecessor_run_id:predecessor?.run_id??null,started_at:new Date().toISOString()};writeFileSync(runMetaPath,JSON.stringify({...current,...patch,updated_at:new Date().toISOString()},null,2)+'\n',{mode:0o600})}
  try{
    controlRoot=prepareOperatorControlRoot(join(runDir,'operator-control'),fixture).path
    scratch=join(controlRoot,'oracle-scratch');mkdirSync(scratch,{recursive:true,mode:0o700})
    runtimeSandbox=prepareRuntimeSandbox(join(runDir,'model-runtime'),runtimeIdentity);hiState=prepareRuntimeSandbox(join(runtimeSandbox,'hi-state'),runtimeIdentity);tmp=prepareRuntimeSandbox(join(runtimeSandbox,'tmp'),runtimeIdentity)
    const fixtureHead=initFixtureGit(fixture,runtimeIdentity);writeSourcePluginConfig(fixture)
    receipts.write('prompt-identity',promptIdentity(promptPath));receipts.write('oracle-identity',oracleIdentity({path:oraclePath,version:spec.hiddenOracle.version,fixtureIdentity:spec.fixture.baseline.value}))
    receipts.write('tool-preflight',{status:'PASS',exact_opencode:{path:exactBin,version:target,sha256:shaFile(exactBin)},plugin_entrypoint:join(ROOT,'plugin','dist','plugin.js'),fixture_seed_identity:seedIdentity,fixture_git_head:fixtureHead,operator_uid:process.getuid?.()??null,model_runtime:{user:runtimeIdentity.name,uid:runtimeIdentity.uid,gid:runtimeIdentity.gid,oracle_readable:false}})
    const port=await freePort(),base=`http://127.0.0.1:${port}`,runtimeEnv=buildRuntimeEnvironment(runtimeIdentity,{hiState,tmp});pm=new OwnedProcessManager(runDir)
    serverRecord=await pm.spawn({runId,workloadId,command:exactBin,args:['serve','--hostname','127.0.0.1','--port',String(port),'--print-logs','--log-level','INFO'],cwd:fixture,env:runtimeEnv,uid:runtimeIdentity.uid,gid:runtimeIdentity.gid,readiness:{kind:'probe',timeoutMs:30000,intervalMs:250,probe:async()=>{const h=await health(base);return h?.healthy===true&&h?.version===target}}})
    const ids=await toolIds(base,fixture);if(!ids.some(x=>String(x).startsWith('hi_')))throw new Error('HI_TOOL_SURFACE_NOT_LOADED');await assertWPrimaryAgent(base,fixture)
    client=createOpencodeClient({baseUrl:base,directory:fixture})
    const configuredPool=JSON.parse(readFileSync(join(WROOT,'model-pool.json'),'utf8')).models,live=readLiveModelInventory(exactBin,runtimeIdentity),pool=expandTestPool(configuredPool,live)
    selected=selectTestModel({liveInventory:live,pool,requiredCapabilities:spec.requiredCapabilities})
    receipts.write('model-role-selection',{scope:'w-development-test-only',required_capabilities:spec.requiredCapabilities,selected_model:selected.model.id,eligible:selected.eligible,rejected:selected.rejected,reason:selected.reason})
    const mi=modelIdentity(selected.model.id),created=dataOf(await client.session.create({directory:fixture,agent:W_PRIMARY_AGENT,title:`W acceptance ${workloadId} ${runId}`,model:{id:mi.modelID,providerID:mi.providerID}}));if(!created?.id)throw new Error('PARENT_SESSION_CREATE_FAILED');parentID=created.id
    writeMeta({status:'ACTIVE',product_sha:productHead,opencode_version:target,model:selected.model.id,parent_session_id:parentID,server:serverRecord,base_url:base,runtime_state:null})
    const prompt=readFileSync(promptPath,'utf8');const ack=await client.session.promptAsync({sessionID:parentID,directory:fixture,agent:W_PRIMARY_AGENT,model:mi,parts:[{type:'text',text:prompt}]},{throwOnError:true});if(ack?.error)throw new Error(`PROMPT_ASYNC_REJECTED:${JSON.stringify(ack.error)}`)
    for(;;){
      const children=dataOf(await client.session.children({sessionID:parentID,directory:fixture}))??[],childSessionIDs=(Array.isArray(children)?children:[]).map(x=>x.id).filter(Boolean),permissions=await pendingPermissions(base,fixture);let scopeViolation=null;for(const permission of permissions){const decision=classifyWPermissionRequest(permission,{fixture,parentID,childSessionIDs});if(decision.action==='ALLOW_ONCE')await replyPermission(base,fixture,permission.id,'once');else if(decision.action==='REJECT_TERMINAL'){await replyPermission(base,fixture,permission.id,'reject');scopeViolation={permission,decision};break}}if(scopeViolation){await client.session.abort({sessionID:parentID,directory:fixture});const statePath=findRuntimeState(hiState),state=statePath?readJsonMaybe(statePath):undefined;finalMission=state?.missions?.[0];finalLiveness={state:'TERMINAL',inflight:'NO',destructive_recovery_allowed:false,reasons:['w-scope-violation']};writeMeta({scope_violation:{permission_id:scopeViolation.permission.id,permission:scopeViolation.permission.permission,reason:scopeViolation.decision.reason}});break}const statuses=hostStatusMap(await client.session.status({directory:fixture})),statePath=findRuntimeState(hiState),state=statePath?readJsonMaybe(statePath):undefined,mission=state?.missions?.[0]
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
    const missionPass=finalMission?.identity?.status==='completed',stalled=finalLiveness?.state==='STALLED',scopeViolated=finalLiveness?.reasons?.includes('w-scope-violation');let classification
    if(scopeViolated)classification={result:'FAIL',class:'MODEL_BEHAVIOR',root_cause:'Model requested a permission outside the automated W fixture-local execution contract; request was rejected and the exact session was aborted.',product_repair_authorized:false}
    else if(missionPass&&oraclePass)classification={result:'PASS',class:null,root_cause:null,product_repair_authorized:false}
    else if(stalled)classification={result:'FAIL',class:'INCONCLUSIVE',root_cause:'Canonical liveness declared STALLED with exact inflight NO; destructive replacement is not performed automatically by the common driver.',product_repair_authorized:false}
    else classification={result:'FAIL',class:'WORKLOAD_RESULT_FAILURE',root_cause:'Terminal workload result and/or hidden oracle did not pass. Oracle truth does not diagnose a product defect.',product_repair_authorized:false}
    receipts.write('classification',classification)
    for(const child of (dataOf(await client.session.children({sessionID:parentID,directory:fixture}))??[]))try{await client.session.delete({sessionID:child.id,directory:fixture})}catch{}
    try{await client.session.delete({sessionID:parentID,directory:fixture})}catch{}
    cleanupResult=await cleanupOwnedResources(runId,[{kind:'process',ownerRunId:runId,manager:pm,contract:serverRecord,options:{graceMs:1500}},{kind:'path',ownerRunId:runId,path:runtimeSandbox,root:runDir},{kind:'path',ownerRunId:runId,path:controlRoot,root:runDir},{kind:'lock',ownerRunId:runId,lock}])
    receipts.write('cleanup',{cleaned:cleanupResult.cleaned.map(x=>({kind:x.kind,path:x.path??null,pid:x.contract?.pid??null})),skipped:cleanupResult.skipped.length,quarantined:cleanupResult.quarantined})
    const success=missionPass&&oraclePass&&cleanupResult.quarantined.length===0;receipts.write('summary',{status:success?'PASS':'FAIL',workload_id:workloadId,product_sha:productHead,model:selected.model.id,parent_session_id:parentID,mission_status:finalMission?.identity?.status??null,oracle_pass:oraclePass,classification:classification.class,fixture_preserved:spec.cleanup?.preserveFixtureAfterTerminalForInspection===true})
    writeMeta({status:success?'TERMINAL_PASS':'TERMINAL_FAIL',ended_at:new Date().toISOString(),mission_status:finalMission?.identity?.status??null,oracle_pass:oraclePass,classification:classification.class,cleanup_quarantined:cleanupResult.quarantined.length})
    return{disposition:success?'TERMINAL_PASS':'TERMINAL_FAIL',run_id:runId,run_dir:runDir,parent_session_id:parentID,model:selected.model.id,mission_status:finalMission?.identity?.status??null,oracle_pass:oraclePass,classification:classification.class,cleanup_quarantined:cleanupResult.quarantined.length}
  }catch(error){
    writeMeta({status:'SUPERVISOR_ERROR',error:String(error?.stack??error)})
    if(parentID&&client)try{await client.session.abort({sessionID:parentID,directory:fixture})}catch{}
    const resources=[];if(serverRecord&&pm)resources.push({kind:'process',ownerRunId:runId,manager:pm,contract:serverRecord,options:{graceMs:1500}});if(runtimeSandbox&&existsSync(runtimeSandbox))resources.push({kind:'path',ownerRunId:runId,path:runtimeSandbox,root:runDir});if(controlRoot&&existsSync(controlRoot))resources.push({kind:'path',ownerRunId:runId,path:controlRoot,root:runDir});resources.push({kind:'lock',ownerRunId:runId,lock});try{cleanupResult=await cleanupOwnedResources(runId,resources)}catch{}
    try{receipts.write('classification',{result:'FAIL',class:'HARNESS_DEFECT',root_cause:String(error?.message??error),product_repair_authorized:false})}catch{}
    try{receipts.write('cleanup',{error_cleanup:true,quarantined:cleanupResult?.quarantined??[]})}catch{}
    try{receipts.write('summary',{status:'FAIL',workload_id:workloadId,classification:'HARNESS_DEFECT',error:String(error?.message??error)})}catch{}
    throw error
  }
}
