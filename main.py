from fastapi import FastAPI
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))

class Pedido(BaseModel):
    mesa: int
    item: str

@app.get("/")
def inicio():
    return {"mensagem": "Servidor do restaurante funcionando"}

@app.post("/pedido")
def criar_pedido(pedido: Pedido):
    resultado = supabase.table("pedidos").insert({
        "mesa_id": str(pedido.mesa),
        "sessao_cliente": f"mesa_{pedido.mesa}",
        "status": "confirmado",
        "status_pagamento": "aguardando",
        "subtotal": 0,
        "total": 0
    }).execute()
    return {"status": "pedido salvo no banco", "dados": resultado.data}

@app.get("/pedidos")
def listar_pedidos():
    resultado = supabase.table("pedidos").select("*").execute()
    return resultado.data
