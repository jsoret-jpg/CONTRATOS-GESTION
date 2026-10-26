import { AlertCircle, Check, Download, Eye, FileText, PiggyBank, Plus, Receipt, Trash2 } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import Modal from "../../components/Modal";
import { usePermissions } from "../../hooks/usePermissions";
import { companiesService } from "../../services/companies.service";
import { budgetsService } from "../../services/budgets.service";
import { contractsService } from "../../services/contracts.service";
import { invoicesService } from "../../services/invoices.service";
import { providersService } from "../../services/providers.service";
import { serviciosProductosService } from "../../services/serviciosProductos.service";
import { solpedsService } from "../../services/solpeds.service";
import type { Company } from "../../types/company";
import type { AnnualBudget, ServicioProducto } from "../../types/budget";
import type { Contract } from "../../types/contract";
import type { Invoice } from "../../types/invoice";
import {
  ESTADO_LABELS,
  ESTADOS_SOLPED,
  type ImportSummary,
  type Solped,
  type SolpedFilters,
  type SolpedSummary,
} from "../../types/solped";
import { downloadBlob, filenameFromContentDisposition } from "../../utils/download";

interface FormState {
  id: number | null;
  numero_solped: string;
  company_id: number | null;
  tipo: string;
  descripcion: string;
  servicio_producto_id: string;
  contract_id: string;
  fecha_solped: string;
  proveedor_nombre: string;
  numero_orden: string;
  monto_orden: string;
  moneda: string;
  estado: string;
  presupuestada: boolean;
  monto_presupuesto: string;
  monto_ejecutado: string;
  fecha_ejecucion: string;
  observaciones: string;
}

const emptyForm: FormState = {
  id: null,
  numero_solped: "",
  company_id: null,
  tipo: "producto",
  descripcion: "",
  servicio_producto_id: "",
  contract_id: "",
  fecha_solped: "",
  proveedor_nombre: "",
  numero_orden: "",
  monto_orden: "",
  moneda: "PEN",
  estado: "aprobado_nivel_1",
  presupuestada: false,
  monto_presupuesto: "",
  monto_ejecutado: "",
  fecha_ejecucion: "",
  observaciones: "",
};

function money(value: string | null): string {
  if (value === null) return "—";
  const n = Number(value);
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SolpedsList() {
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [solpeds, setSolpeds] = useState<Solped[]>([]);
  const [servicios, setServicios] = useState<ServicioProducto[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [relatedBudget, setRelatedBudget] = useState<AnnualBudget | null>(null);
  const [summary, setSummary] = useState<SolpedSummary | null>(null);
  const [filters, setFilters] = useState<SolpedFilters>(() => ({
    estado: searchParams.get("estado") ?? undefined,
    company_id: searchParams.get("company_id") ? Number(searchParams.get("company_id")) : undefined,
    provider_id: searchParams.get("provider_id") ? Number(searchParams.get("provider_id")) : undefined,
    search: searchParams.get("search") ?? undefined,
    excluir_estado: searchParams.get("excluir_estado") ?? undefined,
  }));
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"editar" | "detalle" | "factura" | "cotizacion" | "presupuesto" | null>(
    null
  );
  const [viewingSolped, setViewingSolped] = useState<Solped | null>(null);
  const [presupuestoAlerta, setPresupuestoAlerta] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceForm, setInvoiceForm] = useState({ numero_factura: "", fecha_factura: "", monto_factura: "" });
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const companyName = (id: number | null) => (id === null ? "Sin empresa" : companies.find((c) => c.id === id)?.name ?? "—");

  async function reload() {
    const [companiesData, solpedsData, summaryData, serviciosData, contractsData] = await Promise.all([
      companiesService.list(),
      solpedsService.list(filters),
      solpedsService.summary(filters),
      serviciosProductosService.list(),
      contractsService.list({}),
    ]);
    setCompanies(companiesData);
    setSolpeds(solpedsData);
    setSummary(summaryData);
    setServicios(serviciosData);
    setContracts(contractsData);
  }

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function openCreate() {
    setForm(emptyForm);
    setFormError(null);
    setInvoices([]);
    setRelatedBudget(null);
    setActiveView("editar");
  }

  /** Carga todo el contexto de una SOLPED (campos, facturas, presupuesto
   * relacionado) en el estado compartido. Se usa tanto para "Editar" como
   * para cada una de las 4 vistas independientes, de modo que sus
   * controles (subir cotización, registrar factura, etc.) sigan
   * funcionando igual sin importar desde qué botón se abrieron. */
  async function loadSolpedContext(s: Solped) {
    setForm({
      id: s.id,
      numero_solped: s.numero_solped,
      company_id: s.company_id,
      tipo: s.tipo,
      descripcion: s.descripcion ?? "",
      servicio_producto_id: s.servicio_producto_id ? String(s.servicio_producto_id) : "",
      contract_id: s.contract_id ? String(s.contract_id) : "",
      fecha_solped: s.fecha_solped,
      proveedor_nombre: "",
      numero_orden: s.numero_orden ?? "",
      monto_orden: s.monto_orden,
      moneda: s.moneda,
      estado: s.estado,
      presupuestada: s.presupuestada,
      monto_presupuesto: s.monto_presupuesto ?? "",
      monto_ejecutado: s.monto_ejecutado ?? "",
      fecha_ejecucion: s.fecha_ejecucion ?? "",
      observaciones: s.observaciones ?? "",
    });
    setFormError(null);
    setInvoiceError(null);
    setViewingSolped(s);
    const invoiceList = await invoicesService.list(s.id);
    setInvoices(invoiceList);

    setRelatedBudget(null);
    if (s.servicio_producto_id && s.company_id) {
      const anio = Number(s.fecha_solped.slice(0, 4));
      const anuales = await budgetsService.listAnnual({
        company_id: s.company_id,
        servicio_producto_id: s.servicio_producto_id,
        anio,
      });
      setRelatedBudget(anuales[0] ?? null);
    }
  }

  async function openEdit(s: Solped) {
    await loadSolpedContext(s);
    setActiveView("editar");
  }

  async function openDetalle(s: Solped) {
    await loadSolpedContext(s);
    setActiveView("detalle");
  }

  async function openFactura(s: Solped) {
    await loadSolpedContext(s);
    setActiveView("factura");
  }

  async function openCotizacion(s: Solped) {
    await loadSolpedContext(s);
    setActiveView("cotizacion");
  }

  async function openPresupuesto(s: Solped) {
    await loadSolpedContext(s);
    setActiveView("presupuesto");
  }

  function closeView() {
    setActiveView(null);
    setViewingSolped(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.company_id) {
      setFormError("Selecciona una empresa");
      return;
    }

    try {
      let provider_id: number | null = null;
      if (form.proveedor_nombre.trim()) {
        const provider = await providersService.findOrCreate(form.proveedor_nombre.trim());
        provider_id = provider.id;
      }

      const payload: Record<string, unknown> = {
        company_id: form.company_id,
        tipo: form.tipo,
        descripcion: form.descripcion || null,
        servicio_producto_id: form.servicio_producto_id ? Number(form.servicio_producto_id) : null,
        contract_id: form.contract_id ? Number(form.contract_id) : null,
        fecha_solped: form.fecha_solped,
        numero_orden: form.numero_orden || null,
        monto_orden: form.monto_orden || "0",
        moneda: form.moneda,
        estado: form.estado,
        presupuestada: form.presupuestada,
        monto_presupuesto: form.monto_presupuesto || null,
        observaciones: form.observaciones || null,
      };
      if (provider_id) payload.provider_id = provider_id;

      let saved: Solped;
      if (form.id) {
        saved = await solpedsService.update(form.id, payload);
      } else {
        payload.numero_solped = form.numero_solped;
        saved = await solpedsService.create(payload);
      }

      setPresupuestoAlerta(saved.presupuesto_alerta);
      setActiveView(null);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(detail ?? "Ocurrió un error al guardar la SOLPED");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar esta SOLPED? Esta acción no se puede deshacer.")) return;
    try {
      await solpedsService.remove(id);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(detail ?? "No se pudo eliminar la SOLPED");
    }
  }

  async function handleDownloadTemplate() {
    const response = await solpedsService.downloadTemplate();
    downloadBlob(response.data, "plantilla_solpeds.xlsx");
  }

  async function handleExport() {
    const response = await solpedsService.exportExcel(filters);
    const filename = filenameFromContentDisposition(
      response.headers["content-disposition"],
      "solpeds_export.xlsx"
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
      const result = await solpedsService.importExcel(file);
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

  async function handleUploadCotizacion(id: number, file: File) {
    try {
      await solpedsService.uploadCotizacion(id, file);
      await reload();
    } catch {
      alert("No se pudo adjuntar la cotización");
    }
  }

  async function handleDownloadCotizacion(id: number) {
    try {
      const response = await solpedsService.downloadCotizacion(id);
      const filename = filenameFromContentDisposition(
        response.headers["content-disposition"],
        "cotizacion"
      );
      downloadBlob(response.data, filename);
    } catch {
      alert("Esta SOLPED no tiene cotización adjunta");
    }
  }

  async function handleCreateInvoice() {
    if (!form.id) return;
    setInvoiceError(null);
    try {
      await invoicesService.create(form.id, {
        numero_factura: invoiceForm.numero_factura,
        fecha_factura: invoiceForm.fecha_factura,
        monto_factura: invoiceForm.monto_factura,
        moneda: form.moneda,
        estado: "registrada",
      });
      setInvoiceForm({ numero_factura: "", fecha_factura: "", monto_factura: "" });
      const updatedInvoices = await invoicesService.list(form.id);
      setInvoices(updatedInvoices);
      const updatedSolped = await solpedsService.get(form.id);
      setForm((prev) => ({ ...prev, estado: updatedSolped.estado }));
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setInvoiceError(detail ?? "No se pudo registrar la factura");
    }
  }

  async function handleMarkInvoicePaid(invoice: Invoice) {
    if (!form.id) return;
    const fechaPago = prompt("Fecha de pago (AAAA-MM-DD):", new Date().toISOString().slice(0, 10));
    if (!fechaPago) return;
    try {
      await invoicesService.update(form.id, invoice.id, { estado: "pagada", fecha_pago: fechaPago });
      const updatedInvoices = await invoicesService.list(form.id);
      setInvoices(updatedInvoices);
      const updatedSolped = await solpedsService.get(form.id);
      setForm((prev) => ({ ...prev, estado: updatedSolped.estado }));
      await reload();
    } catch {
      alert("No se pudo marcar la factura como pagada");
    }
  }

  async function handleDeleteInvoice(invoice: Invoice) {
    if (!form.id) return;
    if (!confirm("¿Eliminar esta factura?")) return;
    try {
      await invoicesService.remove(form.id, invoice.id);
      const updatedInvoices = await invoicesService.list(form.id);
      setInvoices(updatedInvoices);
    } catch {
      alert("No se pudo eliminar la factura");
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h1>SOLPEDs</h1>

      {summary && (
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-label">Total SOLPEDs</div>
            <div className="stat-value">{summary.total_solpeds}</div>
          </div>
          {Object.entries(summary.por_estado).map(([estado, count]) => (
            <button
              key={estado}
              onClick={() => setFilters({ ...filters, estado })}
              className={`stat-card clickable${filters.estado === estado ? " active" : ""}`}
            >
              <div className="stat-label">{ESTADO_LABELS[estado] ?? estado}</div>
              <div className="stat-value">{count}</div>
            </button>
          ))}
          {Object.entries(summary.total_por_moneda).map(([moneda, total]) => (
            <div key={moneda} className="stat-card">
              <div className="stat-label">Total en {moneda}</div>
              <div className="stat-value" style={{ fontSize: 18 }}>
                {moneda} {money(String(total))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {can("solped", "create") && (
          <button onClick={openCreate} className="btn btn-primary">
            Nueva SOLPED
          </button>
        )}
        {can("solped", "import") && (
          <>
            <button onClick={handleDownloadTemplate} className="btn btn-secondary">
              Descargar plantilla
            </button>
            <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
              {importing ? "Importando..." : "Importar Excel"}
              <input type="file" accept=".xlsx,.xls" onChange={handleImportFile} style={{ display: "none" }} />
            </label>
          </>
        )}
        {can("solped", "export") && (
          <button onClick={handleExport} className="btn btn-secondary">
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
          value={filters.estado ?? ""}
          onChange={(e) => setFilters({ ...filters, estado: e.target.value || undefined })}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_SOLPED.map((estado) => (
            <option key={estado} value={estado}>
              {ESTADO_LABELS[estado]}
            </option>
          ))}
        </select>

        <select
          value={filters.tipo ?? ""}
          onChange={(e) => setFilters({ ...filters, tipo: e.target.value || undefined })}
        >
          <option value="">Todos los tipos</option>
          <option value="producto">Producto</option>
          <option value="servicio">Servicio</option>
        </select>

        <input
          placeholder="Buscar por N.º SOLPED o servicio/producto..."
          value={filters.search ?? ""}
          onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
        />
        {(filters.estado || filters.company_id || filters.tipo || filters.search || filters.excluir_estado) && (
          <button onClick={() => setFilters({})} className="btn btn-secondary">
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

      {presupuestoAlerta && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <strong>Presupuesto:</strong> {presupuestoAlerta}
        </div>
      )}

      {activeView === "editar" && (
        <form
          onSubmit={handleSubmit}
          className="card"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <div className="field">
            <label>Número de SOLPED</label>
            <input
              value={form.numero_solped}
              disabled={!!form.id}
              onChange={(e) => setForm({ ...form, numero_solped: e.target.value })}
              required
            />
          </div>
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
            <label>Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="producto">Producto</option>
              <option value="servicio">Servicio</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: "span 2" }}>
            <label>Descripción</label>
            <input
              value={form.descripcion}
              placeholder="¿Qué se está solicitando?"
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Servicio/Producto (para vincular con Presupuesto)</label>
            <select
              value={form.servicio_producto_id}
              onChange={(e) => setForm({ ...form, servicio_producto_id: e.target.value })}
            >
              <option value="">Sin vincular</option>
              {servicios.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Contrato relacionado</label>
            <select
              value={form.contract_id}
              onChange={(e) => setForm({ ...form, contract_id: e.target.value })}
            >
              <option value="">Sin contrato</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero_contrato}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Fecha de SOLPED</label>
            <input
              type="date"
              value={form.fecha_solped}
              onChange={(e) => setForm({ ...form, fecha_solped: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Proveedor</label>
            <input
              value={form.proveedor_nombre}
              placeholder="Escribe el nombre..."
              onChange={(e) => setForm({ ...form, proveedor_nombre: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Número de orden</label>
            <input value={form.numero_orden} onChange={(e) => setForm({ ...form, numero_orden: e.target.value })} />
          </div>
          <div className="field">
            <label>Monto de orden</label>
            <input
              type="number"
              step="0.01"
              value={form.monto_orden}
              onChange={(e) => setForm({ ...form, monto_orden: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Moneda</label>
            <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>
          <div className="field">
            <label>Estado</label>
            <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              {ESTADOS_SOLPED.map((estado) => (
                <option key={estado} value={estado}>
                  {ESTADO_LABELS[estado]}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 20 }}>
            <input
              type="checkbox"
              checked={form.presupuestada}
              onChange={(e) => setForm({ ...form, presupuestada: e.target.checked })}
              style={{ width: "auto" }}
            />
            <label>Presupuestada</label>
          </div>
          <div className="field">
            <label>Monto presupuesto</label>
            <input
              type="number"
              step="0.01"
              value={form.monto_presupuesto}
              onChange={(e) => setForm({ ...form, monto_presupuesto: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Monto ejecutado</label>
            <input type="text" value={form.monto_ejecutado || "—"} disabled />
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              Se calcula automáticamente al pagar la(s) factura(s) vinculada(s).
            </span>
          </div>
          <div className="field">
            <label>Fecha de ejecución</label>
            <input type="text" value={form.fecha_ejecucion || "—"} disabled />
          </div>
          <div className="field" style={{ gridColumn: "span 3" }}>
            <label>Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              rows={2}
            />
          </div>

          {form.id && (
            <div style={{ gridColumn: "span 3", borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--color-text-secondary)" }}>
                Cotización adjunta
              </label>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && form.id) handleUploadCotizacion(form.id, file);
                }}
                style={{ display: "inline-block", width: "auto" }}
              />{" "}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => form.id && handleDownloadCotizacion(form.id)}
              >
                Descargar cotización
              </button>
            </div>
          )}

          {form.id && (
            <div style={{ gridColumn: "span 3", borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "var(--color-text-secondary)" }}>
                Facturas
              </label>

              {invoices.length > 0 && (
                <table className="table" style={{ marginBottom: 10 }}>
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Fecha</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th>Fecha de pago</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.numero_factura}</td>
                        <td>{inv.fecha_factura}</td>
                        <td>
                          {inv.moneda} {inv.monto_factura}
                        </td>
                        <td>
                          <span className="badge">{inv.estado === "pagada" ? "Pagada" : "Registrada"}</span>
                        </td>
                        <td>{inv.fecha_pago ?? "—"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {inv.estado !== "pagada" && (
                            <button type="button" className="btn-link" onClick={() => handleMarkInvoicePaid(inv)}>
                              Marcar pagada
                            </button>
                          )}
                          <button type="button" className="btn-danger-link" onClick={() => handleDeleteInvoice(inv)}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="field">
                  <label style={{ fontSize: 12 }}>Número de factura</label>
                  <input
                    value={invoiceForm.numero_factura}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, numero_factura: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label style={{ fontSize: 12 }}>Fecha de factura</label>
                  <input
                    type="date"
                    value={invoiceForm.fecha_factura}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, fecha_factura: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label style={{ fontSize: 12 }}>Monto</label>
                  <input
                    type="number"
                    step="0.01"
                    value={invoiceForm.monto_factura}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, monto_factura: e.target.value })}
                  />
                </div>
                <button type="button" className="btn btn-secondary" onClick={handleCreateInvoice}>
                  Registrar factura
                </button>
              </div>
              {invoiceError && (
                <div className="alert alert-error" style={{ marginTop: 8 }}>
                  {invoiceError}
                </div>
              )}
            </div>
          )}

          {form.id && relatedBudget && (
            <div style={{ gridColumn: "span 3", borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "var(--color-text-secondary)" }}>
                Presupuesto relacionado — {relatedBudget.servicio_producto_nombre} ({relatedBudget.anio})
              </label>
              {(() => {
                const mes = Number(form.fecha_solped.slice(5, 7)) || 1;
                const detalle = relatedBudget.meses.find((m) => m.mes === mes);
                if (!detalle) return <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Sin datos para este mes.</p>;
                const porcentaje = Number(detalle.porcentaje_ejecutado);
                return (
                  <div className="stat-row">
                    <div className="stat-card">
                      <div className="stat-label">Presupuesto mensual</div>
                      <div className="stat-value" style={{ fontSize: 16 }}>
                        {Number(detalle.monto_mensual).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Total anual</div>
                      <div className="stat-value" style={{ fontSize: 16 }}>
                        {Number(relatedBudget.total_anual).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Ejecutado (mes)</div>
                      <div className="stat-value" style={{ fontSize: 16 }}>
                        {Number(detalle.ejecutado).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Saldo (mes)</div>
                      <div className="stat-value" style={{ fontSize: 16 }}>
                        {Number(detalle.disponible).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">% Ejecución</div>
                      <div className="stat-value">
                        <span className={`badge ${detalle.excedido ? "badge-danger" : porcentaje >= 80 ? "badge-warning" : "badge-success"}`}>
                          {porcentaje.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {formError && (
            <div className="alert alert-error" style={{ gridColumn: "span 3" }}>
              {formError}
            </div>
          )}

          <div style={{ gridColumn: "span 3", display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">
              {form.id ? "Guardar cambios" : "Registrar SOLPED"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => closeView()}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {activeView === "detalle" && viewingSolped && (
        <Modal title={`Detalle — SOLPED ${viewingSolped.numero_solped}`} onClose={closeView} width={620}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 14 }}>
            <div>
              <strong>Número:</strong> {viewingSolped.numero_solped}
            </div>
            <div>
              <strong>Empresa:</strong> {companyName(viewingSolped.company_id)}
            </div>
            <div>
              <strong>Tipo:</strong> {viewingSolped.tipo}
            </div>
            <div>
              <strong>Servicio/Producto:</strong> {viewingSolped.servicio_producto_nombre ?? "Sin vincular"}
            </div>
            <div>
              <strong>Contrato relacionado:</strong> {viewingSolped.contract_numero ?? "Sin contrato"}
            </div>
            <div>
              <strong>Fecha:</strong> {viewingSolped.fecha_solped}
            </div>
            <div>
              <strong>Monto de orden:</strong> {viewingSolped.moneda} {money(viewingSolped.monto_orden)}
            </div>
            <div>
              <strong>Estado:</strong> <span className="badge">{ESTADO_LABELS[viewingSolped.estado] ?? viewingSolped.estado}</span>
            </div>
            <div>
              <strong>Número de orden:</strong> {viewingSolped.numero_orden ?? "—"}
            </div>
            <div>
              <strong>Presupuestada:</strong> {viewingSolped.presupuestada ? "Sí" : "No"}
            </div>
            <div>
              <strong>Monto presupuesto:</strong> {viewingSolped.monto_presupuesto ? money(viewingSolped.monto_presupuesto) : "—"}
            </div>
            <div>
              <strong>Monto ejecutado:</strong> {viewingSolped.monto_ejecutado ? money(viewingSolped.monto_ejecutado) : "—"}
            </div>
            <div>
              <strong>Fecha de ejecución:</strong> {viewingSolped.fecha_ejecucion ?? "—"}
            </div>
            <div>
              <strong>Saldo:</strong> {viewingSolped.saldo !== null ? money(viewingSolped.saldo) : "—"}
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <strong>Descripción:</strong> {viewingSolped.descripcion ?? "—"}
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <strong>Observaciones:</strong> {viewingSolped.observaciones ?? "—"}
            </div>
          </div>
        </Modal>
      )}

      {activeView === "cotizacion" && viewingSolped && (
        <Modal title={`Cotización — SOLPED ${viewingSolped.numero_solped}`} onClose={closeView} width={480}>
          <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "var(--color-text-secondary)" }}>
            Adjunta, visualiza o descarga la cotización de esta SOLPED. No se muestra ninguna otra información.
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && viewingSolped.id) handleUploadCotizacion(viewingSolped.id, file);
              }}
              style={{ display: "inline-block", width: "auto" }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleDownloadCotizacion(viewingSolped.id)}
            >
              <Download size={16} />
              Ver / Descargar cotización
            </button>
          </div>
        </Modal>
      )}

      {activeView === "factura" && viewingSolped && (
        <Modal title={`Factura — SOLPED ${viewingSolped.numero_solped}`} onClose={closeView} width={720}>
          {invoices.length > 0 && (
            <table className="table" style={{ marginBottom: 14 }}>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Fecha de pago</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.numero_factura}</td>
                    <td>{inv.fecha_factura}</td>
                    <td>
                      {inv.moneda} {inv.monto_factura}
                    </td>
                    <td>
                      <span className={`badge ${inv.estado === "pagada" ? "badge-success" : "badge-warning"}`}>
                        {inv.estado === "pagada" ? "Pagada" : "Registrada"}
                      </span>
                    </td>
                    <td>{inv.fecha_pago ?? "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {inv.estado !== "pagada" && (
                        <button type="button" className="btn-link" onClick={() => handleMarkInvoicePaid(inv)}>
                          <Check size={14} />
                          Marcar pagada
                        </button>
                      )}
                      <button type="button" className="btn-danger-link" onClick={() => handleDeleteInvoice(inv)}>
                        <Trash2 size={14} />
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {invoices.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 0 }}>
              Esta SOLPED todavía no tiene facturas registradas.
            </p>
          )}

          <label style={{ display: "block", margin: "12px 0 8px", fontSize: 13, color: "var(--color-text-secondary)" }}>
            Registrar nueva factura
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field">
              <label style={{ fontSize: 12 }}>Número de factura</label>
              <input
                value={invoiceForm.numero_factura}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, numero_factura: e.target.value })}
              />
            </div>
            <div className="field">
              <label style={{ fontSize: 12 }}>Fecha de factura</label>
              <input
                type="date"
                value={invoiceForm.fecha_factura}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, fecha_factura: e.target.value })}
              />
            </div>
            <div className="field">
              <label style={{ fontSize: 12 }}>Monto</label>
              <input
                type="number"
                step="0.01"
                value={invoiceForm.monto_factura}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, monto_factura: e.target.value })}
              />
            </div>
            <button type="button" className="btn btn-secondary" onClick={handleCreateInvoice}>
              <Plus size={16} />
              Registrar factura
            </button>
          </div>
          {invoiceError && (
            <div className="alert alert-error" style={{ marginTop: 8 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {invoiceError}
            </div>
          )}
        </Modal>
      )}

      {activeView === "presupuesto" && viewingSolped && (
        <Modal title={`Presupuesto — SOLPED ${viewingSolped.numero_solped}`} onClose={closeView} width={640}>
          {!viewingSolped.servicio_producto_id && (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 0 }}>
              Esta SOLPED no tiene un Servicio/Producto vinculado, así que no puede relacionarse con ningún
              presupuesto.
            </p>
          )}
          {viewingSolped.servicio_producto_id && !relatedBudget && (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 0 }}>
              No existe un presupuesto registrado para "{viewingSolped.servicio_producto_nombre}" en el año de esta
              SOLPED.
            </p>
          )}
          {relatedBudget &&
            (() => {
              const mes = Number(form.fecha_solped.slice(5, 7)) || 1;
              const detalle = relatedBudget.meses.find((m) => m.mes === mes);
              if (!detalle)
                return (
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Sin datos para este mes.</p>
                );
              const porcentaje = Number(detalle.porcentaje_ejecutado);
              return (
                <>
                  <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 0 }}>
                    {relatedBudget.servicio_producto_nombre} — {relatedBudget.anio}
                  </p>
                  <div className="stat-row">
                    <div className="stat-card">
                      <div className="stat-label">Presupuesto mensual</div>
                      <div className="stat-value" style={{ fontSize: 16 }}>
                        {Number(detalle.monto_mensual).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Total anual</div>
                      <div className="stat-value" style={{ fontSize: 16 }}>
                        {Number(relatedBudget.total_anual).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Ejecutado (mes)</div>
                      <div className="stat-value" style={{ fontSize: 16 }}>
                        {Number(detalle.ejecutado).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Saldo (mes)</div>
                      <div className="stat-value" style={{ fontSize: 16 }}>
                        {Number(detalle.disponible).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">% Ejecución</div>
                      <div className="stat-value">
                        <span
                          className={`badge ${detalle.excedido ? "badge-danger" : porcentaje >= 80 ? "badge-warning" : "badge-success"}`}
                        >
                          {porcentaje.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
        </Modal>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Número</th>
            <th>Empresa</th>
            <th>Descripción del servicio/producto</th>
            <th>Fecha</th>
            <th>Monto</th>
            <th>Estado</th>
            <th>Saldo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {solpeds.map((s) => (
            <tr key={s.id}>
              <td>{s.numero_solped}</td>
              <td>{companyName(s.company_id)}</td>
              <td>{s.servicio_producto_nombre ?? s.descripcion ?? "—"}</td>
              <td>{s.fecha_solped}</td>
              <td>
                {s.moneda} {money(s.monto_orden)}
              </td>
              <td>
                <span className="badge">{ESTADO_LABELS[s.estado] ?? s.estado}</span>
              </td>
              <td>{s.saldo !== null ? money(s.saldo) : "—"}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <span className="tooltip" data-tooltip="Ver detalle">
                  <button className="btn-link" onClick={() => openDetalle(s)} aria-label="Ver detalle">
                    <Eye size={15} />
                  </button>
                </span>
                <span className="tooltip" data-tooltip="Factura">
                  <button className="btn-link" onClick={() => openFactura(s)} aria-label="Factura">
                    <Receipt size={15} />
                  </button>
                </span>
                <span className="tooltip" data-tooltip="Cotización">
                  <button className="btn-link" onClick={() => openCotizacion(s)} aria-label="Cotización">
                    <FileText size={15} />
                  </button>
                </span>
                <span className="tooltip" data-tooltip="Presupuesto">
                  <button className="btn-link" onClick={() => openPresupuesto(s)} aria-label="Presupuesto">
                    <PiggyBank size={15} />
                  </button>
                </span>
                {can("solped", "edit") && (
                  <button className="btn-link" onClick={() => openEdit(s)}>
                    Editar
                  </button>
                )}
                {can("solped", "delete") && (
                  <button className="btn-danger-link" onClick={() => handleDelete(s.id)}>
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
          {solpeds.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: 16, textAlign: "center", color: "var(--color-text-muted)" }}>
                No hay SOLPEDs que coincidan con los filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
