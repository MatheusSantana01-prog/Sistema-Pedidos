from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from datetime import datetime, timedelta

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/frontend", StaticFiles(directory="../frontend"), name="frontend")

pedidos = []
contador_id = 1


class Pedido(BaseModel):
    mesa: int
    item: str


@app.get("/")
def inicio():
    return {"mensagem": "Servidor do restaurante funcionando"}


@app.post("/pedido")
def criar_pedido(pedido: Pedido):
    global contador_id

    novo_pedido = {
        "id": contador_id,
        "mesa": pedido.mesa,
        "item": pedido.item,
        "status": "em preparo",
        "recebido_em": None
    }

    pedidos.append(novo_pedido)
    contador_id += 1

    return novo_pedido


@app.get("/pedidos")
def listar_pedidos():
    global pedidos

    agora = datetime.now()

    pedidos = [
        pedido for pedido in pedidos
        if not (
            pedido["status"] == "recebido" and
            pedido["recebido_em"] is not None and
            agora - pedido["recebido_em"] >= timedelta(minutes=2)
        )
    ]

    return pedidos


@app.put("/pedido/{pedido_id}")
def atualizar_status(pedido_id: int):
    for pedido in pedidos:
        if pedido["id"] == pedido_id:

            if pedido["status"] == "em preparo":
                pedido["status"] = "pronto"
                pedido["recebido_em"] = None

            elif pedido["status"] == "pronto":
                pedido["status"] = "recebido"
                pedido["recebido_em"] = datetime.now()

            elif pedido["status"] == "recebido":
                pedido["status"] = "em preparo"
                pedido["recebido_em"] = None

            return pedido

    return {"erro": "pedido não encontrado"}