from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.logging import configure_logging, get_logger
from backend.app.routes.game import router as game_router
from backend.app.storage.db import init_db

configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    logger.info("in-memory store initialized")
    yield


app = FastAPI(title="Probabilistic Poker Engine API", lifespan=lifespan)

_default_origins = ["http://localhost:5173", "http://localhost:3000"]
_env_origin = os.getenv("VITE_API_BASE_URL")
_allowed_origins = list({*_default_origins, *([_env_origin] if _env_origin else [])})

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(game_router)
