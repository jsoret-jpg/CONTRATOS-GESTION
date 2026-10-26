import {
  AlertCircle,
  Building2,
  Check,
  ClipboardList,
  Download,
  FileDown,
  FilterX,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import BackButton from "../../components/BackButton";
import { usePermissions } from "../../hooks/usePermissions";
import { companiesService } from "../../services/companies.service";
import { computerLeasingService } from "../../services/computerLeasing.service";
import { providersService } from "../../services/providers.service";
import type { Company } from "../../types/company";
import {
  ESTADO_RENOVACION_BADGE,
  ESTADO_RENOVACION_LABELS,
  ESTADOS_RENOVACION,
  SIN_CONTRATO_LABEL,
  type ComputerLeasing,
  type ComputerLeasingFilters,
  type ComputerLeasingSummary,
  type ImportSummary,
} from "../../types/computerLeasing";
import { formatDateDMY } from "../../utils/dateFormat";
import { downloadBlob, filenameFromContentDisposition } from "../../utils/download";

interface FormState {
  id: number | null;
  company_id: number | null;
  area: string;
  proceso: string;
  usuario: string;
  precio: string;
  contrato: string;
  proveedor_nombre: string;
  fecha_asignacion: string;
  fecha_renovacion: string;
  equipo: string;
  modelo: string;
  observaciones: string;
}

const emptyForm: FormState = {
  id: null,
  company_id: null,
  area: "",
  proceso: "",
  usuario: "",
  precio: "",
  contrato: "",
  proveedor_nombre: "",
  fecha_asignacion: "",
  fecha_renovacion: "",
  equipo: "",
  modelo: "",
  observaciones: "",
};

function money(value: string): string {
  const n = Number(value);
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LeasingComputadorasList() {
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [items, setItems] = useState<ComputerLeasing[]>([]);
  const [summary, setSummary] = useState<ComputerLeasingSummary | null>(null);
  const [filters, setFilters] = useState<ComputerLeasingFilters>(() => ({
    company_id: searchParams.get("company_id") ? Number(searchParams.get("company_id")) : undefined,
    proceso: searchParams.get("proceso") ?? undefined,
    estado: searchParams.get("estado") ?? undefined,
    contrato: searchParams.get("contrato") ?? undefined,
    sin_contrato: searchParams.get("sin_contrato") === "true" ? true : undefined,
  }));
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [detailView, setDetailView] = useState<{
    titulo: string;
    items: ComputerLeasing[];
    porProceso: Record<string, number>;
    porProcesoCount: Record<string, number>;
    total: number;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [procesoFiltroDetalle, setProcesoFiltroDetalle] = useState<string>("");
  const [mostrarResumenDetalle, setMostrarResumenDetalle] = useState(false);

  const companyName = (id: number | null) => (id === null ? "Sin empresa" : companies.find((c) => c.id === id)?.name ?? "—");

  async function reload() {
    const [companiesData, itemsData, summaryData] = await Promise.all([
      companiesService.list(),
      computerLeasingService.list(filters),
      computerLeasingService.summary(filters),
    ]);
    setCompanies(companiesData);
    setItems(itemsData);
    setSummary(summaryData);
  }

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function openCreate() {
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(item: ComputerLeasing) {
    setForm({
      id: item.id,
      company_id: item.company_id,
      area: item.area ?? "",
      proceso: item.proceso ?? "",
      usuario: item.usuario ?? "",
      precio: item.precio,
      contrato: item.contrato ?? "",
      proveedor_nombre: "",
      fecha_asignacion: item.fecha_asignacion,
      fecha_renovacion: item.fecha_renovacion,
      equipo: item.equipo,
      modelo: item.modelo ?? "",
      observaciones: item.observaciones ?? "",
    });
    setFormError(null);
    setShowForm(true);
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
        area: form.area || null,
        proceso: form.proceso || null,
        usuario: form.usuario || null,
        precio: form.precio,
        contrato: form.contrato || null,
        fecha_asignacion: form.fecha_asignacion,
        fecha_renovacion: form.fecha_renovacion,
        equipo: form.equipo,
        modelo: form.modelo || null,
        observaciones: form.observaciones || null,
      };
      if (provider_id) payload.provider_id = provider_id;

      if (form.id) {
        await computerLeasingService.update(form.id, payload);
      } else {
        await computerLeasingService.create(payload);
      }

      setShowForm(false);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(detail ?? "Ocurrió un error al guardar el registro");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
    try {
      await computerLeasingService.remove(id);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(detail ?? "No se pudo eliminar el registro");
    }
  }

  async function handleDownloadTemplate() {
    const response = await computerLeasingService.downloadTemplate();
    downloadBlob(response.data, "plantilla_leasing_computadoras.xlsx");
  }

  async function handleExport() {
    const response = await computerLeasingService.exportExcel(filters);
    const filename = filenameFromContentDisposition(
      response.headers["content-disposition"],
      "leasing_computadoras_export.xlsx"
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
      const result = await computerLeasingService.importExcel(file);
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

  async function openEmpresaDetail(empresaNombre: string) {
    setDetailLoading(true);
    setProcesoFiltroDetalle("");
    setMostrarResumenDetalle(false);
    try {
      const company = companies.find((c) => c.name === empresaNombre);
      let detailItems: ComputerLeasing[];
      if (company) {
        detailItems = await computerLeasingService.list({ company_id: company.id });
      } else {
        // "Sin asignar": no hay filtro directo en el backend para esto, se filtra en el cliente.
        const todos = await computerLeasingService.list({});
        detailItems = todos.filter((item) => item.company_id === null);
      }
      const porProceso: Record<string, number> = {};
      const porProcesoCount: Record<string, number> = {};
      let total = 0;
      detailItems.forEach((item) => {
        const proceso = item.proceso ?? "Sin proceso";
        const precio = Number(item.precio);
        porProceso[proceso] = (porProceso[proceso] ?? 0) + precio;
        porProcesoCount[proceso] = (porProcesoCount[proceso] ?? 0) + 1;
        total += precio;
      });
      setDetailView({ titulo: `Empresa: ${empresaNombre}`, items: detailItems, porProceso, porProcesoCount, total });
    } finally {
      setDetailLoading(false);
    }
  }

  async function openContratoDetail(contratoNombre: string) {
    setDetailLoading(true);
    setProcesoFiltroDetalle("");
    setMostrarResumenDetalle(false);
    try {
      const esSinContrato = contratoNombre === SIN_CONTRATO_LABEL;
      const detailItems = await computerLeasingService.list(
        esSinContrato ? { sin_contrato: true } : { contrato: contratoNombre }
      );
      const porProceso: Record<string, number> = {};
      const porProcesoCount: Record<string, number> = {};
      let total = 0;
      detailItems.forEach((item) => {
        const proceso = item.proceso ?? "Sin proceso";
        const precio = Number(item.precio);
        porProceso[proceso] = (porProceso[proceso] ?? 0) + precio;
        porProcesoCount[proceso] = (porProcesoCount[proceso] ?? 0) + 1;
        total += precio;
      });
      setDetailView({
        titulo: esSinContrato ? "Equipos sin contrato" : `Contrato: ${contratoNombre}`,
        items: detailItems,
        porProceso,
        porProcesoCount,
        total,
      });
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetailView() {
    setDetailView(null);
    setProcesoFiltroDetalle("");
    setMostrarResumenDetalle(false);
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h1>Leasing · Computadoras</h1>

      {summary && !detailView && (
        <>
          <div className="stat-row">
            <div className="stat-card">
              <div className="stat-label">Total equipos</div>
              <div className="stat-value">{summary.total}</div>
            </div>
            {ESTADOS_RENOVACION.map((estado) => (
              <button
                key={estado}
                onClick={() => setFilters({ ...filters, estado })}
                className={`stat-card clickable${filters.estado === estado ? " active" : ""}`}
              >
                <div className="stat-label">{ESTADO_RENOVACION_LABELS[estado]}</div>
                <div className="stat-value">{summary.por_estado[estado] ?? 0}</div>
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div className="card">
              <h2>Total pagado por empresa</h2>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: -6, marginBottom: 10 }}>
                Selecciona una empresa para ver el detalle de sus equipos.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(summary.total_por_empresa).map(([empresa, monto]) => (
                  <button
                    key={empresa}
                    className="btn-link"
                    style={{ textAlign: "left", display: "flex", justifyContent: "space-between" }}
                    onClick={() => openEmpresaDetail(empresa)}
                  >
                    <span>{empresa}</span>
                    <strong>S/ {money(monto)}</strong>
                  </button>
                ))}
                {Object.keys(summary.total_por_empresa).length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Sin registros.</p>
                )}
              </div>
            </div>

            <div className="card">
              <h2>Total pagado por proceso</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(summary.total_por_proceso).map(([proceso, monto]) => (
                  <button
                    key={proceso}
                    className="btn-link"
                    style={{ textAlign: "left", display: "flex", justifyContent: "space-between" }}
                    onClick={() => setFilters({ ...filters, proceso })}
                  >
                    <span>{proceso}</span>
                    <strong>S/ {money(monto)}</strong>
                  </button>
                ))}
                {Object.keys(summary.total_por_proceso).length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Sin registros.</p>
                )}
              </div>
            </div>

            <div className="card">
              <h2>Total pagado por contrato</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(summary.total_por_contrato).map(([contrato, monto]) => (
                  <button
                    key={contrato}
                    className="btn-link"
                    style={{ textAlign: "left", display: "flex", justifyContent: "space-between" }}
                    onClick={() => openContratoDetail(contrato)}
                  >
                    <span>{contrato}</span>
                    <strong>S/ {money(monto)}</strong>
                  </button>
                ))}
                {Object.keys(summary.total_por_contrato).length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Sin registros.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {detailLoading && <p>Cargando detalle...</p>}

      {detailView && !detailLoading && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Building2 size={16} color="var(--color-primary)" />
              {detailView.titulo}
            </h2>
            <BackButton onClick={closeDetailView} />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
            <div className="field" style={{ minWidth: 220 }}>
              <label style={{ fontSize: 12 }}>Filtrar por proceso</label>
              <select value={procesoFiltroDetalle} onChange={(e) => setProcesoFiltroDetalle(e.target.value)}>
                <option value="">Todos los procesos</option>
                {Object.keys(detailView.porProceso)
                  .sort()
                  .map((proceso) => (
                    <option key={proceso} value={proceso}>
                      {proceso}
                    </option>
                  ))}
              </select>
            </div>
            <button className="btn btn-secondary" onClick={() => setMostrarResumenDetalle((prev) => !prev)}>
              <ClipboardList size={16} />
              {mostrarResumenDetalle ? "Ocultar detalle" : "Detalle"}
            </button>
          </div>

          {(() => {
            const itemsFiltrados = procesoFiltroDetalle
              ? detailView.items.filter((item) => (item.proceso ?? "Sin proceso") === procesoFiltroDetalle)
              : detailView.items;
            const totalFiltrado = itemsFiltrados.reduce((acc, item) => acc + Number(item.precio), 0);

            return (
              <>
                <div className="stat-row" style={{ marginBottom: 16 }}>
                  <div className="stat-card">
                    <div className="stat-label">
                      {procesoFiltroDetalle ? `Total — ${procesoFiltroDetalle}` : "Total general"}
                    </div>
                    <div className="stat-value" style={{ fontSize: 18 }}>
                      S/ {money(String(totalFiltrado))}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Equipos {procesoFiltroDetalle ? "en este proceso" : ""}</div>
                    <div className="stat-value">{itemsFiltrados.length}</div>
                  </div>
                </div>

                {mostrarResumenDetalle && (
                  <>
                    <h3 style={{ fontSize: 14 }}>Total y cantidad por proceso</h3>
                    <table className="table" style={{ marginBottom: 16 }}>
                      <thead>
                        <tr>
                          <th>Proceso</th>
                          <th style={{ textAlign: "right" }}>Cantidad de equipos</th>
                          <th style={{ textAlign: "right" }}>Total pagado</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ fontWeight: 650 }}>
                          <td>Total general</td>
                          <td style={{ textAlign: "right" }}>{detailView.items.length}</td>
                          <td style={{ textAlign: "right" }}>S/ {money(String(detailView.total))}</td>
                        </tr>
                        {Object.entries(detailView.porProceso).map(([proceso, monto]) => (
                          <tr key={proceso}>
                            <td>{proceso}</td>
                            <td style={{ textAlign: "right" }}>{detailView.porProcesoCount[proceso] ?? 0}</td>
                            <td style={{ textAlign: "right" }}>S/ {money(String(monto))}</td>
                          </tr>
                        ))}
                        {Object.keys(detailView.porProceso).length === 0 && (
                          <tr>
                            <td colSpan={3} style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
                              Sin registros.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </>
                )}

                <h3 style={{ fontSize: 14 }}>Equipos</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Proceso</th>
                      <th>Equipo</th>
                      <th>Modelo</th>
                      <th>Renovación</th>
                      <th style={{ textAlign: "right" }}>Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsFiltrados.map((item) => (
                      <tr key={item.id}>
                        <td>{item.usuario ?? "—"}</td>
                        <td>{item.proceso ?? "Sin proceso"}</td>
                        <td>{item.equipo}</td>
                        <td>{item.modelo ?? "—"}</td>
                        <td>
                          <span className={`badge ${ESTADO_RENOVACION_BADGE[item.renovacion_estado] ?? ""}`}>
                            {item.renovacion_texto}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>{money(item.precio)}</td>
                      </tr>
                    ))}
                    {itemsFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
                          Sin equipos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            );
          })()}
        </div>
      )}

      {!detailView && (
        <>
      <div className="toolbar">
        {can("leasing_computadora", "create") && (
          <button onClick={openCreate} className="btn btn-primary">
            <Plus size={16} />
            Nuevo equipo
          </button>
        )}
        {can("leasing_computadora", "import") && (
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
        {can("leasing_computadora", "export") && (
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

        <input
          placeholder="Buscar usuario, equipo o modelo..."
          value={filters.search ?? ""}
          onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
        />
        {(filters.company_id ||
          filters.estado ||
          filters.proceso ||
          filters.search ||
          filters.contrato ||
          filters.sin_contrato) && (
          <button onClick={() => setFilters({})} className="btn btn-secondary">
            <FilterX size={16} />
            Limpiar filtros
          </button>
        )}
      </div>

      {importResult && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <strong>Resultado de la importación:</strong> {importResult.insertados} nuevos,{" "}
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
            <label>Equipo</label>
            <input
              value={form.equipo}
              placeholder="Laptop, Desktop..."
              onChange={(e) => setForm({ ...form, equipo: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Modelo</label>
            <input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
          </div>
          <div className="field">
            <label>Usuario</label>
            <input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} />
          </div>
          <div className="field">
            <label>Área</label>
            <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          </div>
          <div className="field">
            <label>Proceso</label>
            <input value={form.proceso} onChange={(e) => setForm({ ...form, proceso: e.target.value })} />
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
            <label>Contrato</label>
            <input value={form.contrato} onChange={(e) => setForm({ ...form, contrato: e.target.value })} />
          </div>
          <div className="field">
            <label>Precio</label>
            <input
              type="number"
              step="0.01"
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Fecha de asignación</label>
            <input
              type="date"
              value={form.fecha_asignacion}
              onChange={(e) => setForm({ ...form, fecha_asignacion: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Fecha de renovación</label>
            <input
              type="date"
              value={form.fecha_renovacion}
              onChange={(e) => setForm({ ...form, fecha_renovacion: e.target.value })}
              required
            />
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
              {form.id ? "Guardar cambios" : "Registrar equipo"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
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
            <th>Usuario</th>
            <th>Equipo</th>
            <th>Modelo</th>
            <th>Contrato</th>
            <th>Fecha de renovación</th>
            <th>Renovación</th>
            <th>Precio</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{companyName(item.company_id)}</td>
              <td>{item.usuario ?? "—"}</td>
              <td>{item.equipo}</td>
              <td>{item.modelo ?? "—"}</td>
              <td>{item.contrato ?? SIN_CONTRATO_LABEL}</td>
              <td>{formatDateDMY(item.fecha_renovacion)}</td>
              <td>
                <span className={`badge ${ESTADO_RENOVACION_BADGE[item.renovacion_estado] ?? ""}`}>
                  {item.renovacion_texto}
                </span>
              </td>
              <td>{money(item.precio)}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                {can("leasing_computadora", "edit") && (
                  <button className="btn-link" onClick={() => openEdit(item)}>
                    <Pencil size={14} />
                    Editar
                  </button>
                )}
                {can("leasing_computadora", "delete") && (
                  <button className="btn-danger-link" onClick={() => handleDelete(item.id)}>
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={9} style={{ padding: 16, textAlign: "center", color: "var(--color-text-muted)" }}>
                No hay equipos que coincidan con los filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
        </>
      )}
    </div>
  );
}
