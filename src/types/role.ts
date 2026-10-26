export interface Role {
  id: number;
  name: string;
}

export interface ModuleItem {
  id: number;
  code: string;
  name: string;
}

export interface PermissionItem {
  id: number;
  code: string;
}

export interface RoleModulePermission {
  module_code: string;
  permission_code: string;
}
