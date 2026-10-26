import {
  AlertCircle,
  Building2,
  Calculator,
  FileDown,
  Gauge,
  Plus,
  Receipt,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import { usePermissions } from "../../hooks/usePermissions";
import { printerLeasingService } from "../../services/printerLeasing.service";
import type {
  AllocationSummary,
  CostCenter,
  ImportSummary,
  PecuariaCompany,
  PrinterAllocation,
  PrinterConsumption,
  PrinterConsumptionCompany,
  PrinterInvoice,
} from "../../types/printerLeasing";
import { MESES_LABELS } from "../../types/printerLeasing";
import { downloadBlob } from "../../utils/download";

type Tab = "centros" | "consumo" | "facturas";

function money(value: string): string {
  const n = Number(value);
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LeasingImpresoras() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<Tab>("centros");

  const [pecuarias, setPecuarias] = useState<PecuariaCompany[]>([]);
  const [consumptionCompanies, setConsumptionCompanies] = useState<PrinterConsumptionCompany[]>([]);

  useEffect(() => {
    printerLeasingService.pecuariaCompanies().then(setPecuarias);
    printerLeasingService.consumptionCompanies().then(setConsumptionCompanies);
  }, []);

  return (
    <div>
      <h1>Leasing · Impresoras</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          className={tab === "centros" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setTab("centros")}
        >
          <Building2 size={16} />
          Centros de costo
        </button>
        <button
          className={tab === "consumo" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setTab("consumo")}
        >
          <Gauge size={16} />
          Consumo mensual
        </button>
        <button
          className={tab === "facturas" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setTab("facturas")}
        >
          <Receipt size={16} />
          Facturas y prorrateo
        </button>
      </div>

      {tab === "centros" && <CostCentersTab pecuarias={pecuarias} can={can} />}
      {tab === "consumo" && <ConsumptionTab pecuarias={pecuarias} can={can} />}
      {tab === "facturas" && (
        <InvoicesTab pecuarias={pecuarias} consumptionCompanies={consumptionCompanies} can={can} />
      )}
    </div>
  );
}

// ---------- Centros de costo ----------

function CostCentersTab({
  pecuarias,
  can,
}: {
  pecuarias: PecuariaCompany[];
  can: (m: string, a: string) => boolean;
}) {
  const [items, setItems] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", proceso: "" });
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);

  function pecuariaName(id: number) {
    return pecuarias.find((p) => p.id === id)?.name ?? "—";
  }

  async function reload() {
    const data = await printerLeasingService.costCenters.list();
    setItems(data);
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await printerLeasingService.costCenters.create({
        name: form.name,
        proceso: form.proceso || null,
      });
      setForm({ name: "", proceso: "" });
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "No se pudo crear el centro de costo");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este centro de costo?")) return;
    await printerLeasingService.costCenters.remove(id);
    await reload();
  }

  async function handleDownloadTemplate() {
    const response = await printerLeasingService.costCenters.downloadTemplate();
    downloadBlob(response.data, "plantilla_centros_costo.xlsx");
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await printerLeasingService.costCenters.importExcel(file);
      setImportResult(result);
      await reload();
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <div className="toolbar">
        {can("leasing_impresora", "import") && (
          <>
            <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
              <FileDown size={16} />
              Descargar plantilla
            </button>
            <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
              <Upload size={16} />
              {importing ? "Importando..." : "Importar Excel"}
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: "none" }} />
            </label>
          </>
        )}
      </div>

      {importResult && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          {importResult.insertados} nuevos, {importResult.actualizados} actualizados,{" "}
          {importResult.rechazados} rechazados.
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

      {can("leasing_impresora", "create") && (
        <form
          onSubmit={handleSubmit}
          className="card"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20, maxWidth: 700 }}
        >
          <div className="field">
            <label>Nombre (CECO)</label>
            <input
              value={form.name}
              placeholder="OF-001-123, VA-002-456..."
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              La empresa se identifica sola por el prefijo: OF=Oregon Foods, VA=Valora, PG=Protein Group,
              MP=MP San Antonio, TA=Tecnica Avicola.
            </span>
          </div>
          <div className="field">
            <label>Proceso</label>
            <input value={form.proceso} onChange={(e) => setForm({ ...form, proceso: e.target.value })} />
          </div>
          {error && (
            <div className="alert alert-error" style={{ gridColumn: "span 3" }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}
          <div style={{ gridColumn: "span 3" }}>
            <button type="submit" className="btn btn-primary">
              <Plus size={16} />
              Registrar centro de costo
            </button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Empresa pecuaria</th>
            <th>Proceso</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((cc) => (
            <tr key={cc.id}>
              <td>{cc.name}</td>
              <td>{pecuariaName(cc.pecuaria_company_id)}</td>
              <td>{cc.proceso ?? "—"}</td>
              <td>
                {can("leasing_impresora", "delete") && (
                  <button className="btn-danger-link" onClick={() => handleDelete(cc.id)}>
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: 16, textAlign: "center", color: "var(--color-text-muted)" }}>
                No hay centros de costo registrados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Consumo mensual ----------

function ConsumptionTab({
  pecuarias,
  can,
}: {
  pecuarias: PecuariaCompany[];
  can: (m: string, a: string) => boolean;
}) {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [items, setItems] = useState<PrinterConsumption[]>([]);
  const [filters, setFilters] = useState<{ anio?: number; mes?: number; pecuaria_company_id?: number }>({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ cost_center_id: "", usuario: "", anio: "2026", mes: "1", consumo: "" });
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);

  function costCenterName(id: number) {
    return costCenters.find((c) => c.id === id)?.name ?? "—";
  }

  async function reload() {
    const [ccData, consumption] = await Promise.all([
      printerLeasingService.costCenters.list(),
      printerLeasingService.consumption.list(filters),
    ]);
    setCostCenters(ccData);
    setItems(consumption);
  }

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await printerLeasingService.consumption.create({
        cost_center_id: Number(form.cost_center_id),
        usuario: form.usuario,
        anio: Number(form.anio),
        mes: Number(form.mes),
        consumo: form.consumo,
      });
      setForm({ cost_center_id: "", usuario: "", anio: "2026", mes: "1", consumo: "" });
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "No se pudo registrar el consumo");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este registro de consumo?")) return;
    await printerLeasingService.consumption.remove(id);
    await reload();
  }

  async function handleDownloadTemplate() {
    const response = await printerLeasingService.consumption.downloadTemplate();
    downloadBlob(response.data, "plantilla_consumo_impresoras.xlsx");
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await printerLeasingService.consumption.importExcel(file);
      setImportResult(result);
      await reload();
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <div className="toolbar">
        {can("leasing_impresora", "import") && (
          <>
            <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
              <FileDown size={16} />
              Descargar plantilla
            </button>
            <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
              <Upload size={16} />
              {importing ? "Importando..." : "Subir reporte de consumo"}
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: "none" }} />
            </label>
          </>
        )}
        <select
          value={filters.anio ?? ""}
          onChange={(e) => setFilters({ ...filters, anio: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">Todos los años</option>
          <option value={2026}>2026</option>
          <option value={2025}>2025</option>
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
        <select
          value={filters.pecuaria_company_id ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, pecuaria_company_id: e.target.value ? Number(e.target.value) : undefined })
          }
        >
          <option value="">Todas las pecuarias</option>
          {pecuarias.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {importResult && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          {importResult.insertados} nuevos, {importResult.actualizados} actualizados,{" "}
          {importResult.rechazados} rechazados.
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

      {can("leasing_impresora", "create") && (
        <form
          onSubmit={handleSubmit}
          className="card"
          style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}
        >
          <div className="field">
            <label>Centro de costo</label>
            <select
              value={form.cost_center_id}
              onChange={(e) => setForm({ ...form, cost_center_id: e.target.value })}
              required
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Usuario</label>
            <input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} required />
          </div>
          <div className="field">
            <label>Año / Mes</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="number"
                value={form.anio}
                onChange={(e) => setForm({ ...form, anio: e.target.value })}
                style={{ width: "50%" }}
              />
              <select value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })}>
                {MESES_LABELS.slice(1).map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Consumo</label>
            <input
              type="number"
              step="0.01"
              value={form.consumo}
              onChange={(e) => setForm({ ...form, consumo: e.target.value })}
              required
            />
          </div>
          {error && (
            <div className="alert alert-error" style={{ gridColumn: "span 4" }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}
          <div style={{ gridColumn: "span 4" }}>
            <button type="submit" className="btn btn-primary">
              <Plus size={16} />
              Registrar consumo
            </button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Centro de costo</th>
            <th>Usuario</th>
            <th>Proceso</th>
            <th>Periodo</th>
            <th>Consumo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>{costCenterName(c.cost_center_id)}</td>
              <td>{c.usuario}</td>
              <td>{c.proceso ?? "—"}</td>
              <td>
                {MESES_LABELS[c.mes]} {c.anio}
              </td>
              <td>{money(c.consumo)}</td>
              <td>
                {can("leasing_impresora", "delete") && (
                  <button className="btn-danger-link" onClick={() => handleDelete(c.id)}>
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 16, textAlign: "center", color: "var(--color-text-muted)" }}>
                No hay consumo registrado para estos filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Facturas y prorrateo ----------

function InvoicesTab({
  pecuarias,
  consumptionCompanies,
  can,
}: {
  pecuarias: PecuariaCompany[];
  consumptionCompanies: PrinterConsumptionCompany[];
  can: (m: string, a: string) => boolean;
}) {
  const [invoices, setInvoices] = useState<PrinterInvoice[]>([]);
  const [form, setForm] = useState({ printer_company_id: "", anio: "2026", mes: "1", monto_sin_igv: "", fecha_factura: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [allocations, setAllocations] = useState<PrinterAllocation[]>([]);
  const [allocationSummary, setAllocationSummary] = useState<AllocationSummary | null>(null);
  const [allocationFilters, setAllocationFilters] = useState<{ anio?: number; mes?: number; pecuaria_company_id?: number }>({});
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  function companyName(id: number) {
    return consumptionCompanies.find((c) => c.id === id)?.name ?? "—";
  }

  async function reload() {
    const data = await printerLeasingService.invoices.list({});
    setInvoices(data);
  }

  async function reloadAllocations() {
    const [data, summaryData] = await Promise.all([
      printerLeasingService.allocations.list(allocationFilters),
      printerLeasingService.allocations.summary(allocationFilters),
    ]);
    setAllocations(data);
    setAllocationSummary(summaryData);
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reloadAllocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocationFilters]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await printerLeasingService.invoices.create({
        printer_company_id: Number(form.printer_company_id),
        anio: Number(form.anio),
        mes: Number(form.mes),
        monto_sin_igv: form.monto_sin_igv,
        fecha_factura: form.fecha_factura,
      });
      setForm({ printer_company_id: "", anio: "2026", mes: "1", monto_sin_igv: "", fecha_factura: "" });
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "No se pudo registrar la factura");
    }
  }

  async function handleCalculate(invoiceId: number) {
    setCalcError(null);
    setSelectedInvoiceId(invoiceId);
    try {
      await printerLeasingService.invoices.calculateAllocation(invoiceId);
      await reloadAllocations();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCalcError(detail ?? "No se pudo calcular el prorrateo");
    }
  }

  async function handleDeleteInvoice(id: number) {
    if (!confirm("¿Eliminar esta factura? También se pierde su prorrateo calculado.")) return;
    await printerLeasingService.invoices.remove(id);
    await reload();
    await reloadAllocations();
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h2>Facturas mensuales</h2>

      {can("leasing_impresora", "create") && (
        <form
          onSubmit={handleSubmit}
          className="card"
          style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}
        >
          <div className="field">
            <label>Empresa de consumo</label>
            <select
              value={form.printer_company_id}
              onChange={(e) => setForm({ ...form, printer_company_id: e.target.value })}
              required
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {consumptionCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Año / Mes</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="number"
                value={form.anio}
                onChange={(e) => setForm({ ...form, anio: e.target.value })}
                style={{ width: "50%" }}
              />
              <select value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })}>
                {MESES_LABELS.slice(1).map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Monto sin IGV</label>
            <input
              type="number"
              step="0.01"
              value={form.monto_sin_igv}
              onChange={(e) => setForm({ ...form, monto_sin_igv: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Fecha de factura</label>
            <input
              type="date"
              value={form.fecha_factura}
              onChange={(e) => setForm({ ...form, fecha_factura: e.target.value })}
              required
            />
          </div>
          {error && (
            <div className="alert alert-error" style={{ gridColumn: "span 4" }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}
          <div style={{ gridColumn: "span 4" }}>
            <button type="submit" className="btn btn-primary">
              <Plus size={16} />
              Registrar factura
            </button>
          </div>
        </form>
      )}

      <table className="table" style={{ marginBottom: 28 }}>
        <thead>
          <tr>
            <th>Empresa de consumo</th>
            <th>Periodo</th>
            <th>Monto sin IGV</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td>{companyName(inv.printer_company_id)}</td>
              <td>
                {MESES_LABELS[inv.mes]} {inv.anio}
              </td>
              <td>{money(inv.monto_sin_igv)}</td>
              <td>{inv.fecha_factura}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                {can("leasing_impresora", "edit") && (
                  <button className="btn-link" onClick={() => handleCalculate(inv.id)}>
                    <Calculator size={14} />
                    Calcular prorrateo
                  </button>
                )}
                {can("leasing_impresora", "delete") && (
                  <button className="btn-danger-link" onClick={() => handleDeleteInvoice(inv.id)}>
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
          {invoices.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 16, textAlign: "center", color: "var(--color-text-muted)" }}>
                No hay facturas registradas.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {calcError && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {calcError}
        </div>
      )}
      {selectedInvoiceId && !calcError && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          Prorrateo calculado correctamente.
        </div>
      )}

      <h2>Prorrateo — consulta histórica</h2>

      {allocationSummary && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="card">
            <h3>Total por pecuaria</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 650, marginBottom: 2 }}>
                <span>Total del periodo</span>
                <span>S/ {allocationSummary.total_monto}</span>
              </div>
              {Object.entries(allocationSummary.por_pecuaria).map(([nombre, monto]) => {
                const pecuaria = pecuarias.find((p) => p.name === nombre);
                return (
                  <button
                    key={nombre}
                    className="btn-link"
                    style={{ textAlign: "left", display: "flex", justifyContent: "space-between", width: "100%" }}
                    onClick={() =>
                      pecuaria && setAllocationFilters({ ...allocationFilters, pecuaria_company_id: pecuaria.id })
                    }
                  >
                    <span>{nombre}</span>
                    <strong>S/ {monto}</strong>
                  </button>
                );
              })}
              {Object.keys(allocationSummary.por_pecuaria).length === 0 && (
                <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Sin registros.</p>
              )}
            </div>
          </div>
          <div className="card">
            <h3>Total por proceso</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(allocationSummary.por_proceso).map(([proceso, monto]) => (
                <div key={proceso} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span>{proceso}</span>
                  <strong>S/ {monto}</strong>
                </div>
              ))}
              {Object.keys(allocationSummary.por_proceso).length === 0 && (
                <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Sin registros.</p>
              )}
            </div>
          </div>
          <div className="card">
            <h3>Total por usuario</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
              {Object.entries(allocationSummary.por_usuario).map(([usuario, monto]) => (
                <div key={usuario} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span>{usuario}</span>
                  <strong>S/ {monto}</strong>
                </div>
              ))}
              {Object.keys(allocationSummary.por_usuario).length === 0 && (
                <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Sin registros.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={allocationFilters.anio ?? ""}
          onChange={(e) =>
            setAllocationFilters({
              ...allocationFilters,
              anio: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        >
          <option value="">Todos los años</option>
          <option value={2026}>2026</option>
          <option value={2025}>2025</option>
        </select>
        <select
          value={allocationFilters.mes ?? ""}
          onChange={(e) =>
            setAllocationFilters({
              ...allocationFilters,
              mes: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        >
          <option value="">Todos los meses</option>
          {MESES_LABELS.slice(1).map((label, i) => (
            <option key={label} value={i + 1}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={allocationFilters.pecuaria_company_id ?? ""}
          onChange={(e) =>
            setAllocationFilters({
              ...allocationFilters,
              pecuaria_company_id: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        >
          <option value="">Todas las pecuarias</option>
          {pecuarias.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Proceso</th>
            <th>Periodo</th>
            <th>Consumo</th>
            <th>% participación</th>
            <th>Monto a pagar</th>
          </tr>
        </thead>
        <tbody>
          {allocations.map((a) => (
            <tr key={a.id}>
              <td>{a.usuario}</td>
              <td>{a.proceso ?? "—"}</td>
              <td>
                {MESES_LABELS[a.mes]} {a.anio}
              </td>
              <td>{money(a.consumo)}</td>
              <td>{Number(a.porcentaje_participacion).toFixed(2)}%</td>
              <td>{money(a.monto_a_pagar)}</td>
            </tr>
          ))}
          {allocations.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 16, textAlign: "center", color: "var(--color-text-muted)" }}>
                No hay prorrateo calculado para estos filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
