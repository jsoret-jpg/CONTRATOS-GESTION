import { AlertCircle, Check, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { rolesService } from "../../services/roles.service";
import { usersService } from "../../services/users.service";
import type { CurrentUser } from "../../types/auth";
import type { Role } from "../../types/role";

interface FormState {
  id: number | null;
  username: string;
  email: string;
  full_name: string;
  role_id: number | null;
  is_active: boolean;
  password: string;
}

const emptyForm: FormState = {
  id: null,
  username: "",
  email: "",
  full_name: "",
  role_id: null,
  is_active: true,
  password: "",
};

export default function Users() {
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [u, r] = await Promise.all([usersService.list(), rolesService.list()]);
    setUsers(u);
    setRoles(r);
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  function roleName(roleId: number) {
    return roles.find((r) => r.id === roleId)?.name ?? "—";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.role_id) {
      setError("Selecciona un rol");
      return;
    }
    try {
      if (form.id) {
        await usersService.update(form.id, {
          email: form.email,
          full_name: form.full_name,
          role_id: form.role_id,
          is_active: form.is_active,
          ...(form.password ? { password: form.password } : {}),
        });
      } else {
        await usersService.create({
          username: form.username,
          email: form.email,
          full_name: form.full_name,
          role_id: form.role_id,
          is_active: form.is_active,
          password: form.password,
        });
      }
      setForm(emptyForm);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Ocurrió un error al guardar el usuario");
    }
  }

  function edit(user: CurrentUser) {
    setForm({
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role_id: user.role_id,
      is_active: user.is_active,
      password: "",
    });
  }

  async function remove(id: number) {
    if (!confirm("¿Eliminar este usuario? Esta acción no se puede deshacer.")) return;
    try {
      await usersService.remove(id);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(detail ?? "No se pudo eliminar el usuario");
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <UserPlus size={22} color="var(--color-primary)" />
        Usuarios
      </h1>

      <form
        onSubmit={handleSubmit}
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 14,
          maxWidth: 560,
          marginBottom: 24,
        }}
      >
        <div className="field">
          <label>Usuario</label>
          <input
            value={form.username}
            disabled={!!form.id}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Correo</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Nombre completo</label>
          <input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Rol</label>
          <select
            value={form.role_id ?? ""}
            onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}
            required
          >
            <option value="" disabled>
              Selecciona...
            </option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{form.id ? "Nueva contraseña (opcional)" : "Contraseña"}</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!form.id}
            minLength={8}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 20 }}>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            style={{ width: "auto" }}
          />
          <label>Activo</label>
        </div>
        {error && (
          <div className="alert alert-error" style={{ gridColumn: "span 2" }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}
        <div style={{ gridColumn: "span 2", display: "flex", gap: 8 }}>
          <button type="submit" className="btn btn-primary">
            <Check size={16} />
            {form.id ? "Guardar cambios" : "Crear usuario"}
          </button>
          {form.id && (
            <button type="button" className="btn btn-secondary" onClick={() => setForm(emptyForm)}>
              <X size={16} />
              Cancelar
            </button>
          )}
        </div>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Rol</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.full_name}</td>
              <td>{u.email}</td>
              <td>{roleName(u.role_id)}</td>
              <td>
                <span className={`badge ${u.is_active ? "badge-success" : "badge-danger"}`}>
                  {u.is_active ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button className="btn-link" onClick={() => edit(u)}>
                  <Pencil size={14} />
                  Editar
                </button>
                <button className="btn-danger-link" onClick={() => remove(u.id)}>
                  <Trash2 size={14} />
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
