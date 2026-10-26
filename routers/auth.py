from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models.module import Module
from models.permission import Permission
from models.role_module_permission import RoleModulePermission
from models.user import User
from schemas.auth import RefreshRequest, TokenResponse
from schemas.user import UserOut
from security import create_access_token, create_refresh_token, decode_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == form_data.username))
    if not user or not user.is_active or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
        )

    user.last_login = datetime.now(timezone.utc)
    db.commit()

    return TokenResponse(
        access_token=create_access_token(user.username),
        refresh_token=create_refresh_token(user.username),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise ValueError("token no es de tipo refresh")
        username = data["sub"]
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido")

    user = db.scalar(select(User).where(User.username == username))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no válido")

    return TokenResponse(
        access_token=create_access_token(user.username),
        refresh_token=create_refresh_token(user.username),
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/permissions", response_model=list[str])
def my_permissions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Devuelve los permisos reales del rol actual como strings 'modulo:accion',
    para que el frontend pueda mostrar/ocultar botones sin adivinar."""
    stmt = (
        select(Module.code, Permission.code)
        .select_from(RoleModulePermission)
        .join(Module, Module.id == RoleModulePermission.module_id)
        .join(Permission, Permission.id == RoleModulePermission.permission_id)
        .where(RoleModulePermission.role_id == current_user.role_id)
    )
    rows = db.execute(stmt).all()
    return [f"{module_code}:{permission_code}" for module_code, permission_code in rows]
