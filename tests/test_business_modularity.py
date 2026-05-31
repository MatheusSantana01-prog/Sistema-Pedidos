from pathlib import Path

import main


def test_business_type_normalization_and_visibility():
    assert main.normalize_business_type("delivery") == "delivery_only"
    assert main.normalize_business_type("PIZZARIA") == "pizzaria"
    assert main.business_type_visible_tabs("delivery_only")
    assert "mesas" not in main.business_type_visible_tabs("delivery_only")
    assert "cardapio" in main.business_type_visible_tabs("delivery_only")


def test_business_modules_follow_profile_and_plan_limits():
    control = {
        "business_type": "pizzaria",
        "modules": {},
        "limits": {},
    }
    updated = main.aplicar_limites_plano(control, "starter", force=True)

    assert updated["business_type"] == "pizzaria"
    assert updated["segment"] == "pizzaria"
    assert updated["modules_config"]["pizza_meio_a_meio"] is True
    assert updated["modules"]["pizza_meio_a_meio"] is True
    assert updated["modules"]["cozinha"] is True
    assert updated["modules"]["mesas"] is True


def test_enrich_restaurant_contract_includes_business_contract():
    restaurant = {"id": "rest-1", "plan": "pro", "slug": "alpha", "name": "Alpha"}
    control = {"business_type": "padaria", "modules": {"venda_peso": True}, "segment": "padaria"}

    enriched = main.enrich_restaurant_business_contract(restaurant, control)

    assert enriched["business_type"] == "padaria"
    assert enriched["modules_config"]["venda_peso"] is True
    assert "mesas" not in enriched["visible_tabs"]
    assert enriched["modules"]["venda_peso"] is True
    assert control["business_type"] == "padaria"


def test_business_schema_file_is_present_and_mentions_required_columns():
    sql = Path("backend/supabase_business_type_schema.sql").read_text(encoding="utf-8").lower()
    assert "business_type" in sql
    assert "modules_config" in sql
    assert "public.restaurants" in sql


def test_frontend_business_type_controls_exist():
    super_admin_js = Path("frontend/super-admin/app.js").read_text(encoding="utf-8")
    super_admin_html = Path("frontend/super-admin/index.html").read_text(encoding="utf-8")
    admin_js = Path("frontend/r/admin/app.js").read_text(encoding="utf-8")
    admin_html = Path("frontend/r/admin/index.html").read_text(encoding="utf-8")

    assert "BUSINESS_TYPE_OPTIONS" in super_admin_js
    assert "ctrl-business-type" in super_admin_js
    assert "r-business-type" in super_admin_html
    assert "data-tab=\"mesas\"" in admin_html
    assert "applyBusinessVisibility" in admin_js
