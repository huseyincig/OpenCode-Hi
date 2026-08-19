#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import hashlib,json,os,re,subprocess,tempfile,shutil,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/test-harness-isolation-0.1.0.json'

def tree_stats(path:Path):
    files=0;size=0
    if not path.exists():return {'entries':0,'bytes':0}
    try:
        for p in path.rglob('*'):
            try:
                if p.is_file():files+=1;size+=p.stat().st_size
            except OSError:pass
    except OSError:pass
    return {'entries':files,'bytes':size}

def hi_home_state():
    home=Path.home()
    roots=[home/'.local/share/opencode/hi',home/'.local/state/opencode/hi',home/'.config/opencode/hi']
    stats=[tree_stats(p) for p in roots]
    return {'entries':sum(x['entries'] for x in stats),'bytes':sum(x['bytes'] for x in stats)}

def parse(text:str):
    def n(label):
        m=re.findall(rf'ℹ {re.escape(label)} (\d+)(?:\r?\n|$)',text);return int(m[-1]) if m else None
    return {k:n(k) for k in ['tests','pass','fail','cancelled','skipped','todo']}

def valid(summary):return isinstance(summary.get('tests'),int) and summary['tests']>0 and summary.get('pass')==summary['tests'] and summary.get('fail')==0 and summary.get('cancelled')==0

def isolated_env(sandbox:Path):
    for d in ['hi-state','xdg-state','xdg-cache','xdg-config','localappdata']:(sandbox/d).mkdir(parents=True,exist_ok=True)
    env={**os.environ,'OPENCODE_HI_STATE_DIR':str(sandbox/'hi-state'),'XDG_STATE_HOME':str(sandbox/'xdg-state'),'XDG_CACHE_HOME':str(sandbox/'xdg-cache'),'XDG_CONFIG_HOME':str(sandbox/'xdg-config')}
    if os.name=='nt':env['LOCALAPPDATA']=str(sandbox/'localappdata')
    return env

def run_focused(cwd:Path,target:str):
    with tempfile.TemporaryDirectory(prefix='hi-harness-cwd-') as td:
        env=isolated_env(Path(td));r=subprocess.run(['node','--test','--test-timeout=120000',target],cwd=cwd,env=env,text=True,capture_output=True,timeout=180)
    text=(r.stdout or '')+'\n'+(r.stderr or '');summary=parse(text)
    known=r.returncode in (-6,134) and 'uv__io_poll' in text and 'errno == EEXIST' in text and summary.get('fail')==0 and summary.get('cancelled')==0
    return {**summary,'returncode':r.returncode,'known_teardown_normalized':known,'status':'PASS' if valid(summary) and (r.returncode==0 or known) else 'FAIL'}

def main():
    head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip();tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=ROOT,text=True).strip()
    before=hi_home_state()
    r=subprocess.run(['node','../scripts/run-node-test-suite.mjs'],cwd=ROOT/'plugin',text=True,capture_output=True,timeout=330)
    text=(r.stdout or '')+'\n'+(r.stderr or '');canonical=parse(text);after=hi_home_state()
    canonical.update({'home_hi_state_before':before,'home_hi_state_after':after,'home_hi_state_delta':{'entries':after['entries']-before['entries'],'bytes':after['bytes']-before['bytes']},'returncode':r.returncode,'status':'PASS' if valid(canonical) and r.returncode==0 and before==after else 'FAIL'})
    dual={'plugin_cwd':run_focused(ROOT/'plugin','test/native-skill-catalog.test.mjs'),'repo_root_cwd':run_focused(ROOT,'plugin/test/native-skill-catalog.test.mjs')}
    status='PASS' if canonical['status']=='PASS' and all(x['status']=='PASS' for x in dual.values()) else 'FAIL'
    payload={'schema':2,'kind':'PROMPT_B_TEST_HARNESS_ISOLATION_ACCEPTANCE','program':'PROMPT_B','section':30,'status':status,'source_binding':{'tested_git_commit':head,'tested_git_tree':tree,'runner':'scripts/run-node-test-suite.mjs','runner_sha256':hashlib.sha256((ROOT/'scripts/run-node-test-suite.mjs').read_bytes()).hexdigest()},'canonical_suite_observation':canonical,'cwd_dual_run':dual,'cwd_probe':'plugin/test/native-skill-catalog.test.mjs','isolation_env':['OPENCODE_HI_STATE_DIR','XDG_STATE_HOME','XDG_CACHE_HOME','XDG_CONFIG_HOME','LOCALAPPDATA(win32)'],'timeouts':{'per_test_ms':120000,'suite_ms':300000},'host_teardown_rule':'SIGABRT is normalized only with exact uv__io_poll EEXIST signature plus terminal fail=0 and cancelled=0; all other signals/nonzero remain failures.','claim_boundary':'Fresh controlled test-harness acceptance. Counts are terminal observations, never hand-maintained release constants. Mock/fake tests do not own T3.'}
    OUT.write_text(json.dumps(payload,indent=2)+'\n')
    print(f"test harness isolation {status}: node={canonical.get('pass')}/{canonical.get('tests')} home_delta={canonical['home_hi_state_delta']} cwd={dual['plugin_cwd'].get('pass')}/{dual['plugin_cwd'].get('tests')},{dual['repo_root_cwd'].get('pass')}/{dual['repo_root_cwd'].get('tests')}")
    if status!='PASS':print(text[-12000:]);return 1
    return 0
if __name__=='__main__':sys.exit(main())
