import { api } from "./api";
import type { DashboardSummary, GlobalInvoice } from "../types/dashboard";

export const dashboardService = {
  summary: (anio?: number) =>
    api.get<DashboardSummary>(`/dashboard/summary${anio ? `?anio=${anio}` : ""}`).then((r) => r.data),
  facturas: (estado?: string, company_id?: number) => {
    const params = new URLSearchParams();
    if (estado) params.set("estado", estado);
    if (company_id) params.set("company_id", String(company_id));
    return api.get<GlobalInvoice[]>(`/dashboard/facturas?${params.toString()}`).then((r) => r.data);
  },
};
