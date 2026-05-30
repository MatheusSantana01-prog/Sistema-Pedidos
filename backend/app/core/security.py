from __future__ import annotations

from datetime import datetime, timedelta

import bcrypt
import jwt as pyjwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

bearer = HTTPBearer(auto_error=False)


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
    payload = {
        "sub": str(usuario["id"]),
        "email": usuario["email"],
        "nome": usuario["nome"],
        "perfil": usuario.get("perfil", "funcionario"),
        "restaurant_id": restaurant_id,
        "role": role,
        "is_super_admin": usuario.get("is_super_admin", False),
        "exp": datetime.utcnow() + timedelta(hours=expires_hours),
        "iat": datetime.utcnow(),
    }
    return pyjwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def verificar_token(cred: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not cred:
        raise HTTPException(401, "Token não fornecido")
    try:
        return pyjwt.decode(cred.credentials, settings.jwt_secret, algorithms=["HS256"])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirado")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")


def authorize(roles: list[str], require_restaurant: bool = True):
    allowed_roles = set(roles)

    def _check(u: dict = Depends(verificar_token)):
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
