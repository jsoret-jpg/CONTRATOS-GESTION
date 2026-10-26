import { AlertCircle, CheckCheck, Eye, Mail, Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { usePermissions } from "../../hooks/usePermissions";
import { notificationsService } from "../../services/notifications.service";
import { TIPO_LABELS, type Notification, type NotificationRecipient } from "../../types/notification";
import { resolveNotificationLink } from "../../utils/notificationLink";

export default function AlertasList() {
  const { can } = usePermissions();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [modulo, setModulo] = useState("");
  const [loading, setLoading] = useState(true);

  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function reload() {
    const data = await notificationsService.list(modulo || undefined);
    setNotifications(data);
  }

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulo]);

  useEffect(() => {
    if (can("alerta", "edit")) {
      notificationsService.recipients.list().then(setRecipients);
    }
  }, [can]);

  async function handleRowClick(notification: Notification) {
    await notificationsService.markRead(notification.id);
    await reload();
    navigate(resolveNotificationLink(notification));
  }

  async function handleMarkAllRead() {
    await notificationsService.markAllRead();
    await reload();
  }

  async function handleAddRecipient(e: FormEvent) {
    e.preventDefault();
    setRecipientError(null);
    try {
      await notificationsService.recipients.create(newEmail);
      setNewEmail("");
      const data = await notificationsService.recipients.list();
      setRecipients(data);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setRecipientError(detail ?? "No se pudo agregar el destinatario");
    }
  }

  async function handleRemoveRecipient(id: number) {
    await notificationsService.recipients.remove(id);
    const data = await notificationsService.recipients.list();
    setRecipients(data);
  }

  async function handleSendEmail() {
    setSending(true);
    setEmailStatus(null);
    try {
      const result = await notificationsService.sendDigestEmail();
      setEmailStatus(result.mensaje);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h1>Alertas</h1>

      <div className="toolbar">
        <select value={modulo} onChange={(e) => setModulo(e.target.value)}>
          <option value="">Todos los módulos</option>
          <option value="contrato">Contratos</option>
          <option value="factura">Facturas</option>
          <option value="solped">SOLPEDs</option>
          <option value="pago_mensual">Pagos mensuales</option>
          <option value="presupuesto">Presupuesto</option>
        </select>
        <button className="btn btn-secondary" onClick={handleMarkAllRead}>
          <CheckCheck size={16} />
          Marcar todas como leídas
        </button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Mensaje</th>
            <th>Fecha</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {notifications.map((notification) => (
            <tr key={notification.id} style={{ opacity: notification.leida ? 0.6 : 1 }}>
              <td>{TIPO_LABELS[notification.tipo] ?? notification.tipo}</td>
              <td>{notification.mensaje}</td>
              <td>{new Date(notification.created_at).toLocaleDateString("es-PE")}</td>
              <td>
                <span className={`badge ${notification.leida ? "" : "badge-warning"}`}>
                  {notification.leida ? "Leída" : "Nueva"}
                </span>
              </td>
              <td>
                <button className="btn-link" onClick={() => handleRowClick(notification)}>
                  <Eye size={14} />
                  Ver registro
                </button>
              </td>
            </tr>
          ))}
          {notifications.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 16, textAlign: "center", color: "var(--color-text-muted)" }}>
                No hay alertas.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {can("alerta", "edit") && (
        <div className="card" style={{ marginTop: 24, maxWidth: 500 }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Mail size={15} color="var(--color-primary)" />
            Configuración de correo
          </h2>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            El servidor SMTP se configura en el archivo <code>.env</code> del backend (nunca en el código).
            Aquí defines a quién se le envía el resumen de alertas pendientes.
          </p>

          <form onSubmit={handleAddRecipient} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              type="email"
              placeholder="correo@empresa.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-secondary">
              <Plus size={16} />
              Agregar
            </button>
          </form>
          {recipientError && (
            <div className="alert alert-error" style={{ marginBottom: 12 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {recipientError}
            </div>
          )}

          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
            {recipients.map((recipient) => (
              <li
                key={recipient.id}
                style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}
              >
                <span>{recipient.email}</span>
                <button className="btn-danger-link" onClick={() => handleRemoveRecipient(recipient.id)}>
                  <Trash2 size={14} />
                  Quitar
                </button>
              </li>
            ))}
            {recipients.length === 0 && (
              <li style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Sin destinatarios configurados.</li>
            )}
          </ul>

          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleSendEmail} disabled={sending}>
            <Send size={15} />
            {sending ? "Enviando..." : "Enviar resumen por correo ahora"}
          </button>
          {emailStatus && <p style={{ marginTop: 8, fontSize: 13 }}>{emailStatus}</p>}
        </div>
      )}
    </div>
  );
}
