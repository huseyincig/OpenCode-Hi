#!/usr/bin/env python3
from __future__ import annotations

import argparse
import fnmatch
import json
import re
import subprocess
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT=Path(__file__).resolve().parents[1]
POLICY_PATH=ROOT/'data/opencode-host-compatibility-policy.json'
OBSERVATION_PATH=ROOT/'data/validation/opencode-upstream-observation.json'
ASSET_MANIFEST_PATH=ROOT/'data/opencode-host-assets.json'
SEMVER_RE=re.compile(r'^(\d+)\.(\d+)\.(\d+)$')
REQUIRED_ASSETS={
    'linux-x64':'opencode-linux-x64.tar.gz',
    'linux-arm64':'opencode-linux-arm64.tar.gz',
    'windows-x64':'opencode-windows-x64.zip',
    'windows-arm64':'opencode-windows-arm64.zip',
}


def run(cmd:list[str],cwd:Path|None=None,timeout:int=60)->str:
    p=subprocess.run(cmd,cwd=cwd,text=True,capture_output=True,timeout=timeout)
    if p.returncode!=0:
        raise RuntimeError(f"command failed ({p.returncode}): {' '.join(cmd)}\n{(p.stderr or p.stdout)[-1800:]}")
    return p.stdout.strip()


def semver(value:str)->tuple[int,int,int]:
    m=SEMVER_RE.fullmatch(str(value).strip())
    if not m: raise ValueError(f'not stable semver: {value!r}')
    return tuple(map(int,m.groups()))


def target_version()->str:
    pkg=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
    sdk=str((pkg.get('dependencies') or {}).get('@opencode-ai/sdk') or '').strip()
    peer=str((pkg.get('peerDependencies') or {}).get('@opencode-ai/plugin') or '').strip()
    if not SEMVER_RE.fullmatch(sdk) or peer!=sdk:
        raise RuntimeError(f'exact OpenCode target pin drift: sdk={sdk or "<missing>"} plugin={peer or "<missing>"}')
    return sdk


def policy()->dict[str,Any]:
    p=json.loads(POLICY_PATH.read_text(encoding='utf-8'))
    if p.get('schema')!=1 or p.get('kind')!='OPENCODE_HOST_COMPATIBILITY_POLICY':
        raise RuntimeError('invalid OpenCode compatibility policy')
    return p


def resolve_registry_state(target:str,versions:dict[str,str|None])->dict[str,Any]:
    expected=['opencode-ai','@opencode-ai/sdk','@opencode-ai/plugin']
    normalized={k:(str(versions.get(k)).strip() if versions.get(k) is not None else None) for k in expected}
    if any(v is None or not SEMVER_RE.fullmatch(v) for v in normalized.values()):
        return {'status':'REGISTRY_UNAVAILABLE','latest':None,'target':target,'versions':normalized,'target_current':False,'support_promotion_allowed':False}
    unique=set(normalized.values())
    if len(unique)!=1:
        return {'status':'REGISTRY_SKEW','latest':None,'target':target,'versions':normalized,'target_current':False,'support_promotion_allowed':False}
    latest=next(iter(unique))
    if semver(latest)==semver(target): status='CURRENT'
    elif semver(latest)>semver(target): status='UPDATE_AVAILABLE'
    else: status='TARGET_AHEAD_OF_REGISTRY'
    return {'status':status,'latest':latest,'target':target,'versions':normalized,'target_current':status=='CURRENT','support_promotion_allowed':False}


def _matches(path:str,patterns:list[str])->bool:
    return any(fnmatch.fnmatchcase(path,p) for p in patterns)


def classify_changed_paths(p:dict[str,Any],changed_paths:list[str])->dict[str,Any]:
    paths=sorted({str(x).strip().replace('\\','/') for x in changed_paths if str(x).strip()})
    ignored_patterns=list(p.get('ignored_change_patterns') or [])
    critical_roots=tuple(str(x) for x in (p.get('critical_roots') or []))
    ignored=[]
    candidate=[]
    for path in paths:
        if _matches(path,ignored_patterns): ignored.append(path)
        else: candidate.append(path)
    surface_changes:dict[str,list[str]]={}
    covered:set[str]=set()
    groups_by_id={str(g['id']):g for g in (p.get('surface_groups') or [])}
    for gid,g in groups_by_id.items():
        matched=[path for path in candidate if _matches(path,list(g.get('patterns') or []))]
        if matched:
            surface_changes[gid]=matched
            covered.update(matched)
    unclassified=sorted(path for path in candidate if path not in covered and path.startswith(critical_roots))
    other=sorted(path for path in candidate if path not in covered and path not in unclassified)
    surface_ids=sorted(surface_changes)
    selected=[groups_by_id[x] for x in surface_ids]
    t3=sorted({str(cap) for g in selected for cap in (g.get('t3_capabilities') or [])})
    full_t3=any(g.get('full_t3_required') is True for g in selected)
    fresh=any(g.get('fresh_consumer_required') is True for g in selected)
    manual=bool(unclassified)
    if manual: classification='MANUAL_REVIEW_REQUIRED'
    elif surface_ids: classification='CAPABILITY_RELEVANT'
    else: classification='METADATA_ONLY'
    return {
        'classification':classification,
        'changed_files':paths,
        'surface_ids':surface_ids,
        'surface_changes':surface_changes,
        'ignored':ignored,
        'other_noncritical':other,
        'unclassified':unclassified,
        't3_capabilities':t3,
        'fresh_consumer_required':fresh,
        'full_t3_required':full_t3,
        'manual_review_required':manual,
        'support_promotion_allowed':False,
    }


def registry_versions(p:dict[str,Any])->dict[str,str|None]:
    out:dict[str,str|None]={}
    for package in p['upstream']['registry_packages']:
        try:
            raw=run(['npm','view',package,'version','--json'],ROOT,30)
            value=json.loads(raw)
            out[package]=value if isinstance(value,str) else None
        except Exception:
            out[package]=None
    return out


def release_cadence()->dict[str,Any]:
    try:
        raw=run(['npm','view','opencode-ai','time','--json'],ROOT,30)
        data=json.loads(raw)
    except Exception as e:
        return {'status':'UNAVAILABLE','error':str(e)}
    now=datetime.now(timezone.utc)
    rows=[]
    for version,stamp in data.items():
        if not SEMVER_RE.fullmatch(version): continue
        try: at=datetime.fromisoformat(str(stamp).replace('Z','+00:00'))
        except Exception: continue
        rows.append((at,version))
    rows.sort(reverse=True)
    return {
        'status':'OBSERVED',
        'stable_releases_7d':sum(at>=now-timedelta(days=7) for at,_ in rows),
        'stable_releases_30d':sum(at>=now-timedelta(days=30) for at,_ in rows),
        'recent':[{'version':v,'published_at':at.isoformat()} for at,v in rows[:12]],
    }


def default_upstream_repo()->Path:
    try:
        common=Path(run(['git','rev-parse','--path-format=absolute','--git-common-dir'],ROOT)).resolve()
        project=common.parent
    except Exception:
        project=ROOT
    return project/'.agent-work/external/repos/anomalyco-opencode'


def git_cmd(repo:Path,*args:str,timeout:int=60)->str:
    return run(['git','-c',f'safe.directory={repo}','-C',str(repo),*args],timeout=timeout)


def verify_upstream_repo(repo:Path,p:dict[str,Any])->None:
    if not (repo/'.git').exists(): raise RuntimeError(f'upstream repo missing: {repo}')
    origin=git_cmd(repo,'remote','get-url','origin')
    accepted={p['upstream']['repository'],'git@github.com:anomalyco/opencode.git','https://github.com/anomalyco/opencode'}
    if origin not in accepted: raise RuntimeError(f'untrusted OpenCode upstream origin: {origin}')


def ensure_tag(repo:Path,version:str,fetch:bool)->str:
    ref=f'v{version}'
    if fetch:
        git_cmd(repo,'fetch','--quiet','origin','tag',ref,timeout=120)
    try: return git_cmd(repo,'rev-parse',ref)
    except Exception as e: raise RuntimeError(f'missing exact upstream tag {ref}; rerun with --fetch') from e


def git_delta(repo:Path,from_version:str,to_version:str,fetch:bool)->dict[str,Any]:
    from_commit=ensure_tag(repo,from_version,fetch)
    to_commit=ensure_tag(repo,to_version,fetch)
    changed=git_cmd(repo,'diff','--name-only',f'v{from_version}..v{to_version}').splitlines()
    return {'from_ref':f'v{from_version}','from_commit':from_commit,'to_ref':f'v{to_version}','to_commit':to_commit,'changed_files':[x for x in changed if x]}


def github_release(version:str,p:dict[str,Any])->dict[str,Any]:
    repo=p['upstream']['github_repository']
    url=f'https://api.github.com/repos/{repo}/releases/tags/v{version}'
    req=urllib.request.Request(url,headers={'User-Agent':'OpenCode-Hi compatibility tracker','Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(req,timeout=30) as r: raw=json.loads(r.read().decode('utf-8'))
    assets={}
    for row in raw.get('assets') or []:
        name=row.get('name');digest=row.get('digest')
        if isinstance(name,str) and isinstance(digest,str) and digest.startswith('sha256:'):
            assets[name]={'sha256':digest.split(':',1)[1],'size':row.get('size'),'url':row.get('browser_download_url')}
    return {'tag_name':raw.get('tag_name'),'immutable':raw.get('immutable') is True,'published_at':raw.get('published_at'),'html_url':raw.get('html_url'),'assets':assets}


def asset_manifest(version:str,release:dict[str,Any],source_commit:str)->dict[str,Any]:
    if release.get('tag_name')!=f'v{version}' or release.get('immutable') is not True:
        raise RuntimeError(f'OpenCode v{version} release is not exact immutable release metadata')
    assets={}
    for platform_key,name in REQUIRED_ASSETS.items():
        row=(release.get('assets') or {}).get(name)
        if not row or not re.fullmatch(r'[a-f0-9]{64}',str(row.get('sha256') or '')):
            raise RuntimeError(f'missing immutable SHA-256 for {name}')
        assets[platform_key]={'name':name,'sha256':row['sha256'],'size':row.get('size'),'url':row.get('url')}
    return {
        'schema':1,
        'kind':'OPENCODE_EXACT_HOST_ASSET_MANIFEST',
        'version':version,
        'tag':f'v{version}',
        'source_commit':source_commit,
        'release_immutable':True,
        'published_at':release.get('published_at'),
        'assets':assets,
        'claim_boundary':'Committed integrity metadata for exact OpenCode host acceptance. A newer upstream release never rewrites this target automatically.',
    }


def observe(args:argparse.Namespace)->dict[str,Any]:
    p=policy();target=target_version();versions=registry_versions(p);state=resolve_registry_state(target,versions)
    out:dict[str,Any]={
        'schema':1,
        'kind':'OPENCODE_UPSTREAM_OBSERVATION',
        'observed_at':datetime.now(timezone.utc).isoformat(),
        'target':target,
        'registry':state,
        'cadence':release_cadence(),
        'policy':'data/opencode-host-compatibility-policy.json',
        'support_promotion_allowed':False,
    }
    if args.registry_only or state.get('latest') is None:
        return out
    latest=str(state['latest'])
    repo=Path(args.repo).resolve() if args.repo else default_upstream_repo().resolve()
    try:
        verify_upstream_repo(repo,p)
        if state['status']=='UPDATE_AVAILABLE':
            delta=git_delta(repo,target,latest,args.fetch)
            out['upstream_delta']={**delta,'impact':classify_changed_paths(p,delta['changed_files'])}
        else:
            commit=ensure_tag(repo,target,args.fetch)
            out['upstream_delta']={'from_ref':f'v{target}','from_commit':commit,'to_ref':f'v{target}','to_commit':commit,'changed_files':[],'impact':classify_changed_paths(p,[])}
        rel=github_release(latest,p)
        out['latest_release']={k:v for k,v in rel.items() if k!='assets'}
        out['latest_release']['asset_digests']={name:row['sha256'] for name,row in rel['assets'].items() if name in REQUIRED_ASSETS.values()}
    except Exception as e:
        out['analysis_error']=str(e)
        if state['status']=='UPDATE_AVAILABLE':
            out['upstream_delta']={'impact':{'classification':'MANUAL_REVIEW_REQUIRED','manual_review_required':True,'support_promotion_allowed':False,'unclassified':['analysis-unavailable'],'surface_ids':[],'t3_capabilities':[],'fresh_consumer_required':True,'full_t3_required':False}}
    return out


def parse_args(argv:list[str]|None=None)->argparse.Namespace:
    ap=argparse.ArgumentParser(description='Observe and classify OpenCode stable-version drift without auto-promoting compatibility.')
    ap.add_argument('--repo',help='Exact anomalyco/opencode mirror used for source diff classification.')
    ap.add_argument('--fetch',action='store_true',help='Fetch the exact target/latest stable tags into the project-local mirror.')
    ap.add_argument('--write',action='store_true',help='Write data/validation/opencode-upstream-observation.json.')
    ap.add_argument('--write-assets',action='store_true',help='Write committed exact-target release asset digests for host acceptance.')
    ap.add_argument('--require-current',action='store_true',help='Exit nonzero unless package target equals the stable registry version.')
    ap.add_argument('--registry-only',action='store_true',help='Observe registry versions only; do not inspect or mutate the upstream Git mirror.')
    return ap.parse_args(argv)


def main(argv:list[str]|None=None)->int:
    args=parse_args(argv);out=observe(args)
    if args.write:
        OBSERVATION_PATH.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    if args.write_assets:
        p=policy();target=target_version();repo=Path(args.repo).resolve() if args.repo else default_upstream_repo().resolve();verify_upstream_repo(repo,p)
        commit=ensure_tag(repo,target,args.fetch);release=github_release(target,p);manifest=asset_manifest(target,release,commit)
        ASSET_MANIFEST_PATH.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        out['asset_manifest']='data/opencode-host-assets.json'
    print(json.dumps(out,indent=2,ensure_ascii=False))
    status=(out.get('registry') or {}).get('status')
    if status in {'REGISTRY_SKEW','REGISTRY_UNAVAILABLE','TARGET_AHEAD_OF_REGISTRY'}: return 2
    if args.require_current and status!='CURRENT': return 3
    return 0


if __name__=='__main__':
    raise SystemExit(main())
