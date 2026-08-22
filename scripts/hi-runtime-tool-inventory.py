from __future__ import annotations
import json,subprocess
from pathlib import Path

def expected_hi_runtime_tools(root:Path)->list[str]:
    code="import {HI_RUNTIME_TOOL_IDS} from './plugin/dist/runtime/routing/execution-profile.js'; console.log(JSON.stringify([...HI_RUNTIME_TOOL_IDS].sort()))"
    raw=subprocess.check_output(['node','--input-type=module','-e',code],cwd=root,text=True)
    value=json.loads(raw.strip())
    if not isinstance(value,list) or not value or not all(isinstance(x,str) and x.startswith('hi_') for x in value):
        raise RuntimeError('canonical Hi runtime tool inventory is invalid')
    if len(value)!=len(set(value)):
        raise RuntimeError('canonical Hi runtime tool inventory contains duplicates')
    return sorted(value)
