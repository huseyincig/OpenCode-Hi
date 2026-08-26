import json
from dataclasses import asdict
from .model import Task
def save(path,tasks): path.write_text(json.dumps([asdict(x) for x in tasks]))
def load(path):
 try:return [Task(**x) for x in json.loads(path.read_text())]
 except FileNotFoundError:return []
