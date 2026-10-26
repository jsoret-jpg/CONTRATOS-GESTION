import { AlertCircle, Check, Download, FileDown, FilterX, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { usePermissions } from "../../hooks/usePermissions";
import { companiesService } from "../../services/companies.service";
import { monthlyPaymentsService } from "../../services/monthlyPayments.service";
import type { Company } from "../../types/company";
import {
  ESTADO_PAGO_BADGE,
  ESTADO_PAGO_LABELS,
  MESES_LABELS,
  type ImportSummary,
  type MonthlyPayment,
  type MonthlyPaymentFilters,
  type MonthlyPaymentSummary,
} from "../../types/monthlyPayment";
import { downloadBlob, filenameFromContentDisposition } from "../../utils/download";

interface FormState {
  id: number | null;
  company_id: number | null;
  tipo_servicio: string;
  anio: string;
  mes: string;
  monto: string;
  observaciones: string;
}

const emptyForm: FormState = {
  id: null,
  company_id: null,
  tipo_servicio: "",
  anio: String(new Date().getFullYear()),
  mes: String(new Date().getMonth() + 1),
  monto: "",
  observaciones: "",
};

const CHECKLIST_STEPS: { field: keyof MonthlyPayment; label: string }[] = [
  { field: "solped_registrada", label: "SOLPED registrada" },
  { field: "factura_registrada", label: "Factura registrada" },
];

function money(value: string): string {
  const n = Number(value);
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PagosMensualesList() {
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);
  const [summary, setSummary] = useState<MonthlyPaymentSummary | null>(null);
  const [filters, setFilters] = useState<MonthlyPaymentFilters>(() => {
    const pagadaParam = searchParams.get("pagada");
    return {
      company_id: searchParams.get("company_id") ? Number(searchParams.get("company_id")) : undefined,
      pagada: pagadaParam === "true" ? true : pagadaParam === "false" ? false : undefined,
      tipo_servicio: searchParams.get("tipo_servicio") ?? undefined,
    };
  });
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const companyName = (id: number | null) => (id === null ? "Sin empresa" : companies.find((c) => c.id === id)?.name ?? "—");

  async function reload() {
    const [companiesData, paymentsData, summaryData] = await Promise.all([
      companiesService.list(),
      monthlyPaymentsService.list(filters),
      monthlyPaymentsService.summary(),
    ]);
    setCompanies(companiesData);
    setPayments(paymentsData);
    setSummary(summaryData);
  }

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.company_id) {
      setFormError("Selecciona una empresa");
      return;
    }

    try {
      const payload = {
        company_id: form.company_id,
        tipo_servicio: form.tipo_servicio,
        anio: Number(form.anio),
        mes: Number(form.mes),
        monto: form.monto,
        observaciones: form.observaciones || null,
      };
      if (form.id) {
        await monthlyPaymentsService.update(form.id, payload);
      } else {
        await monthlyPaymentsService.create(payload);
      }
      setForm(emptyForm);
      setShowForm(false);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(detail ?? "Ocurrió un error al guardar el registro");
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(p: MonthlyPayment) {
    setForm({
      id: p.id,
      company_id: p.company_id,
      tipo_servicio: p.tipo_servicio,
      anio: String(p.anio),
      mes: String(p.mes),
      monto: p.monto,
      observaciones: p.observaciones ?? "",
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleToggleStep(payment: MonthlyPayment, field: keyof MonthlyPayment) {
    try {
      await monthlyPaymentsService.update(payment.id, { [field]: !payment[field] });
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(detail ?? "No se pudo actualizar el checklist");
    }
  }

  async function handleTogglePagada(payment: MonthlyPayment) {
    try {
      await monthlyPaymentsService.update(payment.id, { pagada: !payment.pagada });
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(
        detail ?? "No se puede marcar como pagada sin completar antes SOLPED registrada y factura registrada"
      );
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
    try {
      await monthlyPaymentsService.remove(id);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(detail ?? "No se pudo eliminar el registro");
    }
  }

  async function handleDownloadTemplate() {
    const response = await monthlyPaymentsService.downloadTemplate();
    downloadBlob(response.data, "plantilla_pagos_mensuales.xlsx");
  }

  async function handleExport() {
    const response = await monthlyPaymentsService.exportExcel(filters);
    const filename = filenameFromContentDisposition(
      response.headers["content-disposition"],
      "pagos_mensuales_export.xlsx"
    );
    downloadBlob(response.data, filename);
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const result = await monthlyPaymentsService.importExcel(file);
      setImportResult(result);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setImportError(detail ?? "No se pudo importar el archivo");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h1>Pagos mensuales</h1>

      {summary && (
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-label">Total registros</div>
            <div className="stat-value">{summary.total}</div>
          </div>
          {Object.entries(ESTADO_PAGO_LABELS).map(([estado, label]) => (
            <button
              key={estado}
              onClick={() => setFilters({ ...filters, pagada: estado === "pagado" ? true : undefined })}
              className="stat-card clickable"
            >
              <div className="stat-label">{label}</div>
              <div className="stat-value">{summary.por_estado[estado] ?? 0}</div>
            </button>
          ))}
          <div className="stat-card">
            <div className="stat-label">Monto pagado</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {money(summary.total_monto_pagado)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monto pendiente</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {money(summary.total_monto_pendiente)}
            </div>
          </div>
        </div>
      )}

      <div className="toolbar">
        {can("pago_mensual", "create") && (
          <button onClick={openCreate} className="btn btn-primary">
            <Plus size={16} />
            Nuevo registro
          </button>
        )}
        {can("pago_mensual", "import") && (
          <>
            <button onClick={handleDownloadTemplate} className="btn btn-secondary">
              <FileDown size={16} />
              Descargar plantilla
            </button>
            <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
              <Upload size={16} />
              {importing ? "Importando..." : "Importar Excel"}
              <input type="file" accept=".xlsx,.xls" onChange={handleImportFile} style={{ display: "none" }} />
            </label>
          </>
        )}
        {can("pago_mensual", "export") && (
          <button onClick={handleExport} className="btn btn-secondary">
            <Download size={16} />
            Exportar Excel
          </button>
        )}

        <select
          value={filters.company_id ?? ""}
          onChange={(e) => setFilters({ ...filters, company_id: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">Todas las empresas</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={filters.anio ?? ""}
          onChange={(e) => setFilters({ ...filters, anio: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">Todos los años</option>
          {Array.from(new Set(payments.map((p) => p.anio)))
            .sort((a, b) => b - a)
            .map((anio) => (
              <option key={anio} value={anio}>
                {anio}
              </option>
            ))}
        </select>

        <select
          value={filters.mes ?? ""}
          onChange={(e) => setFilters({ ...filters, mes: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">Todos los meses</option>
          {MESES_LABELS.slice(1).map((label, i) => (
            <option key={label} value={i + 1}>
              {label}
            </option>
          ))}
        </select>

        <input
          placeholder="Buscar tipo de servicio..."
          value={filters.tipo_servicio ?? ""}
          onChange={(e) => setFilters({ ...filters, tipo_servicio: e.target.value || undefined })}
        />
        {(filters.company_id || filters.anio || filters.mes || filters.tipo_servicio || filters.pagada !== undefined) && (
          <button onClick={() => setFilters({})} className="btn btn-secondary">
            <FilterX size={16} />
            Limpiar filtros
          </button>
        )}
      </div>

      {importResult && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <strong>Resultado de la importación:</strong> {importResult.insertados} nuevos,{" "}
          {importResult.actualizados} actualizados, {importResult.rechazados} rechazados.
          {importResult.errores.length > 0 && (
            <ul style={{ margin: "8px 0 0", color: "var(--color-danger)" }}>
              {importResult.errores.map((err, i) => (
                <li key={i}>
                  Fila {err.fila}: {err.mensaje}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {importError && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {importError}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}
        >
          <div className="field">
            <label>Empresa</label>
            <select
              value={form.company_id ?? ""}
              onChange={(e) => setForm({ ...form, company_id: Number(e.target.value) })}
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
            <label>Tipo de servicio</label>
            <input
              value={form.tipo_servicio}
              placeholder="Internet, Telefonía, Leasing..."
              onChange={(e) => setForm({ ...form, tipo_servicio: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Monto</label>
            <input
              type="number"
              step="0.01"
              value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
              required
            />
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
          <div className="field">
            <label>Mes</label>
            <select value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })}>
              {MESES_LABELS.slice(1).map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ gridColumn: "span 3" }}>
            <label>Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              rows={2}
            />
          </div>

          {formError && (
            <div className="alert alert-error" style={{ gridColumn: "span 3" }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {formError}
            </div>
          )}

          <div style={{ gridColumn: "span 3", display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">
              <Check size={16} />
              {form.id ? "Guardar cambios" : "Registrar"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
            >
              <X size={16} />
              Cancelar
            </button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Servicio</th>
            <th>Periodo</th>
            <th>Monto</th>
            {CHECKLIST_STEPS.map((step) => (
              <th key={step.field} style={{ textAlign: "center" }}>
                {step.label}
              </th>
            ))}
            <th style={{ textAlign: "center" }}>Factura pagada</th>
            <th>Avance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{companyName(p.company_id)}</td>
              <td>{p.tipo_servicio}</td>
              <td>
                {MESES_LABELS[p.mes]} {p.anio}
              </td>
              <td>{money(p.monto)}</td>
              {CHECKLIST_STEPS.map((step) => (
                <td key={step.field} style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    style={{ width: "auto" }}
                    checked={Boolean(p[step.field])}
                    disabled={!can("pago_mensual", "edit")}
                    onChange={() => handleToggleStep(p, step.field)}
                  />
                </td>
              ))}
              <td style={{ textAlign: "center" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={p.pagada}
                  disabled={!can("pago_mensual", "edit")}
                  onChange={() => handleTogglePagada(p)}
                />
              </td>
              <td style={{ minWidth: 130 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="progress-bar" style={{ flex: 1 }}>
                    <div className="progress-bar-fill" style={{ width: `${p.porcentaje}%` }} />
                  </div>
                  <span
                    className={`badge ${ESTADO_PAGO_BADGE[p.estado] ?? ""}`}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {p.porcentaje}%
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                  {ESTADO_PAGO_LABELS[p.estado] ?? p.estado}
                </div>
              </td>
              <td>
                {can("pago_mensual", "edit") && (
                  <button className="btn-link" onClick={() => openEdit(p)}>
                    <Pencil size={14} />
                    Editar
                  </button>
                )}
                {can("pago_mensual", "delete") && (
                  <button className="btn-danger-link" onClick={() => handleDelete(p.id)}>
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
          {payments.length === 0 && (
            <tr>
              <td colSpan={9} style={{ padding: 16, textAlign: "center", color: "var(--color-text-muted)" }}>
                No hay registros que coincidan con los filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
