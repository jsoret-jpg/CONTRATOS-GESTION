import { AlertCircle, Building2, KeyRound, LogIn, User } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch {
      setError("Usuario o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <form onSubmit={handleSubmit} className="auth-card">
        <h1>
          <Building2 size={22} color="var(--color-primary)" />
          Control de Gestión
        </h1>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Usuario</label>
          <div style={{ position: "relative" }}>
            <User
              size={16}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }}
            />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{ paddingLeft: 32, width: "100%" }}
            />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Contraseña</label>
          <div style={{ position: "relative" }}>
            <KeyRound
              size={16}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ paddingLeft: 32, width: "100%" }}
            />
          </div>
        </div>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}
        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
          <LogIn size={16} />
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
