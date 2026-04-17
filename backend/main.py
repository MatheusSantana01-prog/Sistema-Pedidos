"""
FastAPI — Sistema de Pedidos | Sabor & Fogo  v3.1
Uso interno: cozinha, admin, gerente, dono.
Instalar: pip install -r requirements.txt
Rodar:    uvicorn main:app --reload --host 0.0.0.0 --port 8000
Docs:     http://localhost:8000/docs
"""
from __future__ import annotations
import os
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from pydantic import BaseModel, field_validator
from supabase import Client, create_client
import jwt as pyjwt

load_dotenv()

# ── CONFIG ────────────────────────────────────────────────────────
SUPABASE_URL     = os.getenv("SUPABASE_URL","https://lhrfemeunswviwzdpppp.supabase.co")
SUPABASE_KEY     = os.getenv("SUPABASE_SERVICE_KEY","")
JWT_SECRET       = os.getenv("JWT_SECRET","")
JWT_EXP_H        = int(os.getenv("JWT_EXP_HOURS","12"))
AMBIENTE         = os.getenv("AMBIENTE","desenvolvimento")
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS","*")

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET nao configurado no .env")
if not SUPABASE_KEY or "COLE" in SUPABASE_KEY:
    raise RuntimeError("SUPABASE_SERVICE_KEY nao configurado no .env")

CORS_ORIGINS = ["*"] if CORS_ORIGINS_RAW=="*" else [o.strip() for o in CORS_ORIGINS_RAW.split(",")]

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(
    title="Restaurante API", version="3.1.0",
    docs_url="/docs" if AMBIENTE=="desenvolvimento" else None,
    redoc_url=None,
)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS,
    allow_methods=["GET","POST","PATCH","DELETE","OPTIONS"],
    allow_headers=["Authorization","Content-Type"], allow_credentials=True)

bearer = HTTPBearer(auto_error=False)
ROLE_LEVEL = {"dono":4,"gerente":3,"funcionario":2,"cozinha":1}
STATUS_VALIDOS = ["confirmado","em_preparo","pronto","entregue","cancelado"]

# ── AUTH ──────────────────────────────────────────────────────────
def criar_token(u):
    return pyjwt.encode({"sub":str(u["id"]),"email":u["email"],"nome":u["nome"],
        "perfil":u["perfil"],"exp":datetime.utcnow()+timedelta(hours=JWT_EXP_H),
        "iat":datetime.utcnow()}, JWT_SECRET, algorithm="HS256")

def verificar_token(cred: HTTPAuthorizationCredentials=Depends(bearer)):
    if not cred: raise HTTPException(401,"Token nao fornecido")
    try: return pyjwt.decode(cred.credentials, JWT_SECRET, algorithms=["HS256"])
    except pyjwt.ExpiredSignatureError: raise HTTPException(401,"Token expirado")
    except pyjwt.InvalidTokenError:     raise HTTPException(401,"Token invalido")

def authorize(roles):
    """Middleware RBAC: authorize(['gerente']) aceita gerente e dono."""
    min_lvl = min(ROLE_LEVEL.get(r,0) for r in roles)
    def _chk(u=Depends(verificar_token)):
        if ROLE_LEVEL.get(u.get("perfil",""),0) < min_lvl:
            raise HTTPException(403,f"Sem permissao. Requer: {roles}")
        return u
    return _chk

def log_acao(u, acao, tabela=None, reg_id=None, ant=None, novo=None, req=None):
    try:
        ip = req.client.host if req and req.client else None
        sb.table("audit_log").insert({"usuario_id":u.get("sub"),"usuario_nome":u.get("nome"),
            "perfil":u.get("perfil"),"acao":acao,"tabela":tabela,
            "registro_id":str(reg_id) if reg_id else None,
            "valor_anterior":ant,"valor_novo":novo,"ip":ip}).execute()
    except: pass

def _row(r):
    if not r.data: raise HTTPException(404,"Nao encontrado")
    return r.data[0] if isinstance(r.data,list) else r.data
def _rows(r): return r.data or []

# ── SCHEMAS ───────────────────────────────────────────────────────
class LoginInput(BaseModel):
    email: str; senha: str

class CriarUsuario(BaseModel):
    nome: str; email: str; senha: str; perfil: str="funcionario"; observacao: Optional[str]=None
    @field_validator("perfil")
    @classmethod
    def vp(cls,v):
        if v not in ROLE_LEVEL: raise ValueError(f"Perfil invalido: {list(ROLE_LEVEL)}")
        return v
    @field_validator("senha")
    @classmethod
    def vs(cls,v):
        if len(v)<6: raise ValueError("Senha min 6 chars")
        return v

class AtualizarUsuario(BaseModel):
    nome: Optional[str]=None; perfil: Optional[str]=None
    ativo: Optional[bool]=None; observacao: Optional[str]=None

class AtualizarStatusPedido(BaseModel):
    status: str; observacao: Optional[str]=None; motivo_cancelamento: Optional[str]=None
    @field_validator("status")
    @classmethod
    def vs(cls,v):
        if v not in STATUS_VALIDOS: raise ValueError(f"Status invalido: {STATUS_VALIDOS}")
        return v

class AtualizarMesa(BaseModel):
    status: Optional[str]=None; capacidade: Optional[int]=None

class CriarProduto(BaseModel):
    categoria_id: UUID; nome: str; descricao: Optional[str]=None
    preco: float; custo: float=0.0; foto_url: Optional[str]=None
    disponivel: bool=True; destaque: bool=False; tempo_preparo_minutos: int=10

class AtualizarProduto(BaseModel):
    nome: Optional[str]=None; descricao: Optional[str]=None
    preco: Optional[float]=None; custo: Optional[float]=None
    foto_url: Optional[str]=None; disponivel: Optional[bool]=None
    destaque: Optional[bool]=None; tempo_preparo_minutos: Optional[int]=None
    categoria_id: Optional[UUID]=None

class CriarFornecedor(BaseModel):
    nome: str; cnpj: Optional[str]=None; telefone: Optional[str]=None
    email: Optional[str]=None; contato: Optional[str]=None

class CriarInsumo(BaseModel):
    nome: str; unidade: str="un"; custo_unitario: float=0.0
    estoque_atual: float=0.0; estoque_minimo: float=0.0; fornecedor_id: Optional[UUID]=None

class MovimentacaoEstoque(BaseModel):
    insumo_id: UUID; tipo: str; quantidade: float
    custo_total: float=0.0; motivo: Optional[str]=None; fornecedor_id: Optional[UUID]=None
    @field_validator("tipo")
    @classmethod
    def vt(cls,v):
        if v not in ["entrada","saida","ajuste","perda"]: raise ValueError("Tipo invalido")
        return v

class FecharConta(BaseModel):
    forma_pagamento: str; observacao: Optional[str]=None
    @field_validator("forma_pagamento")
    @classmethod
    def vf(cls,v):
        if v not in ["dinheiro","pix","cartao_credito","cartao_debito"]:
            raise ValueError("Forma de pagamento invalida")
        return v

# ── ROTAS ─────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"api":"Restaurante API v3.1","ambiente":AMBIENTE,
            "docs":"/docs" if AMBIENTE=="desenvolvimento" else "desabilitado"}

# AUTH
@app.post("/api/auth/login", tags=["auth"])
def login(body: LoginInput):
    resp = sb.table("usuarios").select("*").eq("email",body.email).eq("ativo",True).single().execute()
    if not resp.data: raise HTTPException(401,"Credenciais invalidas")
    u = resp.data
    ok = False
    try: ok = pwd_ctx.verify(body.senha, u.get("senha_hash",""))
    except:
        import hashlib
        ok = hashlib.sha256(body.senha.encode()).hexdigest() == u.get("senha_hash","")
    if not ok: raise HTTPException(401,"Credenciais invalidas")
    sb.table("usuarios").update({"ultimo_acesso":datetime.utcnow().isoformat()}).eq("id",u["id"]).execute()
    return {"token":criar_token(u),"usuario":{"id":u["id"],"nome":u["nome"],"email":u["email"],"perfil":u["perfil"]}}

@app.post("/api/auth/trocar-senha", tags=["auth"])
def trocar_senha(body: dict, u=Depends(verificar_token)):
    nova = body.get("senha_nova","")
    if len(nova)<6: raise HTTPException(400,"Nova senha min 6 chars")
    usr = sb.table("usuarios").select("senha_hash").eq("id",u["sub"]).single().execute()
    if not pwd_ctx.verify(body.get("senha_atual",""), _row(usr)["senha_hash"]):
        raise HTTPException(401,"Senha atual incorreta")
    sb.table("usuarios").update({"senha_hash":pwd_ctx.hash(nova)}).eq("id",u["sub"]).execute()
    return {"mensagem":"Senha alterada com sucesso"}

@app.get("/api/auth/me", tags=["auth"])
def me(u=Depends(verificar_token)):
    return {k:u[k] for k in ("sub","nome","email","perfil") if k in u}

# COZINHA
@app.get("/api/cozinha/fila", tags=["cozinha"])
def fila(u=Depends(authorize(["cozinha"]))):
    r = sb.table("pedidos").select(
        "id,numero,status,created_at,observacao_geral,mesa_id,"
        "mesas(numero),pedido_itens(nome_produto,quantidade,observacao,"
        "pedido_item_ingredientes(acao,nome_ingrediente))"
    ).in_("status",["pendente","confirmado","em_preparo"]).order("created_at").execute()
    return {"pedidos":_rows(r)}

@app.patch("/api/cozinha/pedidos/{pid}/status", tags=["cozinha"])
def avancar(pid:str, body:AtualizarStatusPedido, req:Request, u=Depends(authorize(["cozinha"]))):
    ant = sb.table("pedidos").select("status").eq("id",pid).single().execute()
    extra = {"updated_at":datetime.utcnow().isoformat()}
    if body.status=="em_preparo": extra["tempo_inicio_preparo"]=extra["updated_at"]
    if body.status=="pronto":     extra["tempo_pronto"]=extra["updated_at"]
    if body.status=="entregue":   extra["tempo_entrega"]=extra["updated_at"]
    if body.status=="cancelado":  extra["cancelado_por"]=u["sub"]; extra["motivo_cancelamento"]=body.motivo_cancelamento
    r = sb.table("pedidos").update({"status":body.status,**extra}).eq("id",pid)\
          .select("id,numero,status,updated_at").execute()
    log_acao(u,f"status_pedido_{body.status}","pedidos",pid,ant.data,{"status":body.status},req)
    sb.table("pedido_status_log").insert({"pedido_id":pid,"status_novo":body.status,
        "status_anterior":(ant.data or {}).get("status"),"usuario_id":u["sub"],"observacao":body.observacao}).execute()
    return {"pedido":_row(r)}

# MESAS
@app.get("/api/admin/mesas", tags=["admin"])
def mesas(u=Depends(authorize(["funcionario"]))):
    r = sb.table("mesas").select("id,numero,status,capacidade,qr_code_token,"
        "sessao_mesa!left(id,status,aberta_em,total_consumido)").eq("ativa",True).order("numero").execute()
    ms = _rows(r)
    for m in ms:
        ss = m.pop("sessao_mesa",[]) or []
        m["sessao_ativa"] = next((s for s in ss if s["status"]=="aberta"),None)
    return {"mesas":ms}

@app.patch("/api/admin/mesas/{mid}", tags=["admin"])
def upd_mesa(mid:str, body:AtualizarMesa, req:Request, u=Depends(authorize(["gerente"]))):
    p = {k:v for k,v in body.model_dump().items() if v is not None}
    if not p: raise HTTPException(400,"Nenhum campo")
    p["updated_at"]=datetime.utcnow().isoformat()
    r = sb.table("mesas").update(p).eq("id",mid).select("id,numero,status").execute()
    log_acao(u,"atualizar_mesa","mesas",mid,None,p,req)
    return {"mesa":_row(r)}

@app.post("/api/admin/mesas/{mid}/fechar", tags=["admin"])
def fechar_mesa(mid:str, body:FecharConta, req:Request, u=Depends(authorize(["funcionario"]))):
    s = sb.table("sessao_mesa").select("id,total_consumido").eq("mesa_id",mid).eq("status","aberta").single().execute()
    sess = _row(s)
    sb.rpc("fechar_sessao_mesa",{"p_sessao_id":sess["id"]}).execute()
    sb.table("pedidos").update({"forma_pagamento":body.forma_pagamento,"status_pagamento":"aprovado",
        "updated_at":datetime.utcnow().isoformat()}).eq("sessao_mesa_id",sess["id"]).neq("status","cancelado").execute()
    log_acao(u,"fechar_conta_mesa","sessao_mesa",sess["id"],None,{"pgto":body.forma_pagamento,"total":str(sess["total_consumido"])},req)
    return {"mensagem":"Mesa fechada","total":sess["total_consumido"],"forma_pagamento":body.forma_pagamento}

# PEDIDOS
@app.get("/api/admin/pedidos", tags=["admin"])
def pedidos(status_filtro:Optional[str]=None,mesa_id:Optional[str]=None,sessao_id:Optional[str]=None,
            limite:int=50, u=Depends(authorize(["funcionario"]))):
    q = sb.table("pedidos").select("id,numero,status,total,subtotal,desconto,created_at,"
        "mesa_id,sessao_mesa_id,forma_pagamento,status_pagamento,mesas(numero),"
        "pedido_itens(nome_produto,quantidade,subtotal)").order("created_at",desc=True).limit(min(limite,200))
    if status_filtro: q=q.eq("status",status_filtro)
    if mesa_id:       q=q.eq("mesa_id",mesa_id)
    if sessao_id:     q=q.eq("sessao_mesa_id",sessao_id)
    return {"pedidos":_rows(q.execute())}

@app.patch("/api/admin/pedidos/{pid}/cancelar", tags=["admin"])
def cancelar(pid:str, body:AtualizarStatusPedido, req:Request, u=Depends(authorize(["gerente"]))):
    ant = sb.table("pedidos").select("status,total,desconto,subtotal").eq("id",pid).single().execute()
    d = ant.data or {}
    if d.get("subtotal",0) and d.get("desconto",0):
        pct = float(d["desconto"])/float(d["subtotal"])
        if pct>0.10 and ROLE_LEVEL.get(u["perfil"],0)<ROLE_LEVEL["dono"]:
            raise HTTPException(403,"Cancelamento com desconto >10% requer dono")
    r = sb.table("pedidos").update({"status":"cancelado","cancelado_por":u["sub"],
        "motivo_cancelamento":body.motivo_cancelamento,"updated_at":datetime.utcnow().isoformat()}
    ).eq("id",pid).select("id,numero,status").execute()
    log_acao(u,"cancelar_pedido","pedidos",pid,{"status":d.get("status")},{"status":"cancelado","motivo":body.motivo_cancelamento},req)
    return {"pedido":_row(r)}

# PRODUTOS
@app.get("/api/admin/produtos", tags=["admin"])
def prods(categoria_id:Optional[str]=None,disponivel:Optional[bool]=None,u=Depends(authorize(["funcionario"]))):
    q = sb.table("produtos").select("*,categorias(nome,icone)").order("nome")
    if categoria_id: q=q.eq("categoria_id",categoria_id)
    if disponivel is not None: q=q.eq("disponivel",disponivel)
    return {"produtos":_rows(q.execute())}

@app.post("/api/admin/produtos", tags=["admin"])
def criar_prod(body:CriarProduto, req:Request, u=Depends(authorize(["gerente"]))):
    p = body.model_dump(); p["categoria_id"]=str(p["categoria_id"])
    r = sb.table("produtos").insert(p).select("*").execute()
    prod = _row(r); log_acao(u,"criar_produto","produtos",prod["id"],None,p,req)
    return {"produto":prod}

@app.patch("/api/admin/produtos/{pid}", tags=["admin"])
def upd_prod(pid:str, body:AtualizarProduto, req:Request, u=Depends(authorize(["gerente"]))):
    ant = sb.table("produtos").select("nome,preco,disponivel").eq("id",pid).single().execute()
    p = {k:(str(v) if isinstance(v,UUID) else v) for k,v in body.model_dump().items() if v is not None}
    if not p: raise HTTPException(400,"Nenhum campo")
    p["updated_at"]=datetime.utcnow().isoformat()
    r = sb.table("produtos").update(p).eq("id",pid).select("id,nome,preco,disponivel,destaque").execute()
    log_acao(u,"atualizar_produto","produtos",pid,ant.data,p,req)
    return {"produto":_row(r)}

@app.delete("/api/admin/produtos/{pid}", tags=["admin"])
def del_prod(pid:str, req:Request, u=Depends(authorize(["gerente"]))):
    r = sb.table("produtos").update({"disponivel":False,"updated_at":datetime.utcnow().isoformat()})\
          .eq("id",pid).select("id,nome,disponivel").execute()
    log_acao(u,"desativar_produto","produtos",pid,None,None,req)
    return {"produto":_row(r)}

# ESTOQUE
@app.get("/api/admin/estoque/insumos", tags=["estoque"])
def insumos(u=Depends(authorize(["gerente"]))):
    r = sb.table("insumos").select("*,fornecedores(nome)").eq("ativo",True).order("nome").execute()
    ins = _rows(r)
    for i in ins: i["alerta_reposicao"]=float(i["estoque_atual"])<=float(i["estoque_minimo"])
    return {"insumos":ins,"alertas":[i for i in ins if i["alerta_reposicao"]]}

@app.post("/api/admin/estoque/insumos", tags=["estoque"])
def criar_ins(body:CriarInsumo, req:Request, u=Depends(authorize(["gerente"]))):
    p = body.model_dump()
    if p.get("fornecedor_id"): p["fornecedor_id"]=str(p["fornecedor_id"])
    r = sb.table("insumos").insert(p).select("*").execute()
    ins=_row(r); log_acao(u,"criar_insumo","insumos",ins["id"],None,p,req)
    return {"insumo":ins}

@app.post("/api/admin/estoque/movimentacao", tags=["estoque"])
def movim(body:MovimentacaoEstoque, req:Request, u=Depends(authorize(["gerente"]))):
    iid=str(body.insumo_id)
    atual=float(_row(sb.table("insumos").select("estoque_atual,nome").eq("id",iid).single().execute())["estoque_atual"])
    sinal=1 if body.tipo=="entrada" else -1
    novo=atual+sinal*body.quantidade
    if novo<0 and body.tipo=="saida": raise HTTPException(400,f"Estoque insuficiente. Atual: {atual}")
    sb.table("insumos").update({"estoque_atual":novo,"updated_at":datetime.utcnow().isoformat()}).eq("id",iid).execute()
    r = sb.table("movimentacao_estoque").insert({"insumo_id":iid,"tipo":body.tipo,"quantidade":body.quantidade,
        "custo_total":body.custo_total,"motivo":body.motivo,"usuario_id":u["sub"],
        "fornecedor_id":str(body.fornecedor_id) if body.fornecedor_id else None}).select("*").execute()
    log_acao(u,f"estoque_{body.tipo}","insumos",iid,{"estoque":atual},{"estoque":novo},req)
    return {"movimentacao":_row(r),"estoque_atual":novo}

@app.get("/api/admin/estoque/fornecedores", tags=["estoque"])
def fornecs(u=Depends(authorize(["gerente"]))):
    return {"fornecedores":_rows(sb.table("fornecedores").select("*").eq("ativo",True).order("nome").execute())}

@app.post("/api/admin/estoque/fornecedores", tags=["estoque"])
def criar_forn(body:CriarFornecedor, req:Request, u=Depends(authorize(["gerente"]))):
    r = sb.table("fornecedores").insert(body.model_dump()).select("*").execute()
    f=_row(r); log_acao(u,"criar_fornecedor","fornecedores",f["id"],None,body.model_dump(),req)
    return {"fornecedor":f}

# CAIXA
@app.post("/api/admin/caixa/fechar", tags=["financeiro"])
def fechar_cx(data:Optional[str]=None, req:Request=None, u=Depends(authorize(["gerente"]))):
    dr=data or datetime.utcnow().date().isoformat()
    r=sb.rpc("gerar_fechamento_caixa",{"p_data":dr,"p_usuario_id":u["sub"]}).execute()
    log_acao(u,"fechar_caixa","fechamento_caixa",None,None,{"data":dr,"total_liquido":r.data.get("total_liquido")},req)
    return r.data

@app.get("/api/admin/caixa/historico", tags=["financeiro"])
def hist_cx(u=Depends(authorize(["gerente"]))):
    return {"fechamentos":_rows(sb.table("fechamento_caixa").select("*,usuarios(nome)").order("data_referencia",desc=True).limit(30).execute())}

# DONO — Financeiro
@app.get("/api/dono/dashboard", tags=["dono"])
def dashboard(data_inicio:str, data_fim:str, u=Depends(authorize(["dono"]))):
    return sb.rpc("get_dashboard_financeiro",{"p_data_inicio":data_inicio,"p_data_fim":data_fim}).execute().data

@app.get("/api/dono/relatorio/hoje", tags=["dono"])
def rpt_hoje(u=Depends(authorize(["dono"]))):
    hoje=datetime.utcnow().date().isoformat()
    return sb.rpc("get_dashboard_financeiro",{"p_data_inicio":hoje,"p_data_fim":hoje}).execute().data

# DONO — Usuários
@app.get("/api/dono/usuarios", tags=["dono"])
def lst_users(u=Depends(authorize(["dono"]))):
    return {"usuarios":_rows(sb.table("usuarios").select("id,nome,email,perfil,ativo,ultimo_acesso,created_at,observacao").order("nome").execute())}

@app.post("/api/dono/usuarios", tags=["dono"])
def criar_user(body:CriarUsuario, req:Request, u=Depends(authorize(["dono"]))):
    if sb.table("usuarios").select("id").eq("email",body.email).execute().data:
        raise HTTPException(400,"Email ja cadastrado")
    r = sb.table("usuarios").insert({"nome":body.nome,"email":body.email,
        "senha_hash":pwd_ctx.hash(body.senha),"perfil":body.perfil,
        "criado_por":u["sub"],"observacao":body.observacao,"ativo":True}).select("id,nome,email,perfil").execute()
    f=_row(r); log_acao(u,"criar_usuario","usuarios",f["id"],None,{"email":body.email,"perfil":body.perfil},req)
    return {"usuario":f}

@app.patch("/api/dono/usuarios/{uid}", tags=["dono"])
def upd_user(uid:str, body:AtualizarUsuario, req:Request, u=Depends(authorize(["dono"]))):
    ant=sb.table("usuarios").select("nome,perfil,ativo").eq("id",uid).single().execute()
    p={k:v for k,v in body.model_dump().items() if v is not None}
    if not p: raise HTTPException(400,"Nenhum campo")
    p["updated_at"]=datetime.utcnow().isoformat()
    r=sb.table("usuarios").update(p).eq("id",uid).select("id,nome,perfil,ativo").execute()
    log_acao(u,"atualizar_usuario","usuarios",uid,ant.data,p,req)
    return {"usuario":_row(r)}

@app.delete("/api/dono/usuarios/{uid}", tags=["dono"])
def del_user(uid:str, req:Request, u=Depends(authorize(["dono"]))):
    if uid==u["sub"]: raise HTTPException(400,"Nao pode desativar sua propria conta")
    r=sb.table("usuarios").update({"ativo":False,"updated_at":datetime.utcnow().isoformat()})\
        .eq("id",uid).select("id,nome,ativo").execute()
    log_acao(u,"desativar_usuario","usuarios",uid,None,{"ativo":False},req)
    return {"usuario":_row(r)}

# DONO — Auditoria
@app.get("/api/dono/auditoria", tags=["dono"])
def auditoria(acao:Optional[str]=None,usuario_id:Optional[str]=None,
              data_inicio:Optional[str]=None,data_fim:Optional[str]=None,
              limite:int=100, u=Depends(authorize(["dono"]))):
    r=sb.rpc("get_audit_report",{"p_acao":acao,"p_usuario_id":usuario_id,
        "p_data_inicio":data_inicio or (datetime.utcnow()-timedelta(days=7)).date().isoformat(),
        "p_data_fim":data_fim or datetime.utcnow().date().isoformat(),"p_limit":min(limite,500)}).execute()
    return {"logs":r.data}

@app.get("/api/dono/auditoria/cancelamentos", tags=["dono"])
def audit_cancel(u=Depends(authorize(["dono"]))):
    logs=sb.rpc("get_audit_report",{"p_acao":"cancelar_pedido",
        "p_data_inicio":(datetime.utcnow()-timedelta(days=30)).date().isoformat(),
        "p_data_fim":datetime.utcnow().date().isoformat(),"p_limit":200}).execute()
    desc=sb.table("pedidos").select("numero,desconto,subtotal,total,cancelado_por,created_at").gt("desconto",0).order("created_at",desc=True).limit(50).execute()
    return {"cancelamentos":logs.data,"descontos_aplicados":_rows(desc)}
