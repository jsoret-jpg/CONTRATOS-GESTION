import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileStack,
  FileWarning,
  PiggyBank,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { dashboardService } from "../services/dashboard.service";
import type { DashboardSummary } from "../types/dashboard";
import { ESTADO_LABELS } from "../types/solped";

function money(value: string): string {
  const n = Number(value);
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MonthlyExecutionChart({ data }: { data: DashboardSummary["ejecucion_presupuestal_mensual"] }) {
  const maxVal = Math.max(1, ...data.map((d) => Number(d.ejecutado)));
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  return (
    <div className="card">
      <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <TrendingUp size={16} color="var(--color-primary)" />
        Ejecución presupuestal mensual
      </h2>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140 }}>
        {data.map((d) => {
          const heightPct = (Number(d.ejecutado) / maxVal) * 100;
          return (
            <div key={d.mes} style={{ flex: 1, textAlign: "center" }}>
              <div
                className="tooltip"
                data-tooltip={`S/ ${money(d.ejecutado)}`}
                style={{ height: 110, display: "flex", alignItems: "flex-end", width: "100%" }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${heightPct}%`,
                    background: "linear-gradient(180deg, var(--color-primary), var(--color-primary-hover))",
                    borderRadius: "5px 5px 0 0",
                    minHeight: Number(d.ejecutado) > 0 ? 3 : 0,
                    transition: "height 0.3s var(--ease)",
                  }}
                />
              </div>
              <div style={{ fontSize: 10, marginTop: 4, color: "var(--color-text-muted)", fontWeight: 500 }}>
                {meses[d.mes - 1]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STAT_TONE = {
  primary: "var(--color-primary)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  success: "var(--color-success)",
} as const;

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  onClick,
}: {
  icon: typeof ShoppingCart;
  tone: keyof typeof STAT_TONE;
  label: string;
  value: number | string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Icon size={15} color={STAT_TONE[tone]} />
        <div className="stat-label" style={{ margin: 0 }}>
          {label}
        </div>
      </div>
      <div className="stat-value">{value}</div>
    </>
  );
  if (onClick) {
    return (
      <button className="stat-card clickable" onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className="stat-card">{content}</div>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    dashboardService
      .summary()
      .then(setSummary)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Cargando panel...</p>;

  if (error || !summary) {
    return (
      <div className="alert alert-error">
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        No se pudo cargar el panel. Revisa que el backend esté corriendo.
      </div>
    );
  }

  return (
    <div>
      <h1>Panel</h1>
      <p style={{ color: "var(--color-text-secondary)" }}>
        Sesión iniciada como <strong>{user?.full_name}</strong>.
      </p>

      <div className="stat-row">
        <StatCard
          icon={ShoppingCart}
          tone="primary"
          label="Total SOLPEDs"
          value={summary.solpeds_total}
          onClick={() => navigate("/solpeds")}
        />
        <StatCard
          icon={Clock}
          tone="warning"
          label="SOLPEDs pendientes"
          value={summary.solpeds_pendientes}
          onClick={() => navigate("/solpeds?excluir_estado=factura_pagada")}
        />
        <StatCard
          icon={CalendarClock}
          tone="warning"
          label="Contratos urgentes"
          value={summary.contratos_por_vencer}
          onClick={() => navigate("/contratos?estado=urgente")}
        />
        <StatCard
          icon={AlertTriangle}
          tone="danger"
          label="Contratos vencidos"
          value={summary.contratos_vencidos}
          onClick={() => navigate("/contratos?estado=vencido")}
        />
        <StatCard
          icon={FileWarning}
          tone="warning"
          label="Facturas pendientes"
          value={summary.facturas_pendientes}
          onClick={() => navigate("/facturas?estado=registrada")}
        />
        <StatCard
          icon={Wallet}
          tone="warning"
          label="Gastos mensuales pendientes"
          value={summary.gastos_mensuales_pendientes}
          onClick={() => navigate("/pagos-mensuales?pagada=false")}
        />
      </div>

      <div className="stat-row">
        <StatCard
          icon={TrendingDown}
          tone="success"
          label="Presupuesto ejecutado"
          value={`S/ ${money(summary.presupuesto_ejecutado)}`}
        />
        <StatCard
          icon={PiggyBank}
          tone="primary"
          label="Presupuesto disponible"
          value={`S/ ${money(summary.presupuesto_disponible)}`}
        />
        <StatCard
          icon={AlertTriangle}
          tone="danger"
          label="Presupuestos excedidos"
          value={summary.presupuesto_excedido_count}
          onClick={() => navigate("/presupuesto")}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShoppingCart size={15} color="var(--color-primary)" />
            SOLPEDs por estado
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {Object.entries(summary.solpeds_por_estado).map(([estado, count]) => (
              <button
                key={estado}
                className="btn-link"
                style={{ textAlign: "left", display: "flex", justifyContent: "space-between", width: "100%" }}
                onClick={() => navigate(`/solpeds?estado=${estado}`)}
              >
                <span>{ESTADO_LABELS[estado] ?? estado}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Receipt size={15} color="var(--color-primary)" />
            Facturas por estado
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {Object.entries(summary.facturas_por_estado).map(([estado, count]) => (
              <button
                key={estado}
                className="btn-link"
                style={{ textAlign: "left", display: "flex", justifyContent: "space-between", width: "100%" }}
                onClick={() => navigate(`/facturas?estado=${estado}`)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {estado === "pagada" ? (
                    <CheckCircle2 size={13} color="var(--color-success)" />
                  ) : (
                    <Clock size={13} color="var(--color-warning)" />
                  )}
                  {estado === "pagada" ? "Pagada" : "Registrada"}
                </span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Building2 size={15} color="var(--color-primary)" />
            Gastos por empresa
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(summary.gastos_por_empresa).length === 0 && (
              <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Sin facturas registradas.</p>
            )}
            {Object.entries(summary.gastos_por_empresa).map(([empresa, monto]) => (
              <div key={empresa} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span>{empresa}</span>
                <strong>{money(monto)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileStack size={15} color="var(--color-primary)" />
            Gastos por proveedor
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(summary.gastos_por_proveedor).length === 0 && (
              <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Sin facturas registradas.</p>
            )}
            {Object.entries(summary.gastos_por_proveedor).map(([proveedor, monto]) => (
              <div key={proveedor} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span>{proveedor}</span>
                <strong>{money(monto)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <MonthlyExecutionChart data={summary.ejecucion_presupuestal_mensual} />
    </div>
  );
}
