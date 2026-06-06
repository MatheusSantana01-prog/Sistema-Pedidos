import pytest
from fastapi import HTTPException

import main
from tests.test_inventory_smoke import FakeSupabase


def make_order_cancel_db(status="pendente"):
    return FakeSupabase({
        "sessao_mesa": [{
            "id": "sess-1",
            "restaurant_id": "rest-a",
            "mesa_id": "mesa-1",
            "status": "aberta",
        }],
        "pedidos": [{
            "id": "pedido-1",
            "numero": 1,
            "restaurant_id": "rest-a",
            "sessao_mesa_id": "sess-1",
            "mesa_id": "mesa-1",
            "status": status,
            "observacao_geral": "",
        }],
        "audit_log": [],
    })


def test_customer_cannot_cancel_closed_session(monkeypatch):
    fake = make_order_cancel_db("pendente")
    fake.tables["sessao_mesa"][0]["status"] = "fechada"
    monkeypatch.setattr(main, "sb", fake)

    with pytest.raises(HTTPException) as exc:
        main.cancelar_pedido_cliente_publico("rest-a", "sess-1", "pedido-1", mesa_id="mesa-1")

    assert exc.value.status_code == 409
    assert fake.tables["pedidos"][0]["status"] == "pendente"


def test_customer_cannot_cancel_order_from_other_table(monkeypatch):
    fake = make_order_cancel_db("pendente")
    monkeypatch.setattr(main, "sb", fake)

    with pytest.raises(HTTPException) as exc:
        main.cancelar_pedido_cliente_publico("rest-a", "sess-1", "pedido-1", mesa_id="mesa-2")

    assert exc.value.status_code == 403
    assert fake.tables["pedidos"][0]["status"] == "pendente"


def test_customer_cannot_cancel_order_from_other_tenant(monkeypatch):
    fake = make_order_cancel_db("pendente")
    monkeypatch.setattr(main, "sb", fake)

    with pytest.raises(HTTPException) as exc:
        main.cancelar_pedido_cliente_publico("rest-b", "sess-1", "pedido-1", mesa_id="mesa-1")

    assert exc.value.status_code == 404
    assert fake.tables["pedidos"][0]["status"] == "pendente"


def test_customer_cancellation_rules_by_status():
    assert main.regra_cancelamento_cliente("pendente")["acao"] == "cancelar"
    assert main.regra_cancelamento_cliente("confirmado")["acao"] == "solicitar"
    assert main.regra_cancelamento_cliente("em_preparo")["permitido"] is False
    assert main.regra_cancelamento_cliente("pronto")["permitido"] is False
    assert main.regra_cancelamento_cliente("entregue")["permitido"] is False


def test_ready_order_can_be_cancelled_only_by_authorized_internal_flow():
    assert "cancelado" in main.ORDER_TRANSITIONS["pronto"]
    assert main.ORDER_TRANSITIONS["entregue"] == set()


def test_customer_can_cancel_pending_order_and_stock_reversal_is_safe(monkeypatch):
    fake = make_order_cancel_db("pendente")
    calls = []
    monkeypatch.setattr(main, "sb", fake)
    monkeypatch.setattr(main, "estornar_estoque_pedido", lambda rid, pedido_id, user=None: calls.append((rid, pedido_id)) or {"status": "sem_baixa"})

    result = main.cancelar_pedido_cliente_publico("rest-a", "sess-1", "pedido-1", mesa_id="mesa-1", motivo="Erro no pedido")

    assert result["acao"] == "cancelado"
    assert fake.tables["pedidos"][0]["status"] == "cancelado"
    assert fake.tables["pedidos"][0]["motivo_cancelamento"] == "Erro no pedido"
    assert calls == [("rest-a", "pedido-1")]
    assert fake.tables["audit_log"][0]["acao"] == "cliente_cancelou_pedido"


def test_duplicate_customer_cancel_does_not_cancel_twice(monkeypatch):
    fake = make_order_cancel_db("pendente")
    monkeypatch.setattr(main, "sb", fake)
    monkeypatch.setattr(main, "estornar_estoque_pedido", lambda rid, pedido_id, user=None: {"status": "sem_baixa"})

    main.cancelar_pedido_cliente_publico("rest-a", "sess-1", "pedido-1", mesa_id="mesa-1")

    with pytest.raises(HTTPException) as exc:
        main.cancelar_pedido_cliente_publico("rest-a", "sess-1", "pedido-1", mesa_id="mesa-1")

    assert exc.value.status_code == 409
    assert len(fake.tables["audit_log"]) == 1


def test_customer_confirmed_order_registers_request_without_canceling(monkeypatch):
    fake = make_order_cancel_db("confirmado")
    monkeypatch.setattr(main, "sb", fake)

    result = main.cancelar_pedido_cliente_publico("rest-a", "sess-1", "pedido-1", mesa_id="mesa-1", motivo="Desistiu")

    pedido = fake.tables["pedidos"][0]
    assert result["acao"] == "solicitacao_registrada"
    assert pedido["status"] == "confirmado"
    assert "Cancelamento solicitado pelo cliente: Desistiu" in pedido["observacao_geral"]
    assert fake.tables["audit_log"][0]["acao"] == "cliente_solicitou_cancelamento"


@pytest.mark.parametrize("status", ["em_preparo", "pronto", "entregue", "cancelado"])
def test_customer_cannot_cancel_late_or_finished_order(monkeypatch, status):
    fake = make_order_cancel_db(status)
    monkeypatch.setattr(main, "sb", fake)

    with pytest.raises(HTTPException) as exc:
        main.cancelar_pedido_cliente_publico("rest-a", "sess-1", "pedido-1", mesa_id="mesa-1")

    assert exc.value.status_code == 409
    assert fake.tables["pedidos"][0]["status"] == status
