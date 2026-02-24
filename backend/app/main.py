from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app.core.logging import configure_logging, get_logger
from backend.app.routes.game import router as game_router
from backend.app.storage.db import init_db

configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    logger.info("database initialized")
    yield


app = FastAPI(title="Probabilistic Poker Engine API", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(game_router)
