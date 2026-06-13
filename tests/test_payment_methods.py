import pytest
from fastapi import HTTPException

import main
from tests.test_inventory_smoke import FakeSupabase


def make_payment_db():
    return FakeSupabase({
        "restaurant_payment_methods": [
            {
                "id": "pm-cash",
                "restaurant_id": "rest-a",
                "name": "Dinheiro",
                "code": "dinheiro",
                "type": "cash",
                "is_active": True,
                "allow_change": True,
                "requires_reference": False,
                "sort_order": 10,
            },
            {
                "id": "pm-sodexo",
                "restaurant_id": "rest-a",
                "name": "Sodexo",
                "code": "sodexo",
                "type": "meal_voucher",
                "is_active": True,
                "allow_change": False,
                "requires_reference": True,
                "sort_order": 50,
            },
            {
                "id": "pm-vr-b",
                "restaurant_id": "rest-b",
                "name": "VR B",
                "code": "vr",
                "type": "meal_voucher",
                "is_active": True,
                "allow_change": False,
                "requires_reference": False,
                "sort_order": 50,
            },
            {
                "id": "pm-old",
                "restaurant_id": "rest-a",
                "name": "Antigo",
                "code": "antigo",
                "type": "other",
                "is_active": False,
                "allow_change": False,
                "requires_reference": False,
                "sort_order": 80,
            },
        ]
    })


def test_custom_payment_method_normalizes_with_snapshot(monkeypatch):
    monkeypatch.setattr(main, "sb", make_payment_db())
    body = main.FecharContaInput(pagamentos=[
        {"forma_pagamento": "sodexo", "valor": 50, "referencia": "NSU-123"}
    ])

    forma_db, resumo = main._normalizar_pagamentos(body, 50, "rest-a")

    assert forma_db == "sodexo"
    assert resumo["por_forma"] == {"sodexo": 50.0}
    assert resumo["por_forma_nome"] == {"Sodexo": 50.0}
    assert resumo["pagamentos"][0]["payment_method_name_snapshot"] == "Sodexo"
    assert resumo["pagamentos"][0]["payment_method_type_snapshot"] == "meal_voucher"


def test_custom_payment_method_requires_reference(monkeypatch):
    monkeypatch.setattr(main, "sb", make_payment_db())
    body = main.FecharContaInput(pagamentos=[
        {"forma_pagamento": "sodexo", "valor": 50}
    ])

    with pytest.raises(HTTPException) as exc:
        main._normalizar_pagamentos(body, 50, "rest-a")

    assert exc.value.status_code == 400
    assert "referência" in exc.value.detail


def test_inactive_payment_method_is_rejected_for_new_payment(monkeypatch):
    monkeypatch.setattr(main, "sb", make_payment_db())
    body = main.FecharContaInput(pagamentos=[
        {"forma_pagamento": "antigo", "valor": 20}
    ])

    with pytest.raises(HTTPException) as exc:
        main._normalizar_pagamentos(body, 20, "rest-a")

    assert exc.value.status_code == 400
    assert "inativa" in exc.value.detail


def test_payment_methods_are_isolated_by_restaurant(monkeypatch):
    monkeypatch.setattr(main, "sb", make_payment_db())
    body = main.FecharContaInput(pagamentos=[
        {"forma_pagamento": "vr", "valor": 20}
    ])

    with pytest.raises(HTTPException):
        main._normalizar_pagamentos(body, 20, "rest-a")

    _, resumo = main._normalizar_pagamentos(body, 20, "rest-b")
    assert resumo["por_forma"] == {"vr": 20.0}


def test_legacy_payment_fallback_still_works_without_restaurant_context():
    body = main.FecharContaInput(pagamentos=[
        {"forma_pagamento": "dinheiro", "valor": 7.90, "valor_recebido": 200}
    ])

    forma_db, resumo = main._normalizar_pagamentos(body, 7.90)

    assert forma_db == "dinheiro"
    assert resumo["pagamentos"][0]["troco"] == 192.10


def test_cash_shift_expected_cash_uses_custom_cash_snapshot():
    shift = {
        "payments_by_method": {"dinheiro": 10},
        "account_closures": [
            {"pagamentos": [
                {"forma_pagamento": "dinheiro", "valor": 10},
                {"forma_pagamento": "cash_local", "payment_method_type_snapshot": "cash", "valor": 15},
                {"forma_pagamento": "pix", "payment_method_type_snapshot": "pix", "valor": 20},
            ]}
        ],
    }

    assert main.total_dinheiro_turno(shift) == 25
