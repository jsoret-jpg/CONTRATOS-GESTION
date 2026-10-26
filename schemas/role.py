from pydantic import BaseModel, ConfigDict


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ModuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str


class RoleModulePermissionOut(BaseModel):
    module_code: str
    permission_code: str


class PermissionAssignment(BaseModel):
    module_code: str
    permission_code: str


class RolePermissionsUpdate(BaseModel):
    permissions: list[PermissionAssignment]
