from __future__ import annotations

import logging

from backend.app.core.config import settings


LOGGER_NAME = "ppe.backend"


def configure_logging() -> None:
    """Configure application logging for local/dev execution."""
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


def get_logger(name: str = LOGGER_NAME) -> logging.Logger:
    return logging.getLogger(name)
