#!/usr/bin/env python3
from pathlib import Path
import argparse, json, shutil, subprocess
ROOT=Path(__file__).resolve().parents[2]
LAB=ROOT/'test-lab'
p=argparse.ArgumentParser();p.add_argument('scenario');p.add_argument('--reset',action='store_true');a=p.parse_args()
sid=a.scenario
scenario=LAB/'scenarios'/sid
if not scenario.is_dir(): raise SystemExit(f'unknown scenario: {sid}')
run=LAB/'runtime'/sid
if run.exists() and not a.reset: raise SystemExit(f'run already exists: {run}; resume it or use --reset only after proving restart is intended')
if run.exists(): shutil.rmtree(run)
(run/'workspace').mkdir(parents=True);(run/'logs').mkdir();(run/'artifacts').mkdir()
fixture=LAB/'fixtures'/sid
if fixture.is_dir():
 for child in fixture.iterdir():
  target=run/'workspace'/child.name
  shutil.copytree(child,target) if child.is_dir() else shutil.copy2(child,target)
state={"schema":1,"scenario":sid,"status":"READY","classification":None,"last_evidence":"run workspace prepared; scenario not yet started","open_blocker":None,"exact_next_action":"Refresh live host/model inventory, then start the scenario prompt without changing the fixture first.","active_processes":[]}
(run/'RUN_STATE.json').write_text(json.dumps(state,indent=2)+'\n')
program={"schema":1,"program_status":"ACTIVE","active_scenario":sid,"completed":[],"last_evidence":f'{sid} workspace prepared',"exact_next_action":state['exact_next_action']}
sp=LAB/'STATE.json'
if sp.exists():
 try:
  old=json.loads(sp.read_text());program['completed']=old.get('completed',[])
 except Exception: pass
sp.write_text(json.dumps(program,indent=2)+'\n')
print(run)
