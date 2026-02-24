from __future__ import annotations

"""
Day 1 Mini Spec: API Entrypoint

Inputs:
- HTTP requests routed to /health and /game/*.

Outputs:
- FastAPI app object for uvicorn.
- Health payload {"status": "ok"}.

Workflow:
1. Initialize app.
2. Register health endpoint.
3. Include game router.
"""

from fastapi import FastAPI

from backend.app.routes.game import router as game_router

app = FastAPI(title="Probabilistic Poker Engine API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(game_router)
