import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  FileDown,
  FilterX,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import { usePermissions } from "../../hooks/usePermissions";
import { companiesService } from "../../services/companies.service";
import { licensesService } from "../../services/licenses.service";
import type { Company } from "../../types/company";
import type { ImportSummary, License, LicenseFilters, LicenseSummary } from "../../types/license";
import { formatDateDMY } from "../../utils/dateFormat";
import { downloadBlob, filenameFromContentDisposition } from "../../utils/download";

interface FormState {
  id: number | null;
  company_id: number | null;
  area: string;
  proceso: string;
  tipo: string;
  usuario: string;
  cuenta: string;
  precio: string;
  moneda: string;
  fecha_renovacion: string;
  observaciones: string;
}

const emptyForm: FormState = {
  id: null,
  company_id: null,
  area: "",
  proceso: "",
  tipo: "",
  usuario: "",
  cuenta: "",
  precio: "",
  moneda: "USD",
  fecha_renovacion: "",
  observaciones: "",
};

function money(value: string): string {
  const n = Number(value);
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LicenciasList() {
  const { can } = usePermissions();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [summary, setSummary] = useState<LicenseSummary | null>(null);
  const [filters, setFilters] = useState<LicenseFilters>({});
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [tipos, setTipos] = useState<string[]>([]);
  const [cascadeTipo, setCascadeTipo] = useState("");
  const [cascadePrecio, setCascadePrecio] = useState("");
  const [cascadeError, setCascadeError] = useState<string | null>(null);
  const [cascadeResult, setCascadeResult] = useState<string | null>(null);

  const companyName = (id: number | null) => (id === null ? "Sin empresa" : companies.find((c) => c.id === id)?.name ?? "—");

  async function reload() {
    const [companiesData, licensesData, summaryData, tiposData] = await Promise.all([
      companiesService.list(),
      licensesService.list(filters),
      licensesService.summary(filters),
      licensesService.types(),
    ]);
    setCompanies(companiesData);
    setLicenses(licensesData);
    setSummary(summaryData);
    setTipos(tiposData);
  }

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function handleCascadeUpdate(e: FormEvent) {
    e.preventDefault();
    setCascadeError(null);
    setCascadeResult(null);
    if (!cascadeTipo || !cascadePrecio) {
      setCascadeError("Selecciona un tipo e ingresa el nuevo precio");
      return;
    }
    try {
      const result = await licensesService.updatePriceByType(cascadeTipo, cascadePrecio);
      setCascadeResult(
        `Se actualizaron ${result.actualizadas} licencia(s) de tipo "${result.tipo}" al precio ${result.precio}.`
      );
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCascadeError(detail ?? "No se pudo actualizar el precio");
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(lic: License) {
    setForm({
      id: lic.id,
      company_id: lic.company_id,
      area: lic.area ?? "",
      proceso: lic.proceso ?? "",
      tipo: lic.tipo,
      usuario: lic.usuario ?? "",
      cuenta: lic.cuenta,
      precio: lic.precio,
      moneda: lic.moneda,
      fecha_renovacion: lic.fecha_renovacion ?? "",
      observaciones: lic.observaciones ?? "",
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
      const payload: Record<string, unknown> = {
        company_id: form.company_id,
        area: form.area || null,
        proceso: form.proceso || null,
        tipo: form.tipo,
        usuario: form.usuario || null,
        cuenta: form.cuenta,
        precio: form.precio,
        moneda: form.moneda,
        fecha_renovacion: form.fecha_renovacion || null,
        observaciones: form.observaciones || null,
      };

      if (form.id) {
        await licensesService.update(form.id, payload);
      } else {
        await licensesService.create(payload);
      }

      setShowForm(false);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(detail ?? "Ocurrió un error al guardar la licencia");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar esta licencia? Esta acción no se puede deshacer.")) return;
    try {
      await licensesService.remove(id);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(detail ?? "No se pudo eliminar la licencia");
    }
  }

  async function handleDownloadTemplate() {
    const response = await licensesService.downloadTemplate();
    downloadBlob(response.data, "plantilla_licencias.xlsx");
  }

  async function handleExport() {
    const response = await licensesService.exportExcel(filters);
    const filename = filenameFromContentDisposition(
      response.headers["content-disposition"],
      "licencias_export.xlsx"
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
      const result = await licensesService.importExcel(file);
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
      <h1>Licencias</h1>

      {summary && (
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-label">Total licencias</div>
            <div className="stat-value">{summary.total_licencias}</div>
          </div>
          {Object.entries(summary.por_tipo).map(([tipo, count]) => (
            <button
              key={tipo}
              onClick={() => setFilters({ ...filters, tipo })}
              className={`stat-card clickable${filters.tipo === tipo ? " active" : ""}`}
            >
              <div className="stat-label">{tipo}</div>
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

      {can("licencia", "edit") && (
        <form
          onSubmit={handleCascadeUpdate}
          className="card"
          style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 20 }}
        >
          <div className="field">
            <label style={{ fontSize: 12 }}>Actualizar precio por tipo de licencia</label>
            <select value={cascadeTipo} onChange={(e) => setCascadeTipo(e.target.value)} required>
              <option value="" disabled>
                Selecciona un tipo...
              </option>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label style={{ fontSize: 12 }}>Nuevo precio</label>
            <input
              type="number"
              step="0.01"
              value={cascadePrecio}
              onChange={(e) => setCascadePrecio(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            <RefreshCw size={16} />
            Aplicar a todas las licencias de ese tipo
          </button>
          {cascadeError && (
            <div className="alert alert-error" style={{ margin: 0 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {cascadeError}
            </div>
          )}
          {cascadeResult && (
            <div className="alert alert-success" style={{ margin: 0 }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {cascadeResult}
            </div>
          )}
        </form>
      )}

      <div className="toolbar">
        {can("licencia", "create") && (
          <button onClick={openCreate} className="btn btn-primary">
            <Plus size={16} />
            Nueva licencia
          </button>
        )}
        {can("licencia", "import") && (
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
        {can("licencia", "export") && (
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
          value={filters.tipo ?? ""}
          onChange={(e) => setFilters({ ...filters, tipo: e.target.value || undefined })}
        >
          <option value="">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <input
          placeholder="Filtrar por proceso..."
          value={filters.proceso ?? ""}
          onChange={(e) => setFilters({ ...filters, proceso: e.target.value || undefined })}
        />

        <input
          placeholder="Buscar usuario o cuenta..."
          value={filters.search ?? ""}
          onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
        />
        {(filters.company_id || filters.tipo || filters.proceso || filters.search) && (
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
            <label>Tipo</label>
            <input
              value={form.tipo}
              placeholder="Microsoft 365, Adobe, Zoom..."
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Cuenta</label>
            <input
              value={form.cuenta}
              placeholder="usuario@empresa.com"
              onChange={(e) => setForm({ ...form, cuenta: e.target.value })}
              required
            />
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
            <label>Usuario</label>
            <input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} />
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
            <label>Moneda</label>
            <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>
          <div className="field">
            <label>Fecha de renovación</label>
            <input
              type="date"
              value={form.fecha_renovacion}
              onChange={(e) => setForm({ ...form, fecha_renovacion: e.target.value })}
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
              {form.id ? "Guardar cambios" : "Registrar licencia"}
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
            <th>Tipo</th>
            <th>Cuenta</th>
            <th>Usuario</th>
            <th>Área / Proceso</th>
            <th>Precio</th>
            <th>Renovación</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {licenses.map((lic) => (
            <tr key={lic.id}>
              <td>{companyName(lic.company_id)}</td>
              <td>{lic.tipo}</td>
              <td>{lic.cuenta}</td>
              <td>{lic.usuario ?? "—"}</td>
              <td>
                {lic.area ?? "—"} / {lic.proceso ?? "—"}
              </td>
              <td>
                {lic.moneda} {money(lic.precio)}
              </td>
              <td>{formatDateDMY(lic.fecha_renovacion)}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                {can("licencia", "edit") && (
                  <button className="btn-link" onClick={() => openEdit(lic)}>
                    <Pencil size={14} />
                    Editar
                  </button>
                )}
                {can("licencia", "delete") && (
                  <button className="btn-danger-link" onClick={() => handleDelete(lic.id)}>
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
          {licenses.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: 16, textAlign: "center", color: "var(--color-text-muted)" }}>
                No hay licencias que coincidan con los filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
