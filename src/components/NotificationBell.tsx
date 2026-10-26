import { Bell, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { notificationsService } from "../services/notifications.service";
import type { Notification, NotificationSummary } from "../types/notification";
import { TIPO_LABELS } from "../types/notification";
import { resolveNotificationLink } from "../utils/notificationLink";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [items, setItems] = useState<Notification[]>([]);

  async function reload() {
    const [summaryData, list] = await Promise.all([
      notificationsService.summary(),
      notificationsService.list(undefined, false),
    ]);
    setSummary(summaryData);
    setItems(list.slice(0, 8));
  }

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 60000);
    return () => clearInterval(interval);
  }, []);

  async function handleClick(notification: Notification) {
    await notificationsService.markRead(notification.id);
    setOpen(false);
    await reload();
    navigate(resolveNotificationLink(notification));
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        className="btn btn-secondary"
        onClick={() => setOpen((prev) => !prev)}
        style={{ position: "relative" }}
      >
        <Bell size={15} />
        Alertas
        {summary && summary.no_leidas > 0 && <span className="notification-badge">{summary.no_leidas}</span>}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            right: 0,
            top: "110%",
            width: 340,
            zIndex: 20,
            maxHeight: 400,
            overflowY: "auto",
            padding: 8,
          }}
        >
          {items.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "8px 10px" }}>
              Sin alertas pendientes.
            </p>
          )}
          {items.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleClick(notification)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderRadius: "var(--radius-sm)",
                borderBottom: "1px solid var(--color-border)",
                padding: "9px 10px",
                cursor: "pointer",
                fontSize: 13,
                transition: "background 0.1s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-accent-light)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ color: "var(--color-text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {TIPO_LABELS[notification.tipo] ?? notification.tipo}
              </div>
              <div>{notification.mensaje}</div>
            </button>
          ))}
          <button
            className="btn-link"
            style={{ marginTop: 6, width: "100%", justifyContent: "center" }}
            onClick={() => {
              setOpen(false);
              navigate("/alertas");
            }}
          >
            Ver todas las alertas
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
