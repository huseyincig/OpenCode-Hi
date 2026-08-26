from datetime import datetime,timedelta
def next_due(dt:datetime,hours:int): return (dt+timedelta(hours=hours)).replace(tzinfo=None)
