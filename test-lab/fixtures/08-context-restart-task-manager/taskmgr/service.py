from .store import load
def summary(path):
 tasks=getattr(summary,'_cache',None)
 if tasks is None: tasks=summary._cache=load(path)
 return f'{len(tasks)} tasks'
