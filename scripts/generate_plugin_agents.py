#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ROLES=ROOT/'roles'
OUT=ROOT/'plugin'/'src'/'generated'/'agent-config.ts'


def scalar(value:str):
    v=value.strip()
    if v in ('true','false'): return v=='true'
    try: return int(v)
    except ValueError: pass
    if (len(v)>=2 and v[0]==v[-1] and v[0] in "\"'"):
        return v[1:-1]
    return v


def parse_frontmatter(text:str):
    if not text.startswith('---\n'): raise ValueError('missing frontmatter')
    end=text.find('\n---\n',4)
    if end<0: raise ValueError('unterminated frontmatter')
    fm=text[4:end].splitlines(); body=text[end+5:].strip()+'\n'
    root={}; stack=[(-1,root)]
    for raw in fm:
        if not raw.strip() or raw.lstrip().startswith('#'): continue
        indent=len(raw)-len(raw.lstrip(' '))
        line=raw.strip()
        if ':' not in line: raise ValueError(f'unsupported frontmatter line: {raw}')
        key,val=line.split(':',1); key=key.strip().strip('"\''); val=val.strip()
        while stack and indent<=stack[-1][0]: stack.pop()
        parent=stack[-1][1]
        if val=='':
            node={}; parent[key]=node; stack.append((indent,node))
        else: parent[key]=scalar(val)
    return root,body


def main():
    agents={}
    for path in sorted(ROLES.glob('*.md')):
        fm,body=parse_frontmatter(path.read_text(encoding='utf-8'))
        fm['prompt']=body
        agents[path.stem]=fm
    OUT.parent.mkdir(parents=True,exist_ok=True)
    payload=json.dumps(agents,ensure_ascii=False,sort_keys=True,separators=(',',':'))
    OUT.write_text('/* generated from roles/*.md by scripts/generate_plugin_agents.py; do not hand edit */\n'
                   f'export const PACKAGED_HI_AGENTS = {payload} as const\n',encoding='utf-8')
    print(f'generated {len(agents)} agents -> {OUT.relative_to(ROOT)}')

if __name__=='__main__': main()
