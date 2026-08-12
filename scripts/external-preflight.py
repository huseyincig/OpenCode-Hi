#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, shutil, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SETUP=ROOT/'scripts'/'native_plugin_setup.py'

def run_json(args:list[str])->dict:
    p=subprocess.run([sys.executable,str(SETUP),*args],text=True,capture_output=True)
    try:d=json.loads(p.stdout)
    except Exception:d={'status':'ERROR','stdout':p.stdout.strip(),'stderr':p.stderr.strip()}
    d['_returncode']=p.returncode
    return d

def detect_version(exe:str|None)->str|None:
    if not exe:return None
    for argv in ([exe,'--version'],[exe,'version']):
        try:
            p=subprocess.run(argv,text=True,capture_output=True,timeout=10)
            out=(p.stdout or p.stderr).strip()
            if p.returncode==0 and out:return out.splitlines()[0].strip()
        except Exception:pass
    return None

def main()->int:
    ap=argparse.ArgumentParser(description='HI external-runtime preflight; does not claim runtime acceptance.')
    ap.add_argument('project',nargs='?',default='.')
    ap.add_argument('--opencode-version')
    ap.add_argument('--git-ref',help='Exact pushed commit/tag intended for hi-test-lab')
    a=ap.parse_args();project=str(Path(a.project).expanduser().resolve())
    oc=shutil.which('opencode');node=shutil.which('node');npm=shutil.which('npm');detected=detect_version(oc);version=a.opencode_version or detected
    doctor=run_json(['doctor',project])
    checks={
      'opencode_cli':{'status':'PASS' if oc else 'ACTION_REQUIRED','path':oc,'version':detected},
      'node':{'status':'PASS' if node else 'INFO','path':node},
      'npm':{'status':'PASS' if npm else 'INFO','path':npm},
      'plugin_runtime':{'status':'PASS' if (ROOT/'plugin/dist/plugin.js').is_file() else 'ACTION_REQUIRED','path':str(ROOT/'plugin/dist/plugin.js')},
      'git_ref':{'status':'PASS' if a.git_ref else 'ACTION_REQUIRED','value':a.git_ref},
      'registration_doctor':{'status':'PASS' if doctor.get('status') in ('OK','WARN') else 'ACTION_REQUIRED','detail':doctor},
    }
    blockers=[k for k,v in checks.items() if v['status']=='ACTION_REQUIRED']
    if not version:blockers.append('opencode_version')
    out={
      'status':'READY_FOR_Hi_TEST_LAB' if not blockers else 'PREPARATION_REQUIRED',
      'product':'OpenCode-Hi','short':'HI','project':project,'opencode_version':version,
      'blockers':blockers,'checks':checks,
      'canonical_lab':'hi-test-lab','lab_mode':'clean consumer Git install',
      'next_commands':[f'python scripts/native_plugin_setup.py install {project}'+(f' --ref {a.git_ref}' if a.git_ref else ''),'Restart OpenCode','Run exact Git candidate acceptance in hi-test-lab']
    }
    print(json.dumps(out,ensure_ascii=False,indent=2));return 0 if not blockers else 2
if __name__=='__main__':raise SystemExit(main())
