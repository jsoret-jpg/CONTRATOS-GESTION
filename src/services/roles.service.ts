import { api } from "./api";
import type { ModuleItem, PermissionItem, Role, RoleModulePermission } from "../types/role";

export const rolesService = {
  list: () => api.get<Role[]>("/roles").then((r) => r.data),
  modules: () => api.get<ModuleItem[]>("/roles/modules").then((r) => r.data),
  permissionsCatalog: () => api.get<PermissionItem[]>("/roles/permissions-catalog").then((r) => r.data),
  getRolePermissions: (roleId: number) =>
    api.get<RoleModulePermission[]>(`/roles/${roleId}/permissions`).then((r) => r.data),
  updateRolePermissions: (roleId: number, permissions: RoleModulePermission[]) =>
    api.put<RoleModulePermission[]>(`/roles/${roleId}/permissions`, { permissions }).then((r) => r.data),
};
