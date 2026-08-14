#!/usr/bin/env python3
from __future__ import annotations
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'data'/'hi-permission-profiles.json'
OUT=ROOT/'plugin'/'src'/'generated'/'permission-policy.ts'
ID_RE=re.compile(r'^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$')
ACTIONS={'allow','ask','deny'}

def fail(msg:str): raise ValueError(msg)
def load_catalog()->list[dict]:
    raw=json.loads(CATALOG.read_text(encoding='utf-8'))
    if raw.get('schema')!=1 or raw.get('type')!='hi-permission-profile-catalog': fail('permission profile catalog header invalid')
    profiles=raw.get('profiles')
    if not isinstance(profiles,list) or not profiles: fail('permission profile catalog must contain profiles')
    ids=[]
    for i,p in enumerate(profiles):
        if not isinstance(p,dict): fail(f'profiles[{i}] must be object')
        required={'id','rules','safety_class','may_be_widened_by_lower_layer','host_mapping_requirements'}
        if set(p)!=required: fail(f'profiles[{i}] fields mismatch: {sorted(set(p)^required)}')
        pid=p['id']; ids.append(pid)
        if not isinstance(pid,str) or not ID_RE.fullmatch(pid): fail(f'profiles[{i}].id invalid')
        if not isinstance(p['safety_class'],str) or not ID_RE.fullmatch(p['safety_class']): fail(f'{pid}: safety_class invalid')
        if p['may_be_widened_by_lower_layer'] is not False: fail(f'{pid}: lower-layer widening must be false')
        hm=p['host_mapping_requirements']
        if not isinstance(hm,list) or not hm or len(hm)!=len(set(hm)) or not all(isinstance(x,str) and ID_RE.fullmatch(x) for x in hm): fail(f'{pid}: host mapping requirements invalid')
        rules=p['rules']
        if not isinstance(rules,list) or not rules: fail(f'{pid}: rules missing')
        seen=set()
        for j,r in enumerate(rules):
            if not isinstance(r,dict) or not {'capability','action'}<=set(r) or set(r)-{'capability','action','pattern'}: fail(f'{pid}.rules[{j}] invalid shape')
            cap=r['capability']; action=r['action']; pattern=r.get('pattern')
            if not isinstance(cap,str) or not ID_RE.fullmatch(cap): fail(f'{pid}.rules[{j}].capability invalid')
            if action not in ACTIONS: fail(f'{pid}.rules[{j}].action invalid')
            if pattern is not None and (not isinstance(pattern,str) or not pattern): fail(f'{pid}.rules[{j}].pattern invalid')
            key=(cap,pattern)
            if key in seen: fail(f'{pid}: duplicate capability/pattern {key}')
            seen.add(key)
    if len(ids)!=len(set(ids)): fail('duplicate permission profile id')
    return profiles

def render_native_permission(profile:dict)->dict:
    out={}
    for rule in profile['rules']:
        cap=rule['capability']; action=rule['action']; pattern=rule.get('pattern')
        if pattern is None:
            if cap in out: fail(f"{profile['id']}: mixed scalar/pattern permission for {cap}")
            out[cap]=action
        else:
            current=out.get(cap)
            if current is None: current={}; out[cap]=current
            if not isinstance(current,dict): fail(f"{profile['id']}: mixed scalar/pattern permission for {cap}")
            current[pattern]=action
    return out

def main():
    profiles=load_catalog()
    normalized=[{
      'id':p['id'],'rules':[{'capability':r['capability'],'action':r['action'],**({'pattern':r['pattern']} if 'pattern' in r else {})} for r in p['rules']],
      'safetyClass':p['safety_class'],'mayBeWidenedByLowerLayer':False,'hostMappingRequirements':p['host_mapping_requirements']
    } for p in profiles]
    payload=json.dumps(normalized,ensure_ascii=False,separators=(',',':'))
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_bytes(('/* generated from data/hi-permission-profiles.json; do not hand edit */\n'+f'export const HI_PERMISSION_PROFILES = {payload} as const\n'+"export type HiPermissionProfileID = typeof HI_PERMISSION_PROFILES[number]['id']\n").encode('utf-8'))
    print(f'generated {len(profiles)} permission profiles -> {OUT.relative_to(ROOT)}')
if __name__=='__main__': main()
