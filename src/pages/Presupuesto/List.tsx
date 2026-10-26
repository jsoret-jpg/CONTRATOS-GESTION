import { AlertCircle, Check, Eye, Pencil, Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import BackButton from "../../components/BackButton";

import { usePermissions } from "../../hooks/usePermissions";
import { budgetsService } from "../../services/budgets.service";
import { companiesService } from "../../services/companies.service";
import { serviciosProductosService } from "../../services/serviciosProductos.service";
import type { Company } from "../../types/company";
import { MESES_LABELS, type AnnualBudget, type BudgetSummary, type ServicioProducto } from "../../types/budget";

function money(value: string): string {
  const n = Number(value);
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function PresupuestoList() {
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [servicios, setServicios] = useState<ServicioProducto[]>([]);
  const [annualBudgets, setAnnualBudgets] = useState<AnnualBudget[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [filterAnio, setFilterAnio] = useState(2026);
  const [filterCompanyId, setFilterCompanyId] = useState<number | undefined>(undefined);
  const [filterServicioId, setFilterServicioId] = useState<number | undefined>(
    searchParams.get("servicio_producto_id") ? Number(searchParams.get("servicio_producto_id")) : undefined
  );

  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newServicioNombre, setNewServicioNombre] = useState("");
  const [form, setForm] = useState<{
    company_id: string;
    servicio_producto_id: string;
    anio: string;
    montos: string[];
  }>({
    company_id: "",
    servicio_producto_id: "",
    anio: "2026",
    montos: Array(12).fill(""),
  });

  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const companyName = (id: number) => companies.find((c) => c.id === id)?.name ?? "—";

  async function reload() {
    const [companiesData, serviciosData, annualData, summaryData] = await Promise.all([
      companiesService.list(),
      serviciosProductosService.list(),
      budgetsService.listAnnual({
        anio: filterAnio || undefined,
        company_id: filterCompanyId,
        servicio_producto_id: filterServicioId,
      }),
      budgetsService.summary({ anio: filterAnio || undefined, company_id: filterCompanyId, servicio_producto_id: filterServicioId }),
    ]);
    setCompanies(companiesData);
    setServicios(serviciosData);
    setAnnualBudgets(annualData);
    setSummary(summaryData);
  }

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAnio, filterCompanyId, filterServicioId]);

  function openCreate() {
    setForm({ company_id: "", servicio_producto_id: "", anio: String(filterAnio || 2026), montos: Array(12).fill("") });
    setNewServicioNombre("");
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(annual: AnnualBudget) {
    setForm({
      company_id: String(annual.company_id),
      servicio_producto_id: String(annual.servicio_producto_id),
      anio: String(annual.anio),
      montos: annual.meses.map((m) => m.monto_mensual),
    });
    setNewServicioNombre("");
    setFormError(null);
    setShowForm(true);
  }

  async function handleCreateServicio() {
    if (!newServicioNombre.trim()) return;
    try {
      const created = await serviciosProductosService.create(newServicioNombre.trim());
      const nuevos = await serviciosProductosService.list();
      setServicios(nuevos);
      setForm({ ...form, servicio_producto_id: String(created.id) });
      setNewServicioNombre("");
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(detail ?? "No se pudo crear el servicio/producto");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.company_id || !form.servicio_producto_id) {
      setFormError("Selecciona empresa y servicio/producto");
      return;
    }
    try {
      const montos: Record<string, string> = {};
      form.montos.forEach((valor, idx) => {
        if (valor !== "") montos[String(idx + 1)] = valor;
      });
      await budgetsService.upsertAnnual({
        company_id: Number(form.company_id),
        servicio_producto_id: Number(form.servicio_producto_id),
        anio: Number(form.anio),
        montos,
      });
      setShowForm(false);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(detail ?? "No se pudo guardar el presupuesto");
    }
  }

  const totalAnualCalculado = form.montos.reduce((acc, v) => acc + (Number(v) || 0), 0);

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h1>Presupuesto</h1>

      {summary && (
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-label">Asignado {filterAnio}</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {money(summary.total_asignado)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ejecutado</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {money(summary.total_ejecutado)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Disponible</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {money(summary.total_disponible)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Presupuestos excedidos</div>
            <div className="stat-value">{summary.presupuestos_excedidos}</div>
          </div>
        </div>
      )}

      <div className="toolbar">
        {can("presupuesto", "create") && (
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Nuevo presupuesto anual
          </button>
        )}
        <input
          type="number"
          value={filterAnio}
          onChange={(e) => setFilterAnio(Number(e.target.value))}
          style={{ width: 100 }}
          placeholder="Año"
        />
        <select
          value={filterCompanyId ?? ""}
          onChange={(e) => setFilterCompanyId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Todas las empresas</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filterServicioId ?? ""}
          onChange={(e) => setFilterServicioId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Todos los servicios/productos</option>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card"
          style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div className="field">
              <label>Empresa</label>
              <select
                value={form.company_id}
                onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                required
              >
                <option value="" disabled>
                  Selecciona...
                </option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Servicio/Producto</label>
              <select
                value={form.servicio_producto_id}
                onChange={(e) => setForm({ ...form, servicio_producto_id: e.target.value })}
                required
              >
                <option value="" disabled>
                  Selecciona...
                </option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input
                  placeholder="Crear nuevo servicio/producto..."
                  value={newServicioNombre}
                  onChange={(e) => setNewServicioNombre(e.target.value)}
                  style={{ fontSize: 12 }}
                />
                <button type="button" className="btn btn-secondary" onClick={handleCreateServicio}>
                  <Plus size={14} />
                  Crear
                </button>
              </div>
            </div>
            <div className="field">
              <label>Año</label>
              <input
                type="number"
                value={form.anio}
                onChange={(e) => setForm({ ...form, anio: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Presupuesto de enero a diciembre</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginTop: 8 }}>
              {MESES_CORTOS.map((label, idx) => (
                <div className="field" key={label}>
                  <label style={{ fontSize: 12 }}>{label}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.montos[idx]}
                    onChange={(e) => {
                      const nuevos = [...form.montos];
                      nuevos[idx] = e.target.value;
                      setForm({ ...form, montos: nuevos });
                    }}
                  />
                </div>
              ))}
            </div>
            <p style={{ marginTop: 8, fontSize: 13, color: "var(--color-text-secondary)" }}>
              Total anual (automático): <strong>{money(String(totalAnualCalculado))}</strong>
            </p>
          </div>

          {formError && (
            <div className="alert alert-error">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {formError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">
              <Check size={16} />
              Guardar
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              <X size={16} />
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Servicio/Producto</th>
              {MESES_CORTOS.map((m) => (
                <th key={m} style={{ textAlign: "right" }}>
                  {m}
                </th>
              ))}
              <th style={{ textAlign: "right" }}>Total anual</th>
              <th style={{ textAlign: "right" }}>Ejecutado</th>
              <th style={{ textAlign: "right" }}>Saldo</th>
              <th>% Ejecución</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {annualBudgets.map((annual) => {
              const key = `${annual.company_id}-${annual.servicio_producto_id}-${annual.anio}`;
              const porcentaje = Number(annual.porcentaje_ejecucion_anual);
              const excedido = Number(annual.total_ejecutado) > Number(annual.total_anual);
              return (
                <>
                  <tr key={key}>
                    <td>{companyName(annual.company_id)}</td>
                    <td>{annual.servicio_producto_nombre}</td>
                    {annual.meses.map((m) => (
                      <td key={m.mes} style={{ textAlign: "right" }}>
                        {Number(m.monto_mensual) > 0 ? money(m.monto_mensual) : "—"}
                      </td>
                    ))}
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{money(annual.total_anual)}</td>
                    <td style={{ textAlign: "right" }}>{money(annual.total_ejecutado)}</td>
                    <td style={{ textAlign: "right" }}>{money(annual.total_disponible)}</td>
                    <td>
                      <span className={`badge ${excedido ? "badge-danger" : porcentaje >= 80 ? "badge-warning" : "badge-success"}`}>
                        {porcentaje.toFixed(0)}%
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {can("presupuesto", "edit") && (
                        <button className="btn-link" onClick={() => openEdit(annual)}>
                          <Pencil size={14} />
                          Editar
                        </button>
                      )}
                      <button
                        className="btn-link"
                        onClick={() => setExpandedKey(expandedKey === key ? null : key)}
                      >
                        <Eye size={14} />
                        Detalle
                      </button>
                    </td>
                  </tr>
                  {expandedKey === key && (
                    <tr>
                      <td colSpan={18} style={{ background: "var(--color-accent-light)", padding: 16 }}>
                        <BackButton onClick={() => setExpandedKey(null)} label="Atrás a la lista" />
                        <strong>Detalle mensual — {annual.servicio_producto_nombre} ({annual.anio})</strong>
                        <table className="table" style={{ marginTop: 8, background: "#fff" }}>
                          <thead>
                            <tr>
                              <th>Mes</th>
                              <th>Presupuesto</th>
                              <th>Ejecutado</th>
                              <th>Disponible</th>
                              <th>% Ejecución</th>
                            </tr>
                          </thead>
                          <tbody>
                            {annual.meses.map((m) => (
                              <tr key={m.mes}>
                                <td>{MESES_LABELS[m.mes]}</td>
                                <td>{money(m.monto_mensual)}</td>
                                <td>{money(m.ejecutado)}</td>
                                <td>{money(m.disponible)}</td>
                                <td>
                                  <span className={`badge ${m.excedido ? "badge-danger" : ""}`}>
                                    {Number(m.porcentaje_ejecutado).toFixed(0)}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {annualBudgets.length === 0 && (
              <tr>
                <td colSpan={18} style={{ padding: 16, textAlign: "center", color: "var(--color-text-muted)" }}>
                  No hay presupuestos que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
