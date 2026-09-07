import pytest
from fastapi import HTTPException

import main


@pytest.fixture
def checkout(monkeypatch):
    calls = []
    monkeypatch.setattr(main, "enforce_modules_enabled", lambda *a: None)
    monkeypatch.setattr(main, "enforce_platform_control", lambda *a: None)
    monkeypatch.setattr(main, "buscar_mesa_do_restaurante", lambda *a: {"id": "table-1", "numero": 1})
    monkeypatch.setattr(main, "buscar_sessao_aberta_mesa", lambda *a: {"id": "session-1", "total_consumido": 999})
    monkeypatch.setattr(main, "count_pedidos_abertos_sessao", lambda *a: 0)
    monkeypatch.setattr(main, "listar_pedidos_fechamento", lambda *a: [{"id": "order-1", "total": 30}])
    monkeypatch.setattr(main, "turno_aberto_por_id", lambda *a: {"id": "shift-1", "opened_by": "cashier-1"})
    monkeypatch.setattr(main, "get_fiscal_config", lambda *a: {"enabled": False})
    monkeypatch.setattr(main, "log_acao", lambda *a: None)
    monkeypatch.setattr(main, "payment_method_by_code", lambda rid, code: {"code": code, "name": code, "is_active": True, "type": "cash" if code == "dinheiro" else "pix"})
    def rpc(name, params):
        calls.append((name, params))
        return {"total": 30, "cash_shift": {"sales_total": 30}}
    monkeypatch.setattr(main, "financial_rpc", rpc)
    return calls


def user():
    return {"sub": "cashier-1", "role": "cashier", "restaurant_id": "rest-a", "nome": "Cashier"}


def body(**kwargs):
    return main.FecharContaInput(cash_shift_id="shift-1", pagamentos=[{"forma_pagamento": "pix", "valor": 10}, {"forma_pagamento": "dinheiro", "valor": 20}], **kwargs)


def test_checkout_uses_one_atomic_write_and_live_order_total(checkout):
    response = main.fechar_conta_mesa("table-1", body(), None, user())
    assert response["total"] == 30
    assert len(checkout) == 1
    name, params = checkout[0]
    assert name == "checkout_table_atomic"
    assert params["p_expected_total"] == 30
    assert params["p_restaurant_id"] == "rest-a"
    assert params["p_cashier_id"] == "cashier-1"
    assert params["p_closure"]["payments_by_method"] == {"pix": 10, "dinheiro": 20}


def test_cashier_must_open_shift(checkout):
    with pytest.raises(HTTPException) as exc:
        main.fechar_conta_mesa("table-1", main.FecharContaInput(forma_pagamento="pix"), None, user())
    assert exc.value.status_code == 409
    assert checkout == []


def test_open_order_blocks_all_checkout_writes(checkout, monkeypatch):
    monkeypatch.setattr(main, "count_pedidos_abertos_sessao", lambda *a: 1)
    with pytest.raises(HTTPException) as exc:
        main.fechar_conta_mesa("table-1", body(), None, user())
    assert exc.value.status_code == 409
    assert checkout == []


def test_atomic_conflict_is_not_reported_as_success(checkout, monkeypatch):
    def conflict(*a):
        raise HTTPException(409, "Concurrent close")
    monkeypatch.setattr(main, "financial_rpc", conflict)
    with pytest.raises(HTTPException) as exc:
        main.fechar_conta_mesa("table-1", body(), None, user())
    assert exc.value.status_code == 409


@pytest.mark.parametrize("amount", ["nan", "inf", "-inf"])
def test_nonfinite_payment_rejected(amount):
    with pytest.raises(HTTPException):
        main._normalizar_pagamentos(main.FecharContaInput(pagamentos=[{"forma_pagamento": "pix", "valor": amount}]), 30)


def test_one_cent_difference_is_rejected():
    with pytest.raises(HTTPException):
        main._normalizar_pagamentos(main.FecharContaInput(pagamentos=[{"forma_pagamento": "pix", "valor": 29.99}]), 30)


def test_split_payments_preserve_every_cent_across_orders():
    allocated = main.alocar_pagamentos_pedidos(
        [{"id": "order-1", "total": 15.90}, {"id": "order-2", "total": 15.90}],
        {"pagamentos": [{"forma_pagamento": "pix", "valor": 20}, {"forma_pagamento": "dinheiro", "valor": 11.80}]},
    )
    totals = {}
    for order in allocated:
        assert round(sum(p["valor"] for p in order["payments"]), 2) == 15.90
        for payment in order["payments"]:
            totals[payment["forma_pagamento"]] = round(totals.get(payment["forma_pagamento"], 0) + payment["valor"], 2)
    assert totals == {"pix": 20, "dinheiro": 11.80}
