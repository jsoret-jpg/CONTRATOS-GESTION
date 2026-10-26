import { api } from "./api";
import type { ImportSummary, License, LicenseFilters, LicenseSummary } from "../types/license";

function buildQuery(filters: LicenseFilters): string {
  const params = new URLSearchParams();
  if (filters.company_id) params.set("company_id", String(filters.company_id));
  if (filters.tipo) params.set("tipo", filters.tipo);
  if (filters.proceso) params.set("proceso", filters.proceso);
  if (filters.search) params.set("search", filters.search);
  return params.toString();
}

export const licensesService = {
  list: (filters: LicenseFilters = {}) =>
    api.get<License[]>(`/licenses?${buildQuery(filters)}`).then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    api.post<License>("/licenses", payload).then((r) => r.data),
  update: (id: number, payload: Record<string, unknown>) =>
    api.put<License>(`/licenses/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/licenses/${id}`),
  summary: (filters: LicenseFilters = {}) =>
    api.get<LicenseSummary>(`/licenses/summary/dashboard?${buildQuery(filters)}`).then((r) => r.data),
  types: () => api.get<string[]>("/licenses/tipos").then((r) => r.data),
  updatePriceByType: (tipo: string, precio: string) =>
    api
      .put<{ tipo: string; precio: string; actualizadas: number }>("/licenses/actualizar-precio-por-tipo", {
        tipo,
        precio,
      })
      .then((r) => r.data),
  downloadTemplate: () => api.get("/licenses/template", { responseType: "blob" }),
  exportExcel: (filters: LicenseFilters = {}) =>
    api.get(`/licenses/export?${buildQuery(filters)}`, { responseType: "blob" }),
  importExcel: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api
      .post<ImportSummary>("/licenses/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};
