import { Check, Save, Shield } from "lucide-react";
import { useEffect, useState } from "react";

import { rolesService } from "../../services/roles.service";
import type { ModuleItem, PermissionItem, Role, RoleModulePermission } from "../../types/role";

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([rolesService.list(), rolesService.modules(), rolesService.permissionsCatalog()]).then(
      ([r, m, p]) => {
        setRoles(r);
        setModules(m);
        setPermissions(p);
        if (r.length) setSelectedRole(r[0].id);
      }
    );
  }, []);

  useEffect(() => {
    if (selectedRole == null) return;
    setMessage(null);
    rolesService.getRolePermissions(selectedRole).then((rows) => {
      setGranted(new Set(rows.map((row) => `${row.module_code}:${row.permission_code}`)));
    });
  }, [selectedRole]);

  function toggle(moduleCode: string, permissionCode: string) {
    const key = `${moduleCode}:${permissionCode}`;
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (selectedRole == null) return;
    setSaving(true);
    setMessage(null);
    const payload: RoleModulePermission[] = Array.from(granted).map((key) => {
      const [module_code, permission_code] = key.split(":");
      return { module_code, permission_code };
    });
    await rolesService.updateRolePermissions(selectedRole, payload);
    setSaving(false);
    setMessage("Permisos guardados correctamente");
  }

  return (
    <div>
      <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Shield size={22} color="var(--color-primary)" />
        Roles y permisos
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>
        Marca o desmarca las casillas y guarda para actualizar los permisos reales de este rol.
      </p>

      <div className="field" style={{ maxWidth: 260, marginBottom: 16 }}>
        <label>Rol</label>
        <select value={selectedRole ?? ""} onChange={(e) => setSelectedRole(Number(e.target.value))}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Módulo</th>
              {permissions.map((p) => (
                <th key={p.id} style={{ textAlign: "center" }}>
                  {p.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                {permissions.map((p) => (
                  <td key={p.id} style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      style={{ width: "auto" }}
                      checked={granted.has(`${m.code}:${p.code}`)}
                      onChange={() => toggle(m.code, p.code)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} disabled={saving} className="btn btn-primary">
          <Save size={16} />
          {saving ? "Guardando..." : "Guardar permisos"}
        </button>
        {message && (
          <span style={{ color: "var(--color-success)", fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
            <Check size={14} />
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
