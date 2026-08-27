#!/usr/bin/env python3
from pathlib import Path
import argparse, json, shutil, subprocess

ROOT=Path(__file__).resolve().parents[2]
LAB=ROOT/'test-lab'

def run_checked(args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, text=True, stderr=subprocess.STDOUT).strip()

def write_test_host_config(workspace:Path):
    pool=json.loads((LAB/'config/model-pool.json').read_text())
    allowed=pool['allowed_models']
    if allowed!=pool['cost_priority']:
        raise SystemExit('model-pool allowed_models must exactly equal cost_priority')
    profile=pool.get('execution_profile',{})
    if profile.get('executionPolicy')!='adaptive' or profile.get('topology')!='adaptive' or profile.get('roleModels')!={}:
        raise SystemExit('test model pool must use adaptive executionPolicy/topology with empty roleModels')
    head=run_checked(['git','-c',f'safe.directory={ROOT}','rev-parse','HEAD'],ROOT)
    (workspace/'opencode.json').write_text(json.dumps({
        '$schema':'https://opencode.ai/config.json',
        'plugin':[f'opencode-hi@git+https://github.com/huseyincig/OpenCode-Hi.git#{head}']
    },indent=2)+'\n')
    routing=workspace/'.opencode/hi/policy/routing.json'
    routing.parent.mkdir(parents=True,exist_ok=True)
    routing.write_text(json.dumps({
        'schema':1,
        'type':'hi-routing',
        'executionPolicy':'adaptive',
        'routing':{'roleModels':{},'allowedModels':allowed},
        'execution':{'topology':'adaptive'},
        'applied_by':'opencode-hi-test-lab'
    },indent=2)+'\n')
    return head,allowed

def initialize_isolated_project(workspace:Path):
    run_checked(['git','init','-q','-b','main'],workspace)
    root=Path(run_checked(['git','rev-parse','--show-toplevel'],workspace)).resolve()
    if root!=workspace.resolve():
        raise SystemExit(f'test workspace did not become its own Git worktree: {root}')
    subprocess.check_call(['git','add','-A'],cwd=workspace)
    subprocess.check_call([
        'git','-c','user.name=OpenCode-Hi Test Lab','-c','user.email=test-lab@opencode-hi.invalid',
        'commit','-q','-m','test-lab fixture baseline'
    ],cwd=workspace)
    return run_checked(['git','rev-parse','HEAD'],workspace)

p=argparse.ArgumentParser();p.add_argument('scenario');p.add_argument('--reset',action='store_true');a=p.parse_args()
sid=a.scenario
scenario=LAB/'scenarios'/sid
if not scenario.is_dir(): raise SystemExit(f'unknown scenario: {sid}')
run=LAB/'runtime'/sid
if run.exists() and not a.reset: raise SystemExit(f'run already exists: {run}; resume it or use --reset only after proving restart is intended')
prior_debug_checkpoint=None
if run.exists() and a.reset and (run/'RUN_STATE.json').is_file():
    try:
        old=json.loads((run/'RUN_STATE.json').read_text())
        keep=['classification','root_cause_hypothesis','local_reference_records','hi_reference_delta','failed_strategy_guard','repair_verification','test_model_policy']
        prior_debug_checkpoint={k:old[k] for k in keep if k in old}
    except Exception:
        prior_debug_checkpoint={'classification':'PRIOR_RUN_STATE_UNREADABLE'}
if run.exists():
    shutil.rmtree(run/'workspace',ignore_errors=True)
    shutil.rmtree(run/'tmp',ignore_errors=True)
(run/'workspace').mkdir(parents=True,exist_ok=True)
(run/'logs').mkdir(exist_ok=True)
(run/'artifacts').mkdir(exist_ok=True)
(run/'tmp').mkdir(exist_ok=True)
fixture=LAB/'fixtures'/sid
if fixture.is_dir():
 for child in fixture.iterdir():
  target=run/'workspace'/child.name
  shutil.copytree(child,target) if child.is_dir() else shutil.copy2(child,target)
head,allowed=write_test_host_config(run/'workspace')
baseline=initialize_isolated_project(run/'workspace')
state={
  'schema':1,'scenario':sid,'status':'READY','classification':None,
  'last_evidence':f'isolated Git workspace prepared; baseline={baseline}; product={head}; adaptive lab pool={len(allowed)}',
  'open_blocker':None,
  'exact_next_action':'Refresh live host/model inventory, confirm the effective allowlist is the live intersection of test-lab/config/model-pool.json, then start the scenario prompt once without changing the fixture first.',
  'active_processes':[],
  'test_environment':{'workspace_git_root':str((run/'workspace').resolve()),'baseline_commit':baseline,'product_commit':head,'executionPolicy':'adaptive','topology':'adaptive','roleModels':{},'allowed_models':allowed},
  **({'prior_debug_checkpoint':prior_debug_checkpoint} if prior_debug_checkpoint else {})
}
(run/'RUN_STATE.json').write_text(json.dumps(state,indent=2)+'\n')
program={'schema':1,'program_status':'ACTIVE','active_scenario':sid,'completed':[],'last_evidence':f'{sid} isolated workspace prepared','exact_next_action':state['exact_next_action']}
sp=LAB/'STATE.json'
if sp.exists():
 try:
  old=json.loads(sp.read_text());program['completed']=old.get('completed',[])
 except Exception: pass
sp.write_text(json.dumps(program,indent=2)+'\n')
print(run)
