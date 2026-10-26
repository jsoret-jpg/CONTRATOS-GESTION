from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.module import Module
from app.models.permission import Permission
from app.models.role_module_permission import RoleModulePermission
from app.models.user import User
from app.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar la credencial",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exception
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.scalar(select(User).where(User.username == username))
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_permission(module_code: str, permission_code: str):
    """Factory de dependencia: exige que el rol del usuario actual tenga
    el permiso `permission_code` sobre el módulo `module_code` en la tabla
    role_module_permissions. Se usa como Depends() en cada router."""

    def checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        stmt = (
            select(RoleModulePermission.id)
            .join(Module, Module.id == RoleModulePermission.module_id)
            .join(Permission, Permission.id == RoleModulePermission.permission_id)
            .where(
                RoleModulePermission.role_id == current_user.role_id,
                Module.code == module_code,
                Permission.code == permission_code,
            )
        )
        if db.scalar(stmt) is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No tienes permiso '{permission_code}' en el módulo '{module_code}'",
            )
        return current_user

    return checker
