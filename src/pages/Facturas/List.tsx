import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { companiesService } from "../../services/companies.service";
import { dashboardService } from "../../services/dashboard.service";
import type { Company } from "../../types/company";
import type { GlobalInvoice } from "../../types/dashboard";

function money(value: string): string {
  const n = Number(value);
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FacturasList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [invoices, setInvoices] = useState<GlobalInvoice[]>([]);
  const [estado, setEstado] = useState(searchParams.get("estado") ?? "");
  const [companyId, setCompanyId] = useState(searchParams.get("company_id") ?? "");
  const [loading, setLoading] = useState(true);

  const companyName = (id: number) => companies.find((c) => c.id === id)?.name ?? "—";

  async function reload() {
    const [companiesData, invoicesData] = await Promise.all([
      companiesService.list(),
      dashboardService.facturas(estado || undefined, companyId ? Number(companyId) : undefined),
    ]);
    setCompanies(companiesData);
    setInvoices(invoicesData);
  }

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, companyId]);

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h1>Facturas</h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>
        Vista de todas las facturas del sistema. Para registrar o pagar una factura, hazlo desde su SOLPED.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="registrada">Registrada</option>
          <option value="pagada">Pagada</option>
        </select>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">Todas las empresas</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {(estado || companyId) && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              setEstado("");
              setCompanyId("");
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>N.º de factura</th>
            <th>SOLPED</th>
            <th>Empresa</th>
            <th>Fecha</th>
            <th>Monto</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.numero_factura}</td>
              <td>{inv.numero_solped}</td>
              <td>{companyName(inv.company_id)}</td>
              <td>{inv.fecha_factura}</td>
              <td>
                {inv.moneda} {money(inv.monto_factura)}
              </td>
              <td>
                <span className={`badge ${inv.estado === "pagada" ? "badge-success" : "badge-warning"}`}>
                  {inv.estado === "pagada" ? "Pagada" : "Registrada"}
                </span>
              </td>
              <td>
                <button
                  className="btn-link"
                  onClick={() => navigate(`/solpeds?search=${encodeURIComponent(inv.numero_solped)}`)}
                >
                  Ver SOLPED
                </button>
              </td>
            </tr>
          ))}
          {invoices.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 16, textAlign: "center", color: "var(--color-text-muted)" }}>
                No hay facturas que coincidan con los filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
