"""Настройки из переменных окружения. Для запуска без Docker читает .env из корня репозитория."""

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Config:
    database_url: str
    superjob_api_key: str


def _load_dotenv() -> None:
    """Минимальный разбор .env: KEY=VALUE, без перезаписи уже заданных переменных."""
    for candidate in (Path.cwd() / ".env", Path.cwd().parent / ".env"):
        if not candidate.is_file():
            continue
        for line in candidate.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())
        return


def load() -> Config:
    _load_dotenv()
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise SystemExit("не задан DATABASE_URL")
    return Config(
        database_url=database_url,
        superjob_api_key=os.environ.get("SUPERJOB_API_KEY", ""),
    )
