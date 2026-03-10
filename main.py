from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


pedidos = []

class Pedido(BaseModel):
    mesa: int
    item: str


@app.get("/")
def inicio():
    return {"mensagem": "Servidor do restaurante funcionando"}


@app.post("/pedido")
def criar_pedido(pedido: Pedido):
    
    pedidos.append(pedido)

    return {
        "status": "pedido recebido",
        "mesa": pedido.mesa,
        "item": pedido.item
    }


@app.get("/pedidos")
def listar_pedidos():
    return pedidos