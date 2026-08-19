import test from 'node:test'
import assert from 'node:assert/strict'
import { OpenCodePtyAdapter,ProcessSpawnPermissionError } from '../dist/opencode/open-code-pty-adapter.js'
import { evaluateProcessSpawnAuthority,processCommandLine } from '../dist/runtime/process/authority.js'
import { isProcessContract } from '../dist/contracts/process.js'
import { resolve,sep } from 'node:path'

class FakeSocket {
  readyState=0
  listeners=new Map()
  sent=[]
  constructor(url){this.url=url;queueMicrotask(()=>{this.readyState=1;this.emit('open',{})})}
  addEventListener(type,listener){const list=this.listeners.get(type)??[];list.push(listener);this.listeners.set(type,list)}
  send(data){this.sent.push(data)}
  close(code=1000,reason=''){this.readyState=3;this.emit('close',{code,reason})}
  emit(type,event){for(const fn of [...(this.listeners.get(type)??[])])fn(event)}
  message(data){this.emit('message',{data})}
}

function meta(cursor){const body=new TextEncoder().encode(JSON.stringify({cursor}));const out=new Uint8Array(body.length+1);out[0]=0;out.set(body,1);return out}
function host(permission={bash:{'*':'allow'},external_directory:{'*':'ask'}}){return{agent:{coder:{permission}}}}
function baseRequest(extra={}){return{mission_id:'m_1',task_id:'t_1',worker_id:'w_1',role:'coder',command:'node',args:['-e','console.log(1)'],cwd:'/repo',authority_ref:'auth:unit',...extra}}
function harness({permission,signal,processGroup,nativeArgsSuffix=[],initialMeta=true}={}){
  let nextPid=4100
  const sessions=new Map(),removed=[],sockets=[]
  const pty={
    async list(){return{data:{data:[...sessions.values()].map(x=>({...x}))}}},
    async create(input){const info={id:`pty-${nextPid}`,title:input.title??'x',command:input.command,args:[...(input.args??[]),...nativeArgsSuffix],cwd:input.cwd,status:'running',pid:nextPid++};sessions.set(info.id,info);return{data:{data:{...info}}}},
    async get({ptyID}){const info=sessions.get(ptyID);if(!info)throw new Error('missing pty');return{data:{data:{...info}}}},
    async remove({ptyID}){removed.push(ptyID);sessions.delete(ptyID);return{data:undefined}},
    async connectToken({ptyID}){assert.ok(sessions.has(ptyID));return{data:{data:{ticket:`ticket-${ptyID}`,expires_in:10}}}},
  }
  const client={v2:{pty}}
  const adapter=new OpenCodePtyAdapter(client,new URL('http://127.0.0.1:4096'),'/repo','/repo',()=>host(permission),url=>{const ws=new FakeSocket(url);sockets.push(ws);if(initialMeta){const current=[...sessions.values()].at(-1),marker=current?.args?.find?.(x=>typeof x==='string'&&/^~HI:[a-f0-9]{16}~$/.test(x));queueMicrotask(()=>ws.message(meta(0)));if(marker)queueMicrotask(()=>ws.message(marker))}return ws},signal??(()=>{}),32,8,processGroup??(()=>undefined))
  return{adapter,sessions,removed,sockets,exit(ptyID,code=0){const info=sessions.get(ptyID);Object.assign(info,{status:'exited',exitCode:code})}}
}

async function spawned(h,request=baseRequest()){
  const handle=await h.adapter.spawn(request)
  assert.equal(isProcessContract(handle.contract),true)
  assert.equal(handle.contract.status,'RUNNING')
  assert.ok(handle.contract.pid>0)
  assert.match(handle.contract.process_id,/^proc_[a-f0-9]{24}$/)
  assert.equal(handle.host_process_id.startsWith('pty-'),true)
  return handle
}

test('P2 authority evaluator mirrors OpenCode last-match wildcard semantics and fails closed on ask/deny',()=>{
  const request=baseRequest()
  assert.equal(processCommandLine(request),"node -e 'console.log(1)'")
  assert.equal(evaluateProcessSpawnAuthority(request,'/repo',host({bash:{'*':'allow','node *':'deny'},external_directory:{'*':'ask'}})).decision,'DENY')
  assert.equal(evaluateProcessSpawnAuthority(request,'/repo',host({bash:{'*':'deny','node *':'allow'},external_directory:{'*':'ask'}})).decision,'ALLOW')
  assert.equal(evaluateProcessSpawnAuthority(request,'/repo',host({bash:{'git *':'allow'},external_directory:{'*':'ask'}})).decision,'ASK')
})

test('P2 external cwd requires explicit external_directory allow and external effects require matching ExternalAction authority',()=>{
  const outside=resolve('/outside'),outsidePattern=outside.replace(/[\\/]$/,'')+sep+'*'
  const external=baseRequest({cwd:outside})
  assert.equal(evaluateProcessSpawnAuthority(external,'/repo',host({bash:{'*':'allow'},external_directory:{'*':'ask'}})).decision,'ASK')
  assert.equal(evaluateProcessSpawnAuthority(external,'/repo',host({bash:{'*':'allow'},external_directory:{[outsidePattern]:'deny','*':'ask'}})).decision,'ASK','later wildcard ask wins like OpenCode')
  assert.equal(evaluateProcessSpawnAuthority(external,'/repo',host({bash:{'*':'allow'},external_directory:{'*':'ask',[outsidePattern]:'allow'}})).decision,'ALLOW')
  const push=baseRequest({command:'git',args:['push','origin','main']})
  assert.equal(evaluateProcessSpawnAuthority(push,'/repo',host({bash:{'*':'allow'},external_directory:{'*':'ask'}})).decision,'ASK')
  const authorized={...push,external_action:{action_type:'git-push',target:'git push origin main',requested_explicitly:true,required_authority_ref:'auth:unit',executor:'hi-process-executor'}}
  assert.equal(evaluateProcessSpawnAuthority(authorized,'/repo',host({bash:{'*':'allow'},external_directory:{'*':'ask'}})).decision,'ALLOW')
})

test('P2 POSIX launch barrier waits for initial cursor metadata before releasing the requested command',async()=>{
  if(process.platform==='win32')return
  const h=harness({initialMeta:false})
  let settled=false
  const pending=h.adapter.spawn(baseRequest()).then(value=>{settled=true;return value})
  await new Promise(r=>setTimeout(r,0))
  assert.equal(settled,false,'spawn must not release a POSIX command before initial PTY replay/cursor metadata')
  const ws=h.sockets[0];assert.ok(ws);assert.deepEqual(ws.sent,[])
  ws.message(meta(0))
  await new Promise(r=>setTimeout(r,0));assert.equal(settled,false,'spawn must also wait for the internal barrier-ready marker')
  const marker=[...h.sessions.values()].at(-1).args.find(x=>/^~HI:[a-f0-9]{16}~$/.test(x));assert.ok(marker);ws.message(marker)
  const handle=await pending,info=h.sessions.get(handle.host_process_id)
  assert.equal(info.command,'/usr/bin/env')
  assert.deepEqual(info.args.slice(0,4),['sh','-c','stty -echo || exit 125; printf %s "$1"; shift; IFS= read -r _ || exit 125; stty echo || exit 125; exec "$@"','hi-opencode-pty-barrier'])
  assert.match(info.args[4],/^~HI:[a-f0-9]{16}~$/)
  assert.deepEqual(info.args.slice(5),['node','-e','console.log(1)'])
  assert.deepEqual(ws.sent,['\n'])
})

test('P2 spawn binds native PID and ticketed websocket URL without raw output in ProcessContract',async()=>{
  const h=harness(),handle=await spawned(h)
  const ws=h.sockets[0]
  assert.match(ws.url,/\/api\/pty\/pty-4100\/connect/)
  assert.match(ws.url,/ticket=ticket-pty-4100/)
  assert.match(ws.url,/location%5Bdirectory%5D=%2Frepo/)
  assert.equal('stdout' in handle.contract,false);assert.equal('buffer' in handle.contract,false)
})

test('P2 stdin write uses the live websocket and refuses write after exit',async()=>{
  const h=harness(),handle=await spawned(h);const ws=h.sockets[0]
  await h.adapter.write(handle.contract.process_id,'hello\n')
  assert.deepEqual(ws.sent,process.platform==='win32'?['hello\n']:['\n','hello\n'])
  h.exit(handle.host_process_id,0);ws.close()
  await h.adapter.wait(handle.contract.process_id)
  await assert.rejects(()=>h.adapter.write(handle.contract.process_id,'late'),/Cannot write/)
})

test('P2 bounded output honors OpenCode absolute cursor metadata, pagination and truncation',async()=>{
  const h=harness(),handle=await spawned(h),ws=h.sockets[0],id=handle.contract.process_id
  ws.message('0123456789');ws.message(meta(10));ws.message('abcdefghij')
  await new Promise(r=>setTimeout(r,0))
  const first=await h.adapter.read(id,{cursor:0,max_chars:8})
  assert.deepEqual(first,{text:'01234567',start_cursor:0,end_cursor:8,available_start_cursor:0,available_end_cursor:20,truncated:true,status:'RUNNING'})
  const next=await h.adapter.read(id,{cursor:first.end_cursor,max_chars:8})
  assert.equal(next.text,'89abcdef');assert.equal(next.start_cursor,8);assert.equal(next.end_cursor,16);assert.equal(next.truncated,true)
  ws.message('K'.repeat(40));await new Promise(r=>setTimeout(r,0))
  const clipped=await h.adapter.read(id,{cursor:0,max_chars:8})
  assert.ok(clipped.available_start_cursor>0);assert.equal(clipped.truncated,true);assert.equal(clipped.text.length,8)
})



test('PROMPT B huge unread PTY output remains bounded and cursor-addressable',async()=>{
  const h=harness(),handle=await spawned(h),ws=h.sockets[0],id=handle.contract.process_id
  ws.message(meta(0));ws.message('Z'.repeat(1024*1024));await new Promise(r=>setTimeout(r,0))
  const out=await h.adapter.read(id,{cursor:0,max_chars:8})
  assert.equal(out.text.length,8);assert.equal(out.available_end_cursor,1024*1024);assert.equal(out.available_start_cursor,1024*1024-32);assert.equal(out.truncated,true)
  assert.equal('buffer' in handle.contract,false);assert.equal('stdout' in handle.contract,false)
})

test('PROMPT B concurrent owned PTYs keep output cursors and buffers isolated',async()=>{
  const h=harness(),a=await spawned(h,baseRequest({args:['-e','A']})),b=await spawned(h,baseRequest({args:['-e','B'],task_id:'t_2',worker_id:'w_2'}))
  const [wa,wb]=h.sockets;wa.message(meta(0));wb.message(meta(0));wa.message('alpha-only');wb.message('beta-only');await new Promise(r=>setTimeout(r,0))
  const oa=await h.adapter.read(a.contract.process_id,{cursor:0,max_chars:32}),ob=await h.adapter.read(b.contract.process_id,{cursor:0,max_chars:32})
  assert.equal(oa.text,'alpha-on');assert.equal(ob.text,'beta-onl');assert.doesNotMatch(oa.text,/beta/);assert.doesNotMatch(ob.text,/alpha/)
})

test('P2 natural exit records nonzero exit code and cleanup is separate from exit',async()=>{
  const h=harness(),handle=await spawned(h),ws=h.sockets[0],id=handle.contract.process_id
  h.exit(handle.host_process_id,7);ws.close()
  const result=await h.adapter.wait(id)
  assert.equal(result.contract.status,'EXITED');assert.equal(result.contract.exit_code,7);assert.equal(result.contract.cleanup_state,'CLEANUP_PENDING')
  assert.equal(h.removed.length,0)
  await h.adapter.cleanup(id)
  assert.deepEqual(h.removed,[handle.host_process_id])
  assert.equal(h.adapter.list().length,0)
})

test('P2 cleanup refuses to masquerade as kill for a running process',async()=>{
  const h=harness(),handle=await spawned(h)
  await assert.rejects(()=>h.adapter.cleanup(handle.contract.process_id),/Refusing cleanup of running process/)
  assert.equal(h.removed.length,0)
})

test('P2 kill validates PID identity, signals the owned PID, observes exit, then remains separately cleanable',async()=>{
  let signalCall
  const h=harness({signal:(pid,signal)=>{signalCall={pid,signal};const info=[...h.sessions.values()].find(x=>x.pid===pid);Object.assign(info,{status:'exited',exitCode:143});queueMicrotask(()=>h.sockets[0].close())}})
  const handle=await spawned(h),id=handle.contract.process_id
  const result=await h.adapter.kill(id,'SIGTERM')
  assert.deepEqual(signalCall,{pid:handle.contract.pid,signal:'SIGTERM'})
  assert.equal(result.contract.status,'TERMINATED');assert.match(result.contract.termination_reason,/SIGTERM/);assert.equal(h.removed.length,0)
  await h.adapter.cleanup(id);assert.equal(h.removed.length,1)
})



test('PROMPT B isolated owned process group is identity-bound and signalled as a group',async()=>{
  let signalCall
  const h=harness({processGroup:pid=>pid,signal:(target,signal)=>{signalCall={target,signal};const pid=Math.abs(target),info=[...h.sessions.values()].find(x=>x.pid===pid);Object.assign(info,{status:'exited',exitCode:143});queueMicrotask(()=>h.sockets[0].close())}})
  const handle=await spawned(h);assert.equal(handle.contract.process_group_id,handle.contract.pid)
  const result=await h.adapter.kill(handle.contract.process_id,'SIGTERM')
  assert.deepEqual(signalCall,{target:-handle.contract.pid,signal:'SIGTERM'});assert.equal(result.contract.status,'TERMINATED')
})

test('PROMPT B process-group identity drift refuses signalling fail-closed',async()=>{
  let current,signals=0
  const h=harness({processGroup:pid=>current??pid,signal:()=>{signals++}}),handle=await spawned(h);assert.equal(handle.contract.process_group_id,handle.contract.pid)
  current=handle.contract.pid+99
  await assert.rejects(()=>h.adapter.kill(handle.contract.process_id),/Refusing process-group signal/);assert.equal(signals,0)
})

test('PROMPT B kill signalling failure does not fabricate TERMINATED semantics on later natural exit',async()=>{
  const h=harness({signal:()=>{throw new Error('signal-denied')}}),handle=await spawned(h),id=handle.contract.process_id
  await assert.rejects(()=>h.adapter.kill(id,'SIGTERM'),/signal-denied/)
  h.exit(handle.host_process_id,9);h.sockets[0].close();const result=await h.adapter.wait(id)
  assert.equal(result.contract.status,'EXITED');assert.equal(result.contract.exit_code,9);assert.equal(result.contract.termination_reason,undefined)
})

test('P2 stale PID mismatch is fail-closed before signal',async()=>{
  let signals=0
  const h=harness({signal:()=>{signals++}}),handle=await spawned(h)
  h.sessions.get(handle.host_process_id).pid=99999
  await assert.rejects(()=>h.adapter.kill(handle.contract.process_id),/PID identity changed|stale PID/)
  assert.equal(signals,0)
})

test('P2 timeout signals owned PID and resolves as TIMED_OUT only after native exit observation',async()=>{
  let signaled
  const h=harness({signal:(pid,signal)=>{signaled={pid,signal};const info=[...h.sessions.values()].find(x=>x.pid===pid);Object.assign(info,{status:'exited',exitCode:143});queueMicrotask(()=>h.sockets[0].close())}})
  const handle=await spawned(h,baseRequest({timeout_ms:50})),result=await h.adapter.wait(handle.contract.process_id)
  assert.deepEqual(signaled,{pid:handle.contract.pid,signal:'SIGTERM'})
  assert.equal(result.contract.status,'TIMED_OUT');assert.equal(result.contract.cleanup_state,'CLEANUP_PENDING');assert.ok(result.contract.timeout_at>=result.contract.started_at)
})

test('P2 spawn never silently executes native permission ask/deny',async()=>{
  for(const [decision,expected] of [['ask','ASK'],['deny','DENY']]){
    const h=harness({permission:{bash:{'*':decision},external_directory:{'*':'ask'}}})
    await assert.rejects(()=>h.adapter.spawn(baseRequest()),error=>error instanceof ProcessSpawnPermissionError&&error.decision===expected)
    assert.equal(h.sessions.size,0)
  }
})


test('P2/P3 production runtime services own exactly one OpenCodePtyAdapter and docs bind the completed lifecycle claim',async()=>{
  const {readFileSync}=await import('node:fs')
  const services=readFileSync(new URL('../src/runtime/application/runtime-services.ts',import.meta.url),'utf8')
  const plugin=readFileSync(new URL('../src/plugin.ts',import.meta.url),'utf8')
  const hosts=readFileSync(new URL('../../docs/HOSTS.md',import.meta.url),'utf8')
  assert.doesNotMatch(services,/new OpenCodePtyAdapter\(/)
  assert.match(services,/process:ProcessExecutor/)
  assert.match(plugin,/const processExecutor=new OpenCodePtyAdapter\(/)
  assert.match(services,/processExecutor:ports\.process/)
  assert.match(hosts,/ProcessRuntime remains PID\/process-group\/cwd\/command-identity bound/)
  assert.match(hosts,/runtime capability contracts report only what the active host actually exposes/i)
  assert.match(hosts,/`process-lifecycle` \| \*\*SUPPORTED_T3\*\*/)
})


test('P2 timeout also refuses stale PID before signalling',async()=>{
  let signals=0
  const h=harness({signal:()=>{signals++}}),handle=await spawned(h,baseRequest({timeout_ms:50}))
  const pending=h.adapter.wait(handle.contract.process_id)
  setTimeout(()=>{h.sessions.get(handle.host_process_id).pid=99999},20)
  await assert.rejects(()=>pending,/PID identity changed|stale PID timeout/)
  assert.equal(signals,0)
})




test('P3 spawn binds restart identity to native PTY command normalization rather than the pre-create request',async()=>{
  const h=harness({nativeArgsSuffix:['-l']}),handle=await spawned(h)
  const fresh=harness();fresh.sessions.set(handle.host_process_id,{...h.sessions.get(handle.host_process_id)})
  // Reuse the same native PTY seam with a fresh adapter to simulate plugin restart.
  const pty={
    async list(){return{data:{data:[...h.sessions.values()].map(x=>({...x}))}}},
    async create(){throw new Error('must not create during reconcile')},
    async get({ptyID}){return{data:{data:{...h.sessions.get(ptyID)}}}},
    async remove({ptyID}){h.sessions.delete(ptyID);return{data:undefined}},
    async connectToken({ptyID}){return{data:{data:{ticket:`ticket-${ptyID}`,expires_in:10}}}},
  }
  const adapter=new OpenCodePtyAdapter({v2:{pty}},new URL('http://127.0.0.1:4096'),'/repo','/repo',()=>host(),url=>{const ws=new FakeSocket(url);queueMicrotask(()=>ws.message(meta(0)));return ws},()=>{},32,8)
  const result=await adapter.reconcile(handle.contract)
  assert.equal(result.disposition,'ADOPTED')
  assert.equal(result.contract.pid,handle.contract.pid)
})
test('P3 restart reconcile adopts exact native PTY identity and restores live write/read transport',async()=>{
  const h=harness(),handle=await spawned(h),persisted=structuredClone(handle.contract)
  // Simulate a fresh plugin runtime while the OpenCode host retains the PTY.
  const fresh=new OpenCodePtyAdapter({v2:{pty:{
    list:async()=>({data:{data:[...h.sessions.values()].map(x=>({...x}))}}),
    get:async({ptyID})=>({data:{data:{...h.sessions.get(ptyID)}}}),
    remove:async({ptyID})=>{h.removed.push(ptyID);h.sessions.delete(ptyID);return{data:undefined}},
    connectToken:async({ptyID})=>({data:{data:{ticket:`ticket-${ptyID}`,expires_in:10}}}),
    create:async()=>{throw new Error('must not create during reconcile')},
  }}},new URL('http://127.0.0.1:4096'),'/repo','/repo',()=>host(),url=>{const ws=new FakeSocket(url);h.sockets.push(ws);queueMicrotask(()=>ws.message(meta(0)));return ws},()=>{},32,8)
  const result=await fresh.reconcile(persisted);assert.equal(result.disposition,'ADOPTED');assert.equal(result.contract.pid,persisted.pid);assert.equal(fresh.list().length,1)
  await fresh.write(persisted.process_id,'after-restart\n');assert.deepEqual(h.sockets.at(-1).sent,['after-restart\n'])
})

test('P3 restart replay hides the internal POSIX launch marker while preserving pre-restart user output',async()=>{
  if(process.platform==='win32')return
  const h=harness(),handle=await spawned(h),persisted=structuredClone(handle.contract),native=h.sessions.get(handle.host_process_id),marker=native.args.find(x=>/^~HI:[a-f0-9]{16}~$/.test(x));assert.ok(marker)
  const replay='READY_BEFORE_RESTART',pty={
    list:async()=>({data:{data:[{...native}]}}),get:async()=>({data:{data:{...native}}}),remove:async()=>({data:undefined}),connectToken:async()=>({data:{data:{ticket:'ticket-replay',expires_in:10}}}),create:async()=>{throw new Error('must not create during reconcile')},
  },sockets=[]
  const fresh=new OpenCodePtyAdapter({v2:{pty}},new URL('http://127.0.0.1:4096'),'/repo','/repo',()=>host(),url=>{const ws=new FakeSocket(url);sockets.push(ws);queueMicrotask(()=>ws.message(marker+replay));queueMicrotask(()=>ws.message(meta(marker.length+replay.length)));return ws},()=>{},64,64)
  const result=await fresh.reconcile(persisted);assert.equal(result.disposition,'ADOPTED')
  const out=await fresh.read(persisted.process_id,{cursor:0,max_chars:64});assert.equal(out.text,replay);assert.doesNotMatch(out.text,/~HI:/);assert.equal(out.start_cursor,marker.length)
})

test('P3 restart reconcile quarantines same PID with changed command identity and never signals it',async()=>{
  let signals=0
  const h=harness({signal:()=>{signals++}}),handle=await spawned(h),persisted=structuredClone(handle.contract)
  const native=h.sessions.get(handle.host_process_id);native.command='python3';native.args=['-c','print(1)']
  const result=await h.adapter.reconcile(persisted);assert.equal(result.disposition,'ORPHANED');assert.equal(result.contract.status,'ORPHANED');assert.equal(result.contract.cleanup_state,'QUARANTINED');assert.equal(result.contract.termination_reason,'restart-owner-identity-mismatch');assert.equal(signals,0)
})

test('P3 restart reconcile quarantines missing live owner and treats missing terminal host record as cleaned',async()=>{
  const h=harness(),handle=await spawned(h),running=structuredClone(handle.contract);h.sessions.clear()
  const missing=await h.adapter.reconcile(running);assert.equal(missing.disposition,'ORPHANED');assert.equal(missing.contract.termination_reason,'restart-owner-missing')
  const terminal={...running,status:'EXITED',ended_at:Date.now(),exit_code:0,cleanup_state:'CLEANUP_PENDING'}
  const cleaned=await h.adapter.reconcile(terminal);assert.equal(cleaned.disposition,'TERMINAL');assert.equal(cleaned.contract.cleanup_state,'CLEANED')
})
