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
import os
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

import bcrypt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, field_validator
from supabase import Client, create_client
import jwt as pyjwt

load_dotenv()

# ── CONFIG ────────────────────────────────────────────────────────
SUPABASE_URL     = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY     = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
JWT_SECRET       = os.getenv("JWT_SECRET", "")
JWT_EXP_H        = int(os.getenv("JWT_EXP_HOURS", "12"))
APP_ENV          = os.getenv("APP_ENV", "development")
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "*")
FRONTEND_URL     = os.getenv("PUBLIC_FRONTEND_URL", "*")

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET não configurado")
if not SUPABASE_KEY or "COLE" in SUPABASE_KEY:
    raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY não configurado")

CORS_ORIGINS = ["*"] if CORS_ORIGINS_RAW == "*" else [
    o.strip() for o in CORS_ORIGINS_RAW.split(",")
]
LOCAL_CORS_ORIGINS = [
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
if CORS_ORIGINS != ["*"]:
    CORS_ORIGINS = list(dict.fromkeys([*CORS_ORIGINS, *LOCAL_CORS_ORIGINS]))

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
    "pendente":    {"confirmado", "cancelado"},
    "confirmado":  {"em_preparo", "cancelado"},
    "em_preparo":  {"pronto", "cancelado"},
    "pronto":      {"entregue"},
    "entregue":    set(),
    "cancelado":   set(),
}

OPEN_ORDER_STATUSES = {"pendente", "confirmado", "em_preparo", "pronto"}

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

bearer = HTTPBearer(auto_error=False)


# ── BCRYPT ────────────────────────────────────────────────────────
def hash_senha(senha: str) -> str:
    return bcrypt.hashpw(senha.encode(), bcrypt.gensalt(12)).decode()

def verificar_senha(senha: str, hash_armazenado: str) -> bool:
    try:
        return bcrypt.checkpw(senha.encode(), hash_armazenado.encode())
    except Exception:
        return False


# ── JWT ───────────────────────────────────────────────────────────
def criar_token(usuario: dict, restaurant_id: str = None, role: str = None) -> str:
    payload = {
        "sub":           str(usuario["id"]),
        "email":         usuario["email"],
        "nome":          usuario["nome"],
        "perfil":        usuario.get("perfil", "funcionario"),
        "restaurant_id": restaurant_id,
        "role":          role,
        "is_super_admin": usuario.get("is_super_admin", False),
        "exp":           datetime.utcnow() + timedelta(hours=JWT_EXP_H),
        "iat":           datetime.utcnow(),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verificar_token(cred: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not cred:
        raise HTTPException(401, "Token não fornecido")
    try:
        return pyjwt.decode(cred.credentials, JWT_SECRET, algorithms=["HS256"])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirado")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")


# ── RBAC ─────────────────────────────────────────────────────────
def authorize(roles: list[str], require_restaurant: bool = True):
    """
    Middleware RBAC multi-tenant.
    Valida role E garante que o usuário pertence ao restaurante da requisição.
    """
    allowed_roles = set(roles)

    def _check(u: dict = Depends(verificar_token)):
        if u.get("is_super_admin"):
            return u  # super_admin passa em tudo

        role = u.get("role", "")
        if role not in allowed_roles:
            raise HTTPException(
                403,
                f"Sem permissão. Requer: {roles}. Seu papel: {role}"
            )
        if require_restaurant and not u.get("restaurant_id"):
            raise HTTPException(403, "Usuário não vinculado a nenhum restaurante")
        return u
    return _check

def get_restaurant_id_from_token(u: dict) -> str:
    """Extrai restaurant_id do token — nunca confia no frontend."""
    rid = u.get("restaurant_id")
    if not rid:
        raise HTTPException(403, "restaurant_id não encontrado no token")
    return rid


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

def utcnow() -> str:
    return datetime.utcnow().isoformat()

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


# ── SCHEMAS ───────────────────────────────────────────────────────
class LoginInput(BaseModel):
    email: str
    senha: str
    restaurant_slug: Optional[str] = None  # opcional — se omitido, tenta encontrar o restaurante


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
    email: str
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
    forma_pagamento: str

    @field_validator("forma_pagamento")
    @classmethod
    def val(cls, v):
        if v not in ["dinheiro", "pix", "cartao_credito", "cartao_debito"]:
            raise ValueError("Forma de pagamento inválida")
        return v


# ═════════════════════════════════════════════════════════════════
# ROTAS PÚBLICAS (sem autenticação)
# ═════════════════════════════════════════════════════════════════

@app.get("/", tags=["geral"])
def root():
    return {"api": "SaaS Restaurante API", "version": "2.0.0", "env": APP_ENV}

@app.get("/health", tags=["geral"])
def health():
    return {"status": "ok", "timestamp": utcnow()}


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
    return {"sessao": sessao_data}


@app.post("/api/public/restaurants/{slug}/orders", tags=["público"])
def criar_pedido_public(slug: str, body: dict):
    """Cria pedido do cliente."""
    rest = sb.table("restaurants").select("id").eq("slug", slug).eq("is_active", True).single().execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")
    rid = rest.data["id"]

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
        itens_sanitizados.append({
            "produto_id": produto_id,
            "nome_produto": produto["nome"],
            "preco_unitario": preco,
            "quantidade": quantidade,
            "subtotal": item_subtotal,
            "observacao": item.get("observacao") or None,
            "ingredientes": item.get("ingredientes") or [],
        })

    # Garantir que o restaurant_id é o certo (nunca confia no body)
    body["restaurant_id"] = rid
    body["itens"] = itens_sanitizados
    body["items"] = itens_sanitizados
    body["subtotal"] = subtotal
    body["total"] = subtotal

    resp = sb.rpc("criar_pedido", {"payload": body}).execute()
    data = _first(resp.data)
    if not data:
        raise HTTPException(500, "Erro ao criar pedido")
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

    pedidos = sb.rpc("get_pedidos_sessao", {"p_sessao_id": sessao_id, "p_restaurant_id": rid}).execute()
    return {
        "sessao_status":     sessao.data["status"],
        "total_consumido":   sessao.data["total_consumido"],
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
    resp = sb.table("usuarios").select("*").eq("email", body.email.strip().lower()).eq("ativo", True).single().execute()
    if not resp.data:
        raise HTTPException(401, "Credenciais inválidas")

    u = resp.data
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

    token = criar_token(u, restaurant_id, role)

    return {
        "token": token,
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
def fila_cozinha(u: dict = Depends(authorize(["tv", "kitchen", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    resp = sb.table("pedidos").select(
        "id,numero,status,created_at,observacao_geral,mesa_id,"
        "mesas(numero),"
        "pedido_itens(nome_produto,quantidade,observacao,"
        "  pedido_item_ingredientes(acao,nome_ingrediente))"
    ).eq("restaurant_id", rid).in_("status", ["pendente", "confirmado", "em_preparo", "pronto"]).order("created_at").execute()
    return {"pedidos": _rows(resp)}


@app.patch("/api/kitchen/orders/{pedido_id}/status", tags=["cozinha"])
def avancar_status(pedido_id: str, body: AtualizarStatusPedidoInput,
                   request: Request, u: dict = Depends(authorize(["tv", "kitchen", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)

    # Validar que o pedido pertence ao restaurante do token
    ant = sb.table("pedidos").select("status,restaurant_id").eq("id", pedido_id).single().execute()
    if not ant.data or ant.data["restaurant_id"] != rid:
        raise HTTPException(403, "Pedido não pertence ao seu restaurante")

    status_atual = ant.data["status"]
    if body.status not in ORDER_TRANSITIONS.get(status_atual, set()):
        raise HTTPException(409, f"Transição inválida: {status_atual} -> {body.status}")
    if u.get("role") == "tv" and not (status_atual == "pronto" and body.status == "entregue"):
        raise HTTPException(403, "TV só pode marcar pedido pronto como entregue")
    if body.status == "cancelado" and u.get("role") == "kitchen":
        raise HTTPException(403, "Cozinha não pode cancelar pedidos")

    extra = {"updated_at": utcnow()}
    if body.status == "em_preparo": extra["tempo_inicio_preparo"] = extra["updated_at"]
    if body.status == "pronto":     extra["tempo_pronto"]         = extra["updated_at"]
    if body.status == "entregue":   extra["tempo_entrega"]        = extra["updated_at"]
    if body.status == "cancelado":
        extra["cancelado_por"]       = u["sub"]
        extra["motivo_cancelamento"] = body.motivo_cancelamento

    resp = sb.table("pedidos").update({"status": body.status, **extra}).eq("id", pedido_id).select("id,numero,status").execute()
    log_acao(u, f"status_{body.status}", "pedidos", pedido_id, {"status": ant.data["status"]}, {"status": body.status}, request)
    return {"pedido": _row(resp)}


# ═════════════════════════════════════════════════════════════════
# ADMIN — MESAS
# ═════════════════════════════════════════════════════════════════

@app.get("/api/admin/tables", tags=["admin"])
def listar_mesas(u: dict = Depends(authorize(["waiter", "cashier", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    resp = sb.table("mesas").select(
        "id,numero,status,capacidade,qr_code_token,"
        "sessao_mesa!left(id,status,aberta_em,total_consumido)"
    ).eq("restaurant_id", rid).eq("ativa", True).order("numero").execute()
    mesas = _rows(resp)
    for m in mesas:
        sessoes = m.pop("sessao_mesa", []) or []
        abertas = [s for s in sessoes if s["status"] == "aberta"]
        abertas.sort(key=lambda s: s.get("aberta_em") or "", reverse=True)
        m["sessao_ativa"] = abertas[0] if abertas else None
    return {"mesas": mesas}


@app.post("/api/admin/tables", tags=["admin"])
def criar_mesa(body: CriarMesaInput, request: Request, u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    import secrets
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
    # Validar pertencimento
    check = sb.table("mesas").select("id").eq("id", mesa_id).eq("restaurant_id", rid).execute()
    if not check.data:
        raise HTTPException(403, "Mesa não pertence ao seu restaurante")

    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    payload["updated_at"] = utcnow()
    resp = sb.table("mesas").update(payload).eq("id", mesa_id).select("id,numero,status,capacidade").execute()
    log_acao(u, "atualizar_mesa", "mesas", mesa_id, None, payload, request)
    return {"mesa": _row(resp)}


@app.post("/api/admin/tables/{mesa_id}/close", tags=["admin"])
def fechar_conta_mesa(mesa_id: str, body: FecharContaInput, request: Request,
                      u: dict = Depends(authorize(["cashier", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)

    # Validar mesa pertence ao restaurante do token
    mesa = sb.table("mesas").select("id").eq("id", mesa_id).eq("restaurant_id", rid).execute()
    if not mesa.data:
        raise HTTPException(403, "Mesa não pertence ao seu restaurante")

    sess = sb.table("sessao_mesa").select("id,total_consumido").eq("mesa_id", mesa_id).eq("restaurant_id", rid).eq("status", "aberta").single().execute()
    if not sess.data:
        raise HTTPException(404, "Nenhuma sessão aberta nesta mesa")

    sessao = sess.data
    abertos = sb.table("pedidos").select("id", count="exact").eq("sessao_mesa_id", sessao["id"]).eq("restaurant_id", rid).in_("status", list(OPEN_ORDER_STATUSES)).execute()
    if abertos.count:
        raise HTTPException(409, "Não é possível fechar: ainda existem pedidos em aberto")

    sb.rpc("fechar_sessao_mesa", {"p_sessao_id": sessao["id"], "p_restaurant_id": rid}).execute()
    sb.table("pedidos").update({
        "forma_pagamento": body.forma_pagamento,
        "status_pagamento": "aprovado",
        "updated_at": utcnow(),
    }).eq("sessao_mesa_id", sessao["id"]).eq("restaurant_id", rid).neq("status", "cancelado").execute()

    log_acao(u, "fechar_conta_mesa", "sessao_mesa", sessao["id"], None,
             {"pagamento": body.forma_pagamento, "total": sessao["total_consumido"]}, request)
    return {"mensagem": "Mesa fechada", "total": sessao["total_consumido"], "forma_pagamento": body.forma_pagamento}


# ═════════════════════════════════════════════════════════════════
# ADMIN — PEDIDOS
# ═════════════════════════════════════════════════════════════════

@app.get("/api/admin/orders", tags=["admin"])
def listar_pedidos(status_filtro: Optional[str] = None, limite: int = 50,
                   u: dict = Depends(authorize(["cashier", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    q = sb.table("pedidos").select(
        "id,numero,status,total,subtotal,desconto,created_at,forma_pagamento,status_pagamento,"
        "mesas(numero),pedido_itens(nome_produto,quantidade,subtotal)"
    ).eq("restaurant_id", rid).order("created_at", desc=True).limit(min(limite, 200))
    if status_filtro:
        q = q.eq("status", status_filtro)
    return {"pedidos": _rows(q.execute())}


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
    body["restaurant_id"] = rid
    resp = sb.table("categorias").insert(body).select("*").execute()
    return {"categoria": _row(resp)}


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
    ant = sb.table("produtos").select("nome,preco,restaurant_id").eq("id", produto_id).single().execute()
    if not ant.data or ant.data["restaurant_id"] != rid:
        raise HTTPException(403, "Produto não pertence ao seu restaurante")

    body.pop("restaurant_id", None)  # nunca deixa o frontend mudar o restaurant_id
    body["updated_at"] = utcnow()
    resp = sb.table("produtos").update(body).eq("id", produto_id).select("id,nome,preco,disponivel").execute()
    log_acao(u, "atualizar_produto", "produtos", produto_id, ant.data, body, request)
    return {"produto": _row(resp)}


# ═════════════════════════════════════════════════════════════════
# ADMIN — USUÁRIOS DO RESTAURANTE
# ═════════════════════════════════════════════════════════════════

@app.get("/api/admin/users", tags=["usuários"])
def listar_usuarios(u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    resp = sb.table("restaurant_memberships").select(
        "id, role, is_active, created_at,"
        "usuarios(id, nome, email, ativo, ultimo_acesso, perfil)"
    ).eq("restaurant_id", rid).execute()
    return {"usuarios": _rows(resp)}


@app.post("/api/admin/users", tags=["usuários"])
def criar_usuario(body: CriarUsuarioInput, request: Request,
                  u: dict = Depends(authorize(["owner"]))):
    rid = get_restaurant_id_from_token(u)

    # Verificar email duplicado
    existe = sb.table("usuarios").select("id").eq("email", body.email).execute()
    if existe.data:
        # Usuário já existe — apenas adicionar membership
        uid = existe.data[0]["id"]
    else:
        resp = sb.table("usuarios").insert({
            "nome": body.nome, "email": body.email,
            "senha_hash": hash_senha(body.senha),
            "perfil": "funcionario", "ativo": True,
        }).select("id").execute()
        uid = _row(resp)["id"]

    # Criar ou atualizar membership
    sb.table("restaurant_memberships").upsert({
        "restaurant_id": rid, "usuario_id": uid, "role": body.role, "is_active": True,
    }, on_conflict="restaurant_id,usuario_id").execute()

    log_acao(u, "criar_usuario", "usuarios", uid, None, {"email": body.email, "role": body.role}, request)
    return {"mensagem": "Usuário criado e vinculado ao restaurante", "usuario_id": uid}


@app.patch("/api/admin/users/{usuario_id}/role", tags=["usuários"])
def alterar_role(usuario_id: str, body: dict, request: Request,
                 u: dict = Depends(authorize(["owner"]))):
    rid = get_restaurant_id_from_token(u)
    nova_role = body.get("role")
    if nova_role not in ROLE_LEVEL:
        raise HTTPException(400, f"Role inválida: {list(ROLE_LEVEL.keys())}")

    # Validar que o usuário pertence ao restaurante
    m = sb.table("restaurant_memberships").select("role").eq("usuario_id", usuario_id).eq("restaurant_id", rid).single().execute()
    if not m.data:
        raise HTTPException(403, "Usuário não pertence ao seu restaurante")

    sb.table("restaurant_memberships").update({"role": nova_role, "updated_at": utcnow()}).eq("usuario_id", usuario_id).eq("restaurant_id", rid).execute()
    log_acao(u, "alterar_role_usuario", "restaurant_memberships", usuario_id,
             {"role": m.data["role"]}, {"role": nova_role}, request)
    return {"mensagem": "Role atualizada"}


@app.delete("/api/admin/users/{usuario_id}", tags=["usuários"])
def remover_usuario(usuario_id: str, request: Request,
                    u: dict = Depends(authorize(["owner"]))):
    rid = get_restaurant_id_from_token(u)
    if usuario_id == u["sub"]:
        raise HTTPException(400, "Não pode remover sua própria conta")

    sb.table("restaurant_memberships").update({"is_active": False, "updated_at": utcnow()}).eq("usuario_id", usuario_id).eq("restaurant_id", rid).execute()
    log_acao(u, "remover_usuario", "restaurant_memberships", usuario_id, None, {"is_active": False}, request)
    return {"mensagem": "Usuário removido do restaurante"}


# ═════════════════════════════════════════════════════════════════
# ADMIN — CONFIGURAÇÕES DO RESTAURANTE
# ═════════════════════════════════════════════════════════════════

@app.get("/api/admin/restaurant", tags=["restaurante"])
def get_meu_restaurante(u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    resp = sb.table("restaurants").select("*,restaurant_settings(*)").eq("id", rid).single().execute()
    return {"restaurant": _row(resp)}


@app.put("/api/admin/restaurant", tags=["restaurante"])
def atualizar_restaurante(body: AtualizarRestauranteInput, request: Request,
                          u: dict = Depends(authorize(["owner"]))):
    rid = get_restaurant_id_from_token(u)
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    payload["updated_at"] = utcnow()
    resp = sb.table("restaurants").update(payload).eq("id", rid).select("*").execute()
    log_acao(u, "atualizar_restaurante", "restaurants", rid, None, payload, request)
    return {"restaurant": _row(resp)}


@app.put("/api/admin/restaurant/settings", tags=["restaurante"])
def atualizar_settings(body: AtualizarSettingsInput, request: Request,
                       u: dict = Depends(authorize(["owner"]))):
    rid = get_restaurant_id_from_token(u)
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    payload["updated_at"] = utcnow()
    resp = sb.table("restaurant_settings").update(payload).eq("restaurant_id", rid).select("*").execute()
    log_acao(u, "atualizar_settings", "restaurant_settings", rid, None, payload, request)
    return {"settings": _row(resp)}


# ═════════════════════════════════════════════════════════════════
# ADMIN — CAIXA E FINANCEIRO
# ═════════════════════════════════════════════════════════════════

@app.post("/api/admin/cash-register/close", tags=["caixa"])
def fechar_caixa(data: Optional[str] = None, request: Request = None,
                 u: dict = Depends(authorize(["cashier", "manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
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
    resp = sb.table("fechamento_caixa").select("*,usuarios(nome)").eq("restaurant_id", rid).order("data_referencia", desc=True).limit(30).execute()
    return {"fechamentos": _rows(resp)}


@app.get("/api/admin/dashboard", tags=["financeiro"])
def dashboard(data_inicio: str, data_fim: str,
              u: dict = Depends(authorize(["manager", "owner"]))):
    rid = get_restaurant_id_from_token(u)
    resp = sb.rpc("get_dashboard_financeiro", {
        "p_restaurant_id": rid,
        "p_data_inicio":   data_inicio,
        "p_data_fim":      data_fim,
    }).execute()
    return resp.data


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

    payload = body.model_dump()
    resp = sb.table("restaurants").insert(payload).select("*").execute()
    rest = _row(resp)

    # Criar settings padrão
    sb.table("restaurant_settings").insert({"restaurant_id": rest["id"]}).execute()

    log_acao(u, "criar_restaurante", "restaurants", rest["id"], None, {"slug": body.slug, "name": body.name}, request)
    return {"restaurant": rest}


@app.patch("/api/super-admin/restaurants/{restaurant_id}/status", tags=["super-admin"])
def toggle_restaurante_status(restaurant_id: str, body: dict, request: Request,
                               u: dict = Depends(require_super_admin)):
    is_active = body.get("is_active")
    if is_active is None:
        raise HTTPException(400, "is_active obrigatório")

    resp = sb.table("restaurants").update({"is_active": is_active, "updated_at": utcnow()}).eq("id", restaurant_id).select("id,name,slug,is_active").execute()
    log_acao(u, "toggle_restaurante", "restaurants", restaurant_id, None, {"is_active": is_active}, request)
    return {"restaurant": _row(resp)}


@app.get("/api/super-admin/metrics", tags=["super-admin"])
def metrics(u: dict = Depends(require_super_admin)):
    total_rests  = sb.table("restaurants").select("id", count="exact").execute()
    active_rests = sb.table("restaurants").select("id", count="exact").eq("is_active", True).execute()
    total_users  = sb.table("usuarios").select("id", count="exact").execute()
    total_orders = sb.table("pedidos").select("id", count="exact").execute()

    return {
        "total_restaurants":  total_rests.count,
        "active_restaurants": active_rests.count,
        "total_users":        total_users.count,
        "total_orders":       total_orders.count,
    }


@app.get("/api/super-admin/users", tags=["super-admin"])
def listar_usuarios_plataforma(u: dict = Depends(require_super_admin)):
    resp = sb.table("restaurant_memberships").select(
        "role,is_active,created_at,"
        "usuarios(id,nome,email,ativo),"
        "restaurants(id,name,slug)"
    ).order("created_at", desc=True).limit(200).execute()
    return {"memberships": _rows(resp)}


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

    return {"checks": checks}


@app.post("/api/super-admin/restaurants/{restaurant_id}/users", tags=["super-admin"])
def criar_usuario_super_admin(restaurant_id: str, body: CriarUsuarioInput,
                               request: Request, u: dict = Depends(require_super_admin)):
    # Verificar que o restaurante existe
    rest = sb.table("restaurants").select("id").eq("id", restaurant_id).execute()
    if not rest.data:
        raise HTTPException(404, "Restaurante não encontrado")

    existe = sb.table("usuarios").select("id").eq("email", body.email).execute()
    if existe.data:
        uid = existe.data[0]["id"]
    else:
        resp = sb.table("usuarios").insert({
            "nome": body.nome, "email": body.email,
            "senha_hash": hash_senha(body.senha),
            "perfil": "funcionario", "ativo": True,
        }).select("id").execute()
        uid = _row(resp)["id"]

    sb.table("restaurant_memberships").upsert({
        "restaurant_id": restaurant_id, "usuario_id": uid,
        "role": body.role, "is_active": True,
    }, on_conflict="restaurant_id,usuario_id").execute()

    log_acao(u, "super_criar_usuario", "usuarios", uid, None,
             {"email": body.email, "role": body.role, "restaurant_id": restaurant_id}, request)
    return {"mensagem": "Usuário criado", "usuario_id": uid}
