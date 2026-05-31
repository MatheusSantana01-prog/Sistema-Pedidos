from __future__ import annotations

import os
import sys
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import main as backend  # noqa: E402

load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "backend" / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()


def fail(message: str) -> None:
    print(f"ERRO: {message}", file=sys.stderr)
    raise SystemExit(1)


def require_env() -> None:
    if not SUPABASE_URL:
        fail("SUPABASE_URL nao configurado.")
    if not SUPABASE_KEY or "COLE" in SUPABASE_KEY:
        fail("SUPABASE_SERVICE_ROLE_KEY nao configurado. Rode apenas em QA/staging ou com restaurante temporario.")


def first(response):
    data = response.data or []
    return data[0] if isinstance(data, list) and data else data or None


def insert(sb, table: str, payload: dict) -> dict:
    try:
        return first(sb.table(table).insert(payload).select("*").execute())
    except Exception as exc:
        fail(f"Falha ao inserir em {table}: {exc}")


def delete_where(sb, table: str, field: str, value: str) -> None:
    try:
        sb.table(table).delete().eq(field, value).execute()
    except Exception as exc:
        print(f"AVISO: falha ao limpar {table}: {exc}")


def assert_quantity(sb, item_id: str, expected: float, label: str) -> None:
    item = first(sb.table("inventory_items").select("current_quantity").eq("id", item_id).limit(1).execute())
    if not item:
        fail(f"Insumo nao encontrado ao validar {label}")
    current = round(float(item.get("current_quantity") or 0), 3)
    if current != round(float(expected), 3):
        fail(f"{label}: saldo esperado {expected}, obtido {current}")
    print(f"OK {label}: saldo {current}")


def main() -> None:
    require_env()
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    backend.sb = sb

    suffix = uuid4().hex[:8]
    restaurant_id = str(uuid4())
    slug = f"qa-inventory-{suffix}"
    category_id = str(uuid4())
    product_id = str(uuid4())
    supplier_id = str(uuid4())
    item_id = str(uuid4())
    recipe_id = str(uuid4())
    table_id = str(uuid4())
    session_id = str(uuid4())
    order_id = str(uuid4())
    order_item_id = str(uuid4())

    print(f"Smoke estoque QA iniciado: {slug}")
    try:
        insert(sb, "restaurants", {
            "id": restaurant_id,
            "name": f"QA Inventory {suffix}",
            "slug": slug,
            "plan": "pro",
            "is_active": True,
            "business_type": "restaurante",
        })
        insert(sb, "categorias", {
            "id": category_id,
            "restaurant_id": restaurant_id,
            "nome": "QA Estoque",
            "icone": "QA",
            "ordem": 1,
            "ativa": True,
        })
        insert(sb, "produtos", {
            "id": product_id,
            "restaurant_id": restaurant_id,
            "categoria_id": category_id,
            "nome": "Produto QA Estoque",
            "descricao": "Produto temporario do smoke de estoque.",
            "preco": 40,
            "custo": 0,
            "disponivel": True,
            "destaque": False,
            "tempo_preparo_minutos": 10,
        })
        insert(sb, "suppliers", {
            "id": supplier_id,
            "restaurant_id": restaurant_id,
            "name": "Fornecedor QA Estoque",
            "is_active": True,
        })
        insert(sb, "inventory_items", {
            "id": item_id,
            "restaurant_id": restaurant_id,
            "supplier_id": supplier_id,
            "name": "Insumo QA Estoque",
            "unit": "kg",
            "current_quantity": 0,
            "minimum_quantity": 1,
            "unit_cost": 4,
            "is_active": True,
        })

        backend.registrar_inventory_movement(restaurant_id, {
            "inventory_item_id": item_id,
            "movement_type": "entrada",
            "quantity": 10,
            "unit_cost": 4,
            "supplier_id": supplier_id,
            "reason": "Entrada smoke_inventory_real",
        }, {"sub": None, "nome": "Smoke QA"})
        assert_quantity(sb, item_id, 10, "entrada")

        insert(sb, "product_recipes", {
            "id": recipe_id,
            "restaurant_id": restaurant_id,
            "product_id": product_id,
            "yield_quantity": 1,
            "is_active": True,
        })
        insert(sb, "product_recipe_items", {
            "id": str(uuid4()),
            "restaurant_id": restaurant_id,
            "recipe_id": recipe_id,
            "product_id": product_id,
            "inventory_item_id": item_id,
            "quantity": 0.5,
            "unit": "kg",
            "waste_percent": 0,
            "unit_cost_snapshot": 4,
        })
        insert(sb, "mesas", {
            "id": table_id,
            "restaurant_id": restaurant_id,
            "numero": 1,
            "capacidade": 4,
            "status": "ocupada",
            "ativa": True,
            "qr_code_token": f"{slug}-mesa-1",
        })
        insert(sb, "sessao_mesa", {
            "id": session_id,
            "restaurant_id": restaurant_id,
            "mesa_id": table_id,
            "status": "aberta",
            "total_consumido": 80,
        })
        insert(sb, "pedidos", {
            "id": order_id,
            "restaurant_id": restaurant_id,
            "mesa_id": table_id,
            "sessao_mesa_id": session_id,
            "numero": 1,
            "status": "pendente",
            "subtotal": 80,
            "total": 80,
        })
        insert(sb, "pedido_itens", {
            "id": order_item_id,
            "pedido_id": order_id,
            "produto_id": product_id,
            "nome_produto": "Produto QA Estoque",
            "preco_unitario": 40,
            "quantidade": 2,
            "subtotal": 80,
        })

        sb.table("pedidos").update({"status": "entregue"}).eq("id", order_id).eq("restaurant_id", restaurant_id).execute()
        baixa = backend.baixar_estoque_pedido_entregue(restaurant_id, order_id, {"sub": None, "nome": "Smoke QA"})
        if len(baixa.get("movements") or []) != 1:
            fail(f"Baixa automatica esperava 1 movimento, obteve {baixa}")
        assert_quantity(sb, item_id, 9, "baixa automatica")

        sb.table("pedidos").update({"status": "cancelado"}).eq("id", order_id).eq("restaurant_id", restaurant_id).execute()
        estorno = backend.estornar_estoque_pedido(restaurant_id, order_id, {"sub": None, "nome": "Smoke QA"})
        if len(estorno.get("movements") or []) != 1:
            fail(f"Estorno esperava 1 movimento, obteve {estorno}")
        assert_quantity(sb, item_id, 10, "estorno")

        print("OK smoke real de estoque concluido.")
    finally:
        for table in [
            "inventory_count_items",
            "inventory_counts",
            "product_recipe_items",
            "product_recipes",
            "inventory_movements",
            "pedido_itens",
            "pedidos",
            "sessao_mesa",
            "mesas",
            "inventory_items",
            "suppliers",
            "produtos",
            "categorias",
            "restaurant_settings",
            "restaurants",
        ]:
            delete_where(sb, table, "restaurant_id" if table != "restaurants" else "id", restaurant_id)
        print(f"Limpeza QA concluida: {slug}")


if __name__ == "__main__":
    main()
