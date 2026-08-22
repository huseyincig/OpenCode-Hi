#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,os,shutil,socket,subprocess,time,urllib.parse,urllib.request
from datetime import datetime,timezone
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
_inv_spec=importlib.util.spec_from_file_location('hi_runtime_tool_inventory',ROOT/'scripts/hi-runtime-tool-inventory.py');_inv=importlib.util.module_from_spec(_inv_spec);_inv_spec.loader.exec_module(_inv);expected_hi_runtime_tools=_inv.expected_hi_runtime_tools
PACKAGE=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
TARGET=str((PACKAGE.get('dependencies') or {}).get('@opencode-ai/sdk') or '').strip()
if not TARGET or TARGET!=str((PACKAGE.get('peerDependencies') or {}).get('@opencode-ai/plugin') or '').strip():
    raise RuntimeError('Exact OpenCode certification target must equal root @opencode-ai/sdk and @opencode-ai/plugin pins')
OUT=ROOT/f'data/validation/fresh-consumer-opencode-{TARGET}.json'
common_git=Path(subprocess.check_output(['git','rev-parse','--path-format=absolute','--git-common-dir'],cwd=ROOT,text=True).strip())
AGENT_WORK=common_git.parent/'.agent-work'
WORK=AGENT_WORK/'acceptance'/f'fresh-consumer-opencode-{TARGET}'
def run(cmd,cwd=None,env=None,timeout=120):return subprocess.run(cmd,cwd=cwd,env=env,text=True,capture_output=True,timeout=timeout)
def free_port():
    s=socket.socket();s.bind(('127.0.0.1',0));p=s.getsockname()[1];s.close();return p
def get_json(url,timeout=5):
    with urllib.request.urlopen(url,timeout=timeout) as r:return json.loads(r.read().decode())
def exact_opencode():
    requested=os.environ.get('HI_EXACT_OPENCODE_BIN')
    candidates=[]
    if requested:candidates.append(Path(requested).expanduser())
    candidates += [ROOT/'.agent-work/tools'/f'opencode-{TARGET}'/'node_modules/opencode-linux-arm64/bin/opencode',ROOT.parent.parent/'tools'/f'opencode-{TARGET}'/'node_modules/opencode-linux-arm64/bin/opencode']
    resolved=next((str(p.resolve()) for p in candidates if p.is_file()),None) or shutil.which(requested or 'opencode')
    if not resolved:raise RuntimeError('Exact OpenCode binary unavailable; set HI_EXACT_OPENCODE_BIN')
    version=run([resolved,'--version']).stdout.strip()
    if version!=TARGET:raise RuntimeError(f'Exact OpenCode version mismatch: expected {TARGET}, observed {version or "<empty>"}')
    return resolved,version,hashlib.sha256(Path(resolved).read_bytes()).hexdigest()
def npm_latest(package):
    r=run(['npm','view',package,'version','--json'],ROOT,timeout=30)
    if r.returncode!=0:return None
    try:value=json.loads(r.stdout);return value if isinstance(value,str) else None
    except Exception:return None
def main()->int:
  opencode_bin,opencode_version,opencode_sha256=exact_opencode();registry={'opencode_ai_latest':npm_latest('opencode-ai'),'sdk_latest':npm_latest('@opencode-ai/sdk'),'observed_at':datetime.now(timezone.utc).isoformat()}
  shutil.rmtree(WORK,ignore_errors=True);packdir=WORK/'pack';consumer=WORK/'consumer';home=WORK/'home';xdg=WORK/'xdg';bootstrap=WORK/'bootstrap-project'
  for p in (packdir,consumer,home,xdg,bootstrap):p.mkdir(parents=True,exist_ok=True)
  pack=run(['npm','pack','--ignore-scripts','--pack-destination',str(packdir)],ROOT)
  if pack.returncode!=0:raise RuntimeError(pack.stderr[-2000:])
  tgzs=list(packdir.glob('*.tgz'))
  if len(tgzs)!=1:raise RuntimeError(f'Expected one packed candidate, found {len(tgzs)}')
  tgz=tgzs[0];tarball_sha=hashlib.sha256(tgz.read_bytes()).hexdigest()
  (consumer/'package.json').write_text(json.dumps({'name':'hi-fresh-consumer','version':'1.0.0','private':True})+'\n')
  install=run(['npm','install','--ignore-scripts','--no-audit','--no-fund',str(tgz)],consumer,timeout=180)
  if install.returncode!=0:raise RuntimeError(install.stderr[-2000:])
  node_cli=consumer/'node_modules/.bin/opencode-hi';setup=run([str(node_cli),'setup',str(bootstrap)],consumer)
  setup_cfg={}
  try:setup_cfg=json.loads((bootstrap/'opencode.json').read_text(encoding='utf-8'))
  except Exception:pass
  expected_spec=f'opencode-hi@{PACKAGE["version"]}'
  setup_clean=all(not (bootstrap/x).exists() for x in ('package.json','package-lock.json','node_modules'))
  project=consumer/'project';(project/'.opencode/plugins').mkdir(parents=True)
  wrapper=project/'.opencode/plugins/hi-packed.js';wrapper.write_text("export { default } from 'opencode-hi'\n")
  resolve_result=run(['node','--input-type=module','-e',"console.log(import.meta.resolve('opencode-hi'))"],consumer)
  resolved=resolve_result.stdout.strip().splitlines()[-1] if resolve_result.stdout.strip() else ''
  env=os.environ.copy();env['HOME']=str(home);env['XDG_DATA_HOME']=str(xdg/'data');env['XDG_CONFIG_HOME']=str(xdg/'config');env['XDG_CACHE_HOME']=str(xdg/'cache');env['XDG_STATE_HOME']=str(xdg/'state')
  for key in ('XDG_DATA_HOME','XDG_CONFIG_HOME','XDG_CACHE_HOME','XDG_STATE_HOME'):Path(env[key]).mkdir(parents=True,exist_ok=True)
  port=free_port();log=WORK/'opencode.log'
  with log.open('w') as lf:proc=subprocess.Popen([opencode_bin,'serve','--hostname','127.0.0.1','--port',str(port),'--print-logs','--log-level','INFO'],cwd=project,env=env,stdout=lf,stderr=subprocess.STDOUT,text=True)
  base=f'http://127.0.0.1:{port}';tool_ids=None;server_error=None;session=None;agents=None
  try:
    for _ in range(80):
      if proc.poll() is not None:break
      try:
        q=urllib.parse.urlencode({'directory':str(project)});tool_ids=get_json(base+'/experimental/tool/ids?'+q,2);server_error=None;break
      except Exception as e:server_error=str(e);time.sleep(.25)
    try:
      req=urllib.request.Request(base+'/session?directory='+urllib.parse.quote(str(project),safe=''),data=json.dumps({'title':'Hi packed consumer acceptance'}).encode(),headers={'content-type':'application/json'},method='POST')
      with urllib.request.urlopen(req,timeout=5) as r:session=json.loads(r.read().decode())
    except Exception as e:session={'error':str(e)}
    try:
      q=urllib.parse.urlencode({'directory':str(project)});agents=get_json(base+'/agent?'+q,5)
    except Exception as e:agents={'error':str(e)}
  finally:
    try:proc.terminate();proc.wait(timeout=5)
    except Exception:
      try:proc.kill()
      except Exception:pass
  ids=tool_ids if isinstance(tool_ids,list) else (tool_ids.get('data') if isinstance(tool_ids,dict) else None);ids=ids if isinstance(ids,list) else []
  hi_ids=sorted(x for x in ids if isinstance(x,str) and x.startswith('hi_'));expected_hi_ids=expected_hi_runtime_tools(ROOT)
  agent_rows=agents if isinstance(agents,list) else (agents.get('data') if isinstance(agents,dict) else None);agent_rows=agent_rows if isinstance(agent_rows,list) else []
  coder=next((x for x in agent_rows if isinstance(x,dict) and x.get('name')=='coder'),None);log_text=log.read_text(errors='replace') if log.exists() else ''
  session_data=session.get('data') if isinstance(session,dict) and isinstance(session.get('data'),dict) else session
  packed_entry_root=str((consumer/'node_modules/opencode-hi').resolve());source_entrypoint=str((ROOT/'plugin/dist/plugin.js').resolve())
  checks={
    'pack_install':install.returncode==0,
    'node_setup':setup.returncode==0 and setup_cfg.get('plugin')==[expected_spec],
    'node_setup_no_application_root_node_project':setup_clean,
    'consumer_resolution':bool(resolved) and resolved.startswith('file://'+packed_entry_root+'/') and resolved!='file://'+source_entrypoint,
    'server_tool_ids':hi_ids==expected_hi_ids,
    'agent_projection':isinstance(coder,dict) and coder.get('name')=='coder' and coder.get('mode')=='subagent' and coder.get('description')=='Implements scoped changes and produces test and behavior evidence',
    'session_create':isinstance(session_data,dict) and not session_data.get('error') and bool(session_data.get('id')),
    'no_source_tree_in_server_log':source_entrypoint not in log_text,
    'exact_host_version':opencode_version==TARGET,
  }
  status='PASS' if all(checks.values()) else 'FAIL';head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip();tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=ROOT,text=True).strip()
  provider_run={'attempted':False,'reason':'provider-backed chat is outside fresh package/runtime acceptance and isolated HOME does not borrow user provider credentials'}
  receipt={'schema':1,'kind':'PROMPT_B_FRESH_CONSUMER_EXACT_HOST_ACCEPTANCE','program':'PROMPT_B','section':26,'status':status,'source':{'commit':head,'tree':tree},'host':{'opencode':opencode_version,'platform':'linux','architecture':os.uname().machine,'binary':opencode_bin,'binary_sha256':opencode_sha256,'registry_observation':registry},'package':{'release':PACKAGE['version'],'tarball_name':tgz.name,'tarball_sha256':tarball_sha,'installed_from_tarball':True,'resolved_entrypoint':resolved.replace(str(WORK),'<acceptance>')},'consumer':{'project':str(project).replace(str(WORK),'<acceptance>'),'wrapper':'.opencode/plugins/hi-packed.js','node_setup_project':str(bootstrap).replace(str(WORK),'<acceptance>'),'node_setup_rc':setup.returncode},'material_runtime':{'hi_tool_count':len(hi_ids),'hi_tools':hi_ids,'expected_hi_tool_count':len(expected_hi_ids),'expected_hi_tools':expected_hi_ids,'agent_endpoint_count':len(agent_rows),'coder_agent_observed':bool(coder),'coder_projection':({k:coder.get(k) for k in ('name','mode','description','native','hidden') if k in coder} if isinstance(coder,dict) else None),'session':{'created':checks['session_create'],'version':(session_data.get('version') if isinstance(session_data,dict) else None),'directory':'<acceptance>/consumer/project'},'provider_run':provider_run},'checks':checks,'claim_boundary':f'Fresh packed artifact installed outside source tree and loaded by exact OpenCode {TARGET} through its native local-plugin seam. Normal-user Node setup is independently exercised from the same packed artifact. Provider-backed model execution is outside package/runtime acceptance; tool registration, config/agent projection and session material path are provider-independent.'}
  OUT.write_text(json.dumps(receipt,indent=2,ensure_ascii=False)+'\n')
  print(f"fresh consumer acceptance {status}: host={TARGET} hi_tools={len(hi_ids)} session={checks['session_create']} agent={checks['agent_projection']} node_setup={checks['node_setup']}")
  if status!='PASS':print(json.dumps(checks,indent=2));print(log_text[-3000:])
  return 0 if status=='PASS' else 1
if __name__=='__main__':raise SystemExit(main())
