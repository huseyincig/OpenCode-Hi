from dataclasses import dataclass
@dataclass
class Task: title:str; due:str; repeat_hours:int|None=None
