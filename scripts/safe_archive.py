#!/usr/bin/env python3
from __future__ import annotations
import os, stat, zipfile
from pathlib import Path, PurePosixPath
MAX_FILES=10000
MAX_UNCOMPRESSED=512*1024*1024
MAX_RATIO=200.0
class UnsafeArchive(ValueError): pass
def _safe_member(name:str)->PurePosixPath:
    n=name.replace('\\','/'); p=PurePosixPath(n)
    if not n or n.startswith('/') or p.is_absolute(): raise UnsafeArchive(f'absolute archive path: {name}')
    if len(n)>=2 and n[1]==':' and n[0].isalpha(): raise UnsafeArchive(f'drive archive path: {name}')
    if any(part in ('..','') for part in p.parts): raise UnsafeArchive(f'path traversal archive member: {name}')
    return p
def inspect_zip(path:Path)->dict:
    total=0; count=0
    with zipfile.ZipFile(path) as z:
        for i in z.infolist():
            count+=1
            if count>MAX_FILES: raise UnsafeArchive('archive file-count limit exceeded')
            _safe_member(i.filename)
            mode=(i.external_attr>>16)&0xFFFF
            if stat.S_ISLNK(mode): raise UnsafeArchive(f'symlink archive member: {i.filename}')
            total+=i.file_size
            if total>MAX_UNCOMPRESSED: raise UnsafeArchive('archive uncompressed-size limit exceeded')
            if i.file_size>0 and i.compress_size==0: raise UnsafeArchive(f'invalid compression ratio: {i.filename}')
            if i.compress_size>0 and i.file_size/i.compress_size>MAX_RATIO: raise UnsafeArchive(f'archive compression-ratio limit exceeded: {i.filename}')
    return {'files':count,'uncompressed_bytes':total}
def safe_extract_zip(path:Path,destination:Path)->dict:
    report=inspect_zip(path); root=destination.resolve(); destination.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            rel=_safe_member(info.filename); target=(destination/Path(*rel.parts)).resolve()
            if os.path.commonpath([str(root),str(target)])!=str(root): raise UnsafeArchive(f'extraction escape: {info.filename}')
            if info.is_dir(): target.mkdir(parents=True,exist_ok=True); continue
            target.parent.mkdir(parents=True,exist_ok=True)
            with z.open(info) as src, open(target,'wb') as dst:
                while True:
                    chunk=src.read(1024*1024)
                    if not chunk: break
                    dst.write(chunk)
    return report
