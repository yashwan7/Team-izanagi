"""
Kshitij Backend Main Entrypoint
Forwards directly to backend.merge_engine.service
"""

import uvicorn
from backend.merge_engine.service import app

if __name__ == "__main__":
    uvicorn.run("backend.merge_engine.service:app", host="127.0.0.1", port=8000, reload=True)
