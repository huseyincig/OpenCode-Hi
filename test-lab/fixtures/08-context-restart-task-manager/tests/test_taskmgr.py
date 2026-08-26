from datetime import datetime,timezone
from pathlib import Path
from taskmgr.model import Task
from taskmgr.store import save,load
from taskmgr.timecalc import next_due
from taskmgr.service import summary
def test_timezone_is_preserved():
 d=datetime(2026,1,1,tzinfo=timezone.utc);assert next_due(d,2).tzinfo==timezone.utc
def test_reload_keeps_repeat(tmp_path):
 p=tmp_path/'x.json';save(p,[Task('x','2026-01-01',24)]);assert load(p)[0].repeat_hours==24
def test_summary_reads_current_state(tmp_path):
 p=tmp_path/'x.json';save(p,[Task('a','x')]);assert summary(p)=='1 tasks';save(p,[Task('a','x'),Task('b','y')]);assert summary(p)=='2 tasks'
