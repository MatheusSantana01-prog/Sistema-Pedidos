import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
from pydantic import ValidationError

import main
from backend.app.core import security
from tests.test_inventory_smoke import FakeSupabase


@pytest.fixture
def auth_db(monkeypatch):
    db = FakeSupabase({
        "usuarios": [{"id": "user-1", "nome": "Owner", "email": "owner@example.com", "ativo": True, "senha_hash": "hash-before"}],
        "restaurants": [{"id": "restaurant-a", "is_active": True}],
        "restaurant_memberships": [{"usuario_id": "user-1", "restaurant_id": "restaurant-a", "role": "owner", "is_active": True}],
        "platform_admins": [],
    })
    monkeypatch.setattr(security, "sb", db)
    monkeypatch.setattr(main, "sb", db)
    return db


def credentials(db, **kwargs):
    token = security.criar_token(db.tables["usuarios"][0], "restaurant-a", "owner", **kwargs)
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_valid_session_retains_tenant(auth_db):
    assert security.verificar_token(credentials(auth_db))["restaurant_id"] == "restaurant-a"


@pytest.mark.parametrize("change", ["disabled", "removed", "password", "membership", "role", "restaurant"])
def test_existing_session_is_revoked(auth_db, change):
    cred = credentials(auth_db)
    if change == "disabled":
        auth_db.tables["usuarios"][0]["ativo"] = False
    elif change == "removed":
        auth_db.tables["usuarios"] = []
    elif change == "password":
        auth_db.tables["usuarios"][0]["senha_hash"] = "hash-after"
    elif change == "membership":
        auth_db.tables["restaurant_memberships"][0]["is_active"] = False
    elif change == "role":
        auth_db.tables["restaurant_memberships"][0]["role"] = "waiter"
    else:
        auth_db.tables["restaurants"][0]["is_active"] = False
    with pytest.raises(HTTPException) as exc:
        security.verificar_token(cred)
    assert exc.value.status_code == (403 if change == "restaurant" else 401)


def test_revoked_platform_admin_cannot_use_old_token(auth_db):
    auth_db.tables["usuarios"][0]["is_super_admin"] = True
    with pytest.raises(HTTPException) as exc:
        security.verificar_token(credentials(auth_db))
    assert exc.value.status_code == 401


def test_legacy_token_requires_new_login(auth_db):
    cred = credentials(auth_db)
    payload = jwt.decode(cred.credentials, security.settings.jwt_secret, algorithms=["HS256"])
    del payload["pwdv"]
    cred.credentials = jwt.encode(payload, security.settings.jwt_secret, algorithm="HS256")
    with pytest.raises(HTTPException) as exc:
        security.verificar_token(cred)
    assert exc.value.status_code == 401


def test_api_enforces_live_permissions(auth_db):
    cred = credentials(auth_db)
    auth_db.tables["restaurant_memberships"][0]["role"] = "kitchen"
    response = TestClient(main.app).get("/api/admin/users", headers={"Authorization": f"Bearer {cred.credentials}"})
    assert response.status_code == 401


def test_database_failure_does_not_grant_access(auth_db, monkeypatch):
    def unavailable(*args):
        raise RuntimeError("offline")
    cred = credentials(auth_db)
    monkeypatch.setattr(auth_db, "table", unavailable)
    with pytest.raises(HTTPException) as exc:
        security.verificar_token(cred)
    assert exc.value.status_code == 503


def test_owner_cannot_manage_unrelated_or_platform_account(auth_db):
    with pytest.raises(HTTPException):
        main.validar_gestao_conta_restaurante("restaurant-b", "user-1")
    auth_db.tables["platform_admins"] = [{"id": "admin-1", "usuario_id": "user-1"}]
    with pytest.raises(HTTPException):
        main.validar_gestao_conta_restaurante("restaurant-a", "user-1")


def test_shared_password_cannot_be_reset_by_one_restaurant(auth_db):
    auth_db.tables["restaurant_memberships"].append({"usuario_id": "user-1", "restaurant_id": "restaurant-b", "is_active": False})
    with pytest.raises(HTTPException):
        main.validar_gestao_conta_restaurante("restaurant-a", "user-1")


def test_local_account_can_be_managed(auth_db):
    main.validar_gestao_conta_restaurante("restaurant-a", "user-1")


@pytest.mark.parametrize("password", ["admin123", "123456789012", "a" * 20, "x" * 73, "\u00e9" * 40])
def test_weak_or_oversized_password_rejected(password):
    with pytest.raises(ValidationError):
        main.ResetSenhaInput(senha=password)


def test_long_passphrase_accepted():
    assert main.ResetSenhaInput(senha="Cafe com mesas 2026!").senha == "Cafe com mesas 2026!"


def test_platform_role_cannot_be_assigned_as_restaurant_role():
    with pytest.raises(ValidationError):
        main.CriarUsuarioInput(nome="Test", email="test@example.com", senha="Cafe com mesas 2026!", role="super_admin")


def test_weak_password_session_cannot_operate_even_as_super_admin():
    session = {"password_change_required": True, "is_super_admin": True}
    for guard in [security.authorize(["owner"]), main.require_super_admin]:
        with pytest.raises(HTTPException) as exc:
            guard(session)
        assert exc.value.status_code == 403


def test_password_fingerprint_never_contains_password_hash(auth_db):
    token = credentials(auth_db).credentials
    payload = jwt.decode(token, security.settings.jwt_secret, algorithms=["HS256"])
    assert "hash-before" not in str(payload)
    assert "senha_hash" not in payload
