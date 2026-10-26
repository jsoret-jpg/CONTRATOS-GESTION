from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_permission
from models.module import Module
from models.permission import Permission
from models.role import Role
from models.role_module_permission import RoleModulePermission
from schemas.role import ModuleOut, PermissionOut, RoleModulePermissionOut, RoleOut, RolePermissionsUpdate

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=list[RoleOut], dependencies=[Depends(require_permission("rol", "view"))])
def list_roles(db: Session = Depends(get_db)):
    return db.scalars(select(Role).order_by(Role.name)).all()


@router.get(
    "/modules", response_model=list[ModuleOut], dependencies=[Depends(require_permission("rol", "view"))]
)
def list_modules(db: Session = Depends(get_db)):
    return db.scalars(select(Module).order_by(Module.name)).all()


@router.get(
    "/permissions-catalog",
    response_model=list[PermissionOut],
    dependencies=[Depends(require_permission("rol", "view"))],
)
def list_permissions(db: Session = Depends(get_db)):
    return db.scalars(select(Permission).order_by(Permission.id)).all()


@router.get(
    "/{role_id}/permissions",
    response_model=list[RoleModulePermissionOut],
    dependencies=[Depends(require_permission("rol", "view"))],
)
def get_role_permissions(role_id: int, db: Session = Depends(get_db)):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    stmt = (
        select(Module.code, Permission.code)
        .select_from(RoleModulePermission)
        .join(Module, Module.id == RoleModulePermission.module_id)
        .join(Permission, Permission.id == RoleModulePermission.permission_id)
        .where(RoleModulePermission.role_id == role_id)
    )
    rows = db.execute(stmt).all()
    return [RoleModulePermissionOut(module_code=m, permission_code=p) for m, p in rows]


@router.put(
    "/{role_id}/permissions",
    response_model=list[RoleModulePermissionOut],
    dependencies=[Depends(require_permission("rol", "edit"))],
)
def update_role_permissions(role_id: int, payload: RolePermissionsUpdate, db: Session = Depends(get_db)):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    modules = {m.code: m.id for m in db.scalars(select(Module))}
    permissions = {p.code: p.id for p in db.scalars(select(Permission))}

    for item in payload.permissions:
        if item.module_code not in modules or item.permission_code not in permissions:
            raise HTTPException(
                status_code=400,
                detail=f"Módulo o permiso inválido: {item.module_code}/{item.permission_code}",
            )

    db.execute(delete(RoleModulePermission).where(RoleModulePermission.role_id == role_id))
    db.add_all(
        [
            RoleModulePermission(
                role_id=role_id,
                module_id=modules[item.module_code],
                permission_id=permissions[item.permission_code],
            )
            for item in payload.permissions
        ]
    )
    db.commit()

    return get_role_permissions(role_id, db)
