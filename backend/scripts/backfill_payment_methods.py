from __future__ import annotations

import os
import re
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "backend" / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

DEFAULT_METHODS = [
    {"name": "Dinheiro", "code": "dinheiro", "type": "cash", "is_default": True, "allow_change": True, "sort_order": 10},
    {"name": "Pix", "code": "pix", "type": "pix", "is_default": True, "requires_reference": False, "sort_order": 20},
    {"name": "Cartao de credito", "code": "cartao_credito", "type": "credit_card", "is_default": True, "requires_reference": False, "sort_order": 30},
    {"name": "Cartao de debito", "code": "cartao_debito", "type": "debit_card", "is_default": True, "requires_reference": False, "sort_order": 40},
]


def require_env() -> None:
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL nao configurado")
    if not SUPABASE_KEY or "COLE" in SUPABASE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY nao configurado")


def slugify_code(value: str) -> str:
    raw = (value or "").strip().lower()
    raw = raw.replace("ç", "c").replace("ã", "a").replace("á", "a").replace("à", "a")
    raw = raw.replace("é", "e").replace("ê", "e").replace("í", "i").replace("ó", "o").replace("õ", "o").replace("ú", "u")
    raw = re.sub(r"[^a-z0-9]+", "_", raw).strip("_")
    return raw[:60] or "pagamento"


def ensure_methods(sb, restaurant_id: str, methods: list[dict] | None = None) -> int:
    methods = methods or DEFAULT_METHODS
    existing = sb.table("restaurant_payment_methods").select("code").eq("restaurant_id", restaurant_id).execute().data or []
    existing_codes = {row["code"] for row in existing}
    created = 0
    for method in methods:
        code = slugify_code(method["code"])
        if code in existing_codes:
            continue
        payload = {
            "restaurant_id": restaurant_id,
            "name": method["name"],
            "code": code,
            "type": method["type"],
            "is_active": method.get("is_active", True),
            "is_default": method.get("is_default", False),
            "requires_reference": method.get("requires_reference", False),
            "allow_change": method.get("allow_change", method["type"] == "cash"),
            "sort_order": method.get("sort_order", 0),
        }
        sb.table("restaurant_payment_methods").insert(payload).execute()
        existing_codes.add(code)
        created += 1
    return created


def main() -> None:
    require_env()
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    restaurants = sb.table("restaurants").select("id,slug,name").execute().data or []
    total = 0
    for restaurant in restaurants:
        count_resp = sb.table("restaurant_payment_methods").select("id", count="exact").eq("restaurant_id", restaurant["id"]).execute()
        if count_resp.count:
            continue
        created = ensure_methods(sb, restaurant["id"])
        total += created
        print(f"OK {restaurant.get('slug') or restaurant['id']}: {created} forma(s) criada(s)")
    print(f"Backfill concluido. Total criado: {total}")


if __name__ == "__main__":
    main()
