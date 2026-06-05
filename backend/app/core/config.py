from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

LOCAL_CORS_ORIGINS = [
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def parse_cors_origins(raw: str) -> list[str]:
    if raw == "*":
        return ["*"]
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return list(dict.fromkeys([*origins, *LOCAL_CORS_ORIGINS]))


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    jwt_secret: str
    jwt_exp_hours: int
    jwt_remember_days: int
    app_env: str
    cors_origins_raw: str
    cors_origins: list[str]
    frontend_url: str
    app_version: str
    kitchen_ready_visible_minutes: int


def _int_env(name: str, default: str) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return int(default)


def get_settings() -> Settings:
    jwt_secret = os.getenv("JWT_SECRET", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    if not jwt_secret:
        raise RuntimeError("JWT_SECRET não configurado")
    if not supabase_key or "COLE" in supabase_key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY não configurado")

    frontend_url = os.getenv("PUBLIC_FRONTEND_URL", "https://frontend-teal-nine-80.vercel.app")
    cors_raw = os.getenv("CORS_ORIGINS", frontend_url)
    app_version = os.getenv("APP_VERSION", os.getenv("RENDER_GIT_COMMIT", "local"))[:12]

    return Settings(
        supabase_url=os.getenv("SUPABASE_URL", ""),
        supabase_service_role_key=supabase_key,
        jwt_secret=jwt_secret,
        jwt_exp_hours=_int_env("JWT_EXP_HOURS", "12"),
        jwt_remember_days=_int_env("JWT_REMEMBER_DAYS", "30"),
        app_env=os.getenv("APP_ENV", "development"),
        cors_origins_raw=cors_raw,
        cors_origins=parse_cors_origins(cors_raw),
        frontend_url=frontend_url,
        app_version=app_version,
        kitchen_ready_visible_minutes=_int_env("KITCHEN_READY_VISIBLE_MINUTES", "15"),
    )


settings = get_settings()
