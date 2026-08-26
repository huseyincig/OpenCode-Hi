import sys
from pathlib import Path
from .service import summary
if __name__=='__main__': print(summary(Path(sys.argv[1])))
