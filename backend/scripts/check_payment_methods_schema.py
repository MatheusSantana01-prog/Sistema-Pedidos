from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "backend" / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

REQUIRED_COLUMNS = [
    "id",
    "restaurant_id",
    "name",
    "code",
    "type",
    "is_active",
    "is_default",
    "requires_reference",
    "allow_change",
    "sort_order",
    "created_at",
    "updated_at",
]

EXPECTED_SQL_SNIPPETS = [
    "restaurant_payment_methods",
    "idx_restaurant_payment_methods_restaurant_code",
    "idx_restaurant_payment_methods_restaurant_active",
    "enable row level security",
]


def fail(message: str) -> None:
    print(f"ERRO: {message}", file=sys.stderr)
    raise SystemExit(1)


def require_env() -> None:
    if not SUPABASE_URL:
        fail("SUPABASE_URL nao configurado.")
    if not SUPABASE_KEY or "COLE" in SUPABASE_KEY:
        fail("SUPABASE_SERVICE_ROLE_KEY nao configurado. Use QA/staging e nunca exponha esta chave.")


def main() -> None:
    require_env()
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    select_expr = ",".join(REQUIRED_COLUMNS)
    try:
        sb.table("restaurant_payment_methods").select(select_expr).limit(1).execute()
    except Exception as exc:
        fail(f"Schema de formas de pagamento ausente ou incompleto. Select={select_expr}. Detalhe: {exc}")

    sql_path = ROOT / "backend" / "supabase_payment_methods_schema.sql"
    sql = sql_path.read_text(encoding="utf-8").lower()
    missing = [snippet for snippet in EXPECTED_SQL_SNIPPETS if snippet.lower() not in sql]
    if missing:
        fail(f"Arquivo SQL local nao contem itens esperados: {', '.join(missing)}")

    print("OK schema de formas de pagamento validado sem alterar dados.")


if __name__ == "__main__":
    main()
