from pathlib import Path


def test_inventory_schema_has_required_tables_and_rls():
    sql = Path("backend/supabase_inventory_schema.sql").read_text(encoding="utf-8").lower()

    for table in [
        "suppliers",
        "inventory_items",
        "inventory_movements",
        "product_recipes",
        "product_recipe_items",
        "inventory_counts",
        "inventory_count_items",
    ]:
        assert f"create table if not exists public.{table}" in sql
        assert f"alter table public.{table} enable row level security" in sql
        assert f"grant all on table public.{table} to service_role" in sql

    assert "create extension if not exists pgcrypto" in sql
    assert "to_regclass('public.restaurants')" in sql
    assert "to_regclass('public.produtos')" in sql
    assert "restaurant_id uuid not null references public.restaurants(id)" in sql
    assert "product_id uuid not null references public.produtos(id)" in sql
    assert "create unique index if not exists idx_product_recipes_one_active" in sql


def test_inventory_frontend_has_clear_missing_schema_message():
    js = Path("frontend/r/admin/app.js").read_text(encoding="utf-8")

    assert "renderEstoqueSchemaErro" in js
    assert "Estoque ainda não foi habilitado neste ambiente." in js
    assert "backend/supabase_inventory_schema.sql" in js
    assert "Detalhe técnico para suporte" in js
