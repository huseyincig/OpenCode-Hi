#!/usr/bin/env python3
from __future__ import annotations
import json,subprocess,tempfile,tarfile,os,time,socket,urllib.request,urllib.parse,signal,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/fresh-consumer-opencode-1.18.18.json'
def run(cmd,cwd=None,env=None,timeout=120):
    return subprocess.run(cmd,cwd=cwd,env=env,text=True,capture_output=True,timeout=timeout)
def free_port():
    s=socket.socket();s.bind(('127.0.0.1',0));p=s.getsockname()[1];s.close();return p
def get_json(url,timeout=5):
    with urllib.request.urlopen(url,timeout=timeout) as r:return json.loads(r.read().decode())
def main()->int:
  with tempfile.TemporaryDirectory(prefix='hi-b26-consumer-') as td:
    td=Path(td);packdir=td/'pack';packdir.mkdir();consumer=td/'consumer';consumer.mkdir();home=td/'home';home.mkdir();xdg=td/'xdg';xdg.mkdir()
    pack=run(['npm','pack','--ignore-scripts','--pack-destination',str(packdir)],ROOT)
    if pack.returncode!=0:raise RuntimeError(pack.stderr[-2000:])
    tgz=next(packdir.glob('*.tgz'))
    (consumer/'package.json').write_text(json.dumps({'name':'hi-b26-consumer','version':'1.0.0','private':True})+'\n')
    install=run(['npm','install','--ignore-scripts','--no-audit','--no-fund',str(tgz)],consumer,timeout=180)
    if install.returncode!=0:raise RuntimeError(install.stderr[-2000:])
    # Fresh consumer config: package-provided CLI writes Hi-owned policy only.
    setup=consumer/'node_modules/.bin/opencode-hi-setup'
    project=consumer/'project';project.mkdir();(project/'.opencode/plugins').mkdir(parents=True)
    wrapper=project/'.opencode/plugins/hi-packed.js';wrapper.write_text("export { default } from 'opencode-hi'\n")
    reconfig=run([str(setup),'reconfigure',str(project),'--primary-mode','manager','--parallel','disabled','--max-fallbacks','1'],consumer)
    # Record exact resolution location: must be consumer node_modules, never ROOT.
    resolve=run(['node','--input-type=module','-e',"console.log(import.meta.resolve('opencode-hi'))"],consumer)
    resolved=resolve.stdout.strip().splitlines()[-1] if resolve.stdout.strip() else ''
    # isolated state/config, exact installed opencode binary
    env=os.environ.copy();env['HOME']=str(home);env['XDG_DATA_HOME']=str(xdg/'data');env['XDG_CONFIG_HOME']=str(xdg/'config');env['XDG_CACHE_HOME']=str(xdg/'cache');env['XDG_STATE_HOME']=str(xdg/'state')
    port=free_port();log=td/'opencode.log'
    with log.open('w') as lf:
      proc=subprocess.Popen(['opencode','serve','--hostname','127.0.0.1','--port',str(port),'--print-logs','--log-level','INFO'],cwd=project,env=env,stdout=lf,stderr=subprocess.STDOUT,text=True)
    base=f'http://127.0.0.1:{port}'
    tool_ids=None;server_error=None
    try:
      for _ in range(80):
        if proc.poll() is not None:break
        try:
          q=urllib.parse.urlencode({'directory':str(project)})
          tool_ids=get_json(base+'/experimental/tool/ids?'+q,2);break
        except Exception as e:server_error=str(e);time.sleep(.25)
      # session create is provider-independent and proves server/session material path is alive.
      session=None
      try:
        req=urllib.request.Request(base+'/session?directory='+urllib.parse.quote(str(project),safe=''),data=json.dumps({'title':'Hi packed consumer acceptance'}).encode(),headers={'content-type':'application/json'},method='POST')
        with urllib.request.urlopen(req,timeout=5) as r:session=json.loads(r.read().decode())
      except Exception as e: session={'error':str(e)}
      # Debug agent command against same fresh project: config hook projection should expose Hi agent.
      agent=run(['opencode','debug','agent','coder'],project,env,timeout=30)
      # Optional provider-backed material run: attempted but never required for package PASS.
      provider_run=None
      models=run(['opencode','models','opencode-go'],project,env,timeout=30)
      candidate=next((ln.strip() for ln in models.stdout.splitlines() if '/' in ln and not ln.startswith(' ')),None)
      if candidate:
        try:
          rr=run(['opencode','run','-m',candidate,'Use the hi_doctor tool once and report only its top-level status.'],project,env,timeout=45)
          provider_run={'attempted':True,'model':candidate,'rc':rr.returncode,'stdout':rr.stdout[-3000:],'stderr':rr.stderr[-1500:]}
        except subprocess.TimeoutExpired:
          provider_run={'attempted':True,'model':candidate,'timeout':True}
      else:provider_run={'attempted':False,'reason':'no isolated-home opencode-go model inventory'}
    finally:
      try:proc.terminate();proc.wait(timeout=5)
      except Exception:
        try:proc.kill()
        except Exception:pass
    ids=tool_ids if isinstance(tool_ids,list) else (tool_ids.get('data') if isinstance(tool_ids,dict) else None)
    ids=ids if isinstance(ids,list) else []
    hi_ids=sorted(x for x in ids if isinstance(x,str) and x.startswith('hi_'))
    agent_text=(agent.stdout+'\n'+agent.stderr)
    log_text=log.read_text(errors='replace') if log.exists() else ''
    checks={
      'pack_install':install.returncode==0,
      'setup_reconfigure':reconfig.returncode==0 and 'APPLIED' in reconfig.stdout,
      'consumer_resolution':bool(resolved) and str(consumer/'node_modules/opencode-hi') in resolved and str(ROOT) not in resolved,
      'server_tool_ids':len(hi_ids)>=10 and 'hi_doctor' in hi_ids and 'hi_status' in hi_ids and 'hi_task_start' in hi_ids,
      'agent_projection':agent.returncode==0 and ('coder' in agent_text.lower()) and ('permission' in agent_text.lower() or 'tools' in agent_text.lower()),
      'session_create':isinstance(session,dict) and not session.get('error') and bool(session.get('id') or (session.get('data') or {}).get('id')),
      'no_source_tree_in_server_log':str(ROOT) not in log_text,
      'exact_host_version':run(['opencode','--version']).stdout.strip()=='1.18.18',
    }
    status='PASS' if all(checks.values()) else 'FAIL'
    receipt={'schema':1,'kind':'PROMPT_B_FRESH_CONSUMER_EXACT_HOST_ACCEPTANCE','program':'PROMPT_B','section':26,'status':status,'host':{'opencode':'1.18.18','platform':'linux','architecture':os.uname().machine},'package':{'release':'0.1.0','tarball_name':tgz.name,'installed_from_tarball':True,'resolved_entrypoint':resolved.replace(str(td),'<temp>')},'consumer':{'project':str(project).replace(str(td),'<temp>'),'wrapper':'.opencode/plugins/hi-packed.js','reconfigure_rc':reconfig.returncode},'material_runtime':{'hi_tool_count':len(hi_ids),'hi_tools':hi_ids,'agent_debug_rc':agent.returncode,'session':{'created':checks['session_create'],'version':(session.get('version') if isinstance(session,dict) else None),'directory':'<temp>/consumer/project'},'provider_run':provider_run},'checks':checks,'claim_boundary':'Fresh packed artifact installed outside source tree and loaded by exact OpenCode 1.18.18 through its native local-plugin seam. Provider-backed model execution is opportunistic and is not required for package/runtime acceptance; tool registration, config/agent projection and session material path are provider-independent.'}
    OUT.write_text(json.dumps(receipt,indent=2,ensure_ascii=False)+'\n')
    print(f"fresh consumer acceptance {status}: hi_tools={len(hi_ids)} session={checks['session_create']} agent={checks['agent_projection']} provider_attempted={provider_run.get('attempted')}")
    if status!='PASS':
      print(json.dumps(checks,indent=2));print(log_text[-3000:])
    return 0 if status=='PASS' else 1
if __name__=='__main__':raise SystemExit(main())
