from __future__ import annotations

import json
import os
from pathlib import Path
from uuid import uuid4

import bcrypt
from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "backend" / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
DEMO_PASSWORD = os.getenv("DEMO_COMERCIAL_PASSWORD", "Demo@2026")


DEMO_RESTAURANTS = [
    {
        "slug": "demo-restaurante",
        "name": "BRICKODE Restaurante Demo",
        "business_type": "restaurante",
        "plan": "pro",
        "colors": {
            "primary_color": "#e24d2c",
            "secondary_color": "#171717",
            "accent_color": "#f4a261",
            "background_color": "#101010",
            "text_color": "#f7f2ec",
        },
        "tables": 8,
        "categories": [
            ("Entradas", "Saladas, porcoes e pratos para compartilhar.", 1),
            ("Pratos principais", "Pratos executivos e especiais da casa.", 2),
            ("Bebidas", "Sucos, refrigerantes e bebidas sem alcool.", 3),
            ("Sobremesas", "Doces para fechamento da conta.", 4),
        ],
        "products": [
            ("Bruschetta da casa", "Entradas", 24.90, 9.00, "Pao artesanal, tomate, manjericao e azeite.", True, 8),
            ("Bolinho de costela", "Entradas", 32.00, 13.50, "Porcao crocante com molho especial.", True, 12),
            ("Parmegiana executivo", "Pratos principais", 58.90, 24.00, "File, arroz, fritas e molho da casa.", True, 22),
            ("Risoto de camarao", "Pratos principais", 74.90, 31.00, "Risoto cremoso com camaroes selecionados.", True, 26),
            ("Suco natural", "Bebidas", 12.90, 4.20, "Laranja, limao ou abacaxi.", False, 3),
            ("Refrigerante lata", "Bebidas", 8.90, 3.40, "Lata 350 ml.", False, 2),
            ("Pudim da casa", "Sobremesas", 16.90, 5.60, "Pudim artesanal com calda de caramelo.", True, 5),
            ("Brownie com sorvete", "Sobremesas", 22.90, 8.40, "Brownie quente com sorvete de creme.", True, 8),
        ],
        "inventory_demo": {
            "supplier": "Fornecedor Demo Restaurante",
            "item": "File mignon demo",
            "unit": "kg",
            "quantity": 8,
            "minimum": 2,
            "cost": 52,
            "product": "Parmegiana executivo",
            "recipe_quantity": 0.18,
        },
    },
    {
        "slug": "demo-pizzaria",
        "name": "BRICKODE Pizzaria Demo",
        "business_type": "pizzaria",
        "plan": "pro",
        "colors": {
            "primary_color": "#d92d20",
            "secondary_color": "#151515",
            "accent_color": "#22c55e",
            "background_color": "#0f1110",
            "text_color": "#f7f7f2",
        },
        "tables": 10,
        "categories": [
            ("Pizzas", "Pizzas cadastradas como produtos para demo segura.", 1),
            ("Bordas", "Bordas cadastradas como adicionais/produtos.", 2),
            ("Bebidas", "Bebidas para acompanhar.", 3),
            ("Sobremesas", "Sobremesas da pizzaria.", 4),
        ],
        "products": [
            ("Pizza Margherita grande", "Pizzas", 54.90, 20.00, "Molho, mussarela, tomate e manjericao.", True, 28),
            ("Pizza Calabresa grande", "Pizzas", 59.90, 23.00, "Calabresa fatiada, cebola e mussarela.", True, 28),
            ("Pizza Portuguesa grande", "Pizzas", 64.90, 25.00, "Presunto, ovo, cebola, ervilha e mussarela.", True, 30),
            ("Pizza Quatro queijos grande", "Pizzas", 69.90, 28.00, "Mussarela, provolone, parmesao e gorgonzola.", True, 30),
            ("Borda catupiry", "Bordas", 9.90, 3.20, "Borda recheada cadastrada como adicional comercial.", False, 2),
            ("Borda cheddar", "Bordas", 9.90, 3.20, "Borda recheada cadastrada como adicional comercial.", False, 2),
            ("Refrigerante 2L", "Bebidas", 14.90, 7.00, "Coca-Cola ou Guarana.", False, 2),
            ("Pizza doce broto", "Sobremesas", 29.90, 11.00, "Chocolate com morango.", True, 18),
        ],
        "inventory_demo": {
            "supplier": "Fornecedor Demo Pizzaria",
            "item": "Mussarela demo",
            "unit": "kg",
            "quantity": 12,
            "minimum": 3,
            "cost": 34,
            "product": "Pizza Margherita grande",
            "recipe_quantity": 0.28,
        },
    },
    {
        "slug": "demo-padaria",
        "name": "BRICKODE Padaria Demo",
        "business_type": "padaria",
        "plan": "starter",
        "colors": {
            "primary_color": "#b86b24",
            "secondary_color": "#17120e",
            "accent_color": "#f59e0b",
            "background_color": "#111111",
            "text_color": "#fff8ed",
        },
        "tables": 4,
        "categories": [
            ("Paes", "Produtos de panificacao.", 1),
            ("Cafe", "Bebidas de balcão e cafeteria.", 2),
            ("Salgados", "Assados e fritos para alto giro.", 3),
            ("Doces e bolos", "Vitrine doce e bolos.", 4),
            ("Combos", "Combos comerciais para demo.", 5),
        ],
        "products": [
            ("Pao frances unidade", "Paes", 1.20, 0.45, "Produto demonstrativo. Venda por peso em implantacao.", True, 1),
            ("Pao de queijo", "Paes", 5.90, 2.10, "Unidade grande.", True, 8),
            ("Cafe coado", "Cafe", 4.90, 1.10, "Cafe fresco de balcão.", False, 2),
            ("Cappuccino", "Cafe", 9.90, 3.20, "Cappuccino cremoso.", True, 4),
            ("Coxinha de frango", "Salgados", 8.90, 3.40, "Salgado de vitrine.", True, 10),
            ("Bolo de cenoura fatia", "Doces e bolos", 9.90, 3.70, "Fatia com cobertura de chocolate.", True, 6),
            ("Combo cafe da manha", "Combos", 18.90, 7.20, "Cafe, pao de queijo e fatia de bolo.", True, 6),
        ],
        "inventory_demo": {
            "supplier": "Fornecedor Demo Padaria",
            "item": "Farinha de trigo demo",
            "unit": "kg",
            "quantity": 25,
            "minimum": 8,
            "cost": 4.8,
            "product": "Pao frances unidade",
            "recipe_quantity": 0.06,
        },
    },
]

ROLES = [
    ("owner", "Admin Demo"),
    ("waiter", "Garcom Demo"),
    ("kitchen", "Cozinha Demo"),
    ("cashier", "Caixa Demo"),
]


def require_env():
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL nao configurado")
    if not SUPABASE_KEY or "COLE" in SUPABASE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY nao configurado")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()


def first(response):
    data = response.data or []
    return data[0] if isinstance(data, list) and data else data or None


def safe_update(sb, table: str, payload: dict, field: str, value: str):
    try:
        return sb.table(table).update(payload).eq(field, value).execute()
    except Exception as exc:
        print(f"Aviso: nao foi possivel atualizar {table}.{field}={value}: {exc}")
        return None


def upsert_restaurant(sb, demo: dict) -> str:
    row = first(sb.table("restaurants").select("id").eq("slug", demo["slug"]).limit(1).execute())
    payload = {
        "name": demo["name"],
        "slug": demo["slug"],
        "plan": demo["plan"],
        "is_active": True,
        **demo["colors"],
    }
    if row:
        restaurant_id = row["id"]
        safe_update(sb, "restaurants", payload, "id", restaurant_id)
    else:
        restaurant_id = str(uuid4())
        sb.table("restaurants").insert({"id": restaurant_id, **payload}).execute()

    optional_payload = {
        "business_type": demo["business_type"],
        "modules_config": modules_for(demo["business_type"]),
    }
    safe_update(sb, "restaurants", optional_payload, "id", restaurant_id)
    save_platform_control(sb, restaurant_id, demo)
    ensure_settings(sb, restaurant_id, demo["business_type"])
    return restaurant_id


def modules_for(business_type: str) -> dict:
    common = {
        "cozinha": True,
        "caixa": True,
        "estoque": True,
        "ficha_tecnica": True,
        "financeiro": True,
        "fiscal": True,
        "relatorios_avancados": True,
    }
    profiles = {
        "restaurante": {"mesas": True, "comandas": True, "qr_code": True, "garcom": True, "delivery": True},
        "pizzaria": {"mesas": True, "comandas": True, "qr_code": True, "garcom": True, "delivery": True, "pizza_tamanhos": True, "pizza_bordas": True, "pizza_meio_a_meio": True},
        "padaria": {"mesas": False, "comandas": False, "qr_code": False, "garcom": False, "delivery": True, "encomendas": True, "venda_peso": True, "codigo_barras": True, "producao_padaria": True, "lotes_validade": True, "balcao_rapido": True},
    }
    return {**common, **profiles.get(business_type, {})}


def save_platform_control(sb, restaurant_id: str, demo: dict):
    control = {
        "customer_code": f"DEMO-{demo['slug'].split('-', 1)[-1].upper()}",
        "branch_code": f"DEMO-{demo['slug'].split('-', 1)[-1].upper()}-001",
        "branch_label": "Matriz demo",
        "business_type": demo["business_type"],
        "segment": demo["business_type"],
        "billing_status": "teste_gratis",
        "trial_until": "2026-12-31",
        "due_date": "2026-12-31",
        "monthly_amount": 0,
        "block_mode": "none",
        "limits": {"users": 15, "tables": 60, "products": 400},
        "modules": modules_for(demo["business_type"]),
        "modules_config": modules_for(demo["business_type"]),
        "visible_tabs": ["mesas", "pedidos", "cardapio", "estoque", "financeiro", "fiscal", "usuarios", "suporte", "configuracoes", "auditoria"],
        "internal_notes": "Restaurante temporario para apresentacao comercial. Nao usar dados reais.",
    }
    existing = first(sb.table("configuracoes").select("chave").eq("restaurant_id", restaurant_id).eq("chave", "platform_control").limit(1).execute())
    payload = {
        "restaurant_id": restaurant_id,
        "chave": "platform_control",
        "valor": control,
        "descricao": "Controle comercial demo",
    }
    if existing:
        sb.table("configuracoes").update(payload).eq("restaurant_id", restaurant_id).eq("chave", "platform_control").execute()
    else:
        sb.table("configuracoes").insert(payload).execute()


def ensure_settings(sb, restaurant_id: str, business_type: str):
    existing = first(sb.table("restaurant_settings").select("id").eq("restaurant_id", restaurant_id).limit(1).execute())
    payload = {
        "restaurant_id": restaurant_id,
        "service_fee_enabled": business_type == "restaurante",
        "service_fee_percent": 10,
        "allow_customer_notes": True,
        "allow_waiter_call": business_type != "padaria",
        "allow_table_close_request": business_type != "padaria",
        "accept_pix": True,
        "accept_card": True,
        "accept_cash": True,
        "whatsapp": "119876293903",
    }
    if existing:
        sb.table("restaurant_settings").update(payload).eq("id", existing["id"]).execute()
    else:
        sb.table("restaurant_settings").insert(payload).execute()


def upsert_category(sb, restaurant_id: str, name: str, description: str, order: int) -> str:
    row = first(sb.table("categorias").select("id").eq("restaurant_id", restaurant_id).eq("nome", name).limit(1).execute())
    payload = {
        "restaurant_id": restaurant_id,
        "nome": name,
        "icone": "",
        "ordem": order,
        "ativa": True,
    }
    if row:
        safe_update(sb, "categorias", payload, "id", row["id"])
        return row["id"]
    cat_id = str(uuid4())
    sb.table("categorias").insert({"id": cat_id, **payload}).execute()
    return cat_id


def upsert_product(sb, restaurant_id: str, category_id: str, product: tuple) -> str:
    name, _category, price, cost, description, highlight, prep = product
    row = first(sb.table("produtos").select("id").eq("restaurant_id", restaurant_id).eq("nome", name).limit(1).execute())
    payload = {
        "restaurant_id": restaurant_id,
        "categoria_id": category_id,
        "nome": name,
        "descricao": description,
        "preco": price,
        "custo": cost,
        "disponivel": True,
        "destaque": highlight,
        "tempo_preparo_minutos": prep,
    }
    if row:
        safe_update(sb, "produtos", payload, "id", row["id"])
        return row["id"]
    product_id = str(uuid4())
    sb.table("produtos").insert({"id": product_id, **payload}).execute()
    return product_id


def ensure_tables(sb, restaurant_id: str, slug: str, count: int):
    for number in range(1, count + 1):
        row = first(sb.table("mesas").select("id").eq("restaurant_id", restaurant_id).eq("numero", number).limit(1).execute())
        payload = {
            "restaurant_id": restaurant_id,
            "numero": number,
            "capacidade": 4,
            "status": "livre",
            "ativa": True,
            "qr_code_token": f"{slug}-mesa-{number}",
        }
        if row:
            safe_update(sb, "mesas", payload, "id", row["id"])
        else:
            sb.table("mesas").insert({"id": str(uuid4()), **payload}).execute()


def upsert_user(sb, email: str, name: str) -> str:
    row = first(sb.table("usuarios").select("id").eq("email", email).limit(1).execute())
    payload = {
        "nome": name,
        "email": email,
        "senha_hash": hash_password(DEMO_PASSWORD),
        "perfil": "funcionario",
        "ativo": True,
    }
    if row:
        sb.table("usuarios").update(payload).eq("id", row["id"]).execute()
        return row["id"]
    user_id = str(uuid4())
    sb.table("usuarios").insert({"id": user_id, **payload}).execute()
    return user_id


def ensure_membership(sb, user_id: str, restaurant_id: str, role: str):
    row = first(sb.table("restaurant_memberships").select("id").eq("usuario_id", user_id).eq("restaurant_id", restaurant_id).limit(1).execute())
    payload = {"usuario_id": user_id, "restaurant_id": restaurant_id, "role": role, "is_active": True}
    if row:
        sb.table("restaurant_memberships").update(payload).eq("id", row["id"]).execute()
    else:
        sb.table("restaurant_memberships").insert({"id": str(uuid4()), **payload}).execute()


def ensure_inventory_demo(sb, restaurant_id: str, demo: dict, product_ids: dict):
    inv = demo.get("inventory_demo") or {}
    if not inv:
        return "sem estoque demo"
    try:
        supplier = first(sb.table("suppliers").select("id").eq("restaurant_id", restaurant_id).eq("name", inv["supplier"]).limit(1).execute())
        if supplier:
            supplier_id = supplier["id"]
            sb.table("suppliers").update({"is_active": True}).eq("id", supplier_id).execute()
        else:
            supplier_id = str(uuid4())
            sb.table("suppliers").insert({"id": supplier_id, "restaurant_id": restaurant_id, "name": inv["supplier"], "notes": "Fornecedor demo comercial", "is_active": True}).execute()

        item = first(sb.table("inventory_items").select("id").eq("restaurant_id", restaurant_id).eq("name", inv["item"]).limit(1).execute())
        item_payload = {
            "restaurant_id": restaurant_id,
            "supplier_id": supplier_id,
            "name": inv["item"],
            "unit": inv["unit"],
            "current_quantity": inv["quantity"],
            "minimum_quantity": inv["minimum"],
            "unit_cost": inv["cost"],
            "category": "Demo",
            "notes": "Insumo demo para apresentacao comercial",
            "is_active": True,
        }
        if item:
            item_id = item["id"]
            sb.table("inventory_items").update(item_payload).eq("id", item_id).execute()
        else:
            item_id = str(uuid4())
            sb.table("inventory_items").insert({"id": item_id, **item_payload}).execute()

        product_id = product_ids.get(inv["product"])
        if product_id:
            recipe = first(sb.table("product_recipes").select("id").eq("restaurant_id", restaurant_id).eq("product_id", product_id).eq("is_active", True).limit(1).execute())
            if recipe:
                recipe_id = recipe["id"]
                sb.table("product_recipe_items").delete().eq("restaurant_id", restaurant_id).eq("recipe_id", recipe_id).execute()
            else:
                recipe_id = str(uuid4())
                sb.table("product_recipes").insert({"id": recipe_id, "restaurant_id": restaurant_id, "product_id": product_id, "yield_quantity": 1, "notes": "Ficha tecnica demo", "is_active": True}).execute()
            sb.table("product_recipe_items").insert({
                "id": str(uuid4()),
                "restaurant_id": restaurant_id,
                "recipe_id": recipe_id,
                "product_id": product_id,
                "inventory_item_id": item_id,
                "quantity": inv["recipe_quantity"],
                "unit": inv["unit"],
                "waste_percent": 0,
                "unit_cost_snapshot": inv["cost"],
            }).execute()
        return "estoque e ficha tecnica prontos"
    except Exception as exc:
        return f"estoque nao preparado: {exc}"


def seed_restaurant(sb, demo: dict) -> dict:
    restaurant_id = upsert_restaurant(sb, demo)
    category_ids = {}
    for name, description, order in demo["categories"]:
        category_ids[name] = upsert_category(sb, restaurant_id, name, description, order)

    product_ids = {}
    for product in demo["products"]:
        product_ids[product[0]] = upsert_product(sb, restaurant_id, category_ids[product[1]], product)

    ensure_tables(sb, restaurant_id, demo["slug"], demo["tables"])
    for role, label in ROLES:
        email = f"{role}@{demo['slug']}.com"
        user_id = upsert_user(sb, email, f"{label} - {demo['name']}")
        ensure_membership(sb, user_id, restaurant_id, role)

    inventory_status = ensure_inventory_demo(sb, restaurant_id, demo, product_ids)
    return {"slug": demo["slug"], "id": restaurant_id, "inventory": inventory_status}


def main():
    require_env()
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    results = [seed_restaurant(sb, demo) for demo in DEMO_RESTAURANTS]
    print(json.dumps({
        "status": "ok",
        "password": DEMO_PASSWORD,
        "restaurants": results,
        "warning": "Use somente para demo. Troque senhas antes de qualquer uso real.",
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
