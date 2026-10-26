import {
  AlertCircle,
  Check,
  Download,
  Eye,
  FileDown,
  FilterX,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Fragment } from "react";
import { useSearchParams } from "react-router-dom";

import BackButton from "../../components/BackButton";
import { usePermissions } from "../../hooks/usePermissions";
import { companiesService } from "../../services/companies.service";
import { contractsService } from "../../services/contracts.service";
import { providersService } from "../../services/providers.service";
import type { Company } from "../../types/company";
import {
  ESTADO_CONTRATO_BADGE,
  ESTADO_CONTRATO_LABELS,
  ESTADOS_CONTRATO,
  type Contract,
  type ContractFilters,
  type ContractSummary,
  type ImportSummary,
} from "../../types/contract";
import { downloadBlob, filenameFromContentDisposition } from "../../utils/download";

interface FormState {
  id: number | null;
  numero_contrato: string;
  company_id: number | null;
  descripcion_servicio: string;
  cantidad: string;
  sede: string;
  fecha_inicio: string;
  fecha_fin: string;
  tipo_contrato: string;
  monto_igv: string;
  proveedor_nombre: string;
  observaciones: string;
}

const emptyForm: FormState = {
  id: null,
  numero_contrato: "",
  company_id: null,
  descripcion_servicio: "",
  cantidad: "1",
  sede: "",
  fecha_inicio: "",
  fecha_fin: "",
  tipo_contrato: "",
  monto_igv: "",
  proveedor_nombre: "",
  observaciones: "",
};

function money(value: string): string {
  const n = Number(value);
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ContratosList() {
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [summary, setSummary] = useState<ContractSummary | null>(null);
  const [filters, setFilters] = useState<ContractFilters>(() => ({
    estado: searchParams.get("estado") ?? undefined,
    company_id: searchParams.get("company_id") ? Number(searchParams.get("company_id")) : undefined,
    search: searchParams.get("search") ?? undefined,
  }));
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [viewingId, setViewingId] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const companyName = (id: number | null) => (id === null ? "Sin empresa" : companies.find((c) => c.id === id)?.name ?? "—");

  async function reload() {
    const [companiesData, contractsData, summaryData] = await Promise.all([
      companiesService.list(),
      contractsService.list(filters),
      contractsService.summary(),
    ]);
    setCompanies(companiesData);
    setContracts(contractsData);
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

  function toggleView(id: number) {
    setFileError(null);
    setViewingId(viewingId === id ? null : id);
  }

  async function handleUploadContractFile(id: number, file: File) {
    setFileError(null);
    setUploadingFile(true);
    try {
      await contractsService.uploadFile(id, file);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFileError(detail ?? "No se pudo adjuntar el archivo");
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleDownloadContractFile(id: number) {
    try {
      const response = await contractsService.downloadFile(id);
      const filename = filenameFromContentDisposition(response.headers["content-disposition"], "contrato.pdf");
      downloadBlob(response.data, filename);
    } catch {
      setFileError("Este contrato no tiene archivo adjunto");
    }
  }

  async function handleRemoveContractFile(id: number) {
    if (!confirm("¿Eliminar el archivo adjunto de este contrato?")) return;
    await contractsService.removeFile(id);
    await reload();
  }

  function openEdit(c: Contract) {
    setForm({
      id: c.id,
      numero_contrato: c.numero_contrato,
      company_id: c.company_id,
      descripcion_servicio: c.descripcion_servicio,
      cantidad: String(c.cantidad),
      sede: c.sede ?? "",
      fecha_inicio: c.fecha_inicio,
      fecha_fin: c.fecha_fin,
      tipo_contrato: c.tipo_contrato,
      monto_igv: c.monto_igv,
      proveedor_nombre: "",
      observaciones: c.observaciones ?? "",
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
        descripcion_servicio: form.descripcion_servicio,
        cantidad: Number(form.cantidad || "1"),
        sede: form.sede || null,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        tipo_contrato: form.tipo_contrato,
        monto_igv: form.monto_igv,
        observaciones: form.observaciones || null,
      };
      if (provider_id) payload.provider_id = provider_id;

      if (form.id) {
        await contractsService.update(form.id, payload);
      } else {
        payload.numero_contrato = form.numero_contrato;
        await contractsService.create(payload);
      }

      setShowForm(false);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(detail ?? "Ocurrió un error al guardar el contrato");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este contrato? Esta acción no se puede deshacer.")) return;
    try {
      await contractsService.remove(id);
      await reload();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(detail ?? "No se pudo eliminar el contrato");
    }
  }

  async function handleDownloadTemplate() {
    const response = await contractsService.downloadTemplate();
    downloadBlob(response.data, "plantilla_contratos.xlsx");
  }

  async function handleExport() {
    const response = await contractsService.exportExcel(filters);
    const filename = filenameFromContentDisposition(
      response.headers["content-disposition"],
      "contratos_export.xlsx"
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
      const result = await contractsService.importExcel(file);
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
      <h1>Contratos</h1>

      {summary && (
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-label">Total contratos</div>
            <div className="stat-value">{summary.total_contratos}</div>
          </div>
          {ESTADOS_CONTRATO.map((estado) => (
            <button
              key={estado}
              onClick={() => setFilters({ ...filters, estado })}
              className={`stat-card clickable${filters.estado === estado ? " active" : ""}`}
            >
              <div className="stat-label">{ESTADO_CONTRATO_LABELS[estado]}</div>
              <div className="stat-value">{summary.por_estado[estado] ?? 0}</div>
            </button>
          ))}
        </div>
      )}

      <div className="toolbar">
        {can("contrato", "create") && (
          <button onClick={openCreate} className="btn btn-primary">
            <Plus size={16} />
            Nuevo contrato
          </button>
        )}
        {can("contrato", "import") && (
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
        {can("contrato", "export") && (
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
          value={filters.estado ?? ""}
          onChange={(e) => setFilters({ ...filters, estado: e.target.value || undefined })}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_CONTRATO.map((estado) => (
            <option key={estado} value={estado}>
              {ESTADO_CONTRATO_LABELS[estado]}
            </option>
          ))}
        </select>

        <input
          placeholder="Buscar número de contrato..."
          value={filters.search ?? ""}
          onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
        />
        {(filters.estado || filters.company_id || filters.search) && (
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
            <label>Número de contrato / circuito (opcional)</label>
            <input
              value={form.numero_contrato}
              disabled={!!form.id}
              placeholder="Se autogenera si lo dejas vacío"
              onChange={(e) => setForm({ ...form, numero_contrato: e.target.value })}
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
            <label>Tipo de contrato</label>
            <input
              value={form.tipo_contrato}
              placeholder="Servicio, Arrendamiento, Mantenimiento..."
              onChange={(e) => setForm({ ...form, tipo_contrato: e.target.value })}
              required
            />
          </div>
          <div className="field" style={{ gridColumn: "span 3" }}>
            <label>Descripción del servicio</label>
            <input
              value={form.descripcion_servicio}
              onChange={(e) => setForm({ ...form, descripcion_servicio: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Cantidad</label>
            <input
              type="number"
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Sede</label>
            <input value={form.sede} onChange={(e) => setForm({ ...form, sede: e.target.value })} />
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
            <label>Fecha de inicio</label>
            <input
              type="date"
              value={form.fecha_inicio}
              onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Fecha de fin</label>
            <input
              type="date"
              value={form.fecha_fin}
              onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Monto con IGV</label>
            <input
              type="number"
              step="0.01"
              value={form.monto_igv}
              onChange={(e) => setForm({ ...form, monto_igv: e.target.value })}
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
              {form.id ? "Guardar cambios" : "Registrar contrato"}
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
            <th>Número</th>
            <th>Empresa</th>
            <th>Descripción</th>
            <th>Fecha de inicio</th>
            <th>Fecha de fin</th>
            <th>Meses faltantes</th>
            <th>Estado</th>
            <th>Monto con IGV</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => (
            <Fragment key={c.id}>
              <tr>
                <td>{c.numero_contrato}</td>
                <td>{companyName(c.company_id)}</td>
                <td>{c.descripcion_servicio}</td>
                <td>{c.fecha_inicio}</td>
                <td>{c.fecha_fin}</td>
                <td>{c.meses_faltantes}</td>
                <td>
                  <span className={`badge ${ESTADO_CONTRATO_BADGE[c.estado] ?? "badge"}`}>
                    {ESTADO_CONTRATO_LABELS[c.estado] ?? c.estado}
                  </span>
                </td>
                <td>{money(c.monto_igv)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn-link" onClick={() => toggleView(c.id)}>
                    <Eye size={14} />
                    {viewingId === c.id ? "Ocultar" : "Ver contrato"}
                  </button>
                  {can("contrato", "edit") && (
                    <button className="btn-link" onClick={() => openEdit(c)}>
                      <Pencil size={14} />
                      Editar
                    </button>
                  )}
                  {can("contrato", "delete") && (
                    <button className="btn-danger-link" onClick={() => handleDelete(c.id)}>
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
              {viewingId === c.id && (
                <tr>
                  <td colSpan={9} style={{ background: "var(--color-accent-light)", padding: 16 }}>
                    <BackButton onClick={() => toggleView(c.id)} label="Atrás a la lista" />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 12 }}>
                      <div>
                        <strong>Número:</strong> {c.numero_contrato}
                      </div>
                      <div>
                        <strong>Empresa:</strong> {companyName(c.company_id)}
                      </div>
                      <div>
                        <strong>Descripción:</strong> {c.descripcion_servicio}
                      </div>
                      <div>
                        <strong>Sede:</strong> {c.sede ?? "—"}
                      </div>
                      <div>
                        <strong>Tipo:</strong> {c.tipo_contrato}
                      </div>
                      <div>
                        <strong>Vigencia:</strong> {c.fecha_inicio} — {c.fecha_fin}
                      </div>
                      <div>
                        <strong>Monto con IGV:</strong> {money(c.monto_igv)}
                      </div>
                      <div>
                        <strong>Observaciones:</strong> {c.observaciones ?? "—"}
                      </div>
                    </div>

                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--color-text-secondary)" }}>
                      Archivo del contrato
                    </label>
                    {c.tiene_archivo ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <button className="btn btn-secondary" onClick={() => handleDownloadContractFile(c.id)}>
                          <Download size={15} />
                          Descargar / Ver
                        </button>
                        {can("contrato", "edit") && (
                          <button className="btn-danger-link" onClick={() => handleRemoveContractFile(c.id)}>
                            <Trash2 size={14} />
                            Quitar archivo
                          </button>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 8px" }}>
                        Este contrato no tiene archivo adjunto.
                      </p>
                    )}
                    {can("contrato", "edit") && (
                      <div style={{ marginTop: 8 }}>
                        <input
                          type="file"
                          disabled={uploadingFile}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadContractFile(c.id, file);
                            e.target.value = "";
                          }}
                          style={{ display: "inline-block", width: "auto" }}
                        />
                      </div>
                    )}
                    {fileError && (
                      <div className="alert alert-error" style={{ marginTop: 8 }}>
                        {fileError}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {contracts.length === 0 && (
            <tr>
              <td colSpan={9} style={{ padding: 16, textAlign: "center", color: "var(--color-text-muted)" }}>
                No hay contratos que coincidan con los filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
