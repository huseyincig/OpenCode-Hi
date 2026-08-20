#!/usr/bin/env python3
from __future__ import annotations
import glob,hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/compatibility-matrix-0.1.0.json'
CAPS={'process_lifecycle':'process-lifecycle','workspace_isolation_binding':'workspace-isolation-binding','browser_execution':'browser-execution'}
KEYWORDS={
 'process-lifecycle':('process','pty','native bash'),
 'workspace-isolation-binding':('workspace','worktree','isolation'),
 'browser-execution':('browser','playwright','chromium','screenshot','runtime health','observation'),
}
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def source_commit(j):
 s=j.get('source_binding') or {}
 return s.get('tested_git_commit') or s.get('git_head') or (s.get('base_git_commit') if s.get('exact_candidate') else None)
def exact(j):
 s=j.get('source_binding') or {}
 return bool(s.get('tested_git_commit') or s.get('exact_head') is True or s.get('exact_candidate') is True or s.get('state')=='CLEAN_COMMITTED_SOURCE')
def rank(commit):
 try:return int(subprocess.check_output(['git','rev-list','--count',commit],cwd=ROOT,text=True).strip())
 except Exception as e:raise SystemExit(f'compatibility generation requires full Git history containing receipt source {commit}: {e}')
def head_distance(commit,head):
 try:
  reachable=subprocess.run(['git','merge-base','--is-ancestor',commit,head],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
  if not reachable:return None
  return int(subprocess.check_output(['git','rev-list','--ancestry-path','--count',f'{commit}..{head}'],cwd=ROOT,text=True).strip())
 except Exception as e:raise SystemExit(f'compatibility generation cannot compare receipt source {commit} to HEAD {head}: {e}')
def semver(v):
 m=re.fullmatch(r'(\d+)\.(\d+)\.(\d+)',str(v or ''));return tuple(map(int,m.groups())) if m else (-1,-1,-1)
def relevant(cap,text):
 low=text.lower()
 if low.startswith('the fixture emitted'):return False
 return any(k in low for k in KEYWORDS[cap])
def main():
 head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 files=sorted(glob.glob(str(ROOT/'data/validation/external-opencode-hi-*.json')))
 receipts=[]
 for fp in files:
  j=read(fp);host=j.get('host') or {};version=host.get('opencode_version') or host.get('version');commit=source_commit(j)
  row={'receipt':Path(fp).relative_to(ROOT).as_posix(),'receipt_sha256':sha(fp),'status':j.get('status'),'opencode_version':version,'platform':str(host.get('os') or '').lower() or None,'architecture':str(host.get('arch') or '').lower() or None,'tested_git_commit':commit,'exact_source':exact(j),'generated_at':j.get('generated_at') or j.get('captured_at'),'gates':{},'limitations':j.get('limitations') or []}
  for key,name in CAPS.items():
   if key in (j.get('gates') or {}):row['gates'][name]=j['gates'][key]
  if commit and row['exact_source']:
   row['source_rank']=rank(commit);row['head_distance']=head_distance(commit,head);row['reachable_from_head']=row['head_distance'] is not None
  receipts.append(row)
 exact_rows=[r for r in receipts if r['exact_source'] and r.get('tested_git_commit') and semver(r.get('opencode_version'))>= (0,0,0)]
 if not exact_rows:raise SystemExit('no exact-source OpenCode receipts found')
 current_version=max((r['opencode_version'] for r in exact_rows),key=semver)
 current_rows=[r for r in exact_rows if r['opencode_version']==current_version]
 platforms={r['platform'] for r in current_rows if r['platform']};arches={r['architecture'] for r in current_rows if r['architecture']}
 if len(platforms)!=1 or len(arches)!=1:raise SystemExit(f'current host platform/arch ambiguous: {platforms} {arches}')
 selected={}
 for cap in CAPS.values():
  candidates=[r for r in current_rows if cap in r['gates']]
  if not candidates:continue
  # Prefer exact proofs on the current HEAD ancestry. rev-list --count is not a chronology across diverged branches.
  candidates.sort(key=lambda r:(bool(r.get('reachable_from_head')), -(r.get('head_distance') if r.get('head_distance') is not None else 10**9), r['source_rank'], r['receipt']))
  chosen=candidates[-1]
  receipt_json=read(ROOT/chosen['receipt']);structured=(receipt_json.get('capability_limitations') or {}).get(cap)
  limits=list(structured) if isinstance(structured,list) else [x for x in chosen['limitations'] if relevant(cap,x)]
  selected[cap]={'status':chosen['gates'][cap],'tested_git_commit':chosen['tested_git_commit'],'receipt':chosen['receipt'],'source_rank':chosen['source_rank'],'reachable_from_head':chosen.get('reachable_from_head',False),'head_distance':chosen.get('head_distance'),'scope_limitations':limits}
 selected_receipts={v['receipt'] for v in selected.values()}
 history=[]
 for r in sorted(receipts,key=lambda x:(semver(x.get('opencode_version')),x.get('source_rank',-1),x['receipt'])):
  rr=dict(r);rr['current_for_capabilities']=[cap for cap,v in selected.items() if v['receipt']==r['receipt']]
  rr['classification']='NON_EXACT_WORKTREE' if not r['exact_source'] else ('CURRENT_CAPABILITY_PROOF' if rr['current_for_capabilities'] else 'HISTORICAL_EXACT_PROOF')
  history.append(rr)
 dates=[r['generated_at'] for r in receipts if r.get('generated_at')]
 out={'schema':1,'release':'0.1.0','generation_head':head,'kind':'GENERATED_RECEIPT_COMPATIBILITY_PROJECTION','generated_at':max(dates) if dates else None,'generator':'scripts/generate-compatibility-matrix.py','generation_requires_full_git_history':True,'claim_boundary':'Projection only. External receipts remain canonical evidence; this file owns no host capability state and cannot promote support without an exact receipt.','current_reference_host':{'opencode_version':current_version,'platform':next(iter(platforms)),'architecture':next(iter(arches)),'status':'CAPABILITY_SCOPED_EXACT_T3','capabilities':selected},'history':history,'rules':['prefer the nearest current-HEAD-ancestor exact receipt for each capability on the highest exact-tested OpenCode version; use Git-history rank only as a fallback when no reachable proof exists','non-exact worktree receipts never promote current compatibility','historical receipts remain in history even when superseded for a capability','scope limitations are retained per selected capability rather than blindly unioning stale cross-capability limitations']}
 OUT.write_text(json.dumps(out,indent=2)+'\n')
 print(f'wrote {OUT.relative_to(ROOT)}')
if __name__=='__main__':main()
