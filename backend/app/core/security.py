from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import hashlib
import hmac
import jwt as pyjwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .database import sb

bearer = HTTPBearer(auto_error=False)


def password_version(password_hash: str) -> str:
    # A keyed fingerprint revokes sessions after a password change without exposing the hash.
    return hmac.new(settings.jwt_secret.encode(), password_hash.encode(), hashlib.sha256).hexdigest()


def validate_new_password(value: str) -> str:
    value = value.strip()
    if len(value) < 12 or len(value.encode()) > 72:
        raise ValueError("Use uma senha com pelo menos 12 caracteres e no maximo 72 bytes")
    if len(set(value.lower())) < 5 or value.lower() in {"admin12345678", "123456789012", "restaurante123", "password1234"}:
        raise ValueError("Escolha uma senha menos previsivel")
    return value


def hash_senha(senha: str) -> str:
    return bcrypt.hashpw(senha.encode(), bcrypt.gensalt(12)).decode()


def verificar_senha(senha: str, hash_armazenado: str) -> bool:
    try:
        return bcrypt.checkpw(senha.encode(), hash_armazenado.encode())
    except Exception:
        return False


def criar_token(
    usuario: dict,
    restaurant_id: str | None = None,
    role: str | None = None,
    expires_hours: int = settings.jwt_exp_hours,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(usuario["id"]),
        "email": usuario["email"],
        "nome": usuario["nome"],
        "perfil": usuario.get("perfil", "funcionario"),
        "restaurant_id": restaurant_id,
        "role": role,
        "is_super_admin": usuario.get("is_super_admin", False),
        "exp": now + timedelta(hours=expires_hours),
        "iat": now,
        "pwdv": password_version(usuario.get("senha_hash", "")),
        "password_change_required": usuario.get("password_change_required", False),
    }
    return pyjwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def verificar_token(cred: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not cred:
        raise HTTPException(401, "Token não fornecido")
    try:
        payload = pyjwt.decode(
            cred.credentials, settings.jwt_secret, algorithms=["HS256"],
            options={"require": ["sub", "exp", "iat", "pwdv"]},
        )
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirado")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")

    try:
        users = sb.table("usuarios").select("id,nome,email,ativo,senha_hash").eq("id", payload["sub"]).limit(1).execute().data
        user = users[0] if users else None
        if not user or not user.get("ativo"):
            raise HTTPException(401, "Conta desativada ou removida")
        if not isinstance(payload.get("pwdv"), str) or not hmac.compare_digest(payload["pwdv"], password_version(user.get("senha_hash", ""))):
            raise HTTPException(401, "Senha alterada. Entre novamente")
        if payload.get("is_super_admin"):
            admins = sb.table("platform_admins").select("id").eq("usuario_id", user["id"]).limit(1).execute().data
            if not admins:
                raise HTTPException(401, "Acesso de administrador revogado")
        rid = payload.get("restaurant_id")
        if rid:
            restaurants = sb.table("restaurants").select("id,is_active").eq("id", rid).limit(1).execute().data
            if not restaurants or (not restaurants[0].get("is_active") and not payload.get("is_super_admin")):
                raise HTTPException(403, "Restaurante desativado")
            if not payload.get("is_super_admin"):
                memberships = sb.table("restaurant_memberships").select("role").eq("usuario_id", user["id"]).eq("restaurant_id", rid).eq("is_active", True).limit(1).execute().data
                if not memberships or memberships[0].get("role") != payload.get("role"):
                    raise HTTPException(401, "Permissoes alteradas. Entre novamente")
        elif not payload.get("is_super_admin"):
            raise HTTPException(401, "Usuario sem restaurante vinculado")
        payload.update(nome=user["nome"], email=user["email"])
        return payload
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Nao foi possivel validar o acesso. Tente novamente")


def authorize(roles: list[str], require_restaurant: bool = True):
    allowed_roles = set(roles)

    def _check(u: dict = Depends(verificar_token)):
        if u.get("password_change_required"):
            raise HTTPException(403, "Altere sua senha para continuar")
        if u.get("is_super_admin"):
            return u

        role = u.get("role", "")
        if role not in allowed_roles:
            raise HTTPException(403, f"Sem permissão. Requer: {roles}. Seu papel: {role}")
        if require_restaurant and not u.get("restaurant_id"):
            raise HTTPException(403, "Usuário não vinculado a nenhum restaurante")
        return u

    return _check


def get_restaurant_id_from_token(u: dict) -> str:
    rid = u.get("restaurant_id")
    if not rid:
        raise HTTPException(403, "restaurant_id não encontrado no token")
    return rid
