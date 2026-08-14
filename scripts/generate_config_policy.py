#!/usr/bin/env python3
from __future__ import annotations
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'data'/'hi-config-options.json'
OUT=ROOT/'plugin'/'src'/'generated'/'config-policy.ts'
ID_RE=re.compile(r'^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$')
CLASSES={'runtime','diagnostic','schema-marker'}; SAFETY={'preference','constraint','authority-boundary','capacity'}
def fail(msg): raise ValueError(msg)
def nonempty_list(v,field):
    if not isinstance(v,list) or not v or not all(isinstance(x,str) and x.strip() for x in v) or len(v)!=len(set(v)):fail(f'{field}: non-empty unique string array required')
def load_catalog():
    raw=json.loads(CATALOG.read_text())
    if raw.get('schema')!=1 or raw.get('type')!='hi-config-option-catalog':fail('config option catalog header invalid')
    items=raw.get('options');
    if not isinstance(items,list) or not items:fail('config option catalog must contain options')
    ids=set(); paths=set()
    base={'id','path','classification','type','default','owner','source_surfaces','precedence_order','validator','safety_semantics','behavioral_acceptance_refs'}
    optional={'runtime_consumer','executor_effect','diagnostic_consumer','diagnostic_effect','doctor_projection'}
    for i,x in enumerate(items):
        if not isinstance(x,dict):fail(f'options[{i}] must be object')
        if set(x)-base-optional or base-set(x):fail(f"options[{i}] field mismatch: extra={sorted(set(x)-base-optional)} missing={sorted(base-set(x))}")
        oid=x['id']; path=x['path']; cls=x['classification']
        if not isinstance(oid,str) or not ID_RE.fullmatch(oid):fail(f'options[{i}].id invalid')
        if oid in ids or path in paths:fail(f'duplicate config option id/path: {oid}/{path}')
        ids.add(oid);paths.add(path)
        if not isinstance(path,str) or not path or any(not part for part in path.split('.')):fail(f'{oid}: path invalid')
        if cls not in CLASSES:fail(f'{oid}: classification invalid')
        if x['safety_semantics'] not in SAFETY:fail(f'{oid}: safety semantics invalid')
        if x.get('owner')!='hi-config':fail(f'{oid}: owner must be hi-config')
        for k in ['source_surfaces','precedence_order','behavioral_acceptance_refs']:nonempty_list(x[k],f'{oid}.{k}')
        for k in ['type','validator']:
            if not isinstance(x[k],str) or not x[k].strip():fail(f'{oid}.{k} required')
        if cls=='runtime':
            if not all(isinstance(x.get(k),str) and x[k].strip() for k in ['runtime_consumer','executor_effect']):fail(f'{oid}: runtime consumer/effect required')
            if 'diagnostic_consumer' in x or 'diagnostic_effect' in x:fail(f'{oid}: runtime cannot claim diagnostic-only fields')
        else:
            if 'runtime_consumer' in x or 'executor_effect' in x:fail(f'{oid}: non-runtime cannot claim runtime executor')
            if not all(isinstance(x.get(k),str) and x[k].strip() for k in ['diagnostic_consumer','diagnostic_effect']):fail(f'{oid}: diagnostic consumer/effect required')
    return items

def set_path(root,path,value):
    parts=path.split('.'); cur=root
    for p in parts[:-1]:cur=cur.setdefault(p,{})
    cur[parts[-1]]=value

def main():
    items=load_catalog(); defaults={}
    for x in items:set_path(defaults,x['path'],x['default'])
    norm=[]
    for x in items:
        y={'id':x['id'],'path':x['path'],'classification':x['classification'],'type':x['type'],'defaultValue':x['default'],'owner':x['owner'],'sourceSurfaces':x['source_surfaces'],'precedenceOrder':x['precedence_order'],'validator':x['validator'],'safetySemantics':x['safety_semantics'],'behavioralAcceptanceRefs':x['behavioral_acceptance_refs']}
        for a,b in [('runtime_consumer','runtimeConsumer'),('executor_effect','executorEffect'),('diagnostic_consumer','diagnosticConsumer'),('diagnostic_effect','diagnosticEffect'),('doctor_projection','doctorProjection')]:
            if a in x:y[b]=x[a]
        norm.append(y)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_bytes(('/* generated from data/hi-config-options.json; do not hand edit */\n'+f'export const HI_CONFIG_OPTIONS = {json.dumps(norm,separators=(",",":"),ensure_ascii=False)} as const\n'+f'export const HI_CONFIG_DEFAULTS = {json.dumps(defaults,separators=(",",":"),ensure_ascii=False)} as const\n').encode('utf-8'))
    print(f'generated {len(items)} config options -> {OUT.relative_to(ROOT)}')
if __name__=='__main__':main()
