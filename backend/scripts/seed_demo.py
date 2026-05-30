from __future__ import annotations

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
DEMO_SLUG = os.getenv("DEMO_SLUG", "demo-restaurante")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "demo123")


def require_env():
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL não configurado")
    if not SUPABASE_KEY or "COLE" in SUPABASE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY não configurado")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()


def first(response):
    data = response.data or []
    return data[0] if isinstance(data, list) and data else data or None


def upsert_user(sb, email: str, nome: str) -> str:
    existing = first(sb.table("usuarios").select("id").eq("email", email).limit(1).execute())
    if existing:
        return existing["id"]
    user_id = str(uuid4())
    sb.table("usuarios").insert({
        "id": user_id,
        "nome": nome,
        "email": email,
        "senha_hash": hash_password(DEMO_PASSWORD),
        "perfil": "funcionario",
        "ativo": True,
    }).execute()
    return user_id


def ensure_membership(sb, user_id: str, restaurant_id: str, role: str):
    existing = first(sb.table("restaurant_memberships").select("id").eq(
        "usuario_id", user_id
    ).eq("restaurant_id", restaurant_id).limit(1).execute())
    if existing:
        sb.table("restaurant_memberships").update({"role": role, "is_active": True}).eq("id", existing["id"]).execute()
        return
    sb.table("restaurant_memberships").insert({
        "id": str(uuid4()),
        "usuario_id": user_id,
        "restaurant_id": restaurant_id,
        "role": role,
        "is_active": True,
    }).execute()


def main():
    require_env()
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    restaurant = first(sb.table("restaurants").select("id").eq("slug", DEMO_SLUG).limit(1).execute())
    if restaurant:
        restaurant_id = restaurant["id"]
    else:
        restaurant_id = str(uuid4())
        sb.table("restaurants").insert({
            "id": restaurant_id,
            "name": "Restaurante Demo",
            "slug": DEMO_SLUG,
            "plan": "pro",
            "is_active": True,
            "business_type": "restaurante",
        }).execute()

    categories = [
        ("Entradas", "🥗", 1),
        ("Pratos", "🍽️", 2),
        ("Bebidas", "🥤", 3),
    ]
    category_ids = {}
    for nome, icone, ordem in categories:
        existing = first(sb.table("categorias").select("id").eq("restaurant_id", restaurant_id).eq("nome", nome).limit(1).execute())
        if existing:
            category_ids[nome] = existing["id"]
            continue
        cat_id = str(uuid4())
        sb.table("categorias").insert({
            "id": cat_id,
            "restaurant_id": restaurant_id,
            "nome": nome,
            "icone": icone,
            "ordem": ordem,
            "ativa": True,
        }).execute()
        category_ids[nome] = cat_id

    products = [
        ("Bruschetta demo", "Entradas", 24.90),
        ("Prato executivo demo", "Pratos", 49.90),
        ("Suco natural demo", "Bebidas", 12.00),
    ]
    for nome, categoria, preco in products:
        exists = first(sb.table("produtos").select("id").eq("restaurant_id", restaurant_id).eq("nome", nome).limit(1).execute())
        if exists:
            continue
        sb.table("produtos").insert({
            "id": str(uuid4()),
            "restaurant_id": restaurant_id,
            "categoria_id": category_ids[categoria],
            "nome": nome,
            "descricao": "Produto criado pelo seed de demonstração.",
            "preco": preco,
            "disponivel": True,
            "ativo": True,
        }).execute()

    for numero in range(1, 6):
        exists = first(sb.table("mesas").select("id").eq("restaurant_id", restaurant_id).eq("numero", numero).limit(1).execute())
        if exists:
            continue
        sb.table("mesas").insert({
            "id": str(uuid4()),
            "restaurant_id": restaurant_id,
            "numero": numero,
            "capacidade": 4,
            "status": "livre",
            "ativa": True,
            "qr_code_token": f"{DEMO_SLUG}-mesa-{numero}",
        }).execute()

    users = [
        ("demo-owner@example.com", "Owner Demo", "owner"),
        ("demo-garcom@example.com", "Garçom Demo", "waiter"),
        ("demo-cozinha@example.com", "Cozinha Demo", "kitchen"),
        ("demo-caixa@example.com", "Caixa Demo", "cashier"),
    ]
    for email, nome, role in users:
        user_id = upsert_user(sb, email, nome)
        ensure_membership(sb, user_id, restaurant_id, role)

    print(f"Demo pronto: slug={DEMO_SLUG}")
    print("Usuários: demo-owner@example.com, demo-garcom@example.com, demo-cozinha@example.com, demo-caixa@example.com")
    print("Senha demo:", DEMO_PASSWORD)
    print("Altere a senha antes de qualquer uso real.")


if __name__ == "__main__":
    main()
