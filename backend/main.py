"""
FastAPI SaaS Multi-Tenant — Sistema de Pedidos
==============================================
Versão: 2.0.0
- Um único backend para N restaurantes
- Isolamento por restaurant_id em todas as operações
- JWT com restaurant_id e role embutidos
- Sem service_role_key exposta no frontend
- Pronto para Render/Railway/VPS
"""
from __future__ import annotations
import secrets
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

try:
    from app.core.config import settings
    from app.core.database import sb
    from app.core.security import (
        authorize,
        bearer,
        criar_token,
        get_restaurant_id_from_token,
        hash_senha,
        verificar_senha,
        verificar_token,
    )
except ModuleNotFoundError:
    from backend.app.core.config import settings
    from backend.app.core.database import sb
    from backend.app.core.security import (
        authorize,
        bearer,
        criar_token,
        get_restaurant_id_from_token,
        hash_senha,
        verificar_senha,
        verificar_token,
    )

# ── CONFIG ────────────────────────────────────────────────────────
SUPABASE_URL = settings.supabase_url
SUPABASE_KEY = settings.supabase_service_role_key
JWT_SECRET = settings.jwt_secret
JWT_EXP_H = settings.jwt_exp_hours
JWT_REMEMBER_DAYS = settings.jwt_remember_days
APP_ENV = settings.app_env
CORS_ORIGINS_RAW = settings.cors_origins_raw
CORS_ORIGINS = settings.cors_origins
FRONTEND_URL = settings.frontend_url
APP_VERSION = settings.app_version
KITCHEN_READY_VISIBLE_MINUTES = settings.kitchen_ready_visible_minutes
logger = logging.getLogger("restaurante-saas")
logging.basicConfig(level=logging.INFO)

# ── ROLES HIERARQUIA ─────────────────────────────────────────────
ROLE_LEVEL = {
    "super_admin": 99,
    "owner":       5,
    "manager":     4,
    "cashier":     3,
    "waiter":      2,
    "kitchen":     1,
    "tv":          0,
}

ORDER_TRANSITIONS = {
    "pendente":    {"confirmado", "em_preparo", "cancelado"},
    "confirmado":  {"em_preparo", "cancelado"},
    "em_preparo":  {"pronto", "cancelado"},
    "pronto":      {"entregue"},
    "entregue":    set(),
    "cancelado":   set(),
}

OPEN_ORDER_STATUSES = {"pendente", "confirmado", "em_preparo", "pronto"}
FORMAS_PAGAMENTO = {
    "dinheiro",
    "pix",
    "cartao_credito",
    "cartao_debito",
    "vale_refeicao",
    "vale_alimentacao",
    "transferencia",
    "outro",
}

PLAN_LIMITS = {
    "starter": {"users": 5, "tables": 10, "products": 100},
    "pro": {"users": 15, "tables": 60, "products": 400},
    "enterprise": {"users": 9999, "tables": 9999, "products": 9999},
}

CASH_REGISTER_LIMITS = {
    "starter": 2,
    "pro": 3,
    "enterprise": 20,
}

PLAN_BASE_PRICES = {
    "starter": 79,
    "pro": 149,
    "enterprise": 249,
}

PLAN_ALIASES = {
    "basic": "starter",
    "basico": "starter",
    "básico": "starter",
    "starter": "starter",
    "pro": "pro",
    "premium": "enterprise",
    "enterprise": "enterprise",
}

PLAN_MODULES = {
    "starter": {
        "financeiro": True,
        "cupons": False,
        "garcom": False,
        "relatorios": False,
        "api_integrations": False,
        "ifood": False,
        "whatsapp": False,
        "multiunit": False,
        "backups": False,
        "advanced_reports": False,
        "priority_support": False,
        "custom_branding": False,
    },
    "pro": {
        "financeiro": True,
        "cupons": False,
        "garcom": True,
        "relatorios": True,
        "api_integrations": False,
        "ifood": False,
        "whatsapp": False,
        "multiunit": False,
        "backups": False,
        "advanced_reports": False,
        "priority_support": False,
        "custom_branding": True,
    },
    "enterprise": {
        "financeiro": True,
        "cupons": True,
        "garcom": True,
        "relatorios": True,
        "api_integrations": False,
        "ifood": False,
        "whatsapp": False,
        "multiunit": False,
        "backups": True,
        "advanced_reports": True,
        "priority_support": True,
        "custom_branding": True,
    },
}

PLAN_MARKETING = {
    "starter": {
        "label": "Básico",
        "headline": "Comece com QR Code, pedidos digitais e operação essencial.",
        "positioning": "Para restaurante pequeno sair do papel, WhatsApp e comanda manual.",
        "recommended": False,
    },
    "pro": {
        "label": "Pro",
        "headline": "Plano recomendado para operar salão, cozinha, caixa e gestão.",
        "positioning": "Para reduzir erro no movimento e profissionalizar o atendimento.",
        "recommended": True,
    },
    "enterprise": {
        "label": "Premium",
        "headline": "Escala, suporte e integrações premium em evolução.",
        "positioning": "Para operações maiores, redes e integrações sob contrato.",
        "recommended": False,
    },
}

FUTURE_MODULES = {
    "api_integrations": "API para integrações",
    "ifood": "Integração iFood",
    "whatsapp": "Integração WhatsApp",
    "multiunit": "Multiunidade",
}

ROLE_MODULE_REQUIREMENTS = {
    "waiter": "garcom",
}

TEMPLATE_CATEGORIES = {
    "restaurante": [
        {"nome": "Entradas", "icone": "🥗", "ordem": 1},
        {"nome": "Pratos principais", "icone": "🍽️", "ordem": 2},
        {"nome": "Bebidas", "icone": "🥤", "ordem": 3},
        {"nome": "Sobremesas", "icone": "🍰", "ordem": 4},
    ],
    "pizzaria": [
        {"nome": "Pizzas", "icone": "🍕", "ordem": 1},
        {"nome": "Bordas e adicionais", "icone": "🧀", "ordem": 2},
        {"nome": "Bebidas", "icone": "🥤", "ordem": 3},
        {"nome": "Sobremesas", "icone": "🍰", "ordem": 4},
    ],
    "padaria": [
        {"nome": "Pães e salgados", "icone": "🥐", "ordem": 1},
        {"nome": "Cafés", "icone": "☕", "ordem": 2},
        {"nome": "Doces", "icone": "🍰", "ordem": 3},
        {"nome": "Bebidas", "icone": "🥤", "ordem": 4},
    ],
    "bar": [
        {"nome": "Porções", "icone": "🍟", "ordem": 1},
        {"nome": "Pratos", "icone": "🍽️", "ordem": 2},
        {"nome": "Drinks", "icone": "🍹", "ordem": 3},
        {"nome": "Bebidas", "icone": "🥤", "ordem": 4},
    ],
    "hamburgueria": [
        {"nome": "Burgers", "icone": "🍔", "ordem": 1},
        {"nome": "Combos", "icone": "🎁", "ordem": 2},
        {"nome": "Acompanhamentos", "icone": "🍟", "ordem": 3},
        {"nome": "Bebidas", "icone": "🥤", "ordem": 4},
    ],
    "delivery": [
        {"nome": "Mais pedidos", "icone": "⭐", "ordem": 1},
        {"nome": "Combos", "icone": "🎁", "ordem": 2},
        {"nome": "Bebidas", "icone": "🥤", "ordem": 3},
        {"nome": "Sobremesas", "icone": "🍰", "ordem": 4},
    ],
}

SAMPLE_PRODUCTS = {
    "restaurante": [
        ("Entradas", "Bruschetta da casa", "Pão artesanal, tomate fresco, manjericão e azeite.", 24.90, True, 12),
        ("Pratos principais", "Risoto de filé", "Arroz arbóreo cremoso, filé mignon e parmesão.", 68.90, True, 25),
        ("Bebidas", "Suco natural", "Fruta da estação preparada na hora.", 14.90, False, 5),
        ("Sobremesas", "Brownie com sorvete", "Brownie quente, calda e sorvete de creme.", 27.90, False, 10),
    ],
    "pizzaria": [
        ("Pizzas", "Pizza margherita", "Molho artesanal, mussarela, tomate e manjericão.", 59.90, True, 25),
        ("Pizzas", "Pizza calabresa especial", "Calabresa, cebola roxa, mussarela e orégano.", 62.90, True, 25),
        ("Bebidas", "Refrigerante lata", "Opções geladas para acompanhar sua pizza.", 7.90, False, 2),
        ("Sobremesas", "Pizza doce pequena", "Chocolate cremoso e morangos.", 34.90, False, 18),
    ],
    "padaria": [
        ("Pães e salgados", "Pão na chapa especial", "Pão francês, manteiga e queijo derretido.", 12.90, True, 8),
        ("Cafés", "Cappuccino cremoso", "Café espresso, leite vaporizado e canela.", 13.90, True, 6),
        ("Doces", "Fatia de bolo caseiro", "Bolo fresco do dia.", 11.90, False, 4),
        ("Bebidas", "Suco natural", "Fruta da estação preparada na hora.", 14.90, False, 5),
    ],
    "bar": [
        ("Porções", "Batata rústica", "Batatas crocantes com molho da casa.", 32.90, True, 18),
        ("Pratos", "Filé aperitivo", "Tiras de filé, cebola e pão de alho.", 69.90, True, 24),
        ("Drinks", "Gin tônica", "Gin, tônica, limão e especiarias.", 28.90, False, 6),
        ("Bebidas", "Água com gás", "Garrafa gelada.", 6.90, False, 2),
    ],
    "hamburgueria": [
        ("Burgers", "Smash cheddar", "Blend bovino, cheddar e molho especial.", 34.90, True, 18),
        ("Combos", "Combo clássico", "Burger, fritas e bebida.", 49.90, True, 20),
        ("Acompanhamentos", "Batata frita", "Porção crocante com sal da casa.", 19.90, False, 12),
        ("Bebidas", "Refrigerante lata", "Lata gelada.", 7.90, False, 2),
    ],
    "delivery": [
        ("Mais pedidos", "Combo da casa", "Pedido campeão para entrega rápida.", 44.90, True, 20),
        ("Combos", "Combo família", "Porção para compartilhar.", 89.90, True, 30),
        ("Bebidas", "Refrigerante lata", "Lata gelada.", 7.90, False, 2),
        ("Sobremesas", "Brownie", "Brownie macio com chocolate.", 18.90, False, 8),
    ],
}

# ── APP ───────────────────────────────────────────────────────────
app = FastAPI(
    title="SaaS Restaurante API",
    version="2.0.0",
    docs_url="/docs" if APP_ENV == "development" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=True,
)

@app.middleware("http")
async def monitorar_requisicoes(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or secrets.token_hex(8)
    inicio = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        duracao_ms = round((time.perf_counter() - inicio) * 1000, 2)
        logger.exception("erro_nao_tratado request_id=%s path=%s duracao_ms=%s", request_id, request.url.path, duracao_ms)
        try:
            sb.table("audit_log").insert({
                "restaurant_id": None,
                "usuario_id": None,
                "usuario_nome": "Sistema",
                "perfil": "monitoring",
                "acao": "erro_backend",
                "tabela": "api",
                "registro_id": request_id,
                "valor_anterior": None,
                "valor_novo": {
                    "path": request.url.path,
                    "method": request.method,
                    "erro": str(exc)[:500],
                    "duracao_ms": duracao_ms,
                    "version": APP_VERSION,
                },
                "ip": request.client.host if request.client else None,
            }).execute()
        except Exception:
            pass
        raise
    response.headers["x-request-id"] = request_id
    response.headers["x-app-version"] = APP_VERSION
    return response


# ── HELPERS ───────────────────────────────────────────────────────
def _row(r) -> dict:
    if not r.data:
        raise HTTPException(404, "Não encontrado")
    return r.data[0] if isinstance(r.data, list) else r.data

def _rows(r) -> list:
    return r.data or []

def _first(data):
    """Normaliza retorno do Supabase/RPC que pode vir como dict ou lista."""
    if isinstance(data, list):
        return data[0] if data else None
    return data

def _money(value) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0

def normalize_plan(plan: str | None) -> str:
    key = (plan or "starter").strip().lower()
    return PLAN_ALIASES.get(key, key)

def _platform_control_defaults() -> dict:
    return {
        "customer_code": "",
        "branch_code": "",
        "branch_label": "Matriz",
        "billing_status": "em_dia",
        "trial_until": None,
        "due_date": None,
        "monthly_amount": 0,
        "last_payment_date": None,
        "last_payment_amount": 0,
        "last_payment_reference": "",
        "payment_notes": "",
        "grace_alert_days": 15,
        "grace_block_days": 30,
        "segment": "restaurante",
        "city": "",
        "internal_notes": "",
        "support_status": "sem_chamado",
        "support_priority": "normal",
        "support_notes": "",
        "block_mode": "none",
        "broadcast_message": "",
        "limits": PLAN_LIMITS["starter"].copy(),
        "modules": PLAN_MODULES["starter"].copy(),
        "future_modules": FUTURE_MODULES.copy(),
        "plan_marketing": PLAN_MARKETING["starter"].copy(),
    }

def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)[:10]).date()
    except (TypeError, ValueError):
        return None

def calcular_status_financeiro(control: dict) -> dict:
    control = dict(control or {})
    if control.get("billing_status") == "teste_gratis":
        trial = _parse_date(control.get("trial_until"))
        if trial and datetime.utcnow().date() <= trial:
            control["billing_computed_status"] = "teste_gratis"
            control["billing_days_overdue"] = 0
            control["billing_notice"] = f"Teste grátis até {trial.isoformat()}"
            return control

    due = _parse_date(control.get("due_date"))
    today = datetime.utcnow().date()
    days = (today - due).days if due else 0
    paid_after_due = False
    last_payment = _parse_date(control.get("last_payment_date"))
    if due and last_payment and last_payment >= due:
        paid_after_due = True

    alert_days = int(control.get("grace_alert_days") or 15)
    block_days = int(control.get("grace_block_days") or 30)
    if due and days > 0 and not paid_after_due:
        control["billing_days_overdue"] = days
        if days >= block_days:
            control["billing_computed_status"] = "bloqueado"
            control["billing_status"] = "bloqueado"
            if control.get("block_mode") in {None, "", "none"}:
                control["block_mode"] = "admin"
            control["billing_notice"] = f"Mensalidade vencida há {days} dias. Bloqueio administrativo aplicado."
        elif days >= alert_days:
            control["billing_computed_status"] = "vencido"
            control["billing_status"] = "vencido"
            control["billing_notice"] = f"Mensalidade vencida há {days} dias. Entrar em contato com o cliente."
        else:
            control["billing_computed_status"] = "vencido"
            control["billing_status"] = "vencido"
            control["billing_notice"] = f"Mensalidade vencida há {days} dias."
        return control

    control["billing_days_overdue"] = 0
    control["billing_computed_status"] = "em_dia"
    if control.get("billing_status") not in {"bloqueado", "teste_gratis"}:
        control["billing_status"] = "em_dia"
    control["billing_notice"] = "Financeiro em dia" if due else "Sem vencimento definido"
    return control

def get_platform_control(restaurant_id: str) -> dict:
    data = _platform_control_defaults()
    row = _first(sb.table("configuracoes").select("valor").eq("restaurant_id", restaurant_id).eq("chave", "platform_control").execute().data)
    saved = row.get("valor") if row else None
    if isinstance(saved, str):
        try:
            saved = json.loads(saved)
        except json.JSONDecodeError:
            saved = None
    if isinstance(saved, dict):
        data.update({k: v for k, v in saved.items() if k not in {"limits", "modules", "future_modules", "plan_marketing"}})
        data["limits"].update(saved.get("limits") or {})
        data["modules"].update(saved.get("modules") or {})
        data["future_modules"].update(saved.get("future_modules") or {})
        data["plan_marketing"].update(saved.get("plan_marketing") or {})
    return calcular_status_financeiro(data)

def next_customer_code() -> str:
    rows = _rows(sb.table("configuracoes").select("valor").eq("chave", "platform_control").execute())
    highest = 0
    for row in rows:
        saved = row.get("valor")
        if isinstance(saved, str):
            try:
                saved = json.loads(saved)
            except json.JSONDecodeError:
                saved = {}
        code = str((saved or {}).get("customer_code") or "")
        if code.startswith("CLI-"):
            try:
                highest = max(highest, int(code.split("-", 1)[1].split("-", 1)[0]))
            except (ValueError, IndexError):
                continue
    return f"CLI-{highest + 1:03d}"

def save_platform_control(restaurant_id: str, control: dict):
    control = dict(control or {})
    if not control.get("customer_code"):
        control["customer_code"] = next_customer_code()
    if not control.get("branch_code"):
        control["branch_code"] = control["customer_code"]
    if not control.get("branch_label"):
        control["branch_label"] = "Matriz"
    payload = {
        "restaurant_id": restaurant_id,
        "chave": "platform_control",
        "valor": control,
        "descricao": "Controles internos da plataforma",
        "updated_at": utcnow(),
    }
    exists = _first(sb.table("configuracoes").select("chave").eq("restaurant_id", restaurant_id).eq("chave", "platform_control").execute().data)
    if exists:
        sb.table("configuracoes").update(payload).eq("restaurant_id", restaurant_id).eq("chave", "platform_control").execute()
    else:
        sb.table("configuracoes").insert(payload).execute()

def support_ticket_public(ticket: dict) -> dict:
    ticket = dict(ticket or {})
    restaurant = ticket.pop("restaurants", None)
    if restaurant:
        ticket["restaurant"] = restaurant
    return ticket

def listar_support_tickets(restaurant_id: str | None = None, limit: int = 80) -> list:
    query = sb.table("platform_support_tickets").select(
        "*, restaurants(id,name,slug,plan,is_active)"
    ).order("created_at", desc=True).limit(limit)
    if restaurant_id:
        query = query.eq("restaurant_id", restaurant_id)
    return [support_ticket_public(t) for t in _rows(query.execute())]

def atualizar_resumo_suporte(restaurant_id: str):
    control = get_platform_control(restaurant_id)
    tickets = listar_support_tickets(restaurant_id, 20)
    open_tickets = [t for t in tickets if t.get("status") != "resolvido"]
    current = open_tickets[0] if open_tickets else (tickets[0] if tickets else None)
    if not current:
        control["support_status"] = "sem_chamado"
        control["support_priority"] = "normal"
        save_platform_control(restaurant_id, control)
        return control
    if open_tickets:
        control["support_status"] = current.get("status") or "aberto"
        control["support_priority"] = current.get("priority") or "normal"
    else:
        control["support_status"] = "resolvido"
        control["support_priority"] = current.get("priority") or "normal"
    resumo = []
    for t in tickets[:6]:
        resumo.append(
            f"[{t.get('ticket_number') or t.get('id')}] {t.get('status')} / {t.get('priority')} - {t.get('subject') or t.get('message') or ''}"
        )
    control["support_notes"] = "\n".join(resumo)[:6000]
    save_platform_control(restaurant_id, control)
    return control

def get_restaurant_feature_flags(restaurant_id: str) -> dict:
    defaults = {"allow_waiter_payment": False, "allow_waiter_delivery": False}
    row = _first(sb.table("configuracoes").select("valor").eq("restaurant_id", restaurant_id).eq("chave", "feature_flags").execute().data)
    saved = row.get("valor") if row else None
    if isinstance(saved, str):
        try:
            saved = json.loads(saved)
        except json.JSONDecodeError:
            saved = None
    if isinstance(saved, dict):
        defaults.update(saved)
    return defaults

def save_restaurant_feature_flags(restaurant_id: str, flags: dict):
    payload = {
        "restaurant_id": restaurant_id,
        "chave": "feature_flags",
        "valor": flags,
        "descricao": "Recursos opcionais do restaurante",
        "updated_at": utcnow(),
    }
    exists = _first(sb.table("configuracoes").select("chave").eq("restaurant_id", restaurant_id).eq("chave", "feature_flags").execute().data)
    if exists:
        sb.table("configuracoes").update(payload).eq("restaurant_id", restaurant_id).eq("chave", "feature_flags").execute()
    else:
        sb.table("configuracoes").insert(payload).execute()

def get_fiscal_config(restaurant_id: str) -> dict:
    defaults = {
        "enabled": False,
        "mode": "manual",
        "provider": "",
        "document_type": "nfce",
        "environment": "homologacao",
        "cnpj": "",
        "state_registration": "",
        "municipal_registration": "",
        "tax_regime": "simples_nacional",
        "series": "1",
        "auto_after_close": False,
        "notes": "",
    }
    row = _first(sb.table("configuracoes").select("valor").eq("restaurant_id", restaurant_id).eq("chave", "fiscal_config").execute().data)
    saved = row.get("valor") if row else None
    if isinstance(saved, str):
        try:
            saved = json.loads(saved)
        except json.JSONDecodeError:
            saved = None
    if isinstance(saved, dict):
        defaults.update(saved)
    return defaults

def save_fiscal_config(restaurant_id: str, config: dict):
    payload = {
        "restaurant_id": restaurant_id,
        "chave": "fiscal_config",
        "valor": config,
        "descricao": "Configuração fiscal do restaurante",
        "updated_at": utcnow(),
    }
    exists = _first(sb.table("configuracoes").select("chave").eq("restaurant_id", restaurant_id).eq("chave", "fiscal_config").execute().data)
    if exists:
        sb.table("configuracoes").update(payload).eq("restaurant_id", restaurant_id).eq("chave", "fiscal_config").execute()
    else:
        sb.table("configuracoes").insert(payload).execute()

def listar_fiscal_docs(restaurant_id: str) -> list[dict]:
    row = _first(sb.table("configuracoes").select("valor").eq("restaurant_id", restaurant_id).eq("chave", "fiscal_documents").execute().data)
    value = row.get("valor") if row else []
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            value = []
    return value if isinstance(value, list) else []

def save_fiscal_docs(restaurant_id: str, docs: list[dict]):
    payload = {
        "restaurant_id": restaurant_id,
        "chave": "fiscal_documents",
        "valor": docs[-300:],
        "descricao": "Controle de documentos fiscais",
        "updated_at": utcnow(),
    }
    exists = _first(sb.table("configuracoes").select("chave").eq("restaurant_id", restaurant_id).eq("chave", "fiscal_documents").execute().data)
    if exists:
        sb.table("configuracoes").update(payload).eq("restaurant_id", restaurant_id).eq("chave", "fiscal_documents").execute()
    else:
        sb.table("configuracoes").insert(payload).execute()

def _config_value(restaurant_id: str, chave: str, default):
    row = _first(sb.table("configuracoes").select("valor").eq("restaurant_id", restaurant_id).eq("chave", chave).execute().data)
    value = row.get("valor") if row else default
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            value = default
    return value if value is not None else default

def _save_config_value(restaurant_id: str, chave: str, valor, descricao: str):
    payload = {
        "restaurant_id": restaurant_id,
        "chave": chave,
        "valor": valor,
        "descricao": descricao,
        "updated_at": utcnow(),
    }
    exists = _first(sb.table("configuracoes").select("chave").eq("restaurant_id", restaurant_id).eq("chave", chave).execute().data)
    if exists:
        sb.table("configuracoes").update(payload).eq("restaurant_id", restaurant_id).eq("chave", chave).execute()
    else:
        sb.table("configuracoes").insert(payload).execute()

def listar_caixas(restaurant_id: str) -> list[dict]:
    caixas = _config_value(restaurant_id, "cash_registers", [])
    if not isinstance(caixas, list):
        caixas = []
    if not caixas:
        caixas = [{
            "id": str(uuid4()),
            "name": "Caixa 1",
            "is_active": True,
            "created_at": utcnow(),
            "updated_at": utcnow(),
        }]
        salvar_caixas(restaurant_id, caixas)
    return caixas

def salvar_caixas(restaurant_id: str, caixas: list[dict]):
    _save_config_value(restaurant_id, "cash_registers", caixas[-80:], "Caixas físicos/operacionais do restaurante")

def listar_turnos_caixa(restaurant_id: str) -> list[dict]:
    turnos = _config_value(restaurant_id, "cash_shifts", [])
    return turnos if isinstance(turnos, list) else []

def salvar_turnos_caixa(restaurant_id: str, turnos: list[dict]):
    _save_config_value(restaurant_id, "cash_shifts", turnos[-500:], "Aberturas e fechamentos de caixa")

def limite_caixas_restaurante(restaurant_id: str) -> int:
    rest = _first(_rows(sb.table("restaurants").select("plan").eq("id", restaurant_id).limit(1).execute()))
    plan = normalize_plan((rest or {}).get("plan"))
    return CASH_REGISTER_LIMITS.get(plan, CASH_REGISTER_LIMITS["starter"])

def caixa_por_id(restaurant_id: str, caixa_id: str) -> dict:
    caixa = next((c for c in listar_caixas(restaurant_id) if c.get("id") == caixa_id and c.get("is_active") is not False), None)
    if not caixa:
        raise HTTPException(404, "Caixa não encontrado ou inativo")
    return caixa

def turno_aberto_por_caixa(restaurant_id: str, caixa_id: str) -> dict | None:
    return next((t for t in listar_turnos_caixa(restaurant_id) if t.get("register_id") == caixa_id and t.get("status") == "open"), None)

def turno_aberto_por_id(restaurant_id: str, turno_id: str) -> dict | None:
    return next((t for t in listar_turnos_caixa(restaurant_id) if t.get("id") == turno_id and t.get("status") == "open"), None)

def caixa_resumo_dinheiro(cedulas: dict | None) -> dict:
    valores = {"200": 200, "100": 100, "50": 50, "20": 20, "10": 10, "5": 5, "2": 2, "1": 1, "0.50": 0.5, "0.25": 0.25, "0.10": 0.1, "0.05": 0.05}
    cedulas = cedulas or {}
    normalized = {}
    total = 0.0
    for key, valor in valores.items():
        try:
            qtd = max(0, int(cedulas.get(key) or 0))
        except (TypeError, ValueError):
            qtd = 0
        normalized[key] = qtd
        total += qtd * valor
    return {"denominations": normalized, "total": _money(total)}

def atualizar_turno_com_fechamento(restaurant_id: str, shift_id: str | None, fechamento: dict):
    if not shift_id:
        return None
    turnos = listar_turnos_caixa(restaurant_id)
    for turno in turnos:
        if turno.get("id") == shift_id and turno.get("status") == "open":
            turno.setdefault("account_closures", []).append(fechamento)
            turno["sales_total"] = _money(float(turno.get("sales_total") or 0) + float(fechamento.get("total") or 0))
            turno["transactions_count"] = int(turno.get("transactions_count") or 0) + 1
            por_forma = turno.setdefault("payments_by_method", {})
            for forma, valor in (fechamento.get("payments_by_method") or {}).items():
                por_forma[forma] = _money(float(por_forma.get(forma) or 0) + float(valor or 0))
            turno["updated_at"] = utcnow()
            salvar_turnos_caixa(restaurant_id, turnos)
            return turno
    raise HTTPException(409, "Abra um turno de caixa antes de fechar contas")

def registrar_fiscal_documento(restaurant_id: str, sessao_id: str, total: float, origem: str, status_doc: str = "pendente", extra: dict | None = None) -> dict:
    config = get_fiscal_config(restaurant_id)
    doc = {
        "id": str(uuid4()),
        "sessao_mesa_id": sessao_id,
        "document_type": config.get("document_type") or "nfce",
        "environment": config.get("environment") or "homologacao",
        "provider": config.get("provider") or "",
        "status": status_doc,
        "origem": origem,
        "total": _money(total),
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    if extra:
        doc.update(extra)
    docs = listar_fiscal_docs(restaurant_id)
    docs.append(doc)
    save_fiscal_docs(restaurant_id, docs)
    return doc

def buscar_mesa_do_restaurante(restaurant_id: str, mesa_id: str, fields: str = "id,numero") -> dict:
    mesa = sb.table("mesas").select(fields).eq("id", mesa_id).eq("restaurant_id", restaurant_id).execute()
    data = _first(_rows(mesa))
    if not data:
        raise HTTPException(403, "Mesa não pertence ao seu restaurante")
    return data

def buscar_sessao_aberta_mesa(restaurant_id: str, mesa_id: str, fields: str = "id,total_consumido") -> dict:
    sess = sb.table("sessao_mesa").select(fields).eq("mesa_id", mesa_id).eq("restaurant_id", restaurant_id).eq("status", "aberta").limit(1).execute()
    data = _first(_rows(sess))
    if not data:
        raise HTTPException(404, "Nenhuma sessão aberta nesta mesa")
    return data

def count_pedidos_abertos_sessao(restaurant_id: str, sessao_id: str) -> int:
    resp = sb.table("pedidos").select("id", count="exact").eq("sessao_mesa_id", sessao_id).eq("restaurant_id", restaurant_id).in_("status", list(OPEN_ORDER_STATUSES)).execute()
    return resp.count or 0

def listar_pedidos_fechamento(restaurant_id: str, sessao_id: str) -> list[dict]:
    return _rows(
        sb.table("pedidos")
        .select("id,total")
        .eq("sessao_mesa_id", sessao_id)
        .eq("restaurant_id", restaurant_id)
        .neq("status", "cancelado")
        .execute()
    )

def aplicar_limites_plano(control: dict, plan: str, force: bool = False) -> dict:
    plan = normalize_plan(plan)
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["starter"]).copy()
    modules = PLAN_MODULES.get(plan, PLAN_MODULES["starter"]).copy()
    control["limits"] = limits if force else {**limits, **(control.get("limits") or {})}
    control["modules"] = modules if force else {**modules, **(control.get("modules") or {})}
    if force or not control.get("monthly_amount"):
        control["monthly_amount"] = PLAN_BASE_PRICES.get(plan, PLAN_BASE_PRICES["starter"])
    control["future_modules"] = FUTURE_MODULES.copy()
    control["plan_marketing"] = PLAN_MARKETING.get(plan, PLAN_MARKETING["starter"]).copy()
    return control

def validar_role_no_plano(restaurant_id: str, role: str):
    required_module = ROLE_MODULE_REQUIREMENTS.get(role)
    if not required_module:
        return
    control = get_platform_control(restaurant_id)
    if (control.get("modules") or {}).get(required_module) is False:
        raise HTTPException(403, f"O perfil {role} exige o módulo {required_module}, disponível em plano superior")

def platform_links(slug: str) -> dict:
    base_url = "" if FRONTEND_URL == "*" else FRONTEND_URL.rstrip("/")
    prefix = f"{base_url}/r/{slug}"
    return {
        "admin": f"{prefix}/admin",
        "caixa": f"{prefix}/caixa",
        "garcom": f"{prefix}/garcom",
        "cozinha": f"{prefix}/cozinha",
    }

def enforce_platform_control(restaurant_id: str, area: str):
    control = get_platform_control(restaurant_id)
    block_mode = control.get("block_mode") or "none"
    billing_status = control.get("billing_status") or "em_dia"
    if billing_status == "bloqueado" or block_mode == "full":
        raise HTTPException(403, "Restaurante bloqueado pela plataforma")
    if area == "orders" and block_mode == "orders":
        raise HTTPException(403, "Novos pedidos bloqueados pela plataforma")
    if area == "admin" and block_mode == "admin":
        raise HTTPException(403, "Painel administrativo bloqueado pela plataforma")
    if area == "users" and block_mode == "users":
        raise HTTPException(403, "Gestão de usuários bloqueada pela plataforma")
    modules = control.get("modules") or {}
    if area in modules and modules.get(area) is False:
        raise HTTPException(403, f"Módulo {area} não está liberado no plano")

def enforce_plan_limit(restaurant_id: str, limit_key: str, current_count: int, extra: int = 1):
    control = get_platform_control(restaurant_id)
    limit = int((control.get("limits") or {}).get(limit_key) or 0)
    if limit <= 0 or limit >= 9999:
        return
    if current_count + extra > limit:
        labels = {"users": "usuários", "tables": "mesas", "products": "produtos"}
        raise HTTPException(403, f"Limite de {labels.get(limit_key, limit_key)} do plano atingido ({limit})")

def active_memberships_count(restaurant_id: str) -> int:
    resp = sb.table("restaurant_memberships").select("id", count="exact").eq("restaurant_id", restaurant_id).eq("is_active", True).execute()
    return resp.count or 0

def active_role_memberships_count(restaurant_id: str, role: str) -> int:
    resp = sb.table("restaurant_memberships").select("id", count="exact").eq("restaurant_id", restaurant_id).eq("role", role).eq("is_active", True).execute()
    return resp.count or 0

def enforce_cashier_user_limit(restaurant_id: str, role: str):
    if role != "cashier":
        return
    if limite_caixas_restaurante(restaurant_id) <= 1 and active_role_memberships_count(restaurant_id, "cashier") >= 1:
        raise HTTPException(403, "Plano atual permite somente 1 usuário de caixa")

def active_tables_count(restaurant_id: str) -> int:
    resp = sb.table("mesas").select("id", count="exact").eq("restaurant_id", restaurant_id).eq("ativa", True).execute()
    return resp.count or 0

def ensure_active_tables_count(restaurant_id: str, desired_count: int) -> int:
    desired_count = max(0, int(desired_count or 0))
    current_count = active_tables_count(restaurant_id)
    if desired_count <= current_count:
        return 0
    enforce_plan_limit(restaurant_id, "tables", current_count, desired_count - current_count)
    existentes = _rows(sb.table("mesas").select("numero").eq("restaurant_id", restaurant_id).execute())
    usados = {int(m["numero"]) for m in existentes if str(m.get("numero", "")).isdigit()}
    novas = []
    n = 1
    while len(novas) < (desired_count - current_count):
        if n not in usados:
            novas.append({
                "restaurant_id": restaurant_id,
                "numero": n,
                "capacidade": 4,
                "ativa": True,
                "status": "livre",
                "qr_code_token": secrets.token_urlsafe(24),
            })
            usados.add(n)
        n += 1
    if novas:
        sb.table("mesas").insert(novas).execute()
    return len(novas)

def products_count(restaurant_id: str) -> int:
    resp = sb.table("produtos").select("id", count="exact").eq("restaurant_id", restaurant_id).execute()
    return resp.count or 0

def insert_restaurant(payload: dict) -> dict:
    resp = sb.table("restaurants").insert(payload).execute()
    inserted = _first(_rows(resp))
    if inserted:
        return inserted
    rest = sb.table("restaurants").select("*").eq("slug", payload["slug"]).single().execute()
    return _row(rest)

def insert_user(payload: dict, email: str) -> str:
    resp = sb.table("usuarios").insert(payload).execute()
    inserted = _first(_rows(resp))
    if inserted and inserted.get("id"):
        return inserted["id"]
    usr = sb.table("usuarios").select("id").eq("email", email).single().execute()
    return _row(usr)["id"]

def make_login_identifier(identifier: str, restaurant_slug: str | None = None) -> str:
    raw = (identifier or "").strip().lower()
    if not raw:
        raise HTTPException(400, "Login obrigatório")
    if "@" in raw or raw.startswith("super:") or ":" in raw:
        return raw
    if not restaurant_slug:
        raise HTTPException(400, "Informe o restaurante para login por usuário")
    clean = "".join(ch for ch in raw if ch.isalnum() or ch in ("-", "_", "."))
    if len(clean) < 2:
        raise HTTPException(400, "Usuário precisa ter ao menos 2 caracteres")
    return f"{restaurant_slug}:{clean}"

def display_login_identifier(identifier: str, restaurant_slug: str | None = None) -> str:
    raw = identifier or ""
    prefix = f"{restaurant_slug}:"
    if restaurant_slug and raw.startswith(prefix):
        return raw[len(prefix):]
    return raw

def user_identifier_from_body(body: CriarUsuarioInput, restaurant_slug: str) -> str:
    value = body.username or body.email
    if not value:
        raise HTTPException(400, "Informe usuário ou e-mail")
    return make_login_identifier(value, restaurant_slug)

def enrich_membership_logins(memberships: list[dict], restaurant_slug: str | None = None) -> list[dict]:
    for m in memberships:
        usuario = m.get("usuarios") or {}
        if usuario.get("email"):
            usuario["login"] = display_login_identifier(usuario["email"], restaurant_slug)
            usuario["is_email_login"] = "@" in usuario["email"]
    return memberships

def desativar_usuarios_orfaos(usuario_ids: list[str]) -> int:
    desativados = 0
    for uid in set(usuario_ids):
        restantes = sb.table("restaurant_memberships").select("id", count="exact").eq("usuario_id", uid).eq("is_active", True).execute()
        if restantes.count:
            continue
        usuario = _first(_rows(sb.table("usuarios").select("id,email").eq("id", uid).limit(1).execute()))
        admin = sb.table("platform_admins").select("id", count="exact").eq("usuario_id", uid).execute()
        if not usuario or admin.count or usuario.get("email") == "admin@restaurante.com":
            continue
        sb.table("usuarios").update({"ativo": False}).eq("id", uid).execute()
        desativados += 1
    return desativados

def _normalizar_pagamentos(body: FecharContaInput, total: float) -> tuple[str, dict]:
    total = _money(total)
    pagamentos_raw = body.pagamentos or []
    pagamentos = []
    if pagamentos_raw:
        for item in pagamentos_raw:
            forma = item.get("forma_pagamento") or item.get("forma")
            valor = _money(item.get("valor"))
            if forma not in FORMAS_PAGAMENTO:
                raise HTTPException(400, f"Forma de pagamento inválida: {forma}")
            if valor <= 0:
                raise HTTPException(400, "Valor de pagamento precisa ser maior que zero")
            pagamentos.append({"forma_pagamento": forma, "valor": valor})
    elif body.forma_pagamento:
        if body.forma_pagamento not in FORMAS_PAGAMENTO:
            raise HTTPException(400, "Forma de pagamento inválida")
        pagamentos.append({"forma_pagamento": body.forma_pagamento, "valor": total})
    else:
        raise HTTPException(400, "Informe a forma de pagamento")

    soma = round(sum(p["valor"] for p in pagamentos), 2)
    if abs(soma - total) > 0.02:
        raise HTTPException(400, f"Soma dos pagamentos ({soma:.2f}) diferente do total ({total:.2f})")

    por_forma = {}
    for p in pagamentos:
        forma = p["forma_pagamento"]
        por_forma[forma] = round(por_forma.get(forma, 0.0) + p["valor"], 2)

    if len(por_forma) == 1:
        forma_db = next(iter(por_forma.keys()))
    else:
        partes = [f"{forma}:{valor:.2f}" for forma, valor in sorted(por_forma.items())]
        forma_db = "misto|" + ";".join(partes)

    return forma_db, {"total": total, "pagamentos": pagamentos, "por_forma": por_forma}


def _inventory_item_status(item: dict) -> str:
    estoque = _money(item.get("estoque_atual"))
    minimo = _money(item.get("estoque_minimo"))
    if estoque <= 0:
        return "zerado"
    if minimo > 0 and estoque <= minimo:
        return "baixo"
    return "ok"


def _inventory_item_or_404(restaurant_id: str, item_id: str) -> dict:
    item = _first(_rows(
        sb.table("inventory_items")
        .select("*")
        .eq("id", item_id)
        .eq("restaurant_id", restaurant_id)
        .limit(1)
        .execute()
    ))
    if not item:
        raise HTTPException(404, "Insumo nÃ£o encontrado")
    return item


def _product_or_404(restaurant_id: str, product_id: str, fields: str = "id,nome,preco,custo") -> dict:
    produto = _first(_rows(
        sb.table("produtos")
        .select(fields)
        .eq("id", product_id)
        .eq("restaurant_id", restaurant_id)
        .limit(1)
        .execute()
    ))
    if not produto:
        raise HTTPException(404, "Produto nÃ£o encontrado neste restaurante")
    return produto


def calcular_custo_receita(restaurant_id: str, recipe_rows: list[dict]) -> dict:
    item_ids = [r.get("inventory_item_id") for r in recipe_rows if r.get("inventory_item_id")]
    items = {}
    if item_ids:
        rows = _rows(sb.table("inventory_items").select("id,nome,unidade,custo_unitario,estoque_atual,estoque_minimo,ativo").eq("restaurant_id", restaurant_id).in_("id", item_ids).execute())
        items = {row["id"]: row for row in rows}
    enriched = []
    total = 0.0
    for row in recipe_rows:
        item = items.get(row.get("inventory_item_id")) or {}
        quantidade = _money(row.get("quantity"))
        custo_unitario = _money(item.get("custo_unitario"))
        custo_total = _money(quantidade * custo_unitario)
        total = _money(total + custo_total)
        enriched.append({**row, "inventory_item": item, "cost_total": custo_total})
    return {"items": enriched, "cost": total}


def registrar_movimento_estoque(restaurant_id: str, body: InventoryMovementInput, usuario: dict, request: Request | None = None, allow_negative: bool = False) -> dict:
    item = _inventory_item_or_404(restaurant_id, body.inventory_item_id)
    atual = _money(item.get("estoque_atual"))
    qtd = _money(body.quantity)
    tipo = body.movement_type
    if tipo == "entrada":
        novo = _money(atual + qtd)
    elif tipo in {"saida_manual", "perda", "baixa_por_venda"}:
        novo = _money(atual - qtd)
    elif tipo == "ajuste":
        novo = _money(atual + qtd)
    elif tipo == "inventario":
        novo = qtd
    else:
        raise HTTPException(400, "Tipo de movimentaÃ§Ã£o invÃ¡lido")
    if novo < 0 and not allow_negative:
        raise HTTPException(409, "Estoque insuficiente para esta movimentaÃ§Ã£o")

    payload = {
        "restaurant_id": restaurant_id,
        "inventory_item_id": body.inventory_item_id,
        "movement_type": tipo,
        "quantity": qtd,
        "unit_cost": body.unit_cost if body.unit_cost is not None else item.get("custo_unitario"),
        "stock_before": atual,
        "stock_after": novo,
        "reason": body.reason,
        "product_id": body.product_id,
        "order_id": body.order_id,
        "created_by": usuario.get("sub"),
        "created_by_name": usuario.get("nome") or "",
        "created_at": utcnow(),
    }
    mov = _first(_rows(sb.table("inventory_movements").insert(payload).select("*").execute())) or payload
    item_update = {"estoque_atual": novo, "updated_at": utcnow()}
    if body.unit_cost is not None and tipo in {"entrada", "inventario", "ajuste"}:
        item_update["custo_unitario"] = body.unit_cost
    sb.table("inventory_items").update(item_update).eq("id", body.inventory_item_id).eq("restaurant_id", restaurant_id).execute()
    if request:
        log_acao(usuario, "movimentar_estoque", "inventory_movements", mov.get("id"), {"estoque_atual": atual}, payload, request)
    return mov


def baixar_estoque_por_pedidos(restaurant_id: str, pedidos: list[dict], usuario: dict, request: Request | None = None) -> dict:
    pedido_ids = [p.get("id") for p in pedidos if p.get("id")]
    if not pedido_ids:
        return {"movements": 0, "items": []}
    itens_pedido = _rows(
        sb.table("pedido_itens")
        .select("pedido_id,produto_id,quantidade")
        .in_("pedido_id", pedido_ids)
        .execute()
    )
    produto_ids = sorted({it.get("produto_id") for it in itens_pedido if it.get("produto_id")})
    if not produto_ids:
        return {"movements": 0, "items": []}
    receitas = _rows(
        sb.table("product_recipes")
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .in_("product_id", produto_ids)
        .execute()
    )
    receitas_por_produto = {}
    for receita in receitas:
        receitas_por_produto.setdefault(receita.get("product_id"), []).append(receita)
    movimentos = []
    for item_pedido in itens_pedido:
        produto_id = item_pedido.get("produto_id")
        quantidade_vendida = _money(item_pedido.get("quantidade"))
        for receita in receitas_por_produto.get(produto_id, []):
            qtd_baixa = _money(_money(receita.get("quantity")) * quantidade_vendida)
            if qtd_baixa <= 0:
                continue
            movimento = registrar_movimento_estoque(
                restaurant_id,
                InventoryMovementInput(
                    inventory_item_id=receita["inventory_item_id"],
                    movement_type="baixa_por_venda",
                    quantity=qtd_baixa,
                    product_id=produto_id,
                    order_id=item_pedido.get("pedido_id"),
                    reason="Baixa automÃ¡tica por venda",
                ),
                usuario,
                request,
                allow_negative=True,
            )
            movimentos.append(movimento)
    return {"movements": len(movimentos), "items": movimentos}


def _somar_pagamento_dashboard(por_pagamento: dict, forma_pagamento: str, total: float):
    total = _money(total)
    if not forma_pagamento:
        por_pagamento["em_aberto"] = round(por_pagamento.get("em_aberto", 0.0) + total, 2)
        return
    if forma_pagamento.startswith("misto|"):
        for parte in forma_pagamento.split("|", 1)[1].split(";"):
            if ":" not in parte:
                continue
            forma, valor = parte.split(":", 1)
            por_pagamento[forma] = round(por_pagamento.get(forma, 0.0) + _money(valor), 2)
        return
    por_pagamento[forma_pagamento] = round(por_pagamento.get(forma_pagamento, 0.0) + total, 2)

def _forma_pagamento_pedido(resumo_pagamento: dict, total_pedido: float) -> str:
    por_forma = resumo_pagamento.get("por_forma") or {}
    if len(por_forma) == 1:
        return next(iter(por_forma.keys()))
    # O banco atual valida forma_pagamento contra valores fixos e não aceita
    # composição mista. O detalhamento fica no retorno e no audit_log.
    return next(iter(sorted(por_forma.keys())), "pix")

def utcnow() -> str:
    return datetime.utcnow().isoformat()


def parse_datetime(value: str | None) -> Optional[datetime]:
    if not value:
        return None
    try:
        normalized = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt
    except ValueError:
        return None


def pedido_visivel_na_fila(pedido: dict) -> bool:
    if pedido.get("status") != "pronto":
        return True
    referencia = pedido.get("tempo_pronto") or pedido.get("updated_at") or pedido.get("created_at")
    pronto_em = parse_datetime(referencia)
    if not pronto_em:
        return True
    return datetime.utcnow() - pronto_em < timedelta(minutes=KITCHEN_READY_VISIBLE_MINUTES)


def pedido_entregue_visivel_na_cozinha(pedido: dict) -> bool:
    referencia = pedido.get("tempo_entrega") or pedido.get("updated_at") or pedido.get("created_at")
    entregue_em = parse_datetime(referencia)
    if not entregue_em:
        return True
    return datetime.utcnow() - entregue_em < timedelta(minutes=KITCHEN_READY_VISIBLE_MINUTES)


def carregar_pedidos_fila_cozinha(rid: str, limite: int = 80) -> list[dict]:
    resp = sb.table("pedidos").select(
        "id,numero,status,created_at,updated_at,tempo_pronto,tempo_entrega,observacao_geral,mesa_id,"
        "mesas(numero),"
        "pedido_itens(nome_produto,quantidade,observacao,"
        "  pedido_item_ingredientes(acao,nome_ingrediente))"
    ).eq("restaurant_id", rid).in_(
        "status",
        ["pendente", "confirmado", "em_preparo", "pronto", "entregue"],
    ).order("created_at").limit(min(max(limite, 1), 200)).execute()
    pedidos = []
    for pedido in _rows(resp):
        if pedido.get("status") == "entregue":
            if pedido_entregue_visivel_na_cozinha(pedido):
                pedidos.append(pedido)
        elif pedido_visivel_na_fila(pedido):
            pedidos.append(pedido)
    return pedidos


def carregar_pedidos_entregues_cozinha(rid: str, limite: int = 10) -> list[dict]:
    resp = sb.table("pedidos").select(
        "id,numero,status,total,created_at,updated_at,tempo_entrega,mesa_id,"
        "mesas(numero),pedido_itens(nome_produto,quantidade,subtotal)"
    ).eq("restaurant_id", rid).eq("status", "entregue").order(
        "created_at", desc=True
    ).limit(min(max(limite, 1), 50)).execute()
    return [p for p in _rows(resp) if pedido_entregue_visivel_na_cozinha(p)]


def log_acao(u: dict, acao: str, tabela: str = None,
             reg_id: str = None, ant=None, novo=None, request: Request = None):
    try:
        rid = u.get("restaurant_id")
        ip = request.client.host if request and request.client else None
        sb.table("audit_log").insert({
            "restaurant_id":  rid,
            "usuario_id":     u.get("sub"),
            "usuario_nome":   u.get("nome"),
            "perfil":         u.get("role"),
            "acao":           acao,
            "tabela":         tabela,
            "registro_id":    str(reg_id) if reg_id else None,
            "valor_anterior": ant,
            "valor_novo":     novo,
            "ip":             ip,
        }).execute()
    except Exception:
        pass  # log nunca quebra a operação

def log_publico_restaurante(restaurant_id: str, acao: str, tabela: str = None,
                            reg_id: str = None, dados=None, request: Request = None):
    ip = request.client.host if request and request.client else None
    sb.table("audit_log").insert({
        "restaurant_id": restaurant_id,
        "usuario_id": None,
        "usuario_nome": "Cliente",
        "perfil": "cliente",
        "acao": acao,
        "tabela": tabela,
        "registro_id": str(reg_id) if reg_id else None,
        "valor_anterior": None,
        "valor_novo": dados or {},
        "ip": ip,
    }).execute()


# ── SCHEMAS ───────────────────────────────────────────────────────
class LoginInput(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    login: Optional[str] = None
    senha: str
    restaurant_slug: Optional[str] = None  # opcional — se omitido, tenta encontrar o restaurante
    remember_me: bool = False

    def identifier(self) -> str:
        value = self.email or self.username or self.login
        if not value:
            raise HTTPException(400, "Informe o login")
        return value


class CriarRestauranteInput(BaseModel):
    name: str
    slug: str
    email: Optional[str] = None
    phone: Optional[str] = None
    primary_color: str = "#ff4d1c"
    secondary_color: str = "#1a1a1a"
    accent_color: str = "#ff6b3d"
    background_color: str = "#0a0a0a"
    text_color: str = "#f2f0eb"
    plan: str = "starter"
    template: str = "restaurante"
    initial_table_count: int = 10
    create_default_categories: bool = False
    create_sample_products: bool = False

    @field_validator("slug")
    @classmethod
    def val_slug(cls, v):
        if not v or not all(c.islower() or c.isdigit() or c == "-" for c in v):
            raise ValueError("Slug deve conter apenas letras minúsculas, números e hífens")
        return v

    @field_validator("initial_table_count")
    @classmethod
    def val_initial_table_count(cls, v):
        if v < 0 or v > 100:
            raise ValueError("Quantidade inicial de mesas precisa ficar entre 0 e 100")
        return v

    @field_validator("plan")
    @classmethod
    def val_plan(cls, v):
        v = normalize_plan(v)
        if v not in PLAN_LIMITS:
            raise ValueError(f"Plano inválido: {list(PLAN_LIMITS.keys())}")
        return v

    @field_validator("template")
    @classmethod
    def val_template(cls, v):
        if v not in TEMPLATE_CATEGORIES:
            raise ValueError(f"Template inválido: {list(TEMPLATE_CATEGORIES.keys())}")
        return v


class AtualizarRestauranteInput(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None
    background_color: Optional[str] = None
    text_color: Optional[str] = None
    theme_mode: Optional[str] = None


class AtualizarSettingsInput(BaseModel):
    service_fee_enabled: Optional[bool] = None
    service_fee_percent: Optional[float] = None
    allow_customer_notes: Optional[bool] = None
    allow_waiter_call: Optional[bool] = None
    allow_table_close_request: Optional[bool] = None
    allow_waiter_payment: Optional[bool] = None
    allow_waiter_delivery: Optional[bool] = None
    accept_pix: Optional[bool] = None
    accept_card: Optional[bool] = None
    accept_cash: Optional[bool] = None
    pix_key: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None

    @field_validator("service_fee_percent")
    @classmethod
    def val_taxa_servico(cls, v):
        if v is not None and (v < 0 or v > 30):
            raise ValueError("Taxa de serviço precisa ficar entre 0% e 30%")
        return v


class CriarUsuarioInput(BaseModel):
    nome: str
    email: Optional[str] = None
    username: Optional[str] = None
    senha: str
    role: str = "waiter"
    observacao: Optional[str] = None

    @field_validator("senha")
    @classmethod
    def val_senha(cls, v):
        if len(v) < 6:
            raise ValueError("Senha mínimo 6 caracteres")
        return v

    @field_validator("role")
    @classmethod
    def val_role(cls, v):
        if v not in ROLE_LEVEL:
            raise ValueError(f"Role inválida: {list(ROLE_LEVEL.keys())}")
        return v


class ResetSenhaInput(BaseModel):
    senha: str

    @field_validator("senha")
    @classmethod
    def val_senha(cls, v):
        if len(v) < 6:
            raise ValueError("Senha mínimo 6 caracteres")
        return v


class AlterarMinhaSenhaInput(BaseModel):
    senha_atual: str
    nova_senha: str

    @field_validator("senha_atual")
    @classmethod
    def val_senha_atual(cls, v):
        if not v:
            raise ValueError("Senha atual obrigatória")
        return v

    @field_validator("nova_senha")
    @classmethod
    def val_nova_senha(cls, v):
        if len(v) < 6:
            raise ValueError("Nova senha mínimo 6 caracteres")
        return v


class AtualizarStatusPedidoInput(BaseModel):
    status: str
    observacao: Optional[str] = None
    motivo_cancelamento: Optional[str] = None

    @field_validator("status")
    @classmethod
    def val(cls, v):
        validos = ["confirmado", "em_preparo", "pronto", "entregue", "cancelado"]
        if v not in validos:
            raise ValueError(f"Status inválido: {validos}")
        return v


class CriarMesaInput(BaseModel):
    numero: int
    capacidade: int = 4


class AtualizarMesaInput(BaseModel):
    status: Optional[str] = None
    capacidade: Optional[int] = None


class OcuparMesaInput(BaseModel):
    motivo: str = "cliente_sentou"
    observacao: Optional[str] = None

    @field_validator("motivo")
    @classmethod
    def val_motivo(cls, v):
        validos = {"cliente_sentou", "aguardando", "cardapio_fisico", "reserva_chegou", "outro"}
        if v not in validos:
            raise ValueError(f"Motivo inválido: {sorted(validos)}")
        return v


class LiberarMesaInput(BaseModel):
    motivo: str = "nao_consumiu"
    observacao: Optional[str] = None

    @field_validator("motivo")
    @classmethod
    def val_motivo(cls, v):
        validos = {"nao_consumiu", "desistiu", "aguardou_e_saiu", "erro_operacional", "outro"}
        if v not in validos:
            raise ValueError(f"Motivo inválido: {sorted(validos)}")
        return v


class CriarProdutoInput(BaseModel):
    categoria_id: UUID
    nome: str
    descricao: Optional[str] = None
    preco: float
    custo: float = 0.0
    foto_url: Optional[str] = None
    disponivel: bool = True
    destaque: bool = False
    tempo_preparo_minutos: int = 10

    @field_validator("preco")
    @classmethod
    def val_preco(cls, v):
        if v <= 0:
            raise ValueError("Preço precisa ser maior que zero")
        return v

    @field_validator("custo")
    @classmethod
    def val_custo(cls, v):
        if v < 0:
            raise ValueError("Custo não pode ser negativo")
        return v

    @field_validator("tempo_preparo_minutos")
    @classmethod
    def val_tempo_preparo(cls, v):
        if v < 1 or v > 240:
            raise ValueError("Tempo de preparo precisa ficar entre 1 e 240 minutos")
        return v


class FecharContaInput(BaseModel):
    forma_pagamento: Optional[str] = None
    pagamentos: Optional[list[dict]] = None
    cash_shift_id: Optional[str] = None

    @field_validator("forma_pagamento")
    @classmethod
    def val(cls, v):
        if v is not None and v not in FORMAS_PAGAMENTO:
            raise ValueError("Forma de pagamento inválida")
        return v


class CriarCaixaInput(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def val_name(cls, v):
        v = (v or "").strip()
        if len(v) < 3:
            raise ValueError("Nome do caixa precisa ter pelo menos 3 caracteres")
        if len(v) > 40:
            raise ValueError("Nome do caixa muito longo")
        return v


class AbrirTurnoCaixaInput(BaseModel):
    opening_amount: float = 0
    denominations: Optional[dict] = None
    notes: Optional[str] = None


class FecharTurnoCaixaInput(BaseModel):
    denominations: Optional[dict] = None
    closing_amount: Optional[float] = None
    left_for_next_shift: float = 0
    notes: Optional[str] = None


INVENTORY_UNITS = {"unidade", "kg", "g", "litro", "ml"}
INVENTORY_MOVEMENT_TYPES = {"entrada", "saida_manual", "ajuste", "perda", "inventario", "baixa_por_venda"}


class InventoryItemInput(BaseModel):
    nome: str
    unidade: str = "unidade"
    estoque_atual: float = 0
    estoque_minimo: float = 0
    custo_unitario: float = 0
    fornecedor: Optional[str] = None
    validade: Optional[str] = None
    ativo: bool = True

    @field_validator("nome")
    @classmethod
    def val_nome(cls, v):
        v = (v or "").strip()
        if len(v) < 2:
            raise ValueError("Nome do insumo obrigatÃ³rio")
        return v

    @field_validator("unidade")
    @classmethod
    def val_unidade(cls, v):
        if v not in INVENTORY_UNITS:
            raise ValueError(f"Unidade invÃ¡lida: {sorted(INVENTORY_UNITS)}")
        return v

    @field_validator("estoque_atual", "estoque_minimo", "custo_unitario")
    @classmethod
    def val_numero(cls, v):
        if v < 0:
            raise ValueError("Valor nÃ£o pode ser negativo")
        return v


class InventoryItemPatch(BaseModel):
    nome: Optional[str] = None
    unidade: Optional[str] = None
    estoque_minimo: Optional[float] = None
    custo_unitario: Optional[float] = None
    fornecedor: Optional[str] = None
    validade: Optional[str] = None
    ativo: Optional[bool] = None

    @field_validator("unidade")
    @classmethod
    def val_unidade(cls, v):
        if v is not None and v not in INVENTORY_UNITS:
            raise ValueError(f"Unidade invÃ¡lida: {sorted(INVENTORY_UNITS)}")
        return v

    @field_validator("estoque_minimo", "custo_unitario")
    @classmethod
    def val_numero(cls, v):
        if v is not None and v < 0:
            raise ValueError("Valor nÃ£o pode ser negativo")
        return v


class InventoryMovementInput(BaseModel):
    inventory_item_id: str
    movement_type: str
    quantity: float
    unit_cost: Optional[float] = None
    reason: Optional[str] = None
    product_id: Optional[str] = None
    order_id: Optional[str] = None

    @field_validator("movement_type")
    @classmethod
    def val_tipo(cls, v):
        if v not in INVENTORY_MOVEMENT_TYPES:
            raise ValueError(f"Tipo de movimentaÃ§Ã£o invÃ¡lido: {sorted(INVENTORY_MOVEMENT_TYPES)}")
        return v

    @field_validator("quantity")
    @classmethod
    def val_quantidade(cls, v):
        if v <= 0:
            raise ValueError("Quantidade precisa ser maior que zero")
        return v

    @field_validator("unit_cost")
    @classmethod
    def val_custo(cls, v):
        if v is not None and v < 0:
            raise ValueError("Custo nÃ£o pode ser negativo")
        return v


class ProductRecipeInput(BaseModel):
    items: list[dict] = []


DELIVERY_STATUSES = {"recebido", "confirmado", "em_preparo", "pronto", "saiu_para_entrega", "entregue", "cancelado"}
ORDER_TYPES = {"mesa", "balcao", "delivery"}


class DeliveryDriverInput(BaseModel):
    nome: str
    telefone: Optional[str] = None
    veiculo: Optional[str] = None
    ativo: bool = True

    @field_validator("nome")
    @classmethod
    def val_nome(cls, v):
        v = (v or "").strip()
        if len(v) < 2:
            raise ValueError("Nome do entregador obrigatÃ³rio")
        return v


class DeliveryOrderInput(BaseModel):
    customer_name: str
    customer_phone: str
    address: str
    neighborhood: Optional[str] = None
    delivery_fee: float = 0
    total: float = 0
    notes: Optional[str] = None
    driver_id: Optional[str] = None
    status: str = "recebido"

    @field_validator("status")
    @classmethod
    def val_status(cls, v):
        if v not in DELIVERY_STATUSES:
            raise ValueError(f"Status invÃ¡lido: {sorted(DELIVERY_STATUSES)}")
        return v

    @field_validator("delivery_fee", "total")
    @classmethod
    def val_money(cls, v):
        if v < 0:
            raise ValueError("Valor nÃ£o pode ser negativo")
        return v


class DeliveryStatusInput(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def val_status(cls, v):
        if v not in DELIVERY_STATUSES:
            raise ValueError(f"Status invÃ¡lido: {sorted(DELIVERY_STATUSES)}")
        return v


class FiscalConfigInput(BaseModel):
    enabled: Optional[bool] = None
    mode: Optional[str] = None
    provider: Optional[str] = None
    document_type: Optional[str] = None
    environment: Optional[str] = None
    cnpj: Optional[str] = None
    state_registration: Optional[str] = None
    municipal_registration: Optional[str] = None
    tax_regime: Optional[str] = None
    series: Optional[str] = None
    auto_after_close: Optional[bool] = None
    notes: Optional[str] = None

    @field_validator("mode")
    @classmethod
    def val_mode(cls, v):
        if v is not None and v not in {"manual", "api"}:
            raise ValueError("Modo fiscal inválido")
        return v

    @field_validator("document_type")
    @classmethod
    def val_doc(cls, v):
        if v is not None and v not in {"nfce", "nfe", "nfse"}:
            raise ValueError("Tipo de documento fiscal inválido")
        return v

    @field_validator("environment")
    @classmethod
    def val_env(cls, v):
        if v is not None and v not in {"homologacao", "producao"}:
            raise ValueError("Ambiente fiscal inválido")
        return v


class FiscalDocumentInput(BaseModel):
    sessao_mesa_id: Optional[str] = None
    total: Optional[float] = None
    status: str = "emitida"
    chave_acesso: Optional[str] = None
    numero: Optional[str] = None
    serie: Optional[str] = None
    xml_url: Optional[str] = None
    danfe_url: Optional[str] = None
    observacao: Optional[str] = None

    @field_validator("status")
    @classmethod
    def val_status(cls, v):
        if v not in {"pendente", "emitida", "cancelada", "rejeitada"}:
            raise ValueError("Status fiscal inválido")
        return v


class ChamadoMesaInput(BaseModel):
    tipo: str
    mensagem: Optional[str] = None

    @field_validator("tipo")
    @classmethod
    def val_tipo(cls, v):
        if v not in {"garcom", "conta", "problema"}:
            raise ValueError("Tipo de chamado inválido")
        return v


class FeedbackMesaInput(BaseModel):
    nota: int
    comentario: Optional[str] = None
    sessao_mesa_id: Optional[str] = None

    @field_validator("nota")
    @classmethod
    def val_nota(cls, v):
        if v < 1 or v > 5:
            raise ValueError("Nota precisa ficar entre 1 e 5")
        return v


# ═════════════════════════════════════════════════════════════════
# ROTAS PÚBLICAS (sem autenticação)
# ═════════════════════════════════════════════════════════════════

@app.get("/", tags=["geral"])
def root():
    return {"api": "SaaS Restaurante API", "version": "2.0.0", "env": APP_ENV}

@app.get("/health", tags=["geral"])
def health():
    return {"status": "ok", "timestamp": utcnow(), "version": APP_VERSION}


@app.get("/api/health", tags=["geral"])
def api_health():
    return health()


# ── Público: Buscar restaurante por slug ─────────────────────────
@app.get("/api/public/restaurants/{slug}", tags=["público"])
def get_restaurant_public(slug: str):
    """Retorna configurações públicas do restaurante (tema, nome, logo)."""
    resp = sb.rpc("get_restaurant_by_slug", {"p_slug": slug}).execute()
    data = _first(resp.data)
    if not data:
        raise HTTPException(404, f"Restaurante '{slug}' não encontrado ou inativo")
    return data


@app.get("/api/public/restaurants/{slug}/menu", tags=["público"])
def get_menu_public(slug: str):
    """Retorna cardápio completo do restaurante."""
    # Buscar restaurant_id pelo slug
    rest = sb.table("restaurants").select("id").eq("slug", slug).eq("is_active", True).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")
    rid = rest.data["id"]

    cardapio = sb.rpc("get_cardapio", {"p_restaurant_id": rid}).execute()
    return {"cardapio": cardapio.data or []}


@app.get("/api/public/restaurants/{slug}/tables/{table_token}", tags=["público"])
def get_table_public(slug: str, table_token: str):
    """Valida mesa pelo token e retorna dados públicos."""
    rest = sb.table("restaurants").select("id,name,slug").eq("slug", slug).eq("is_active", True).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")
    rid = rest.data["id"]

    mesa = sb.rpc("get_mesa_by_token", {"p_token": table_token, "p_restaurant_id": rid}).execute()
    mesa_data = _first(mesa.data)
    if not mesa_data:
        raise HTTPException(404, "Mesa não encontrada")
    return {"mesa": mesa_data, "restaurant": rest.data}


@app.post("/api/public/restaurants/{slug}/tables/{table_token}/call", tags=["público"])
def criar_chamado_mesa(slug: str, table_token: str, body: ChamadoMesaInput, request: Request):
    rest = sb.table("restaurants").select("id,name,slug").eq("slug", slug).eq("is_active", True).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")
    rid = rest.data["id"]

    mesa = sb.table("mesas").select("id,numero").eq("qr_code_token", table_token).eq("restaurant_id", rid).eq("ativa", True).single().execute()
    if not mesa.data:
        raise HTTPException(404, "Mesa não encontrada")

    settings = _first(_rows(sb.table("restaurant_settings").select(
        "allow_waiter_call,allow_table_close_request"
    ).eq("restaurant_id", rid).limit(1).execute())) or {}
    if body.tipo == "garcom" and settings.get("allow_waiter_call") is False:
        raise HTTPException(403, "Este restaurante desativou chamada de garçom pela mesa")
    if body.tipo == "conta" and settings.get("allow_table_close_request") is False:
        raise HTTPException(403, "Este restaurante desativou pedido de fechamento pela mesa")

    sessao = sb.table("sessao_mesa").select("id,total_consumido").eq("mesa_id", mesa.data["id"]).eq("restaurant_id", rid).eq("status", "aberta").limit(1).execute()
    sessao_data = _first(_rows(sessao)) or {}
    if body.tipo == "conta":
        if not sessao_data.get("id"):
            raise HTTPException(409, "Ainda não existe conta aberta nesta mesa")
        pedidos_abertos = sb.table("pedidos").select("id", count="exact").eq("sessao_mesa_id", sessao_data["id"]).eq("restaurant_id", rid).in_("status", list(OPEN_ORDER_STATUSES)).execute()
        if pedidos_abertos.count:
            raise HTTPException(409, "A conta só pode ser solicitada depois que todos os pedidos forem entregues")

    dados = {
        "tipo": body.tipo,
        "mensagem": body.mensagem,
        "mesa_id": mesa.data["id"],
        "mesa_numero": mesa.data["numero"],
        "sessao_mesa_id": sessao_data.get("id"),
        "status": "aberto",
        "created_at": utcnow(),
    }
    log_publico_restaurante(rid, f"mesa_{body.tipo}", "mesa_chamados", mesa.data["id"], dados, request)
    return {"mensagem": "Chamado enviado", "chamado": dados}


@app.post("/api/public/restaurants/{slug}/tables/{table_token}/sessions", tags=["público"])
def criar_sessao_public(slug: str, table_token: str):
    """Abre ou recupera sessão de uma mesa (cliente via QR Code)."""
    rest = sb.table("restaurants").select("id").eq("slug", slug).eq("is_active", True).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")
    rid = rest.data["id"]

    mesa = sb.table("mesas").select("id").eq("qr_code_token", table_token).eq("restaurant_id", rid).eq("ativa", True).single().execute()
    if not mesa.data:
        raise HTTPException(404, "Mesa não encontrada")

    sessao = sb.rpc("get_or_create_sessao", {
        "p_mesa_id": mesa.data["id"],
        "p_restaurant_id": rid
    }).execute()
    sessao_data = _first(sessao.data)
    if not sessao_data:
        raise HTTPException(500, "Erro ao abrir sessão da mesa")
    sb.table("mesas").update({"status": "ocupada", "updated_at": utcnow()}).eq("id", mesa.data["id"]).eq("restaurant_id", rid).execute()
    return {"sessao": sessao_data}


@app.post("/api/public/restaurants/{slug}/tables/{table_token}/feedback", tags=["público"])
def registrar_feedback(slug: str, table_token: str, body: FeedbackMesaInput, request: Request):
    rest = sb.table("restaurants").select("id").eq("slug", slug).eq("is_active", True).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")
    rid = rest.data["id"]
    mesa = sb.table("mesas").select("id,numero").eq("qr_code_token", table_token).eq("restaurant_id", rid).eq("ativa", True).single().execute()
    if not mesa.data:
        raise HTTPException(404, "Mesa não encontrada")
    dados = {
        "nota": body.nota,
        "comentario": body.comentario,
        "mesa_id": mesa.data["id"],
        "mesa_numero": mesa.data["numero"],
        "sessao_mesa_id": body.sessao_mesa_id,
        "created_at": utcnow(),
    }
    log_publico_restaurante(rid, "feedback_cliente", "feedback", mesa.data["id"], dados, request)
    return {"mensagem": "Obrigado pela avaliação"}


@app.post("/api/public/restaurants/{slug}/orders", tags=["público"])
def criar_pedido_public(slug: str, body: dict):
    """Cria pedido do cliente."""
    rest = sb.table("restaurants").select("id").eq("slug", slug).eq("is_active", True).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")
    rid = rest.data["id"]
    enforce_platform_control(rid, "orders")

    mesa_id = body.get("mesa_id")
    sessao_id = body.get("sessao_mesa_id")
    itens = body.get("itens") or body.get("items") or []
    if not mesa_id or not sessao_id:
        raise HTTPException(400, "mesa_id e sessao_mesa_id são obrigatórios")
    if not isinstance(itens, list) or not itens:
        raise HTTPException(400, "Pedido precisa ter ao menos um item")

    sessao = sb.table("sessao_mesa").select("id,mesa_id,status").eq("id", sessao_id).eq("mesa_id", mesa_id).eq("restaurant_id", rid).single().execute()
    if not sessao.data or sessao.data["status"] != "aberta":
        raise HTTPException(409, "Sessão da mesa inválida ou fechada")

    mesa = sb.table("mesas").select("id,ativa").eq("id", mesa_id).eq("restaurant_id", rid).single().execute()
    if not mesa.data or not mesa.data["ativa"]:
        raise HTTPException(404, "Mesa não encontrada")

    settings_resp = sb.table("restaurant_settings").select(
        "allow_customer_notes"
    ).eq("restaurant_id", rid).single().execute()
    settings = settings_resp.data or {}

    produto_ids = [str(i.get("produto_id")) for i in itens if i.get("produto_id")]
    if len(produto_ids) != len(itens):
        raise HTTPException(400, "Todos os itens precisam informar produto_id")
    produtos = sb.table("produtos").select("id,nome,preco").eq("restaurant_id", rid).eq("disponivel", True).in_("id", produto_ids).execute()
    produtos_por_id = {str(p["id"]): p for p in _rows(produtos)}
    encontrados = set(produtos_por_id.keys())
    if set(produto_ids) - encontrados:
        raise HTTPException(400, "Pedido contém produto indisponível ou inexistente")

    itens_sanitizados = []
    subtotal = 0.0
    for item in itens:
        produto_id = str(item.get("produto_id"))
        produto = produtos_por_id[produto_id]
        try:
            quantidade = int(item.get("quantidade", 1))
        except (TypeError, ValueError):
            raise HTTPException(400, "Quantidade inválida")
        if quantidade < 1 or quantidade > 50:
            raise HTTPException(400, "Quantidade precisa ficar entre 1 e 50")

        preco = float(produto["preco"])
        item_subtotal = round(preco * quantidade, 2)
        subtotal = round(subtotal + item_subtotal, 2)
        ingredientes = item.get("ingredientes") or []
        if not isinstance(ingredientes, list) or len(ingredientes) > 20:
            raise HTTPException(400, "Adicionais/ingredientes inválidos")
        ingredientes_sanitizados = []
        for ing in ingredientes:
            nome_ing = str((ing or {}).get("nome_ingrediente") or "").strip()
            acao_ing = str((ing or {}).get("acao") or "remover").strip()
            if not nome_ing or len(nome_ing) > 80 or acao_ing not in {"remover", "adicionar"}:
                raise HTTPException(400, "Adicional/ingrediente inválido")
            ingredientes_sanitizados.append({"nome_ingrediente": nome_ing, "acao": acao_ing})
        itens_sanitizados.append({
            "produto_id": produto_id,
            "nome_produto": produto["nome"],
            "preco_unitario": preco,
            "quantidade": quantidade,
            "subtotal": item_subtotal,
            "observacao": (item.get("observacao") or None) if settings.get("allow_customer_notes", True) else None,
            "ingredientes": ingredientes_sanitizados,
        })

    # Garantir que o restaurant_id é o certo (nunca confia no body)
    body["restaurant_id"] = rid
    body["itens"] = itens_sanitizados
    body["items"] = itens_sanitizados
    body["subtotal"] = subtotal
    body["total"] = subtotal
    if not settings.get("allow_customer_notes", True):
        body["observacao_geral"] = None

    resp = sb.rpc("criar_pedido", {"payload": body}).execute()
    data = _first(resp.data)
    if not data:
        raise HTTPException(500, "Erro ao criar pedido")
    if data.get("pedido_id") and not data.get("id"):
        data["id"] = data["pedido_id"]
    return {"pedido": data}


@app.get("/api/public/restaurants/{slug}/sessions/{sessao_id}/bill", tags=["público"])
def get_conta_public(slug: str, sessao_id: str):
    """Retorna pedidos da sessão para o cliente ver a conta."""
    rest = sb.table("restaurants").select("id").eq("slug", slug).eq("is_active", True).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")
    rid = rest.data["id"]

    # Validar sessão pertence ao restaurante
    sessao = sb.table("sessao_mesa").select("id,status,total_consumido,fechada_em").eq("id", sessao_id).eq("restaurant_id", rid).single().execute()
    if not sessao.data:
        raise HTTPException(404, "Sessão não encontrada")

    settings = _first(sb.table("restaurant_settings").select(
        "service_fee_enabled,service_fee_percent,accept_pix,accept_card,accept_cash,allow_table_close_request,pix_key"
    ).eq("restaurant_id", rid).execute().data) or {}
    settings.update(get_restaurant_feature_flags(rid))
    pedidos = sb.rpc("get_pedidos_sessao", {"p_sessao_id": sessao_id, "p_restaurant_id": rid}).execute()
    total_consumido = float(sessao.data["total_consumido"] or 0)
    taxa_percent = float(settings.get("service_fee_percent") or 0) if settings.get("service_fee_enabled") else 0
    taxa_servico = round(total_consumido * taxa_percent / 100, 2)
    return {
        "sessao_status":     sessao.data["status"],
        "total_consumido":   total_consumido,
        "taxa_servico":      taxa_servico,
        "total_com_taxa":    round(total_consumido + taxa_servico, 2),
        "settings":          settings,
        "sessao_fechada_em": sessao.data["fechada_em"],
        "pedidos":           pedidos.data or [],
    }


# ═════════════════════════════════════════════════════════════════
# AUTH
# ═════════════════════════════════════════════════════════════════

@app.post("/api/auth/login", tags=["auth"])
def login(body: LoginInput, request: Request):
    """
    Login multi-tenant.
    1. Valida credenciais
    2. Busca membership do usuário (a qual restaurante pertence + role)
    3. Se restaurant_slug informado, valida que o usuário pertence a ele
    4. Retorna JWT com restaurant_id e role embutidos
    """
    identifier = body.identifier()
    login_id = make_login_identifier(identifier, body.restaurant_slug)
    resp = sb.table("usuarios").select("*").eq("email", login_id).eq("ativo", True).limit(1).execute()
    u = _first(_rows(resp))
    if not u:
        raise HTTPException(401, "Credenciais inválidas")

    if not verificar_senha(body.senha.strip(), u.get("senha_hash", "")):
        raise HTTPException(401, "Credenciais inválidas")

    # Verificar se é super_admin da plataforma
    is_super_admin = sb.table("platform_admins").select("id").eq("usuario_id", u["id"]).execute()
    u["is_super_admin"] = bool(is_super_admin.data)

    # Buscar memberships
    memberships = sb.table("restaurant_memberships").select(
        "restaurant_id, role, restaurants(id, name, slug, is_active)"
    ).eq("usuario_id", u["id"]).eq("is_active", True).execute()

    if not memberships.data and not u["is_super_admin"]:
        raise HTTPException(403, "Usuário sem restaurante vinculado")

    # Selecionar o restaurante correto
    restaurant_id = None
    role = None
    restaurant_info = None

    if body.restaurant_slug:
        # Validar que o usuário pertence ao restaurante informado
        for m in (memberships.data or []):
            if m.get("restaurants", {}).get("slug") == body.restaurant_slug:
                restaurant_id = m["restaurant_id"]
                role = m["role"]
                restaurant_info = m["restaurants"]
                break
        if not restaurant_id and not u["is_super_admin"]:
            raise HTTPException(403, "Sem acesso a este restaurante")
    elif memberships.data:
        # Selecionar o primeiro restaurante ativo
        for m in memberships.data:
            if m.get("restaurants", {}).get("is_active"):
                restaurant_id = m["restaurant_id"]
                role = m["role"]
                restaurant_info = m["restaurants"]
                break

    if u["is_super_admin"]:
        role = "super_admin"

    # Atualizar último acesso
    sb.table("usuarios").update({"ultimo_acesso": utcnow()}).eq("id", u["id"]).execute()

    expires_hours = JWT_REMEMBER_DAYS * 24 if body.remember_me else JWT_EXP_H
    token = criar_token(u, restaurant_id, role, expires_hours=expires_hours)

    return {
        "token": token,
        "expires_in_hours": expires_hours,
        "usuario": {
            "id":            u["id"],
            "nome":          u["nome"],
            "email":         u["email"],
            "role":          role,
            "is_super_admin": u["is_super_admin"],
            "restaurant_id": restaurant_id,
            "restaurant":    restaurant_info,
        },
        "memberships": [
            {
                "restaurant_id":   m["restaurant_id"],
                "restaurant_slug": m.get("restaurants", {}).get("slug"),
                "restaurant_name": m.get("restaurants", {}).get("name"),
                "role":            m["role"],
            }
            for m in (memberships.data or [])
        ]
    }


@app.get("/api/auth/me", tags=["auth"])
def me(u: dict = Depends(verificar_token)):
    return {k: u[k] for k in ("sub", "nome", "email", "role", "restaurant_id", "is_super_admin") if k in u}


@app.patch("/api/auth/me/password", tags=["auth"])
def alterar_minha_senha(body: AlterarMinhaSenhaInput, request: Request, u: dict = Depends(verificar_token)):
    usuario = sb.table("usuarios").select("id,email,senha_hash,ativo").eq("id", u["sub"]).single().execute()
    if not usuario.data or usuario.data.get("ativo") is False:
        raise HTTPException(404, "Usuário não encontrado")
    if not verificar_senha(body.senha_atual.strip(), usuario.data.get("senha_hash", "")):
        raise HTTPException(401, "Senha atual incorreta")
    if verificar_senha(body.nova_senha.strip(), usuario.data.get("senha_hash", "")):
        raise HTTPException(400, "A nova senha precisa ser diferente da senha atual")

    sb.table("usuarios").update({
        "senha_hash": hash_senha(body.nova_senha.strip()),
        "ativo": True,
    }).eq("id", u["sub"]).execute()
    log_acao(u, "alterar_minha_senha", "usuarios", u["sub"], None, {"alterada": True}, request)
    return {"mensagem": "Senha atualizada"}


@app.post("/api/auth/switch-restaurant", tags=["auth"])
def switch_restaurant(body: dict, u: dict = Depends(verificar_token)):
    """Troca o restaurante ativo do usuário (para quem tem múltiplos)."""
    target_slug = body.get("restaurant_slug")
    if not target_slug:
        raise HTTPException(400, "restaurant_slug obrigatório")

    rest = sb.table("restaurants").select("id,name,slug,is_active").eq("slug", target_slug).single().execute()
    if not rest.data or not rest.data["is_active"]:
        raise HTTPException(404, "Restaurante não encontrado")

    rid = rest.data["id"]

    # Verificar acesso
    if not u.get("is_super_admin"):
        m = sb.table("restaurant_memberships").select("role").eq("usuario_id", u["sub"]).eq("restaurant_id", rid).eq("is_active", True).single().execute()
        if not m.data:
            raise HTTPException(403, "Sem acesso a este restaurante")
        role = m.data["role"]
    else:
        role = "super_admin"

    usuario_data = sb.table("usuarios").select("id,nome,email,perfil").eq("id", u["sub"]).single().execute()
    token = criar_token(usuario_data.data, rid, role)

    return {"token": token, "restaurant": rest.data, "role": role}


# ═════════════════════════════════════════════════════════════════
# COZINHA — filtrado por restaurant_id do token
# ═════════════════════════════════════════════════════════════════

@app.get("/api/kitchen/queue", tags=["cozinha"])
def fila_cozinha(limite: int = 80, u: dict = Depends(authorize(["kitchen", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    return {"pedidos": carregar_pedidos_fila_cozinha(rid, limite)}


@app.get("/api/kitchen/history", tags=["cozinha"])
def historico_cozinha(limite: int = 50, u: dict = Depends(authorize(["kitchen", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    resp = sb.table("pedidos").select(
        "id,numero,status,total,created_at,updated_at,tempo_pronto,tempo_entrega,observacao_geral,mesa_id,"
        "mesas(numero),pedido_itens(nome_produto,quantidade,observacao)"
    ).eq("restaurant_id", rid).in_(
        "status", ["entregue", "cancelado"]
    ).order("updated_at", desc=True).limit(min(max(limite, 1), 100)).execute()
    return {"pedidos": _rows(resp)}


@app.get("/api/tv/queue", tags=["tv"])
def fila_tv(limite: int = 50, u: dict = Depends(authorize(["tv", "kitchen", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    if u.get("role") == "tv":
        enforce_platform_control(rid, "tv")

    pedidos = carregar_pedidos_fila_cozinha(rid, limite)
    preparando = [p for p in pedidos if p.get("status") in {"pendente", "confirmado", "em_preparo"}]
    pronto = [p for p in pedidos if p.get("status") == "pronto"]
    entregues = carregar_pedidos_entregues_cozinha(rid, 10)

    return {
        "preparando": preparando,
        "pronto": pronto,
        "entregues": entregues,
        "counts": {
            "preparando": len(preparando),
            "pronto": len(pronto),
            "entregue": len(entregues),
        },
        "ready_visible_minutes": KITCHEN_READY_VISIBLE_MINUTES,
    }


@app.patch("/api/kitchen/orders/{pedido_id}/status", tags=["cozinha"])
def avancar_status(pedido_id: str, body: AtualizarStatusPedidoInput,
                   request: Request, u: dict = Depends(authorize(["waiter", "kitchen", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    if u.get("role") == "waiter":
        enforce_platform_control(rid, "garcom")

    # Validar que o pedido pertence ao restaurante do token
    ant = sb.table("pedidos").select("status,restaurant_id").eq("id", pedido_id).single().execute()
    if not ant.data or ant.data["restaurant_id"] != rid:
        raise HTTPException(403, "Pedido não pertence ao seu restaurante")

    status_atual = ant.data["status"]
    if u.get("role") == "waiter":
        flags = get_restaurant_feature_flags(rid)
        if not flags.get("allow_waiter_delivery"):
            raise HTTPException(403, "Entrega pelo garçom está desativada pelo restaurante")
        if status_atual != "pronto" or body.status != "entregue":
            raise HTTPException(403, "Garçom só pode marcar pedido pronto como entregue")
    if body.status not in ORDER_TRANSITIONS.get(status_atual, set()):
        raise HTTPException(409, f"Transição inválida: {status_atual} -> {body.status}")
    if body.status == "cancelado" and u.get("role") == "kitchen":
        raise HTTPException(403, "Cozinha não pode cancelar pedidos")

    extra = {"updated_at": utcnow()}
    if body.status == "pronto":     extra["tempo_pronto"]         = extra["updated_at"]
    if body.status == "entregue":   extra["tempo_entrega"]        = extra["updated_at"]
    if body.status == "cancelado":
        extra["cancelado_por"]       = u["sub"]
        extra["motivo_cancelamento"] = body.motivo_cancelamento

    sb.table("pedidos").update({"status": body.status, **extra}).eq("id", pedido_id).execute()
    resp = sb.table("pedidos").select("id,numero,status").eq("id", pedido_id).execute()
    log_acao(u, f"status_{body.status}", "pedidos", pedido_id, {"status": ant.data["status"]}, {"status": body.status}, request)
    return {"pedido": _row(resp)}


# ═════════════════════════════════════════════════════════════════
# ADMIN — MESAS
# ═════════════════════════════════════════════════════════════════

@app.get("/api/admin/tables", tags=["admin"])
def listar_mesas(u: dict = Depends(authorize(["waiter", "cashier", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    if u.get("role") == "waiter":
        enforce_platform_control(rid, "garcom")
    resp = sb.table("mesas").select(
        "id,numero,status,capacidade,qr_code_token,"
        "sessao_mesa!left(id,status,aberta_em,total_consumido,observacao)"
    ).eq("restaurant_id", rid).eq("ativa", True).order("numero").execute()
    mesas = _rows(resp)
    for m in mesas:
        sessoes = m.pop("sessao_mesa", []) or []
        abertas = [s for s in sessoes if s["status"] == "aberta"]
        abertas.sort(key=lambda s: s.get("aberta_em") or "", reverse=True)
        sessao_ativa = abertas[0] if abertas else None
        if sessao_ativa:
            ultimo = sb.table("pedidos").select("created_at").eq(
                "sessao_mesa_id", sessao_ativa["id"]
            ).eq("restaurant_id", rid).neq("status", "cancelado").order(
                "created_at", desc=True
            ).limit(1).execute()
            ultimo_pedido = _first(_rows(ultimo))
            sessao_ativa["ultima_atividade_em"] = (ultimo_pedido or {}).get("created_at") or sessao_ativa.get("aberta_em")
            pedidos_count = sb.table("pedidos").select("id", count="exact").eq(
                "sessao_mesa_id", sessao_ativa["id"]
            ).eq("restaurant_id", rid).neq("status", "cancelado").execute()
            sessao_ativa["pedidos_count"] = pedidos_count.count or 0
            if sessao_ativa["pedidos_count"] == 0:
                m["estado_operacional"] = "ocupada_sem_pedido"
            else:
                m["estado_operacional"] = "com_pedido"
        else:
            m["estado_operacional"] = "livre"
        m["sessao_ativa"] = sessao_ativa
    return {"mesas": mesas}


@app.post("/api/admin/tables", tags=["admin"])
def criar_mesa(body: CriarMesaInput, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    enforce_plan_limit(rid, "tables", active_tables_count(rid))
    token = secrets.token_urlsafe(24)
    resp = sb.table("mesas").insert({
        "restaurant_id": rid, "numero": body.numero,
        "capacidade": body.capacidade, "ativa": True, "status": "livre",
        "qr_code_token": token,
    }).select("*").execute()
    mesa = _row(resp)
    log_acao(u, "criar_mesa", "mesas", mesa["id"], None, {"numero": body.numero}, request)
    return {"mesa": mesa}


@app.patch("/api/admin/tables/{mesa_id}", tags=["admin"])
def atualizar_mesa(mesa_id: str, body: AtualizarMesaInput, request: Request,
                   u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    # Validar pertencimento
    check = sb.table("mesas").select("id").eq("id", mesa_id).eq("restaurant_id", rid).execute()
    if not check.data:
        raise HTTPException(403, "Mesa não pertence ao seu restaurante")

    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    payload["updated_at"] = utcnow()
    resp = sb.table("mesas").update(payload).eq("id", mesa_id).select("id,numero,status,capacidade").execute()
    log_acao(u, "atualizar_mesa", "mesas", mesa_id, None, payload, request)
    return {"mesa": _row(resp)}


@app.post("/api/admin/tables/{mesa_id}/occupy", tags=["admin"])
def ocupar_mesa(mesa_id: str, body: OcuparMesaInput, request: Request,
                u: dict = Depends(authorize(["waiter", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    if u.get("role") == "waiter":
        enforce_platform_control(rid, "garcom")
    mesa = sb.table("mesas").select("id,numero,status").eq("id", mesa_id).eq("restaurant_id", rid).eq("ativa", True).single().execute()
    if not mesa.data:
        raise HTTPException(404, "Mesa não encontrada")

    aberta = sb.table("sessao_mesa").select("id,status,aberta_em,total_consumido,observacao").eq(
        "mesa_id", mesa_id
    ).eq("restaurant_id", rid).eq("status", "aberta").limit(1).execute()
    aberta_data = _first(_rows(aberta))
    if aberta_data:
        return {"sessao": aberta_data, "mensagem": "Mesa já estava ocupada"}

    observacao = f"ocupacao_manual:{body.motivo}"
    if body.observacao:
        observacao += f" | {body.observacao.strip()[:240]}"

    sb.table("sessao_mesa").insert({
        "restaurant_id": rid,
        "mesa_id": mesa_id,
        "status": "aberta",
        "total_consumido": 0,
        "observacao": observacao,
    }).execute()
    resp = sb.table("sessao_mesa").select("id,status,aberta_em,total_consumido,observacao").eq(
        "mesa_id", mesa_id
    ).eq("restaurant_id", rid).eq("status", "aberta").order("aberta_em", desc=True).limit(1).execute()
    sessao = _first(_rows(resp))
    if not sessao:
        raise HTTPException(500, "Erro ao ocupar mesa")
    sb.table("mesas").update({"status": "ocupada", "updated_at": utcnow()}).eq("id", mesa_id).eq("restaurant_id", rid).execute()
    log_acao(u, "ocupar_mesa_manual", "sessao_mesa", sessao["id"], None,
             {"mesa_id": mesa_id, "mesa_numero": mesa.data.get("numero"), "motivo": body.motivo, "observacao": body.observacao}, request)
    return {"sessao": sessao, "mensagem": "Mesa ocupada"}


@app.post("/api/admin/tables/{mesa_id}/release", tags=["admin"])
def liberar_mesa_sem_consumo(mesa_id: str, body: LiberarMesaInput, request: Request,
                             u: dict = Depends(authorize(["waiter", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    if u.get("role") == "waiter":
        enforce_platform_control(rid, "garcom")
    mesa = sb.table("mesas").select("id,numero").eq("id", mesa_id).eq("restaurant_id", rid).eq("ativa", True).single().execute()
    if not mesa.data:
        raise HTTPException(404, "Mesa não encontrada")

    sess = sb.table("sessao_mesa").select("id,total_consumido,observacao").eq(
        "mesa_id", mesa_id
    ).eq("restaurant_id", rid).eq("status", "aberta").limit(1).execute()
    sessao = _first(_rows(sess))
    if not sessao:
        sb.table("mesas").update({"status": "livre", "updated_at": utcnow()}).eq("id", mesa_id).eq("restaurant_id", rid).execute()
        return {"mensagem": "Mesa liberada"}

    pedidos = sb.table("pedidos").select("id", count="exact").eq(
        "sessao_mesa_id", sessao["id"]
    ).eq("restaurant_id", rid).neq("status", "cancelado").execute()
    if (pedidos.count or 0) > 0 or float(sessao.get("total_consumido") or 0) > 0:
        raise HTTPException(409, "Esta mesa tem consumo. Feche a conta pelo caixa/admin.")

    observacao = (sessao.get("observacao") or "").strip()
    fechamento = f"liberada_sem_consumo:{body.motivo}"
    if body.observacao:
        fechamento += f" | {body.observacao.strip()[:240]}"
    observacao = f"{observacao} || {fechamento}" if observacao else fechamento

    sb.table("sessao_mesa").update({
        "status": "fechada",
        "fechada_em": utcnow(),
        "updated_at": utcnow(),
        "observacao": observacao,
    }).eq("id", sessao["id"]).eq("restaurant_id", rid).execute()
    sb.table("mesas").update({"status": "livre", "updated_at": utcnow()}).eq("id", mesa_id).eq("restaurant_id", rid).execute()
    log_acao(u, "liberar_mesa_sem_consumo", "sessao_mesa", sessao["id"], None,
             {"mesa_id": mesa_id, "mesa_numero": mesa.data.get("numero"), "motivo": body.motivo, "observacao": body.observacao}, request)
    return {"mensagem": "Mesa liberada sem consumo"}


@app.post("/api/admin/tables/{mesa_id}/close", tags=["admin"])
def fechar_conta_mesa(mesa_id: str, body: FecharContaInput, request: Request,
                      u: dict = Depends(authorize(["waiter", "cashier", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    if u.get("role") == "waiter":
        enforce_platform_control(rid, "garcom")
        if not get_restaurant_feature_flags(rid).get("allow_waiter_payment"):
            raise HTTPException(403, "Pagamento pelo garçom não está liberado neste restaurante")
    enforce_platform_control(rid, "financeiro")

    mesa = buscar_mesa_do_restaurante(rid, mesa_id, "id,numero")
    sessao = buscar_sessao_aberta_mesa(rid, mesa_id, "id,total_consumido")
    if count_pedidos_abertos_sessao(rid, sessao["id"]):
        raise HTTPException(409, "Não é possível fechar: ainda existem pedidos em aberto")

    _, resumo_pagamento = _normalizar_pagamentos(body, sessao["total_consumido"])
    if u.get("role") == "cashier" and not body.cash_shift_id:
        raise HTTPException(409, "Abra um turno de caixa antes de fechar contas")
    if body.cash_shift_id:
        turno = turno_aberto_por_id(rid, body.cash_shift_id)
        if not turno:
            raise HTTPException(409, "Turno de caixa não está aberto")
        if u.get("role") == "cashier" and turno.get("opened_by") != u["sub"]:
            raise HTTPException(403, "Este turno pertence a outro caixa")
    pedidos_fechamento = listar_pedidos_fechamento(rid, sessao["id"])

    sb.rpc("fechar_sessao_mesa", {"p_sessao_id": sessao["id"], "p_restaurant_id": rid}).execute()
    sb.table("mesas").update({"status": "livre", "updated_at": utcnow()}).eq("id", mesa_id).eq("restaurant_id", rid).execute()
    for pedido in pedidos_fechamento:
        sb.table("pedidos").update({
            "forma_pagamento": _forma_pagamento_pedido(resumo_pagamento, pedido.get("total")),
            "status_pagamento": "aprovado",
            "updated_at": utcnow(),
        }).eq("id", pedido["id"]).eq("restaurant_id", rid).execute()
    try:
        estoque_baixa = baixar_estoque_por_pedidos(rid, pedidos_fechamento, u, request)
    except Exception as exc:
        estoque_baixa = {"movements": 0, "error": str(exc)[:240]}
        logger.warning("estoque_baixa_falhou restaurant_id=%s erro=%s", rid, exc)

    log_acao(u, "fechar_conta_mesa", "sessao_mesa", sessao["id"], None,
             {"pagamento": resumo_pagamento, "total": sessao["total_consumido"], "estoque_baixa": estoque_baixa}, request)
    turno_atualizado = None
    if body.cash_shift_id:
        turno_atualizado = atualizar_turno_com_fechamento(rid, body.cash_shift_id, {
            "id": str(uuid4()),
            "sessao_id": sessao["id"],
            "mesa_id": mesa_id,
            "mesa_numero": mesa.get("numero"),
            "total": resumo_pagamento["total"],
            "pagamentos": resumo_pagamento["pagamentos"],
            "payments_by_method": resumo_pagamento["por_forma"],
            "closed_by": u["sub"],
            "closed_by_name": u.get("nome") or "",
            "closed_at": utcnow(),
        })
    fiscal_doc = None
    fiscal_config = get_fiscal_config(rid)
    if fiscal_config.get("enabled") and fiscal_config.get("auto_after_close"):
        status_doc = "pendente" if fiscal_config.get("mode") == "api" else "pendente"
        fiscal_doc = registrar_fiscal_documento(
            rid,
            sessao["id"],
            sessao["total_consumido"],
            origem="fechamento_conta",
            status_doc=status_doc,
            extra={"forma_pagamento": resumo_pagamento.get("por_forma")},
        )
        log_acao(u, "fiscal_documento_pendente", "configuracoes", sessao["id"], None, fiscal_doc, request)
    return {
        "mensagem": "Mesa fechada",
        "total": sessao["total_consumido"],
        "forma_pagamento": _forma_pagamento_pedido(resumo_pagamento, sessao["total_consumido"]),
        "pagamentos": resumo_pagamento["pagamentos"],
        "cash_shift": turno_atualizado,
        "fiscal_document": fiscal_doc,
    }


# ═════════════════════════════════════════════════════════════════
# ADMIN — PEDIDOS
# ═════════════════════════════════════════════════════════════════

@app.get("/api/admin/orders", tags=["admin"])
def listar_pedidos(status_filtro: Optional[str] = None, limite: int = 50,
                   u: dict = Depends(authorize(["cashier", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    q = sb.table("pedidos").select(
        "id,numero,status,total,subtotal,desconto,created_at,updated_at,tempo_entrega,forma_pagamento,status_pagamento,"
        "mesas(numero),pedido_itens(nome_produto,quantidade,subtotal)"
    ).eq("restaurant_id", rid).order("created_at", desc=True).limit(min(limite, 200))
    if status_filtro:
        q = q.eq("status", status_filtro)
    return {"pedidos": _rows(q.execute())}


@app.get("/api/admin/service-requests", tags=["atendimento"])
def listar_chamados(limite: int = 50, u: dict = Depends(authorize(["waiter", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    rows = _rows(
        sb.table("audit_log")
        .select("id,acao,valor_novo,created_at")
        .eq("restaurant_id", rid)
        .in_("acao", ["mesa_garcom", "mesa_conta", "mesa_problema"])
        .order("created_at", desc=True)
        .limit(min(limite, 100))
        .execute()
    )
    chamados = []
    for r in rows:
        dados = r.get("valor_novo") or {}
        chamados.append({
            "id": r.get("id"),
            "acao": r.get("acao"),
            "created_at": r.get("created_at"),
            "tipo": dados.get("tipo"),
            "mesa_numero": dados.get("mesa_numero"),
            "mensagem": dados.get("mensagem"),
            "status": dados.get("status", "aberto"),
        })
    return {"chamados": chamados}


@app.patch("/api/admin/service-requests/{chamado_id}", tags=["atendimento"])
def atualizar_chamado(chamado_id: str, body: dict, request: Request,
                      u: dict = Depends(authorize(["waiter", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    status_chamado = body.get("status", "atendido")
    if status_chamado not in {"aberto", "atendido"}:
        raise HTTPException(400, "Status inválido")
    atual = sb.table("audit_log").select("id,valor_novo").eq("id", chamado_id).eq("restaurant_id", rid).single().execute()
    if not atual.data:
        raise HTTPException(404, "Chamado não encontrado")
    dados = atual.data.get("valor_novo") or {}
    dados["status"] = status_chamado
    dados["atendido_em"] = utcnow() if status_chamado == "atendido" else None
    dados["atendido_por"] = u.get("nome")
    sb.table("audit_log").update({"valor_novo": dados}).eq("id", chamado_id).eq("restaurant_id", rid).execute()
    log_acao(u, "atualizar_chamado", "audit_log", chamado_id, None, {"status": status_chamado}, request)
    return {"mensagem": "Chamado atualizado", "chamado": dados}


@app.patch("/api/admin/orders/{pedido_id}/cancel", tags=["admin"])
def cancelar_pedido(pedido_id: str, body: AtualizarStatusPedidoInput,
                    request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    ant = sb.table("pedidos").select("status,total,restaurant_id").eq("id", pedido_id).single().execute()
    if not ant.data or ant.data["restaurant_id"] != rid:
        raise HTTPException(403, "Pedido não pertence ao seu restaurante")
    if ant.data["status"] in {"entregue", "cancelado"}:
        raise HTTPException(409, f"Pedido {ant.data['status']} não pode ser cancelado")

    resp = sb.table("pedidos").update({
        "status": "cancelado", "cancelado_por": u["sub"],
        "motivo_cancelamento": body.motivo_cancelamento,
        "updated_at": utcnow(),
    }).eq("id", pedido_id).select("id,numero,status").execute()
    log_acao(u, "cancelar_pedido", "pedidos", pedido_id,
             {"status": ant.data["status"]}, {"status": "cancelado", "motivo": body.motivo_cancelamento}, request)
    return {"pedido": _row(resp)}


# ═════════════════════════════════════════════════════════════════
# ADMIN — CARDÁPIO
# ═════════════════════════════════════════════════════════════════

@app.get("/api/admin/categories", tags=["cardápio"])
def listar_categorias(u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    return {"categorias": _rows(sb.table("categorias").select("*").eq("restaurant_id", rid).order("ordem").execute())}


@app.post("/api/admin/categories", tags=["cardápio"])
def criar_categoria(body: dict, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    nome = (body.get("nome") or "").strip()
    if not nome:
        raise HTTPException(400, "Nome da categoria obrigatório")
    body["nome"] = nome
    body["icone"] = (body.get("icone") or "•")[:8]
    body["ordem"] = int(body.get("ordem") or 99)
    body["restaurant_id"] = rid
    resp = sb.table("categorias").insert(body).execute()
    categoria = _first(_rows(resp)) or _first(_rows(sb.table("categorias").select("*").eq("restaurant_id", rid).eq("nome", nome).limit(1).execute()))
    log_acao(u, "criar_categoria", "categorias", categoria.get("id") if categoria else None, None, body, request)
    return {"categoria": categoria}


@app.patch("/api/admin/categories/{categoria_id}", tags=["cardápio"])
def atualizar_categoria(categoria_id: str, body: dict, request: Request,
                        u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    ant = sb.table("categorias").select("*").eq("id", categoria_id).eq("restaurant_id", rid).single().execute()
    if not ant.data:
        raise HTTPException(404, "Categoria não encontrada")
    payload = {}
    if "nome" in body:
        nome = (body.get("nome") or "").strip()
        if not nome:
            raise HTTPException(400, "Nome da categoria obrigatório")
        payload["nome"] = nome
    if "icone" in body:
        payload["icone"] = (body.get("icone") or "•")[:8]
    if "ordem" in body:
        payload["ordem"] = int(body.get("ordem") or 99)
    if not payload:
        raise HTTPException(400, "Nada para atualizar")
    sb.table("categorias").update(payload).eq("id", categoria_id).execute()
    resp = sb.table("categorias").select("*").eq("id", categoria_id).eq("restaurant_id", rid).single().execute()
    log_acao(u, "atualizar_categoria", "categorias", categoria_id, ant.data, payload, request)
    return {"categoria": _row(resp)}


@app.delete("/api/admin/categories/{categoria_id}", tags=["cardápio"])
def deletar_categoria(categoria_id: str, request: Request,
                      u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    cat = sb.table("categorias").select("*").eq("id", categoria_id).eq("restaurant_id", rid).single().execute()
    if not cat.data:
        raise HTTPException(404, "Categoria não encontrada")
    produtos = sb.table("produtos").select("id", count="exact").eq("restaurant_id", rid).eq("categoria_id", categoria_id).execute()
    if produtos.count:
        raise HTTPException(409, "Mova ou exclua os produtos desta categoria antes de remover")
    sb.table("categorias").delete().eq("id", categoria_id).eq("restaurant_id", rid).execute()
    log_acao(u, "deletar_categoria", "categorias", categoria_id, cat.data, None, request)
    return {"mensagem": "Categoria removida"}


@app.get("/api/admin/products", tags=["cardápio"])
def listar_produtos(disponivel: Optional[bool] = None, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    q = sb.table("produtos").select("*,categorias(nome,icone)").eq("restaurant_id", rid).order("nome")
    if disponivel is not None:
        q = q.eq("disponivel", disponivel)
    return {"produtos": _rows(q.execute())}


@app.post("/api/admin/products", tags=["cardápio"])
def criar_produto(body: CriarProdutoInput, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    enforce_plan_limit(rid, "products", products_count(rid))
    payload = body.model_dump()
    payload["restaurant_id"] = rid
    payload["categoria_id"]  = str(payload["categoria_id"])

    # Validar categoria pertence ao restaurante
    cat = sb.table("categorias").select("id").eq("id", payload["categoria_id"]).eq("restaurant_id", rid).execute()
    if not cat.data:
        raise HTTPException(403, "Categoria não pertence ao seu restaurante")

    resp = sb.table("produtos").insert(payload).select("*").execute()
    prod = _row(resp)
    log_acao(u, "criar_produto", "produtos", prod["id"], None, {"nome": prod["nome"]}, request)
    return {"produto": prod}


@app.patch("/api/admin/products/{produto_id}", tags=["cardápio"])
def atualizar_produto(produto_id: str, body: dict, request: Request,
                      u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    ant = sb.table("produtos").select("nome,preco,restaurant_id").eq("id", produto_id).single().execute()
    if not ant.data or ant.data["restaurant_id"] != rid:
        raise HTTPException(403, "Produto não pertence ao seu restaurante")

    body.pop("restaurant_id", None)  # nunca deixa o frontend mudar o restaurant_id
    body["updated_at"] = utcnow()
    resp = sb.table("produtos").update(body).eq("id", produto_id).select("id,nome,preco,disponivel").execute()
    log_acao(u, "atualizar_produto", "produtos", produto_id, ant.data, body, request)
    return {"produto": _row(resp)}


@app.get("/api/admin/inventory/items", tags=["estoque"])
def listar_inventory_items(include_inactive: bool = False, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    q = sb.table("inventory_items").select("*").eq("restaurant_id", rid).order("nome")
    if not include_inactive:
        q = q.eq("ativo", True)
    items = _rows(q.execute())
    for item in items:
        item["status_estoque"] = _inventory_item_status(item)
    return {"items": items}


@app.post("/api/admin/inventory/items", tags=["estoque"])
def criar_inventory_item(body: InventoryItemInput, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    payload = body.model_dump()
    payload["restaurant_id"] = rid
    payload["created_at"] = utcnow()
    payload["updated_at"] = utcnow()
    item = _first(_rows(sb.table("inventory_items").insert(payload).select("*").execute())) or payload
    log_acao(u, "criar_insumo", "inventory_items", item.get("id"), None, payload, request)
    return {"item": item}


@app.patch("/api/admin/inventory/items/{item_id}", tags=["estoque"])
def atualizar_inventory_item(item_id: str, body: InventoryItemPatch, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    ant = _inventory_item_or_404(rid, item_id)
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(400, "Nada para atualizar")
    if "nome" in payload:
        payload["nome"] = payload["nome"].strip()
    payload["updated_at"] = utcnow()
    item = _first(_rows(sb.table("inventory_items").update(payload).eq("id", item_id).eq("restaurant_id", rid).select("*").execute())) or {**ant, **payload}
    log_acao(u, "atualizar_insumo", "inventory_items", item_id, ant, payload, request)
    return {"item": item}


@app.post("/api/admin/inventory/items/{item_id}/deactivate", tags=["estoque"])
def desativar_inventory_item(item_id: str, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    ant = _inventory_item_or_404(rid, item_id)
    sb.table("inventory_items").update({"ativo": False, "updated_at": utcnow()}).eq("id", item_id).eq("restaurant_id", rid).execute()
    log_acao(u, "desativar_insumo", "inventory_items", item_id, ant, {"ativo": False}, request)
    return {"mensagem": "Insumo desativado"}


@app.get("/api/admin/inventory/movements", tags=["estoque"])
def listar_inventory_movements(item_id: Optional[str] = None, limite: int = 100, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    q = sb.table("inventory_movements").select("*,inventory_items(nome,unidade)").eq("restaurant_id", rid).order("created_at", desc=True).limit(min(max(limite, 1), 500))
    if item_id:
        q = q.eq("inventory_item_id", item_id)
    return {"movements": _rows(q.execute())}


@app.post("/api/admin/inventory/movements", tags=["estoque"])
def criar_inventory_movement(body: InventoryMovementInput, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    mov = registrar_movimento_estoque(rid, body, u, request)
    item = _inventory_item_or_404(rid, body.inventory_item_id)
    item["status_estoque"] = _inventory_item_status(item)
    return {"movement": mov, "item": item}


@app.get("/api/admin/inventory/alerts", tags=["estoque"])
def listar_inventory_alerts(u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    items = _rows(sb.table("inventory_items").select("*").eq("restaurant_id", rid).eq("ativo", True).order("nome").execute())
    alerts = [{**item, "status_estoque": _inventory_item_status(item)} for item in items if _inventory_item_status(item) != "ok"]
    return {"alerts": alerts}


@app.get("/api/admin/inventory/reports/summary", tags=["estoque"])
def inventory_summary(u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    items = _rows(sb.table("inventory_items").select("*").eq("restaurant_id", rid).execute())
    active = [i for i in items if i.get("ativo") is not False]
    total_value = _money(sum(_money(i.get("estoque_atual")) * _money(i.get("custo_unitario")) for i in active))
    low = [i for i in active if _inventory_item_status(i) == "baixo"]
    zero = [i for i in active if _inventory_item_status(i) == "zerado"]
    movements = _rows(sb.table("inventory_movements").select("movement_type,quantity,unit_cost,created_at").eq("restaurant_id", rid).order("created_at", desc=True).limit(200).execute())
    by_type = {}
    for mov in movements:
        tipo = mov.get("movement_type") or "outro"
        by_type[tipo] = _money(by_type.get(tipo, 0) + _money(mov.get("quantity")))
    return {
        "summary": {
            "items_total": len(items),
            "items_active": len(active),
            "low_stock": len(low),
            "zero_stock": len(zero),
            "inventory_value": total_value,
            "movements_by_type": by_type,
        },
        "low_stock_items": low,
        "zero_stock_items": zero,
        "recent_movements": movements[:30],
    }


@app.get("/api/admin/products/{produto_id}/recipe", tags=["estoque"])
def obter_product_recipe(produto_id: str, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    produto = _product_or_404(rid, produto_id)
    recipe_rows = _rows(sb.table("product_recipes").select("*").eq("restaurant_id", rid).eq("product_id", produto_id).order("created_at").execute())
    calc = calcular_custo_receita(rid, recipe_rows)
    preco = _money(produto.get("preco"))
    margem = _money(preco - calc["cost"])
    margem_percent = round((margem / preco) * 100, 2) if preco > 0 else 0
    return {"product": produto, "recipe": calc["items"], "cost": calc["cost"], "margin": margem, "margin_percent": margem_percent}


@app.put("/api/admin/products/{produto_id}/recipe", tags=["estoque"])
def salvar_product_recipe(produto_id: str, body: ProductRecipeInput, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    produto = _product_or_404(rid, produto_id)
    rows = []
    for item in body.items:
        inventory_item_id = str(item.get("inventory_item_id") or "")
        quantity = _money(item.get("quantity"))
        if not inventory_item_id or quantity <= 0:
            raise HTTPException(400, "Ficha tÃ©cnica precisa de insumo e quantidade maior que zero")
        inv = _inventory_item_or_404(rid, inventory_item_id)
        rows.append({
            "restaurant_id": rid,
            "product_id": produto_id,
            "inventory_item_id": inventory_item_id,
            "quantity": quantity,
            "unit": inv.get("unidade"),
            "notes": item.get("notes") or "",
            "updated_at": utcnow(),
        })
    ant = _rows(sb.table("product_recipes").select("*").eq("restaurant_id", rid).eq("product_id", produto_id).execute())
    sb.table("product_recipes").delete().eq("restaurant_id", rid).eq("product_id", produto_id).execute()
    if rows:
        sb.table("product_recipes").insert(rows).execute()
    recipe_rows = _rows(sb.table("product_recipes").select("*").eq("restaurant_id", rid).eq("product_id", produto_id).execute())
    calc = calcular_custo_receita(rid, recipe_rows)
    sb.table("produtos").update({"custo": calc["cost"], "updated_at": utcnow()}).eq("id", produto_id).eq("restaurant_id", rid).execute()
    log_acao(u, "salvar_ficha_tecnica", "product_recipes", produto_id, ant, {"items": rows, "cost": calc["cost"]}, request)
    return {"product": produto, "recipe": calc["items"], "cost": calc["cost"]}


@app.get("/api/admin/delivery/drivers", tags=["delivery"])
def listar_delivery_drivers(include_inactive: bool = False, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    q = sb.table("delivery_drivers").select("*").eq("restaurant_id", rid).order("nome")
    if not include_inactive:
        q = q.eq("ativo", True)
    return {"drivers": _rows(q.execute())}


@app.post("/api/admin/delivery/drivers", tags=["delivery"])
def criar_delivery_driver(body: DeliveryDriverInput, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    payload = body.model_dump()
    payload["restaurant_id"] = rid
    payload["created_at"] = utcnow()
    payload["updated_at"] = utcnow()
    driver = _first(_rows(sb.table("delivery_drivers").insert(payload).select("*").execute())) or payload
    log_acao(u, "criar_entregador", "delivery_drivers", driver.get("id"), None, payload, request)
    return {"driver": driver}


@app.patch("/api/admin/delivery/drivers/{driver_id}", tags=["delivery"])
def atualizar_delivery_driver(driver_id: str, body: dict, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    ant = _first(_rows(sb.table("delivery_drivers").select("*").eq("id", driver_id).eq("restaurant_id", rid).limit(1).execute()))
    if not ant:
        raise HTTPException(404, "Entregador nÃ£o encontrado")
    body.pop("restaurant_id", None)
    body["updated_at"] = utcnow()
    driver = _first(_rows(sb.table("delivery_drivers").update(body).eq("id", driver_id).eq("restaurant_id", rid).select("*").execute())) or {**ant, **body}
    log_acao(u, "atualizar_entregador", "delivery_drivers", driver_id, ant, body, request)
    return {"driver": driver}


@app.get("/api/admin/delivery/orders", tags=["delivery"])
def listar_delivery_orders(status_filtro: Optional[str] = None, limite: int = 100, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    q = sb.table("delivery_orders").select("*,delivery_drivers(nome,telefone)").eq("restaurant_id", rid).order("created_at", desc=True).limit(min(max(limite, 1), 300))
    if status_filtro:
        q = q.eq("status", status_filtro)
    return {"orders": _rows(q.execute())}


@app.post("/api/admin/delivery/orders", tags=["delivery"])
def criar_delivery_order(body: DeliveryOrderInput, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "orders")
    payload = body.model_dump()
    payload["restaurant_id"] = rid
    payload["order_type"] = "delivery"
    payload["created_by"] = u.get("sub")
    payload["created_by_name"] = u.get("nome") or ""
    payload["created_at"] = utcnow()
    payload["updated_at"] = utcnow()
    order = _first(_rows(sb.table("delivery_orders").insert(payload).select("*").execute())) or payload
    log_acao(u, "criar_pedido_delivery", "delivery_orders", order.get("id"), None, payload, request)
    return {"order": order}


@app.patch("/api/admin/delivery/orders/{order_id}", tags=["delivery"])
def atualizar_delivery_order(order_id: str, body: dict, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "orders")
    ant = _first(_rows(sb.table("delivery_orders").select("*").eq("id", order_id).eq("restaurant_id", rid).limit(1).execute()))
    if not ant:
        raise HTTPException(404, "Pedido delivery nÃ£o encontrado")
    body.pop("restaurant_id", None)
    if "status" in body and body["status"] not in DELIVERY_STATUSES:
        raise HTTPException(400, "Status invÃ¡lido")
    body["updated_at"] = utcnow()
    if body.get("status") == "entregue":
        body["delivered_at"] = utcnow()
    order = _first(_rows(sb.table("delivery_orders").update(body).eq("id", order_id).eq("restaurant_id", rid).select("*").execute())) or {**ant, **body}
    log_acao(u, "atualizar_pedido_delivery", "delivery_orders", order_id, ant, body, request)
    return {"order": order}


@app.patch("/api/admin/delivery/orders/{order_id}/status", tags=["delivery"])
def atualizar_delivery_order_status(order_id: str, body: DeliveryStatusInput, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    payload = {"status": body.status}
    if body.status == "saiu_para_entrega":
        payload["dispatched_at"] = utcnow()
    if body.status == "entregue":
        payload["delivered_at"] = utcnow()
    return atualizar_delivery_order(order_id, payload, request, u)


@app.post("/api/admin/delivery/orders/{order_id}/assign-driver", tags=["delivery"])
def atribuir_delivery_driver(order_id: str, body: dict, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    driver_id = body.get("driver_id")
    driver = _first(_rows(sb.table("delivery_drivers").select("id").eq("id", driver_id).eq("restaurant_id", rid).eq("ativo", True).limit(1).execute()))
    if not driver:
        raise HTTPException(404, "Entregador nÃ£o encontrado")
    return atualizar_delivery_order(order_id, {"driver_id": driver_id}, request, u)


@app.get("/api/admin/delivery/reports", tags=["delivery"])
def delivery_reports(u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    orders = _rows(sb.table("delivery_orders").select("*,delivery_drivers(nome)").eq("restaurant_id", rid).order("created_at", desc=True).limit(500).execute())
    delivered = [o for o in orders if o.get("status") == "entregue"]
    by_driver = {}
    delivery_fee_total = 0.0
    total_minutes = []
    for order in orders:
        delivery_fee_total = _money(delivery_fee_total + _money(order.get("delivery_fee")))
        driver_name = (order.get("delivery_drivers") or {}).get("nome") or "Sem entregador"
        if order.get("status") == "entregue":
            by_driver.setdefault(driver_name, {"orders": 0, "delivery_fees": 0.0})
            by_driver[driver_name]["orders"] += 1
            by_driver[driver_name]["delivery_fees"] = _money(by_driver[driver_name]["delivery_fees"] + _money(order.get("delivery_fee")))
            if order.get("created_at") and order.get("delivered_at"):
                try:
                    total_minutes.append((datetime.fromisoformat(str(order["delivered_at"]).replace("Z", "+00:00")) - datetime.fromisoformat(str(order["created_at"]).replace("Z", "+00:00"))).total_seconds() / 60)
                except ValueError:
                    pass
    avg_minutes = round(sum(total_minutes) / len(total_minutes), 1) if total_minutes else 0
    return {
        "summary": {
            "orders_total": len(orders),
            "orders_delivered": len(delivered),
            "delivery_fee_total": _money(delivery_fee_total),
            "avg_delivery_minutes": avg_minutes,
        },
        "by_driver": by_driver,
        "recent_orders": orders[:50],
    }


# ═════════════════════════════════════════════════════════════════
# ADMIN — USUÁRIOS DO RESTAURANTE
# ═════════════════════════════════════════════════════════════════

@app.get("/api/admin/users", tags=["usuários"])
def listar_usuarios(u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    rest = sb.table("restaurants").select("slug").eq("id", rid).single().execute()
    slug = (rest.data or {}).get("slug")
    resp = sb.table("restaurant_memberships").select(
        "id, role, is_active, created_at,"
        "usuarios(id, nome, email, ativo, ultimo_acesso, perfil)"
    ).eq("restaurant_id", rid).eq("is_active", True).order("created_at", desc=True).execute()
    usuarios = [
        m for m in _rows(resp)
        if m.get("usuarios") and (m.get("usuarios") or {}).get("ativo") is not False
    ]
    return {"usuarios": enrich_membership_logins(usuarios, slug)}


@app.post("/api/admin/users", tags=["usuários"])
def criar_usuario(body: CriarUsuarioInput, request: Request,
                  u: dict = Depends(authorize(["owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "users")
    validar_role_no_plano(rid, body.role)
    enforce_cashier_user_limit(rid, body.role)
    rest = sb.table("restaurants").select("slug").eq("id", rid).single().execute()
    slug = (rest.data or {}).get("slug")
    login_id = user_identifier_from_body(body, slug)

    # Verificar email duplicado
    existe = sb.table("usuarios").select("id,ativo").eq("email", login_id).execute()
    if existe.data:
        # Usuário já existe — apenas adicionar membership
        uid = existe.data[0]["id"]
        if existe.data[0].get("ativo") is False:
            sb.table("usuarios").update({
                "nome": body.nome,
                "senha_hash": hash_senha(body.senha),
                "ativo": True,
            }).eq("id", uid).execute()
        membership = _first(_rows(sb.table("restaurant_memberships").select("id,is_active").eq("restaurant_id", rid).eq("usuario_id", uid).limit(1).execute()))
        if not membership or membership.get("is_active") is False:
            enforce_plan_limit(rid, "users", active_memberships_count(rid))
    else:
        enforce_plan_limit(rid, "users", active_memberships_count(rid))
        uid = insert_user({
            "nome": body.nome, "email": login_id,
            "senha_hash": hash_senha(body.senha),
            "perfil": "funcionario", "ativo": True,
        }, login_id)

    # Criar ou atualizar membership
    sb.table("restaurant_memberships").upsert({
        "restaurant_id": rid, "usuario_id": uid, "role": body.role, "is_active": True,
    }, on_conflict="restaurant_id,usuario_id").execute()

    log_acao(u, "criar_usuario", "usuarios", uid, None, {"login": display_login_identifier(login_id, slug), "role": body.role}, request)
    return {"mensagem": "Usuário criado e vinculado ao restaurante", "usuario_id": uid}


@app.patch("/api/admin/users/{usuario_id}/password", tags=["usuários"])
def redefinir_senha_usuario(usuario_id: str, body: ResetSenhaInput, request: Request,
                            u: dict = Depends(authorize(["owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "users")
    membership = _first(_rows(sb.table("restaurant_memberships").select("id,is_active").eq("usuario_id", usuario_id).eq("restaurant_id", rid).limit(1).execute()))
    if not membership or membership.get("is_active") is False:
        raise HTTPException(404, "Usuário não encontrado neste restaurante")
    sb.table("usuarios").update({"senha_hash": hash_senha(body.senha), "ativo": True}).eq("id", usuario_id).execute()
    log_acao(u, "redefinir_senha_usuario", "usuarios", usuario_id, None, {"alterada": True}, request)
    return {"mensagem": "Senha atualizada"}


@app.patch("/api/admin/users/{usuario_id}/role", tags=["usuários"])
def alterar_role(usuario_id: str, body: dict, request: Request,
                 u: dict = Depends(authorize(["owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "users")
    nova_role = body.get("role")
    if nova_role not in ROLE_LEVEL:
        raise HTTPException(400, f"Role inválida: {list(ROLE_LEVEL.keys())}")
    validar_role_no_plano(rid, nova_role)

    # Validar que o usuário pertence ao restaurante
    m = sb.table("restaurant_memberships").select("role").eq("usuario_id", usuario_id).eq("restaurant_id", rid).eq("is_active", True).single().execute()
    if not m.data:
        raise HTTPException(404, "Usuário não encontrado neste restaurante")
    if m.data["role"] != "cashier":
        enforce_cashier_user_limit(rid, nova_role)

    sb.table("restaurant_memberships").update({"role": nova_role, "updated_at": utcnow()}).eq("usuario_id", usuario_id).eq("restaurant_id", rid).execute()
    log_acao(u, "alterar_role_usuario", "restaurant_memberships", usuario_id,
             {"role": m.data["role"]}, {"role": nova_role}, request)
    return {"mensagem": "Role atualizada"}


@app.delete("/api/admin/users/{usuario_id}", tags=["usuários"])
def remover_usuario(usuario_id: str, request: Request,
                    u: dict = Depends(authorize(["owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "users")
    if usuario_id == u["sub"]:
        raise HTTPException(400, "Não pode remover sua própria conta")

    membership = _first(_rows(sb.table("restaurant_memberships").select(
        "id,role,is_active,usuarios(id,email)"
    ).eq("usuario_id", usuario_id).eq("restaurant_id", rid).limit(1).execute()))
    if not membership or membership.get("is_active") is False:
        raise HTTPException(404, "Usuário não encontrado neste restaurante")

    sb.table("restaurant_memberships").update({"is_active": False, "updated_at": utcnow()}).eq("id", membership["id"]).execute()
    desativar_usuarios_orfaos([usuario_id])
    log_acao(u, "remover_usuario", "restaurant_memberships", usuario_id, None, {"is_active": False}, request)
    return {"mensagem": "Usuário removido do restaurante"}


# ═════════════════════════════════════════════════════════════════
# ADMIN — CONFIGURAÇÕES DO RESTAURANTE
# ═════════════════════════════════════════════════════════════════

@app.get("/api/admin/restaurant", tags=["restaurante"])
def get_meu_restaurante(u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    resp = sb.table("restaurants").select("*,restaurant_settings(*)").eq("id", rid).single().execute()
    restaurant = _row(resp)
    flags = get_restaurant_feature_flags(rid)
    settings = restaurant.get("restaurant_settings")
    if isinstance(settings, list):
        normalized_settings = settings[0] if settings else {}
    elif isinstance(settings, dict):
        normalized_settings = settings
    else:
        normalized_settings = {}
    normalized_settings.update(flags)
    restaurant["restaurant_settings"] = [normalized_settings]
    return {"restaurant": restaurant}


@app.put("/api/admin/restaurant", tags=["restaurante"])
def atualizar_restaurante(body: AtualizarRestauranteInput, request: Request,
                          u: dict = Depends(authorize(["owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    payload["updated_at"] = utcnow()
    sb.table("restaurants").update(payload).eq("id", rid).execute()
    resp = sb.table("restaurants").select("*").eq("id", rid).execute()
    log_acao(u, "atualizar_restaurante", "restaurants", rid, None, payload, request)
    return {"restaurant": _row(resp)}


@app.put("/api/admin/restaurant/settings", tags=["restaurante"])
def atualizar_settings(body: AtualizarSettingsInput, request: Request,
                       u: dict = Depends(authorize(["owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    control = get_platform_control(rid)
    flags_payload = {}
    for flag_key in ("allow_waiter_payment", "allow_waiter_delivery"):
        if flag_key in payload:
            flags_payload[flag_key] = bool(payload.pop(flag_key))
    garcom_flags = flags_payload.get("allow_waiter_payment") is True or flags_payload.get("allow_waiter_delivery") is True
    if (payload.get("allow_waiter_call") is True or payload.get("allow_table_close_request") is True or garcom_flags) and (control.get("modules") or {}).get("garcom") is False:
        raise HTTPException(403, "Recursos de garçom estão disponíveis no plano Pro ou Premium")
    if payload:
        payload["updated_at"] = utcnow()
        sb.table("restaurant_settings").update(payload).eq("restaurant_id", rid).execute()
    if flags_payload:
        flags = get_restaurant_feature_flags(rid)
        flags.update(flags_payload)
        save_restaurant_feature_flags(rid, flags)
    resp = sb.table("restaurant_settings").select("*").eq("restaurant_id", rid).execute()
    settings = _row(resp) or {}
    settings.update(get_restaurant_feature_flags(rid))
    log_acao(u, "atualizar_settings", "restaurant_settings", rid, None, {**payload, **flags_payload}, request)
    return {"settings": settings}


@app.post("/api/admin/support-request", tags=["restaurante"])
def abrir_suporte_restaurante(body: dict, request: Request,
                              u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    control = get_platform_control(rid)
    mensagem = str(body.get("mensagem") or "").strip()
    prioridade = str(body.get("prioridade") or "normal").strip()
    categoria = str(body.get("categoria") or "suporte").strip().lower()
    assunto = str(body.get("assunto") or "").strip()
    if prioridade not in {"normal", "alta", "urgente"}:
        prioridade = "normal"
    if categoria not in {"suporte", "financeiro", "operacao", "acesso", "bug", "melhoria"}:
        categoria = "suporte"
    if not mensagem or len(mensagem) > 2000:
        raise HTTPException(400, "Descreva o suporte em até 2000 caracteres")
    ticket = _row(sb.table("platform_support_tickets").insert({
        "restaurant_id": rid,
        "category": categoria,
        "priority": prioridade,
        "status": "aberto",
        "subject": assunto[:140] or None,
        "message": mensagem,
        "customer_name": u.get("nome"),
        "customer_email": u.get("email") or u.get("login"),
        "created_by": u.get("sub"),
    }).execute())
    registro = f"[{utcnow()}] {ticket.get('ticket_number') or ticket.get('id')} - {u.get('nome') or u.get('email')}: {mensagem}"
    control["support_status"] = "aberto"
    control["support_priority"] = prioridade
    control["support_notes"] = (registro + ("\n\n" + (control.get("support_notes") or "") if control.get("support_notes") else ""))[:6000]
    save_platform_control(rid, control)
    log_acao(u, "abrir_suporte", "platform_support_tickets", rid, ticket.get("id"), {"prioridade": prioridade, "categoria": categoria}, request)
    return {"mensagem": "Solicitação de suporte enviada", "support_status": control["support_status"], "ticket": support_ticket_public(ticket)}


@app.get("/api/admin/support", tags=["restaurante"])
def suporte_restaurante(u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    return {"tickets": listar_support_tickets(rid, 50), "control": get_platform_control(rid)}


@app.get("/api/admin/fiscal", tags=["restaurante"])
def get_fiscal_restaurante(u: dict = Depends(authorize(["owner"]))):
    rid = get_restaurant_id_from_token(u)
    return {
        "config": get_fiscal_config(rid),
        "documents": listar_fiscal_docs(rid)[-80:],
    }


@app.put("/api/admin/fiscal", tags=["restaurante"])
def atualizar_fiscal_restaurante(body: FiscalConfigInput, request: Request,
                                 u: dict = Depends(authorize(["owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "admin")
    config = get_fiscal_config(rid)
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    if payload.get("environment") == "producao" and not payload.get("cnpj") and not config.get("cnpj"):
        raise HTTPException(400, "Informe o CNPJ antes de usar ambiente de produção")
    config.update(payload)
    save_fiscal_config(rid, config)
    log_acao(u, "atualizar_fiscal", "configuracoes", rid, None, {k: v for k, v in payload.items() if "certificate" not in k.lower()}, request)
    return {"config": config}


@app.post("/api/admin/fiscal/documents", tags=["restaurante"])
def registrar_documento_fiscal(body: FiscalDocumentInput, request: Request,
                               u: dict = Depends(authorize(["owner", "manager", "cashier"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "financeiro")
    extra = {
        "chave_acesso": body.chave_acesso,
        "numero": body.numero,
        "serie": body.serie,
        "xml_url": body.xml_url,
        "danfe_url": body.danfe_url,
        "observacao": body.observacao,
    }
    doc = registrar_fiscal_documento(
        rid,
        body.sessao_mesa_id or "",
        body.total or 0,
        origem="registro_manual",
        status_doc=body.status,
        extra={k: v for k, v in extra.items() if v},
    )
    log_acao(u, "registrar_documento_fiscal", "configuracoes", body.sessao_mesa_id, None, doc, request)
    return {"document": doc}


# ═════════════════════════════════════════════════════════════════
# ADMIN — CAIXA E FINANCEIRO
# ═════════════════════════════════════════════════════════════════

@app.post("/api/admin/cash-register/close", tags=["caixa"])
def fechar_caixa(data: Optional[str] = None, request: Request = None,
                 u: dict = Depends(authorize(["cashier", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "financeiro")
    data_ref = data or datetime.utcnow().date().isoformat()
    resp = sb.rpc("gerar_fechamento_caixa", {
        "p_restaurant_id": rid,
        "p_data":          data_ref,
        "p_usuario_id":    u["sub"],
    }).execute()
    log_acao(u, "fechar_caixa", "fechamento_caixa", None, None, {"data": data_ref}, request)
    return resp.data


@app.get("/api/admin/cash-register/history", tags=["caixa"])
def historico_caixa(u: dict = Depends(authorize(["cashier", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "financeiro")
    resp = sb.table("fechamento_caixa").select("*,usuarios(nome)").eq("restaurant_id", rid).order("data_referencia", desc=True).limit(30).execute()
    return {"fechamentos": _rows(resp)}


@app.get("/api/admin/cash-registers", tags=["caixa"])
def listar_caixas_admin(u: dict = Depends(authorize(["cashier", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "financeiro")
    caixas = listar_caixas(rid)
    turnos = listar_turnos_caixa(rid)
    abertos = [t for t in turnos if t.get("status") == "open"]
    return {
        "registers": caixas,
        "open_shifts": abertos,
        "history": sorted(turnos, key=lambda t: t.get("opened_at") or "", reverse=True)[:80],
        "limits": {"registers": limite_caixas_restaurante(rid)},
    }


@app.post("/api/admin/cash-registers", tags=["caixa"])
def criar_caixa_admin(body: CriarCaixaInput, request: Request,
                      u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "financeiro")
    caixas = listar_caixas(rid)
    ativos = [c for c in caixas if c.get("is_active") is not False]
    limite = limite_caixas_restaurante(rid)
    if len(ativos) >= limite:
        raise HTTPException(403, f"Plano atual permite até {limite} caixa(s)")
    nome = body.name.strip()
    if any((c.get("name") or "").strip().lower() == nome.lower() and c.get("is_active") is not False for c in caixas):
        raise HTTPException(409, "Já existe um caixa ativo com este nome")
    caixa = {
        "id": str(uuid4()),
        "name": nome,
        "is_active": True,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    caixas.append(caixa)
    salvar_caixas(rid, caixas)
    log_acao(u, "criar_caixa", "configuracoes", caixa["id"], None, caixa, request)
    return {"register": caixa, "limits": {"registers": limite}}


@app.patch("/api/admin/cash-registers/{caixa_id}", tags=["caixa"])
def atualizar_caixa_admin(caixa_id: str, body: dict, request: Request,
                          u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "financeiro")
    caixas = listar_caixas(rid)
    caixa = next((c for c in caixas if c.get("id") == caixa_id), None)
    if not caixa:
        raise HTTPException(404, "Caixa não encontrado")
    ant = dict(caixa)
    if "name" in body:
        nome = (body.get("name") or "").strip()
        if len(nome) < 3:
            raise HTTPException(400, "Nome do caixa inválido")
        caixa["name"] = nome[:40]
    if "is_active" in body:
        if body.get("is_active") is False and turno_aberto_por_caixa(rid, caixa_id):
            raise HTTPException(409, "Feche o turno aberto antes de desativar este caixa")
        caixa["is_active"] = bool(body.get("is_active"))
    caixa["updated_at"] = utcnow()
    salvar_caixas(rid, caixas)
    log_acao(u, "atualizar_caixa", "configuracoes", caixa_id, ant, caixa, request)
    return {"register": caixa}


@app.post("/api/admin/cash-registers/{caixa_id}/open", tags=["caixa"])
def abrir_turno_caixa(caixa_id: str, body: AbrirTurnoCaixaInput, request: Request,
                      u: dict = Depends(authorize(["cashier", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "financeiro")
    caixa = caixa_por_id(rid, caixa_id)
    if turno_aberto_por_caixa(rid, caixa_id):
        raise HTTPException(409, "Este caixa já está aberto")
    dinheiro = caixa_resumo_dinheiro(body.denominations)
    abertura = _money(body.opening_amount if body.opening_amount and body.opening_amount > 0 else dinheiro["total"])
    turno = {
        "id": str(uuid4()),
        "restaurant_id": rid,
        "register_id": caixa_id,
        "register_name": caixa.get("name") or "Caixa",
        "status": "open",
        "opened_by": u["sub"],
        "opened_by_name": u.get("nome") or "",
        "opened_at": utcnow(),
        "opening_amount": abertura,
        "opening_denominations": dinheiro["denominations"],
        "opening_denominations_total": dinheiro["total"],
        "notes": (body.notes or "")[:500],
        "sales_total": 0,
        "payments_by_method": {},
        "transactions_count": 0,
        "account_closures": [],
        "updated_at": utcnow(),
    }
    turnos = listar_turnos_caixa(rid)
    turnos.append(turno)
    salvar_turnos_caixa(rid, turnos)
    log_acao(u, "abrir_turno_caixa", "configuracoes", turno["id"], None, turno, request)
    return {"shift": turno}


@app.post("/api/admin/cash-shifts/{turno_id}/close", tags=["caixa"])
def fechar_turno_caixa(turno_id: str, body: FecharTurnoCaixaInput, request: Request,
                       u: dict = Depends(authorize(["cashier", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "financeiro")
    turnos = listar_turnos_caixa(rid)
    turno = next((t for t in turnos if t.get("id") == turno_id), None)
    if not turno or turno.get("status") != "open":
        raise HTTPException(404, "Turno aberto não encontrado")
    if u.get("role") == "cashier" and turno.get("opened_by") != u["sub"]:
        raise HTTPException(403, "Somente quem abriu o turno pode fechá-lo")
    dinheiro = caixa_resumo_dinheiro(body.denominations)
    fechamento_informado = body.closing_amount if body.closing_amount is not None else dinheiro["total"]
    esperado = _money(float(turno.get("opening_amount") or 0) + float(turno.get("payments_by_method", {}).get("dinheiro") or 0))
    fechamento = _money(fechamento_informado)
    turno.update({
        "status": "closed",
        "closed_by": u["sub"],
        "closed_by_name": u.get("nome") or "",
        "closed_at": utcnow(),
        "closing_amount": fechamento,
        "closing_denominations": dinheiro["denominations"],
        "closing_denominations_total": dinheiro["total"],
        "expected_cash_amount": esperado,
        "cash_difference": _money(fechamento - esperado),
        "left_for_next_shift": _money(body.left_for_next_shift),
        "closing_notes": (body.notes or "")[:500],
        "updated_at": utcnow(),
    })
    salvar_turnos_caixa(rid, turnos)
    log_acao(u, "fechar_turno_caixa", "configuracoes", turno_id, None, turno, request)
    return {"shift": turno}


@app.get("/api/admin/dashboard", tags=["financeiro"])
def dashboard(data_inicio: str, data_fim: str,
              u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    enforce_platform_control(rid, "financeiro")
    try:
        inicio = datetime.fromisoformat(data_inicio).date()
        fim = datetime.fromisoformat(data_fim).date()
    except ValueError:
        raise HTTPException(400, "Período inválido")
    if inicio > fim:
        raise HTTPException(400, "Data inicial maior que a final")

    inicio_iso = f"{inicio.isoformat()}T00:00:00"
    fim_iso = f"{fim.isoformat()}T23:59:59.999999"
    pedidos = _rows(
        sb.table("pedidos")
        .select("id,status,total,subtotal,desconto,forma_pagamento,status_pagamento,created_at,pedido_itens(nome_produto,quantidade,subtotal)")
        .eq("restaurant_id", rid)
        .gte("created_at", inicio_iso)
        .lte("created_at", fim_iso)
        .neq("status", "cancelado")
        .execute()
    )

    total_bruto = sum(_money(p.get("subtotal") if p.get("subtotal") is not None else p.get("total")) for p in pedidos)
    total_descontos = sum(_money(p.get("desconto")) for p in pedidos)
    total_liquido = sum(_money(p.get("total")) for p in pedidos)
    por_pagamento = {}
    for pedido in pedidos:
        _somar_pagamento_dashboard(por_pagamento, pedido.get("forma_pagamento"), pedido.get("total"))
    produtos = {}
    for pedido in pedidos:
        for item in pedido.get("pedido_itens") or []:
            nome = item.get("nome_produto") or "Produto"
            atual = produtos.setdefault(nome, {"nome": nome, "quantidade": 0, "total": 0.0})
            atual["quantidade"] += int(item.get("quantidade") or 0)
            atual["total"] = round(atual["total"] + _money(item.get("subtotal")), 2)
    top_produtos = sorted(produtos.values(), key=lambda p: (p["quantidade"], p["total"]), reverse=True)[:5]

    feedback_rows = _rows(
        sb.table("audit_log")
        .select("valor_novo,created_at")
        .eq("restaurant_id", rid)
        .eq("acao", "feedback_cliente")
        .gte("created_at", inicio_iso)
        .lte("created_at", fim_iso)
        .execute()
    )
    notas = [_money((r.get("valor_novo") or {}).get("nota")) for r in feedback_rows if (r.get("valor_novo") or {}).get("nota")]
    media_feedback = round(sum(notas) / len(notas), 2) if notas else None

    total_pedidos = len(pedidos)
    return {
        "total_bruto": round(total_bruto, 2),
        "total_descontos": round(total_descontos, 2),
        "total_liquido": round(total_liquido, 2),
        "total_pedidos": total_pedidos,
        "ticket_medio": round(total_liquido / total_pedidos, 2) if total_pedidos else 0,
        "por_pagamento": por_pagamento,
        "top_produtos": top_produtos,
        "feedback_media": media_feedback,
        "feedback_total": len(notas),
    }


# ═════════════════════════════════════════════════════════════════
# ADMIN — AUDITORIA
# ═════════════════════════════════════════════════════════════════

@app.get("/api/admin/audit", tags=["auditoria"])
def get_audit(acao: Optional[str] = None, limite: int = 100,
              u: dict = Depends(authorize(["owner"]))):
    rid = get_restaurant_id_from_token(u)
    q = sb.table("audit_log").select("*,usuarios(nome,email)").eq("restaurant_id", rid).order("created_at", desc=True).limit(min(limite, 500))
    if acao:
        q = q.eq("acao", acao)
    return {"logs": _rows(q.execute())}


# ═════════════════════════════════════════════════════════════════
# SUPER ADMIN — Gerenciamento da plataforma
# ═════════════════════════════════════════════════════════════════

def require_super_admin(u: dict = Depends(verificar_token)) -> dict:
    if not u.get("is_super_admin"):
        raise HTTPException(403, "Acesso restrito a super administradores da plataforma")
    return u


@app.get("/api/super-admin/restaurants", tags=["super-admin"])
def listar_todos_restaurantes(u: dict = Depends(require_super_admin)):
    resp = sb.table("restaurants").select("*,restaurant_settings(*)").order("name").execute()
    return {"restaurants": _rows(resp)}


@app.post("/api/super-admin/restaurants", tags=["super-admin"])
def criar_restaurante(body: CriarRestauranteInput, request: Request,
                      u: dict = Depends(require_super_admin)):
    # Verificar slug único
    existe = sb.table("restaurants").select("id").eq("slug", body.slug).execute()
    if existe.data:
        raise HTTPException(400, f"Slug '{body.slug}' já está em uso")

    body.plan = normalize_plan(body.plan)
    plan_limits = PLAN_LIMITS.get(body.plan, PLAN_LIMITS["starter"])
    if body.initial_table_count > plan_limits["tables"]:
        raise HTTPException(400, f"Quantidade inicial de mesas acima do limite do plano ({plan_limits['tables']})")

    payload = body.model_dump(exclude={"initial_table_count", "create_default_categories", "create_sample_products", "template"})
    rest = insert_restaurant(payload)
    try:
        control = aplicar_limites_plano(_platform_control_defaults(), body.plan, force=True)
        control["segment"] = body.template
        save_platform_control(rest["id"], control)

        plano_modules = PLAN_MODULES.get(body.plan, PLAN_MODULES["starter"])
        # Criar settings padrão
        sb.table("restaurant_settings").insert({
            "restaurant_id": rest["id"],
            "service_fee_enabled": False,
            "service_fee_percent": 10,
            "allow_customer_notes": True,
            "allow_waiter_call": bool(plano_modules.get("garcom")),
            "allow_table_close_request": bool(plano_modules.get("garcom")),
            "accept_pix": True,
            "accept_card": True,
            "accept_cash": True,
        }).execute()

        if body.initial_table_count:
            criadas = ensure_active_tables_count(rest["id"], body.initial_table_count)
            if active_tables_count(rest["id"]) < body.initial_table_count:
                raise RuntimeError(f"Foram criadas {criadas} mesa(s), mas o total solicitado foi {body.initial_table_count}")
    except Exception as exc:
        apagar_restaurante_dados(rest["id"])
        raise HTTPException(500, f"Erro ao preparar restaurante inicial: {exc}")

    log_acao(u, "criar_restaurante", "restaurants", rest["id"], None, {"slug": body.slug, "name": body.name}, request)
    return {"restaurant": rest}


def apagar_restaurante_dados(restaurant_id: str):
    def delete_restaurant_rows(table: str):
        sb.table(table).delete().eq("restaurant_id", restaurant_id).execute()

    membros = _rows(sb.table("restaurant_memberships").select("usuario_id").eq("restaurant_id", restaurant_id).execute())
    usuario_ids = [m["usuario_id"] for m in membros if m.get("usuario_id")]

    pedidos = _rows(sb.table("pedidos").select("id").eq("restaurant_id", restaurant_id).execute())
    pedido_ids = [p["id"] for p in pedidos]
    if pedido_ids:
        itens = _rows(sb.table("pedido_itens").select("id").in_("pedido_id", pedido_ids).execute())
        item_ids = [i["id"] for i in itens]
        if item_ids:
            sb.table("pedido_item_ingredientes").delete().in_("pedido_item_id", item_ids).execute()
        sb.table("pedido_status_log").delete().in_("pedido_id", pedido_ids).execute()
        sb.table("pedido_itens").delete().in_("pedido_id", pedido_ids).execute()

    # Tabelas filhas primeiro para evitar erro de FK ao apagar o restaurante.
    for table in (
        "pedido_item_ingredientes",
        "pedido_status_log",
        "pedido_itens",
        "movimentacao_estoque",
        "produto_insumos",
        "produto_ingredientes",
        "integration_events",
        "restaurant_integrations",
        "promocoes",
        "cupons",
        "configuracoes",
        "fechamento_caixa",
        "audit_log",
        "pedidos",
        "sessao_mesa",
        "produtos",
        "ingredientes",
        "insumos",
        "fornecedores",
        "categorias",
        "mesas",
        "restaurant_settings",
        "restaurant_memberships",
    ):
        delete_restaurant_rows(table)

    sb.table("restaurants").delete().eq("id", restaurant_id).execute()
    desativar_usuarios_orfaos(usuario_ids)


@app.patch("/api/super-admin/restaurants/{restaurant_id}/status", tags=["super-admin"])
def toggle_restaurante_status(restaurant_id: str, body: dict, request: Request,
                               u: dict = Depends(require_super_admin)):
    is_active = body.get("is_active")
    if is_active is None:
        raise HTTPException(400, "is_active obrigatório")

    resp = sb.table("restaurants").update({"is_active": is_active, "updated_at": utcnow()}).eq("id", restaurant_id).select("id,name,slug,is_active").execute()
    log_acao(u, "toggle_restaurante", "restaurants", restaurant_id, None, {"is_active": is_active}, request)
    return {"restaurant": _row(resp)}


@app.delete("/api/super-admin/restaurants/{restaurant_id}", tags=["super-admin"])
def deletar_restaurante(restaurant_id: str, request: Request,
                        u: dict = Depends(require_super_admin)):
    rest = sb.table("restaurants").select("id,name,slug").eq("id", restaurant_id).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")
    try:
        apagar_restaurante_dados(restaurant_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Erro ao deletar restaurante e dados relacionados: {exc}")
    log_acao(u, "deletar_restaurante", "restaurants", restaurant_id, rest.data, None, request)
    return {"mensagem": "Restaurante deletado", "restaurant": rest.data}


@app.get("/api/super-admin/metrics", tags=["super-admin"])
def metrics(u: dict = Depends(require_super_admin)):
    total_rests  = sb.table("restaurants").select("id", count="exact").execute()
    active_rests = sb.table("restaurants").select("id", count="exact").eq("is_active", True).execute()
    memberships = _rows(sb.table("restaurant_memberships").select(
        "usuario_id,is_active,usuarios(id,ativo),restaurants(id,is_active)"
    ).execute())
    total_users = len({
        m.get("usuario_id")
        for m in memberships
        if m.get("usuario_id")
        and m.get("is_active") is not False
        and (m.get("usuarios") or {}).get("ativo") is not False
        and (m.get("restaurants") or {}).get("is_active") is not False
    })
    total_orders = sb.table("pedidos").select("id", count="exact").execute()

    return {
        "total_restaurants":  total_rests.count,
        "active_restaurants": active_rests.count,
        "total_users":        total_users,
        "total_orders":       total_orders.count,
    }


@app.get("/api/super-admin/users", tags=["super-admin"])
def listar_usuarios_plataforma(u: dict = Depends(require_super_admin)):
    resp = sb.table("restaurant_memberships").select(
        "role,is_active,created_at,"
        "usuarios(id,nome,email,ativo),"
        "restaurants(id,name,slug,is_active)"
    ).order("created_at", desc=True).limit(200).execute()
    memberships = [
        m for m in _rows(resp)
        if m.get("usuarios") and m.get("restaurants")
    ]
    for m in memberships:
        slug = (m.get("restaurants") or {}).get("slug")
        usuario = m.get("usuarios") or {}
        usuario["login"] = display_login_identifier(usuario.get("email"), slug)
    return {"memberships": memberships}


@app.get("/api/super-admin/finance", tags=["super-admin"])
def financeiro_plataforma(u: dict = Depends(require_super_admin)):
    restaurantes = _rows(sb.table("restaurants").select(
        "id,name,slug,plan,is_active,created_at"
    ).order("name").execute())
    items = []
    for rest in restaurantes:
        control = get_platform_control(rest["id"])
        amount = _money(control.get("monthly_amount"))
        status_fin = control.get("billing_status") or control.get("billing_computed_status") or "em_dia"
        payments = _rows(sb.table("platform_payments").select(
            "id,customer_code,branch_code,amount,paid_at,next_due_date,reference,notes,created_at"
        ).eq("restaurant_id", rest["id"]).order("paid_at", desc=True).limit(5).execute())
        items.append({
            "restaurant": rest,
            "customer_code": control.get("customer_code") or "",
            "branch_code": control.get("branch_code") or control.get("customer_code") or "",
            "branch_label": control.get("branch_label") or "Matriz",
            "recent_payments": payments,
            "billing_status": status_fin,
            "billing_computed_status": control.get("billing_computed_status"),
            "billing_notice": control.get("billing_notice"),
            "billing_days_overdue": control.get("billing_days_overdue") or 0,
            "due_date": control.get("due_date"),
            "trial_until": control.get("trial_until"),
            "monthly_amount": amount,
            "last_payment_date": control.get("last_payment_date"),
            "last_payment_amount": _money(control.get("last_payment_amount")),
            "last_payment_reference": control.get("last_payment_reference") or "",
            "payment_notes": control.get("payment_notes") or "",
            "grace_alert_days": control.get("grace_alert_days") or 15,
            "grace_block_days": control.get("grace_block_days") or 30,
            "block_mode": control.get("block_mode") or "none",
        })

    summary = {
        "total_monthly": round(sum(i["monthly_amount"] for i in items if (i.get("restaurant") or {}).get("is_active") is not False), 2),
        "overdue_amount": round(sum(i["monthly_amount"] for i in items if i["billing_status"] in {"vencido", "bloqueado"}), 2),
        "active_clients": len([i for i in items if (i.get("restaurant") or {}).get("is_active") is not False]),
        "overdue_clients": len([i for i in items if i["billing_status"] in {"vencido", "bloqueado"}]),
        "trial_clients": len([i for i in items if i["billing_status"] == "teste_gratis"]),
    }
    return {"summary": summary, "items": items, "generated_at": utcnow()}


@app.get("/api/super-admin/support", tags=["super-admin"])
def suporte_plataforma(u: dict = Depends(require_super_admin)):
    tickets = listar_support_tickets(None, 120)
    open_tickets = [t for t in tickets if t.get("status") != "resolvido"]
    return {
        "tickets": tickets,
        "summary": {
            "open": len(open_tickets),
            "urgent": len([t for t in open_tickets if t.get("priority") == "urgente"]),
            "resolved": len([t for t in tickets if t.get("status") == "resolvido"]),
            "total": len(tickets),
        },
    }


@app.patch("/api/super-admin/support/{ticket_id}", tags=["super-admin"])
def atualizar_suporte_plataforma(ticket_id: str, body: dict, request: Request,
                                 u: dict = Depends(require_super_admin)):
    row = _row(sb.table("platform_support_tickets").select("*").eq("id", ticket_id).execute())
    payload = {}
    if body.get("status") in {"aberto", "em_andamento", "liberado_teste", "aguardando_cliente", "resolvido"}:
        payload["status"] = body.get("status")
        if payload["status"] == "resolvido":
            payload["resolved_at"] = utcnow()
        elif row.get("resolved_at"):
            payload["resolved_at"] = None
    if body.get("priority") in {"normal", "alta", "urgente"}:
        payload["priority"] = body.get("priority")
    for key in ("admin_notes", "last_response"):
        if key in body:
            payload[key] = str(body.get(key) or "")[:3000]
    if not payload:
        raise HTTPException(400, "Nada para atualizar")
    payload["updated_at"] = utcnow()
    ticket = _row(sb.table("platform_support_tickets").update(payload).eq("id", ticket_id).execute())
    atualizar_resumo_suporte(ticket["restaurant_id"])
    log_acao(u, "atualizar_suporte", "platform_support_tickets", ticket["restaurant_id"], ticket_id, payload, request)
    return {"ticket": support_ticket_public(ticket)}


@app.get("/api/super-admin/restaurants/{restaurant_id}/overview", tags=["super-admin"])
def detalhes_restaurante_plataforma(restaurant_id: str, u: dict = Depends(require_super_admin)):
    rest = sb.table("restaurants").select("*,restaurant_settings(*)").eq("id", restaurant_id).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")
    restaurant = rest.data
    control = get_platform_control(restaurant_id)

    users = _rows(sb.table("restaurant_memberships").select(
        "id,role,is_active,created_at,usuarios(id,nome,email,ativo,ultimo_acesso)"
    ).eq("restaurant_id", restaurant_id).order("created_at", desc=True).execute())
    users = enrich_membership_logins(users, restaurant.get("slug"))

    mesas = sb.table("mesas").select("id", count="exact").eq("restaurant_id", restaurant_id).eq("ativa", True).execute()
    produtos = sb.table("produtos").select("id", count="exact").eq("restaurant_id", restaurant_id).execute()
    categorias = sb.table("categorias").select("id", count="exact").eq("restaurant_id", restaurant_id).execute()
    pedidos = sb.table("pedidos").select("id", count="exact").eq("restaurant_id", restaurant_id).execute()
    since = (datetime.utcnow() - timedelta(days=30)).isoformat()
    pedidos_30 = _rows(sb.table("pedidos").select("id,total,status,created_at").eq("restaurant_id", restaurant_id).gte("created_at", since).execute())
    pedidos_abertos = sb.table("pedidos").select("id", count="exact").eq("restaurant_id", restaurant_id).in_("status", list(OPEN_ORDER_STATUSES)).execute()
    mesas_ocupadas = sb.table("mesas").select("id", count="exact").eq("restaurant_id", restaurant_id).eq("ativa", True).neq("status", "livre").execute()
    recentes = _rows(sb.table("pedidos").select("id,numero,status,total,created_at,mesas(numero)").eq("restaurant_id", restaurant_id).order("created_at", desc=True).limit(8).execute())
    logs = _rows(sb.table("audit_log").select("id,acao,usuario_nome,perfil,created_at,valor_novo").eq("restaurant_id", restaurant_id).order("created_at", desc=True).limit(12).execute())

    health = []
    def add_health(check, status, detail):
        health.append({"check": check, "status": status, "detail": detail})

    owner_count = len([m for m in users if m.get("role") == "owner" and m.get("is_active") and m.get("usuarios")])
    active_users = len([m for m in users if m.get("is_active") and m.get("usuarios")])
    add_health("Dono", "OK" if owner_count else "WARN", "Owner ativo encontrado" if owner_count else "Sem owner ativo")
    add_health("Mesas", "OK" if (mesas.count or 0) > 0 else "WARN", f"{mesas.count or 0} mesa(s) ativa(s)")
    add_health("Cardápio", "OK" if (produtos.count or 0) > 0 and (categorias.count or 0) > 0 else "WARN", f"{produtos.count or 0} produto(s), {categorias.count or 0} categoria(s)")
    add_health("Pedidos travados", "OK" if (pedidos_abertos.count or 0) == 0 else "INFO", f"{pedidos_abertos.count or 0} pedido(s) aberto(s)")
    add_health("Mesas ocupadas", "OK" if (mesas_ocupadas.count or 0) == 0 else "INFO", f"{mesas_ocupadas.count or 0} mesa(s) ocupada(s)")
    if active_users > int((control.get("limits") or {}).get("users") or 9999):
        add_health("Limite de usuários", "WARN", f"{active_users} usuários ativos acima do limite")
    if (mesas.count or 0) > int((control.get("limits") or {}).get("tables") or 9999):
        add_health("Limite de mesas", "WARN", f"{mesas.count} mesas acima do limite")
    if control.get("billing_status") in {"vencido", "bloqueado"}:
        add_health("Financeiro", "WARN", control.get("billing_notice") or f"Status: {control.get('billing_status')}")

    return {
        "restaurant": restaurant,
        "control": control,
        "feature_flags": get_restaurant_feature_flags(restaurant_id),
        "users": users,
        "links": platform_links(restaurant["slug"]),
        "health": health,
        "usage": {
            "active_users": active_users,
            "tables": mesas.count or 0,
            "products": produtos.count or 0,
            "categories": categorias.count or 0,
            "orders_total": pedidos.count or 0,
            "orders_30d": len(pedidos_30),
            "revenue_30d": round(sum(_money(p.get("total")) for p in pedidos_30 if p.get("status") != "cancelado"), 2),
            "open_orders": pedidos_abertos.count or 0,
            "occupied_tables": mesas_ocupadas.count or 0,
        },
        "recent_orders": recentes,
        "recent_logs": logs,
        "support_tickets": listar_support_tickets(restaurant_id, 20),
    }


@app.patch("/api/super-admin/restaurants/{restaurant_id}/control", tags=["super-admin"])
def atualizar_controle_restaurante(restaurant_id: str, body: dict, request: Request,
                                   u: dict = Depends(require_super_admin)):
    rest = sb.table("restaurants").select("id,plan,is_active").eq("id", restaurant_id).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")

    restaurant_patch = {}
    requested_plan = normalize_plan(body.get("plan")) if body.get("plan") else None
    if requested_plan in {"starter", "pro", "enterprise"}:
        restaurant_patch["plan"] = requested_plan
    if isinstance(body.get("is_active"), bool):
        restaurant_patch["is_active"] = body["is_active"]
    if restaurant_patch:
        restaurant_patch["updated_at"] = utcnow()
        sb.table("restaurants").update(restaurant_patch).eq("id", restaurant_id).execute()

    control = get_platform_control(restaurant_id)
    if requested_plan:
        control = aplicar_limites_plano(control, requested_plan, force=True)
    for key in ("billing_status", "trial_until", "due_date", "segment", "city", "internal_notes", "support_status", "support_priority", "support_notes", "block_mode", "broadcast_message"):
        if key in body:
            control[key] = body.get(key)
    if isinstance(body.get("limits"), dict):
        control["limits"].update(body["limits"])
    if isinstance(body.get("modules"), dict):
        control["modules"].update(body["modules"])
    if isinstance(body.get("feature_flags"), dict):
        flags = get_restaurant_feature_flags(restaurant_id)
        flags.update({k: bool(v) for k, v in body["feature_flags"].items() if k in {"allow_waiter_payment", "allow_waiter_delivery"}})
        if (flags.get("allow_waiter_payment") or flags.get("allow_waiter_delivery")) and (control.get("modules") or {}).get("garcom") is False:
            raise HTTPException(403, "Recursos de garçom exigem módulo Garçom")
        save_restaurant_feature_flags(restaurant_id, flags)
    if body.get("register_payment"):
        payment = body.get("payment") if isinstance(body.get("payment"), dict) else {}
        amount = _money(payment.get("amount") or body.get("last_payment_amount") or control.get("monthly_amount"))
        paid_at = (payment.get("paid_at") or datetime.utcnow().date().isoformat())[:10]
        reference = str(payment.get("reference") or body.get("last_payment_reference") or "").strip()
        control["last_payment_date"] = paid_at
        control["last_payment_amount"] = amount
        control["last_payment_reference"] = reference
        if payment.get("notes"):
            control["payment_notes"] = str(payment.get("notes"))
        if payment.get("next_due_date"):
            control["due_date"] = str(payment.get("next_due_date"))[:10]
        control["billing_status"] = "em_dia"
        if control.get("block_mode") in {"admin", "orders", "users", "full"}:
            control["block_mode"] = "none"
        try:
            sb.table("platform_payments").insert({
                "restaurant_id": restaurant_id,
                "customer_code": control.get("customer_code") or "",
                "branch_code": control.get("branch_code") or control.get("customer_code") or "",
                "amount": amount,
                "paid_at": paid_at,
                "next_due_date": str(payment.get("next_due_date"))[:10] if payment.get("next_due_date") else None,
                "reference": reference,
                "notes": str(payment.get("notes") or ""),
                "created_by": u.get("sub"),
            }).execute()
        except Exception as exc:
            logger.warning("Falha ao registrar histórico financeiro: %s", exc)
    for key in ("monthly_amount", "last_payment_date", "last_payment_amount", "last_payment_reference", "payment_notes", "grace_alert_days", "grace_block_days"):
        if key in body and not body.get("register_payment"):
            control[key] = body.get(key)
    control = calcular_status_financeiro(control)
    save_platform_control(restaurant_id, control)
    tables_created = 0
    if "desired_tables" in body:
        tables_created = ensure_active_tables_count(restaurant_id, int(body.get("desired_tables") or 0))
    if (control.get("modules") or {}).get("garcom") is False:
        sb.table("restaurant_settings").update({
            "allow_waiter_call": False,
            "allow_table_close_request": False,
            "updated_at": utcnow(),
        }).eq("restaurant_id", restaurant_id).execute()

    log_acao(u, "super_atualizar_controle", "configuracoes", restaurant_id, None, body, request)
    return {"mensagem": "Controle atualizado", "control": control, "restaurant_patch": restaurant_patch, "tables_created": tables_created}


@app.post("/api/super-admin/restaurants/{restaurant_id}/impersonate", tags=["super-admin"])
def impersonar_restaurante(restaurant_id: str, request: Request,
                           u: dict = Depends(require_super_admin)):
    rest = sb.table("restaurants").select("id,name,slug,is_active").eq("id", restaurant_id).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")
    usuario = {
        "id": u["sub"],
        "email": u["email"],
        "nome": u.get("nome") or "Super Admin",
        "perfil": "super_admin",
        "is_super_admin": True,
    }
    token = criar_token(usuario, restaurant_id, "owner")
    log_acao(u, "super_impersonar_restaurante", "restaurants", restaurant_id, None, {"slug": rest.data["slug"]}, request)
    return {
        "token": token,
        "usuario": {
            "id": u["sub"],
            "nome": usuario["nome"],
            "email": usuario["email"],
            "role": "owner",
            "is_super_admin": True,
            "restaurant_id": restaurant_id,
            "restaurant": rest.data,
        },
        "redirect_url": f"/r/{rest.data['slug']}/admin",
    }


@app.get("/api/super-admin/audit", tags=["super-admin"])
def auditoria_plataforma(limite: int = 80, u: dict = Depends(require_super_admin)):
    rows = _rows(sb.table("audit_log").select(
        "id,restaurant_id,acao,tabela,registro_id,usuario_nome,perfil,created_at,valor_novo,restaurants(name,slug)"
    ).order("created_at", desc=True).limit(min(limite, 200)).execute())
    return {"logs": rows}


@app.get("/api/super-admin/restaurants/{restaurant_id}/qrcodes", tags=["super-admin"])
def qrcodes_restaurante(restaurant_id: str, u: dict = Depends(require_super_admin)):
    rest = sb.table("restaurants").select("id,name,slug").eq("id", restaurant_id).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")

    mesas = sb.table("mesas").select("numero,qr_code_token").eq("restaurant_id", restaurant_id).eq("ativa", True).order("numero").execute()
    base_url = "" if FRONTEND_URL == "*" else FRONTEND_URL.rstrip("/")
    return {
        "restaurant": rest.data,
        "mesas": [
            {
                "mesa_numero": m["numero"],
                "public_token": m["qr_code_token"],
                "url_slug": f"{base_url}/r/{rest.data['slug']}/mesa/{m['qr_code_token']}",
            }
            for m in _rows(mesas)
            if m.get("qr_code_token")
        ],
    }


@app.get("/api/super-admin/restaurants/{restaurant_id}/export", tags=["super-admin"])
def exportar_restaurante(restaurant_id: str, u: dict = Depends(require_super_admin)):
    rest = sb.table("restaurants").select("*").eq("id", restaurant_id).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")

    def table_rows(table: str, select: str = "*"):
        return _rows(sb.table(table).select(select).eq("restaurant_id", restaurant_id).execute())

    pedidos = table_rows("pedidos")
    pedido_ids = [p["id"] for p in pedidos]
    itens = []
    if pedido_ids:
        itens = _rows(sb.table("pedido_itens").select("*").in_("pedido_id", pedido_ids).execute())

    usuarios = table_rows(
        "restaurant_memberships",
        "id,role,is_active,created_at,usuarios(id,nome,email,ativo,perfil,ultimo_acesso)"
    )
    return {
        "exported_at": utcnow(),
        "version": APP_VERSION,
        "restaurant": rest.data,
        "control": get_platform_control(restaurant_id),
        "settings": table_rows("restaurant_settings"),
        "users": usuarios,
        "tables": table_rows("mesas"),
        "categories": table_rows("categorias"),
        "products": table_rows("produtos"),
        "sessions": table_rows("sessao_mesa"),
        "orders": pedidos,
        "order_items": itens,
        "cash_closures": table_rows("fechamento_caixa"),
        "audit_logs": table_rows("audit_log"),
    }


@app.get("/api/super-admin/operations", tags=["super-admin"])
def operacao_plataforma(u: dict = Depends(require_super_admin)):
    now = datetime.utcnow()
    since_24h = (now - timedelta(hours=24)).isoformat()
    since_7d = (now - timedelta(days=7)).isoformat()
    stale_cutoff = (now - timedelta(minutes=45)).isoformat()
    occupied_cutoff = (now - timedelta(hours=2)).isoformat()

    rests = _rows(sb.table("restaurants").select("id,name,slug,plan,is_active,created_at").execute())
    memberships = _rows(sb.table("restaurant_memberships").select(
        "usuario_id,is_active,usuarios(id,ativo),restaurants(id,is_active)"
    ).execute())
    pedidos_24h = _rows(sb.table("pedidos").select("id,total,status,created_at,restaurants(name,slug)").gte("created_at", since_24h).execute())
    pedidos_7d = _rows(sb.table("pedidos").select("id,total,status,created_at").gte("created_at", since_7d).execute())
    pedidos_abertos = _rows(sb.table("pedidos").select(
        "id,numero,status,created_at,updated_at,tempo_pronto,total,restaurants(name,slug),mesas(numero)"
    ).in_("status", list(OPEN_ORDER_STATUSES)).order("created_at").limit(80).execute())
    mesas_ocupadas = _rows(sb.table("sessao_mesa").select(
        "id,aberta_em,total_consumido,restaurants(name,slug),mesas(numero)"
    ).eq("status", "aberta").order("aberta_em").limit(80).execute())
    erros = _rows(sb.table("audit_log").select(
        "id,created_at,acao,tabela,usuario_nome,perfil,valor_novo,restaurants(name,slug)"
    ).in_("acao", ["erro_backend", "frontend_error"]).order("created_at", desc=True).limit(20).execute())
    logs = _rows(sb.table("audit_log").select(
        "id,created_at,acao,tabela,usuario_nome,perfil,restaurants(name,slug)"
    ).order("created_at", desc=True).limit(20).execute())

    active_users = len({
        m.get("usuario_id")
        for m in memberships
        if m.get("usuario_id")
        and m.get("is_active") is not False
        and (m.get("usuarios") or {}).get("ativo") is not False
        and (m.get("restaurants") or {}).get("is_active") is not False
    })
    revenue_24h = round(sum(_money(p.get("total")) for p in pedidos_24h if p.get("status") != "cancelado"), 2)
    revenue_7d = round(sum(_money(p.get("total")) for p in pedidos_7d if p.get("status") != "cancelado"), 2)
    stale_orders = [p for p in pedidos_abertos if str(p.get("created_at") or "") < stale_cutoff]
    ready_stale_orders = [p for p in pedidos_abertos if p.get("status") == "pronto" and not pedido_visivel_na_fila(p)]
    old_tables = [m for m in mesas_ocupadas if str(m.get("aberta_em") or "") < occupied_cutoff]

    alerts = []
    def add_alert(level: str, title: str, detail: str, href: str | None = None):
        alerts.append({"level": level, "title": title, "detail": detail, "href": href})

    if stale_orders:
        add_alert("WARN", "Pedidos abertos há mais de 45min", f"{len(stale_orders)} pedido(s) precisam de atenção")
    if ready_stale_orders:
        add_alert("INFO", "Pedidos prontos fora da cozinha", f"{len(ready_stale_orders)} pedido(s) prontos há mais de {KITCHEN_READY_VISIBLE_MINUTES}min")
    if old_tables:
        add_alert("INFO", "Mesas ocupadas há mais de 2h", f"{len(old_tables)} mesa(s) abertas por muito tempo")
    if erros:
        add_alert("WARN", "Erros recentes registrados", f"{len(erros)} erro(s) nos últimos logs")
    inactive_count = len([r for r in rests if r.get("is_active") is False])
    if inactive_count:
        add_alert("INFO", "Restaurantes inativos", f"{inactive_count} cliente(s) aparecem como inativos")
    if not alerts:
        add_alert("OK", "Operação sem alertas críticos", "Nenhum alerta automático no momento")

    return {
        "version": APP_VERSION,
        "generated_at": utcnow(),
        "summary": {
            "restaurants_total": len(rests),
            "restaurants_active": len([r for r in rests if r.get("is_active") is not False]),
            "users_active": active_users,
            "orders_24h": len(pedidos_24h),
            "orders_open": len(pedidos_abertos),
            "occupied_tables": len(mesas_ocupadas),
            "revenue_24h": revenue_24h,
            "revenue_7d": revenue_7d,
            "errors_recent": len(erros),
        },
        "alerts": alerts,
        "open_orders": pedidos_abertos[:20],
        "ready_stale_orders": ready_stale_orders[:20],
        "old_tables": old_tables[:20],
        "recent_errors": erros,
        "recent_logs": logs,
    }


@app.get("/api/super-admin/backup", tags=["super-admin"])
def backup_plataforma(u: dict = Depends(require_super_admin)):
    def rows(table: str, select: str = "*"):
        return _rows(sb.table(table).select(select).execute())

    restaurants = rows("restaurants")
    restaurant_ids = [r.get("id") for r in restaurants if r.get("id")]
    pedidos = rows("pedidos")
    pedido_ids = [p.get("id") for p in pedidos if p.get("id")]
    itens = _rows(sb.table("pedido_itens").select("*").in_("pedido_id", pedido_ids).execute()) if pedido_ids else []

    return {
        "backup_type": "platform_snapshot",
        "generated_at": utcnow(),
        "version": APP_VERSION,
        "counts": {
            "restaurants": len(restaurants),
            "orders": len(pedidos),
            "order_items": len(itens),
        },
        "restaurants": restaurants,
        "restaurant_settings": rows("restaurant_settings"),
        "platform_control": rows("configuracoes"),
        "memberships": rows("restaurant_memberships"),
        "users": rows("usuarios", "id,nome,email,ativo,perfil,ultimo_acesso"),
        "tables": rows("mesas"),
        "categories": rows("categorias"),
        "products": rows("produtos"),
        "sessions": rows("sessao_mesa"),
        "orders": pedidos,
        "order_items": itens,
        "cash_closures": rows("fechamento_caixa"),
    }


@app.post("/api/super-admin/restaurants/{restaurant_id}/repair-seed", tags=["super-admin"])
def reparar_seed_restaurante(restaurant_id: str, body: dict, request: Request,
                             u: dict = Depends(require_super_admin)):
    rest = sb.table("restaurants").select("id,name,plan").eq("id", restaurant_id).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")
    template = body.get("template") or get_platform_control(restaurant_id).get("segment") or "restaurante"
    if template not in TEMPLATE_CATEGORIES:
        template = "restaurante"

    criados = {"settings": 0, "categories": 0, "products": 0, "tables": 0}
    if not _rows(sb.table("restaurant_settings").select("id").eq("restaurant_id", restaurant_id).limit(1).execute()):
        sb.table("restaurant_settings").insert({
            "restaurant_id": restaurant_id,
            "service_fee_enabled": False,
            "service_fee_percent": 10,
            "allow_customer_notes": True,
            "allow_waiter_call": True,
            "allow_table_close_request": True,
            "accept_pix": True,
            "accept_card": True,
            "accept_cash": True,
        }).execute()
        criados["settings"] = 1

    categorias = _rows(sb.table("categorias").select("id,nome").eq("restaurant_id", restaurant_id).execute())
    if body.get("create_default_categories", False) and not categorias:
        sb.table("categorias").insert([
            {"restaurant_id": restaurant_id, **cat}
            for cat in TEMPLATE_CATEGORIES[template]
        ]).execute()
        categorias = _rows(sb.table("categorias").select("id,nome").eq("restaurant_id", restaurant_id).execute())
        criados["categories"] = len(categorias)

    if body.get("create_sample_products", False) and not _rows(sb.table("produtos").select("id").eq("restaurant_id", restaurant_id).limit(1).execute()):
        cat_por_nome = {c["nome"]: c["id"] for c in categorias}
        produtos_seed = []
        for cat_nome, nome, descricao, preco, destaque, tempo in SAMPLE_PRODUCTS.get(template, SAMPLE_PRODUCTS["restaurante"]):
            if cat_nome in cat_por_nome:
                produtos_seed.append({
                    "restaurant_id": restaurant_id,
                    "categoria_id": cat_por_nome[cat_nome],
                    "nome": nome,
                    "descricao": descricao,
                    "preco": preco,
                    "custo": 0,
                    "disponivel": True,
                    "destaque": destaque,
                    "tempo_preparo_minutos": tempo,
                })
        if produtos_seed:
            sb.table("produtos").insert(produtos_seed).execute()
            criados["products"] = len(produtos_seed)

    mesas_ativas = active_tables_count(restaurant_id)
    mesas_desejadas = int(body.get("tables") or 0)
    if mesas_desejadas > mesas_ativas:
        criados["tables"] = ensure_active_tables_count(restaurant_id, mesas_desejadas)

    log_acao(u, "super_reparar_seed", "restaurants", restaurant_id, None, criados, request)
    return {"mensagem": "Seed verificado", "created": criados}


@app.post("/api/super-admin/maintenance/cleanup", tags=["super-admin"])
def limpeza_plataforma(body: dict, request: Request, u: dict = Depends(require_super_admin)):
    apply_changes = body.get("apply") is True
    memberships = _rows(sb.table("restaurant_memberships").select("usuario_id,is_active,restaurants(id)").execute())
    usuarios_vinculados = {m.get("usuario_id") for m in memberships if m.get("usuario_id") and m.get("restaurants")}
    todos_usuarios = _rows(sb.table("usuarios").select("id,email,ativo").execute())
    admins = {
        a.get("usuario_id")
        for a in _rows(sb.table("platform_admins").select("usuario_id").execute())
        if a.get("usuario_id")
    }
    todos_orfaos = [
        usr for usr in todos_usuarios
        if usr.get("id") not in usuarios_vinculados
        and usr.get("id") not in admins
        and usr.get("email") != "admin@restaurante.com"
    ]
    orfaos = [usr for usr in todos_orfaos if usr.get("ativo") is not False]

    memberships_orfaos = [m for m in memberships if not m.get("restaurants")]
    resultado = {
        "dry_run": not apply_changes,
        "orphan_users": len(orfaos),
        "inactive_orphan_users": len(todos_orfaos) - len(orfaos),
        "orphan_memberships": len(memberships_orfaos),
        "deactivated_users": 0,
        "deleted_memberships": 0,
    }

    if apply_changes:
        for m in memberships_orfaos:
            if m.get("usuario_id"):
                sb.table("restaurant_memberships").delete().eq("usuario_id", m["usuario_id"]).is_("restaurant_id", "null").execute()
                resultado["deleted_memberships"] += 1
        for usr in orfaos:
            if usr.get("ativo") is not False:
                sb.table("usuarios").update({"ativo": False}).eq("id", usr["id"]).execute()
                resultado["deactivated_users"] += 1
        log_acao(u, "super_limpeza_plataforma", "usuarios", None, None, resultado, request)

    return resultado


@app.get("/api/super-admin/diagnostics", tags=["super-admin"])
def diagnosticos_plataforma(u: dict = Depends(require_super_admin)):
    checks = []
    restaurantes_sem_settings = sb.table("restaurants").select("id,name,restaurant_settings(id)").execute()
    faltando_settings = [
        r["name"] for r in _rows(restaurantes_sem_settings)
        if not r.get("restaurant_settings")
    ]
    checks.append({
        "check_name": "restaurant_settings",
        "status": "OK" if not faltando_settings else "WARN",
        "detail": "Todos os restaurantes possuem configurações" if not faltando_settings else f"Sem settings: {', '.join(faltando_settings)}",
    })

    mesas_sem_token = sb.table("mesas").select("id,numero,restaurants(name)").is_("qr_code_token", "null").eq("ativa", True).execute()
    qtd_mesas_sem_token = len(_rows(mesas_sem_token))
    checks.append({
        "check_name": "qr_code_token",
        "status": "OK" if qtd_mesas_sem_token == 0 else "WARN",
        "detail": "Todas as mesas ativas possuem token" if qtd_mesas_sem_token == 0 else f"{qtd_mesas_sem_token} mesa(s) ativa(s) sem token",
    })

    membros_sem_restaurante = sb.table("restaurant_memberships").select("id").is_("restaurant_id", "null").execute()
    qtd_membros_sem_restaurante = len(_rows(membros_sem_restaurante))
    checks.append({
        "check_name": "memberships",
        "status": "OK" if qtd_membros_sem_restaurante == 0 else "WARN",
        "detail": "Todos os usuários vinculados possuem restaurante" if qtd_membros_sem_restaurante == 0 else f"{qtd_membros_sem_restaurante} vínculo(s) sem restaurante",
    })

    pedidos_sem_restaurante = _rows(sb.table("pedidos").select("id").is_("restaurant_id", "null").limit(200).execute())
    itens_sem_pedido = _rows(sb.table("pedido_itens").select("id").is_("pedido_id", "null").limit(200).execute())
    checks.append({
        "check_name": "pedidos_restaurante",
        "status": "OK" if not pedidos_sem_restaurante else "WARN",
        "detail": "Todos os pedidos possuem restaurante" if not pedidos_sem_restaurante else f"{len(pedidos_sem_restaurante)} pedido(s) sem restaurante",
    })
    checks.append({
        "check_name": "itens_pedido",
        "status": "OK" if not itens_sem_pedido else "WARN",
        "detail": "Todos os itens estão vinculados a pedidos" if not itens_sem_pedido else f"{len(itens_sem_pedido)} item(ns) sem pedido",
    })

    sessoes_abertas = _rows(sb.table("sessao_mesa").select(
        "id,mesa_id,restaurants(name),mesas(numero)"
    ).eq("status", "aberta").limit(500).execute())
    sessoes_por_mesa = {}
    for sessao in sessoes_abertas:
        mesa_id = sessao.get("mesa_id")
        if mesa_id:
            sessoes_por_mesa.setdefault(mesa_id, []).append(sessao)
    mesas_com_sessoes_duplicadas = [
        sessoes[0] for sessoes in sessoes_por_mesa.values() if len(sessoes) > 1
    ]
    checks.append({
        "check_name": "sessoes_mesa_abertas",
        "status": "OK" if not mesas_com_sessoes_duplicadas else "WARN",
        "detail": "Nenhuma mesa possui sessões abertas duplicadas" if not mesas_com_sessoes_duplicadas else f"{len(mesas_com_sessoes_duplicadas)} mesa(s) com mais de uma sessão aberta",
    })

    pedidos_prontos = _rows(sb.table("pedidos").select(
        "id,numero,status,created_at,updated_at,tempo_pronto,restaurants(name),mesas(numero)"
    ).eq("status", "pronto").order("created_at").limit(500).execute())
    prontos_antigos = [p for p in pedidos_prontos if not pedido_visivel_na_fila(p)]
    checks.append({
        "check_name": "cozinha_prontos_antigos",
        "status": "OK" if not prontos_antigos else "INFO",
        "detail": "Nenhum pedido pronto ficou pendente além da janela da cozinha" if not prontos_antigos else f"{len(prontos_antigos)} pedido(s) prontos há mais de {KITCHEN_READY_VISIBLE_MINUTES}min",
    })

    restaurantes = _rows(sb.table("restaurants").select("id,name").eq("is_active", True).execute())
    restaurantes_sem_mesas = []
    restaurantes_sem_categorias = []
    restaurantes_sem_owner = []
    for rest in restaurantes:
        rid = rest["id"]
        if not _rows(sb.table("mesas").select("id").eq("restaurant_id", rid).eq("ativa", True).limit(1).execute()):
            restaurantes_sem_mesas.append(rest["name"])
        if not _rows(sb.table("categorias").select("id").eq("restaurant_id", rid).limit(1).execute()):
            restaurantes_sem_categorias.append(rest["name"])
        owner = sb.table("restaurant_memberships").select("id").eq("restaurant_id", rid).eq("role", "owner").eq("is_active", True).limit(1).execute()
        if not _rows(owner):
            restaurantes_sem_owner.append(rest["name"])

    checks.append({
        "check_name": "mesas_ativas",
        "status": "OK" if not restaurantes_sem_mesas else "WARN",
        "detail": "Todos os restaurantes ativos possuem mesas" if not restaurantes_sem_mesas else f"Sem mesas: {', '.join(restaurantes_sem_mesas)}",
    })
    checks.append({
        "check_name": "categorias_cardapio",
        "status": "OK" if not restaurantes_sem_categorias else "WARN",
        "detail": "Todos os restaurantes ativos possuem categorias" if not restaurantes_sem_categorias else f"Sem categorias: {', '.join(restaurantes_sem_categorias)}",
    })
    checks.append({
        "check_name": "owner_restaurante",
        "status": "OK" if not restaurantes_sem_owner else "WARN",
        "detail": "Todos os restaurantes ativos possuem owner" if not restaurantes_sem_owner else f"Sem owner: {', '.join(restaurantes_sem_owner)}",
    })

    return {"checks": checks}


@app.post("/api/super-admin/restaurants/{restaurant_id}/users", tags=["super-admin"])
def criar_usuario_super_admin(restaurant_id: str, body: CriarUsuarioInput,
                               request: Request, u: dict = Depends(require_super_admin)):
    # Verificar que o restaurante existe
    rest = sb.table("restaurants").select("id,slug").eq("id", restaurant_id).execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")
    validar_role_no_plano(restaurant_id, body.role)
    enforce_cashier_user_limit(restaurant_id, body.role)
    slug = rest.data[0].get("slug")
    login_id = user_identifier_from_body(body, slug)

    existe = sb.table("usuarios").select("id,ativo").eq("email", login_id).execute()
    if existe.data:
        uid = existe.data[0]["id"]
        if existe.data[0].get("ativo") is False:
            sb.table("usuarios").update({
                "nome": body.nome,
                "senha_hash": hash_senha(body.senha),
                "ativo": True,
            }).eq("id", uid).execute()
        membership = _first(_rows(sb.table("restaurant_memberships").select("id,is_active").eq("restaurant_id", restaurant_id).eq("usuario_id", uid).limit(1).execute()))
        if not membership or membership.get("is_active") is False:
            enforce_plan_limit(restaurant_id, "users", active_memberships_count(restaurant_id))
    else:
        enforce_plan_limit(restaurant_id, "users", active_memberships_count(restaurant_id))
        uid = insert_user({
            "nome": body.nome, "email": login_id,
            "senha_hash": hash_senha(body.senha),
            "perfil": "funcionario", "ativo": True,
        }, login_id)

    sb.table("restaurant_memberships").upsert({
        "restaurant_id": restaurant_id, "usuario_id": uid,
        "role": body.role, "is_active": True,
    }, on_conflict="restaurant_id,usuario_id").execute()

    log_acao(u, "super_criar_usuario", "usuarios", uid, None,
             {"login": display_login_identifier(login_id, slug), "role": body.role, "restaurant_id": restaurant_id}, request)
    return {"mensagem": "Usuário criado", "usuario_id": uid}


@app.patch("/api/super-admin/users/{usuario_id}/password", tags=["super-admin"])
def redefinir_senha_usuario_super_admin(usuario_id: str, body: ResetSenhaInput,
                                        request: Request, u: dict = Depends(require_super_admin)):
    usuario = sb.table("usuarios").select("id,email").eq("id", usuario_id).single().execute()
    if not usuario.data:
        raise HTTPException(404, "Usuário não encontrado")
    sb.table("usuarios").update({"senha_hash": hash_senha(body.senha), "ativo": True}).eq("id", usuario_id).execute()
    log_acao(u, "super_redefinir_senha_usuario", "usuarios", usuario_id, None, {"alterada": True}, request)
    return {"mensagem": "Senha atualizada"}
