from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
import pytest

import main


def test_health_check():
    client = TestClient(main.app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_token_keeps_restaurant_context():
    token = main.criar_token(
        {"id": "user-1", "email": "owner@example.com", "nome": "Owner"},
        restaurant_id="restaurant-a",
        role="owner",
    )

    payload = main.verificar_token(
        HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    )

    assert payload["restaurant_id"] == "restaurant-a"
    assert payload["role"] == "owner"
    assert main.get_restaurant_id_from_token(payload) == "restaurant-a"


def test_missing_restaurant_id_is_rejected():
    with pytest.raises(HTTPException) as exc:
        main.get_restaurant_id_from_token({"sub": "user-1"})

    assert exc.value.status_code == 403


def test_plan_and_cash_register_limits():
    assert main.normalize_plan("básico") == "starter"
    assert main.normalize_plan("premium") == "enterprise"
    assert main.CASH_REGISTER_LIMITS["starter"] == 1
    assert main.CASH_REGISTER_LIMITS["pro"] >= 2


def test_cash_denominations_summary():
    resumo = main.caixa_resumo_dinheiro({"100": 1, "20": 2, "10": 1})

    assert resumo["total"] == 150.0
    assert resumo["denominations"]["100"] == 1


def test_payment_normalization_for_split_payment():
    body = main.FecharContaInput(
        pagamentos=[
            {"forma_pagamento": "dinheiro", "valor": 40},
            {"forma_pagamento": "pix", "valor": 60},
        ]
    )

    forma_db, resumo = main._normalizar_pagamentos(body, 100)

    assert forma_db.startswith("misto|")
    assert resumo["por_forma"] == {"dinheiro": 40.0, "pix": 60.0}


def test_payment_normalization_rejects_wrong_total():
    body = main.FecharContaInput(pagamentos=[{"forma_pagamento": "pix", "valor": 90}])

    with pytest.raises(HTTPException) as exc:
        main._normalizar_pagamentos(body, 100)

    assert exc.value.status_code == 400


def test_kitchen_status_transition_rules():
    assert "em_preparo" in main.ORDER_TRANSITIONS["pendente"]
    assert "pronto" in main.ORDER_TRANSITIONS["em_preparo"]
    assert "entregue" in main.ORDER_TRANSITIONS["pronto"]
    assert "pendente" not in main.ORDER_TRANSITIONS["entregue"]
