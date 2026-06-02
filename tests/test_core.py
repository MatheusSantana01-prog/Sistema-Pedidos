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
    assert main.PLAN_LIMITS["starter"] == {"users": 5, "tables": 10, "products": 100}
    assert main.CASH_REGISTER_LIMITS["starter"] == 2
    assert main.CASH_REGISTER_LIMITS["pro"] >= 2
    assert main.PLAN_BASE_PRICES == {"starter": 79, "pro": 149, "enterprise": 249}


def test_cash_denominations_summary():
    resumo = main.caixa_resumo_dinheiro({"100": 1, "20": 2, "10": 1})

    assert resumo["total"] == 150.0
    assert resumo["denominations"]["100"] == 1


def test_inventory_movement_delta_rules():
    assert main._inventory_delta("entrada", 10) == 10
    assert main._inventory_delta("saida", 10) == -10
    assert main._inventory_delta("perda", 3) == -3
    assert main._inventory_delta("venda", 2.5) == -2.5
    assert main._inventory_delta("estorno", 2.5) == 2.5
    assert main._inventory_delta("ajuste", -4) == -4


def test_inventory_alert_status():
    assert main.calcular_estoque_alerta({"current_quantity": 0, "minimum_quantity": 5}) == "zerado"
    assert main.calcular_estoque_alerta({"current_quantity": 3, "minimum_quantity": 5}) == "baixo"
    assert main.calcular_estoque_alerta({"current_quantity": 8, "minimum_quantity": 5}) == "ok"


def test_recipe_cost_and_margin_summary():
    recipe = {"yield_quantity": 2}
    items = [
        {"quantity": 1, "waste_percent": 10, "inventory_items": {"unit_cost": 20}},
        {"quantity": 2, "waste_percent": 0, "inventory_items": {"unit_cost": 5}},
    ]

    summary = main.recipe_cost_summary(recipe, items, product_price=30)

    assert summary["total_cost"] == 32.0
    assert summary["cost_per_unit"] == 16.0
    assert summary["margin_amount"] == 14.0
    assert summary["margin_percent"] == pytest.approx(46.67)


def test_inventory_inputs_validate_permissions_surface():
    with pytest.raises(ValueError):
        main.InventoryItemInput(name="x", unit="kg")

    with pytest.raises(ValueError):
        main.InventoryMovementInput(
            inventory_item_id="00000000-0000-0000-0000-000000000001",
            movement_type="invalido",
            quantity=1,
        )


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


@pytest.mark.parametrize("forma", ["dinheiro", "pix", "cartao_credito", "cartao_debito"])
def test_payment_normalization_accepts_required_cashier_methods(forma):
    body = main.FecharContaInput(pagamentos=[{"forma_pagamento": forma, "valor": 123.45}])

    forma_db, resumo = main._normalizar_pagamentos(body, 123.45)

    assert forma_db == forma
    assert resumo["total"] == 123.45
    assert resumo["por_forma"] == {forma: 123.45}


def test_cash_payment_keeps_sale_value_and_registers_change():
    body = main.FecharContaInput(pagamentos=[{"forma_pagamento": "dinheiro", "valor": 7.90, "valor_recebido": 200}])

    forma_db, resumo = main._normalizar_pagamentos(body, 7.90)

    assert forma_db == "dinheiro"
    assert resumo["por_forma"] == {"dinheiro": 7.90}
    assert resumo["pagamentos"][0]["valor"] == 7.90
    assert resumo["pagamentos"][0]["valor_recebido"] == 200
    assert resumo["pagamentos"][0]["troco"] == 192.10


def test_restaurant_business_type_allows_quick_counter_sale():
    assert main.business_type_modules("restaurante")["balcao_rapido"] is True


def test_cash_shift_updates_when_account_is_closed(monkeypatch):
    saved = {}
    shift_id = "shift-1"
    monkeypatch.setattr(
        main,
        "listar_turnos_caixa",
        lambda restaurant_id: [{
            "id": shift_id,
            "status": "open",
            "sales_total": 50,
            "transactions_count": 1,
            "payments_by_method": {"dinheiro": 50},
        }],
    )
    monkeypatch.setattr(main, "salvar_turnos_caixa", lambda restaurant_id, turnos: saved.update({"turnos": turnos}))

    turno = main.atualizar_turno_com_fechamento("restaurant-a", shift_id, {
        "total": 100,
        "payments_by_method": {"pix": 40, "cartao_debito": 60},
    })

    assert turno["sales_total"] == 150.0
    assert turno["transactions_count"] == 2
    assert turno["payments_by_method"] == {"dinheiro": 50, "pix": 40.0, "cartao_debito": 60.0}
    assert saved["turnos"][0]["account_closures"][0]["total"] == 100


def test_cash_shift_history_matches_open_or_close_date():
    target = main.parse_cash_history_date("2026-06-02")

    assert main.shift_matches_date({"opened_at": "2026-06-02T08:00:00"}, target)
    assert main.shift_matches_date({"opened_at": "2026-06-01T23:00:00", "closed_at": "2026-06-02T01:00:00"}, target)
    assert not main.shift_matches_date({"opened_at": "2026-06-01T08:00:00", "closed_at": "2026-06-01T18:00:00"}, target)


def test_kitchen_status_transition_rules():
    assert "em_preparo" in main.ORDER_TRANSITIONS["pendente"]
    assert "pronto" in main.ORDER_TRANSITIONS["em_preparo"]
    assert "entregue" in main.ORDER_TRANSITIONS["pronto"]
    assert "pendente" not in main.ORDER_TRANSITIONS["entregue"]


def test_plan_limit_blocks_when_quota_is_exceeded(monkeypatch):
    monkeypatch.setattr(
        main,
        "get_platform_control",
        lambda restaurant_id: {"limits": {"tables": 2, "users": 1, "products": 3}},
    )

    with pytest.raises(HTTPException) as exc:
        main.enforce_plan_limit("restaurant-a", "tables", current_count=2)

    assert exc.value.status_code == 403
    assert "Limite de mesas" in exc.value.detail


def test_plan_limit_allows_enterprise_high_limits(monkeypatch):
    monkeypatch.setattr(
        main,
        "get_platform_control",
        lambda restaurant_id: {"limits": {"products": 9999}},
    )

    main.enforce_plan_limit("restaurant-a", "products", current_count=9998)


def test_platform_block_modes(monkeypatch):
    monkeypatch.setattr(
        main,
        "get_platform_control",
        lambda restaurant_id: {"billing_status": "em_dia", "block_mode": "orders", "modules": {}},
    )

    with pytest.raises(HTTPException) as exc:
        main.enforce_platform_control("restaurant-a", "orders")

    assert exc.value.status_code == 403
    assert "Novos pedidos bloqueados" in exc.value.detail


def test_table_access_area_depends_on_role():
    assert main.table_access_area_for_role("waiter") == "garcom"
    assert main.table_access_area_for_role("cashier") == "financeiro"
    assert main.table_access_area_for_role("manager") == "admin"
    assert main.table_access_area_for_role("owner") == "admin"


def test_platform_admin_block_blocks_admin_area(monkeypatch):
    monkeypatch.setattr(
        main,
        "get_platform_control",
        lambda restaurant_id: {"billing_status": "em_dia", "block_mode": "admin", "modules": {}},
    )

    with pytest.raises(HTTPException) as exc:
        main.enforce_platform_control("restaurant-a", main.table_access_area_for_role("owner"))

    assert exc.value.status_code == 403
    assert "Painel administrativo bloqueado" in exc.value.detail


def test_platform_full_block_blocks_admin(monkeypatch):
    monkeypatch.setattr(
        main,
        "get_platform_control",
        lambda restaurant_id: {"billing_status": "bloqueado", "block_mode": "none", "modules": {}},
    )

    with pytest.raises(HTTPException) as exc:
        main.enforce_platform_control("restaurant-a", "admin")

    assert exc.value.status_code == 403
    assert "Restaurante bloqueado" in exc.value.detail


def test_billing_status_trial_overdue_and_blocked():
    trial = main.calcular_status_financeiro({
        "billing_status": "teste_gratis",
        "trial_until": "2999-01-01",
    })
    assert trial["billing_computed_status"] == "teste_gratis"

    overdue = main.calcular_status_financeiro({
        "billing_status": "em_dia",
        "due_date": "2000-01-01",
        "grace_alert_days": 15,
        "grace_block_days": 99999,
    })
    assert overdue["billing_status"] == "vencido"

    blocked = main.calcular_status_financeiro({
        "billing_status": "em_dia",
        "due_date": "2000-01-01",
        "grace_alert_days": 1,
        "grace_block_days": 2,
        "block_mode": "none",
    })
    assert blocked["billing_status"] == "bloqueado"
    assert blocked["block_mode"] == "admin"


def test_role_requires_plan_module(monkeypatch):
    monkeypatch.setattr(
        main,
        "get_platform_control",
        lambda restaurant_id: {"modules": {"garcom": False}},
    )

    with pytest.raises(HTTPException) as exc:
        main.validar_role_no_plano("restaurant-a", "waiter")

    assert exc.value.status_code == 403


def test_cashier_user_limit_for_starter(monkeypatch):
    monkeypatch.setattr(main, "limite_caixas_restaurante", lambda restaurant_id: 1)
    monkeypatch.setattr(main, "active_role_memberships_count", lambda restaurant_id, role: 1)

    with pytest.raises(HTTPException) as exc:
        main.enforce_cashier_user_limit("restaurant-a", "cashier")

    assert exc.value.status_code == 403
    assert "1 usuário de caixa" in exc.value.detail


def test_require_super_admin_rejects_regular_user():
    with pytest.raises(HTTPException) as exc:
        main.require_super_admin({"sub": "user-1", "is_super_admin": False})

    assert exc.value.status_code == 403
