from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.config import settings

app = FastAPI(title="DonutSMP Transaction Tracker Dashboard")
DIST = Path(settings.frontend_dist).resolve()

if (DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/{full_path:path}")
async def spa(full_path: str):
    candidate = (DIST / full_path).resolve()
    if full_path and candidate.is_file() and DIST in candidate.parents:
        return FileResponse(candidate)
    return FileResponse(DIST / "index.html")   # /, /transactions, /players/RealSwitchy …
