from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Runtime settings loaded from environment variables."""

    database_url: str = os.getenv("PPE_DATABASE_URL", "sqlite:///backend/app/storage/ppe.db")
    log_level: str = os.getenv("PPE_LOG_LEVEL", "INFO")


settings = Settings()
