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

REQUIRED_TABLES = {
    "suppliers": ["id", "restaurant_id", "name", "is_active", "created_at"],
    "inventory_items": [
        "id",
        "restaurant_id",
        "supplier_id",
        "name",
        "unit",
        "current_quantity",
        "minimum_quantity",
        "unit_cost",
        "is_active",
    ],
    "inventory_movements": [
        "id",
        "restaurant_id",
        "inventory_item_id",
        "movement_type",
        "quantity",
        "quantity_delta",
        "previous_quantity",
        "balance_after",
        "reference_type",
        "reference_id",
    ],
    "product_recipes": ["id", "restaurant_id", "product_id", "yield_quantity", "is_active"],
    "product_recipe_items": [
        "id",
        "restaurant_id",
        "recipe_id",
        "product_id",
        "inventory_item_id",
        "quantity",
        "waste_percent",
        "unit_cost_snapshot",
    ],
    "inventory_counts": ["id", "restaurant_id", "status", "created_at"],
    "inventory_count_items": [
        "id",
        "restaurant_id",
        "inventory_count_id",
        "inventory_item_id",
        "expected_quantity",
        "counted_quantity",
        "difference_quantity",
    ],
}

EXPECTED_INDEX_SNIPPETS = [
    "idx_inventory_items_restaurant",
    "idx_inventory_movements_restaurant",
    "idx_inventory_movements_reference",
    "idx_product_recipes_restaurant_product",
    "idx_product_recipes_one_active",
    "idx_product_recipe_items_recipe",
    "idx_inventory_counts_restaurant",
]


def fail(message: str) -> None:
    print(f"ERRO: {message}", file=sys.stderr)
    raise SystemExit(1)


def require_env() -> None:
    if not SUPABASE_URL:
        fail("SUPABASE_URL nao configurado.")
    if not SUPABASE_KEY or "COLE" in SUPABASE_KEY:
        fail("SUPABASE_SERVICE_ROLE_KEY nao configurado. Use ambiente QA/staging; nao exponha esta chave.")


def check_table_columns(sb, table: str, columns: list[str]) -> None:
    select_expr = ",".join(columns)
    try:
        sb.table(table).select(select_expr).limit(1).execute()
    except Exception as exc:
        fail(
            f"Tabela/coluna ausente em {table}. Esperado select={select_expr}. "
            f"Detalhe: {exc}"
        )
    print(f"OK tabela {table}: colunas principais acessiveis")


def check_indexes_from_file() -> None:
    schema_path = ROOT / "backend" / "supabase_inventory_schema.sql"
    sql = schema_path.read_text(encoding="utf-8").lower()
    missing = [idx for idx in EXPECTED_INDEX_SNIPPETS if idx.lower() not in sql]
    if missing:
        fail(f"Schema local nao contem indices esperados: {', '.join(missing)}")
    print("OK schema local contem os indices esperados")
    print("INFO: validacao remota de indices exige acesso SQL direto ao Postgres; este script usa Data API e nao altera dados.")


def main() -> None:
    require_env()
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    for table, columns in REQUIRED_TABLES.items():
        check_table_columns(sb, table, columns)
    check_indexes_from_file()
    print("OK schema de estoque validado sem alterar dados.")


if __name__ == "__main__":
    main()
