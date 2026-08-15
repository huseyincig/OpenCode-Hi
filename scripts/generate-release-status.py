#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/release-status-0.1.0.json'
DOC=ROOT/'docs/RELEASE.md'
BEGIN='<!-- BEGIN GENERATED RELEASE STATUS -->'
END='<!-- END GENERATED RELEASE STATUS -->'
INPUTS={
 'final_acceptance':'data/validation/final-acceptance-0.1.0.json',
 'release_gates':'data/validation/release-gates.json',
 'publication':'data/validation/release-publication-0.1.0.json',
 'compatibility':'data/validation/compatibility-matrix-0.1.0.json',
 'oidc_readiness':'data/validation/npm-oidc-readiness-0.1.0.json',
}
def read(rel):return json.loads((ROOT/rel).read_text())
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def main():
 fa,rg,pub,cm,oidc=(read(INPUTS[k]) for k in ('final_acceptance','release_gates','publication','compatibility','oidc_readiness'))
 release=pub.get('release');
 if release!='0.1.0' or rg.get('release')!=release or fa.get('release')!=release:raise SystemExit('release identity drift across status inputs')
 released=pub.get('released_source') or {};gh=pub.get('github_release') or {};npm=pub.get('npm_registry') or {}
 rgpub=((rg.get('current_local_evidence') or {}).get('final_publication') or {})
 if gh.get('status')!='PASS_T4':raise SystemExit('GitHub release is not PASS_T4')
 if npm.get('status')!='BLOCKED_T4_AUTH':raise SystemExit('npm status no longer matches blocked-auth projection; refresh source receipts first')
 if rg.get('release_blocked') is not True or rgpub.get('released_source')!=released.get('git_commit'):raise SystemExit('release-gates/publication source mismatch')
 if released.get('peeled_commit')!=released.get('git_commit') or released.get('remote_tag_peeled')!=released.get('git_commit'):raise SystemExit('published tag/source binding drift')
 host=cm.get('current_reference_host') or {};caps=host.get('capabilities') or {}
 if not all((caps.get(k) or {}).get('status')=='SUPPORTED_T3' for k in ('process-lifecycle','workspace-isolation-binding','browser-execution')):raise SystemExit('current compatibility projection is not fully T3 for selected owned capabilities')
 ext=oidc.get('current_external_state') or {};flow=oidc.get('external_completion_sequence') or []
 if ext.get('npm_whoami')!='ENEEDAUTH' or ext.get('trusted_publisher_configurable_now') is not False:raise SystemExit('OIDC readiness external state changed; refresh R1 evidence before generating release status')
 dates=[x for x in [fa.get('generated_at'),rg.get('generated_at'),pub.get('generated_at'),cm.get('generated_at'),oidc.get('generated_at')] if x]
 out={
  'schema':1,'release':release,'kind':'GENERATED_RELEASE_STATUS_PROJECTION','generated_at':max(dates),
  'generator':'scripts/generate-release-status.py',
  'claim_boundary':'Projection only. Canonical release/publication/host receipts remain the evidence owners; this file owns no release, host capability, authority, or verification state.',
  'inputs':{name:{'path':rel,'sha256':sha(rel)} for name,rel in INPUTS.items()},
  'status':'PARTIAL_EXTERNAL_NPM_BOOTSTRAP_AUTH',
  'release_blocked':True,
  'github':{'status':'PASS_T4','tag':gh.get('tag_name'),'released_source':released.get('git_commit'),'release_id':gh.get('release_id'),'asset_digest_match':gh.get('asset_digest_match')},
  'npm':{'status':npm.get('status'),'whoami_error':npm.get('whoami_error'),'package_present':False,'publish_attempted':npm.get('publish_attempted'),'trusted_publishing_local_readiness':oidc.get('status'),'trusted_publisher_configurable_now':ext.get('trusted_publisher_configurable_now'),'completion_sequence':flow},
  'reference_host':{'opencode_version':host.get('opencode_version'),'platform':host.get('platform'),'architecture':host.get('architecture'),'status':host.get('status'),'capabilities':{k:{'status':v.get('status'),'receipt':v.get('receipt'),'tested_git_commit':v.get('tested_git_commit')} for k,v in caps.items()}},
  'verification':{'persisted_test_count':False,'reason':'Test counts are fresh command output and are intentionally not hand-maintained in release documentation.','commands':{k:v.get('command') for k,v in (rg.get('current_local_evidence') or {}).items() if isinstance(v,dict) and v.get('command')}},
  'rules':['immutable GitHub v0.1.0 source/tag is never rewritten to absorb later engineering','npm T4 remains open until real registry version/integrity/shasum and fresh-install proof exists','current host/capability status is consumed from the generated receipt compatibility projection','test counts are not persisted as release truth'],
 }
 OUT.write_text(json.dumps(out,indent=2)+'\n')
 block='\n'.join([
 BEGIN,
 '## Current release status — generated',
 '',
 f"- Release: `{release}` — **{out['status']}**.",
 f"- GitHub: **PASS_T4** for `{out['github']['tag']}` at exact source `{out['github']['released_source']}`; remote asset digests match: `{str(bool(out['github']['asset_digest_match'])).lower()}`.",
 f"- npm: **{out['npm']['status']}**; package is not yet present, no publish has been attempted, and Trusted Publisher binding remains unavailable until the package exists.",
 f"- Trusted Publishing: local workflow readiness is `{out['npm']['trusted_publishing_local_readiness']}`; bootstrap publication/auth + registry proof + trust binding remain external.",
 f"- Reference host: OpenCode `{out['reference_host']['opencode_version']}` on `{out['reference_host']['platform']}/{out['reference_host']['architecture']}`; process/workspace/browser owned surfaces are receipt-backed `SUPPORTED_T3`.",
 '- Test counts are intentionally not persisted here. Run the canonical verification commands for fresh counts/results.',
 f"- Machine source: `data/validation/release-status-0.1.0.json` (generated from hash-bound receipts/status inputs).",
 END,
 ])
 text=DOC.read_text()
 if BEGIN in text and END in text:
  a=text.index(BEGIN);b=text.index(END,a)+len(END);text=text[:a]+block+text[b:]
 else:text=text.rstrip()+'\n\n'+block+'\n'
 DOC.write_text(text)
 print(f'wrote {OUT.relative_to(ROOT)} and generated RELEASE.md status block')
if __name__=='__main__':main()
