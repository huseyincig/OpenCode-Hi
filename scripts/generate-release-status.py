#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DOC=ROOT/'docs/RELEASE.md';BEGIN='<!-- BEGIN GENERATED RELEASE STATUS -->';END='<!-- END GENERATED RELEASE STATUS -->'
def read(rel):return json.loads((ROOT/rel).read_text(encoding='utf-8'))
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def main():
 version=(ROOT/'VERSION').read_text(encoding='utf-8').strip();out_rel=f'data/validation/release-status-{version}.json';out_path=ROOT/out_rel
 compat='data/validation/compatibility-matrix-0.1.0.json';hist='data/validation/release-publication-0.1.0.json';cm=read(compat);hp=read(hist)
 host=cm.get('current_reference_host') or {};caps=host.get('capabilities') or {}
 if not all((caps.get(k) or {}).get('status')=='SUPPORTED_T3' for k in ('process-lifecycle','workspace-isolation-binding','browser-execution')):raise SystemExit('current compatibility projection is not fully T3')
 current_pub=f'data/validation/release-publication-{version}.json';published=(ROOT/current_pub).exists();pub=read(current_pub) if published else None
 if published:
  npm=(pub.get('npm_registry') or {});gh=(pub.get('github_release') or {});ok=gh.get('status')=='PASS_T4' and npm.get('status')=='PASS_T4'
  status='CERTIFIED_T4' if ok else 'PARTIAL_T4';blocked=not ok
 else:status='PREPUBLICATION_CERTIFIED_PENDING_T4';blocked=True
 out={'schema':1,'release':version,'kind':'GENERATED_RELEASE_STATUS_PROJECTION','generated_at':'2026-08-16','generator':'scripts/generate-release-status.py','claim_boundary':'Current release projection. Historical v0.1.0 remains immutable evidence. T4 is granted only from real current-version GitHub and npm publication receipts.','inputs':{'compatibility':{'path':compat,'sha256':sha(compat)},'historical_v0_1_0_publication':{'path':hist,'sha256':sha(hist)},**({'current_publication':{'path':current_pub,'sha256':sha(current_pub)}} if published else {})},'status':status,'release_blocked':blocked,'publication_authority':{'granted':True,'condition':'effective only after all engineering and final certification complete'},'historical_github_release':{'tag':'v0.1.0','released_source':(hp.get('released_source') or {}).get('git_commit'),'status':(hp.get('github_release') or {}).get('status')},'candidate':{'version':version,'tag':f'v{version}','github_status':(pub or {}).get('github_release',{}).get('status','PENDING_T4'),'npm_status':(pub or {}).get('npm_registry',{}).get('status','PENDING_T4'),'publication_attempted':published},'reference_host':{'opencode_version':host.get('opencode_version'),'platform':host.get('platform'),'architecture':host.get('architecture'),'status':host.get('status'),'capabilities':{k:{'status':v.get('status'),'receipt':v.get('receipt'),'tested_git_commit':v.get('tested_git_commit')} for k,v in caps.items()}},'verification':{'persisted_test_count':False,'reason':'Test totals belong to fresh certification evidence, not hand-maintained release prose.'},'rules':['historical v0.1.0 tag/release is immutable','current release tag is v'+version,'publication authority becomes effective only after final certification','T4 requires real GitHub and npm verification for the current version']}
 out_path.write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8',newline='\n')
 block='\n'.join([BEGIN,'## Current release status — generated','',f"- Candidate: `{version}` (`v{version}`) — **{status}**.",'- Historical `v0.1.0` remains immutable and is not retagged or source-substituted.',f"- GitHub current candidate: **{out['candidate']['github_status']}**; npm current candidate: **{out['candidate']['npm_status']}**.",('- Publication verification is complete: GitHub Release and npm registry are both PASS_T4.' if status=='CERTIFIED_T4' else '- Publication authority is granted only after final engineering/certification completes; until real publication verification exists, T4 remains pending.'),f"- Reference host: OpenCode `{host.get('opencode_version')}` on `{host.get('platform')}/{host.get('architecture')}`; Hi-owned process/workspace/browser surfaces are exact-receipt `SUPPORTED_T3`.",'- Test counts are intentionally not persisted here; final certification owns fresh totals.',f'- Machine source: `{out_rel}`.',END])
 text=DOC.read_text(encoding='utf-8');
 if BEGIN in text and END in text:
  a=text.index(BEGIN);b=text.index(END,a)+len(END);text=text[:a]+block+text[b:]
 else:text=text.rstrip()+'\n\n'+block+'\n'
 DOC.write_text(text,encoding='utf-8',newline='\n');print(f'wrote {out_rel} and RELEASE.md status block')
if __name__=='__main__':main()
