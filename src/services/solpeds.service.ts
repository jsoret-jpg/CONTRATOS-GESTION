import { api } from "./api";
import type { ImportSummary, Solped, SolpedFilters, SolpedSummary } from "../types/solped";

function buildQuery(filters: SolpedFilters): string {
  const params = new URLSearchParams();
  if (filters.estado) params.set("estado", filters.estado);
  if (filters.company_id) params.set("company_id", String(filters.company_id));
  if (filters.tipo) params.set("tipo", filters.tipo);
  if (filters.moneda) params.set("moneda", filters.moneda);
  if (filters.provider_id) params.set("provider_id", String(filters.provider_id));
  if (filters.search) params.set("search", filters.search);
  if (filters.excluir_estado) params.set("excluir_estado", filters.excluir_estado);
  return params.toString();
}

export const solpedsService = {
  list: (filters: SolpedFilters = {}) =>
    api.get<Solped[]>(`/solpeds?${buildQuery(filters)}`).then((r) => r.data),
  get: (id: number) => api.get<Solped>(`/solpeds/${id}`).then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    api.post<Solped>("/solpeds", payload).then((r) => r.data),
  update: (id: number, payload: Record<string, unknown>) =>
    api.put<Solped>(`/solpeds/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/solpeds/${id}`),
  summary: (filters: SolpedFilters = {}) =>
    api.get<SolpedSummary>(`/solpeds/summary/dashboard?${buildQuery(filters)}`).then((r) => r.data),
  downloadTemplate: () => api.get("/solpeds/template", { responseType: "blob" }),
  exportExcel: (filters: SolpedFilters = {}) =>
    api.get(`/solpeds/export?${buildQuery(filters)}`, { responseType: "blob" }),
  importExcel: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api
      .post<ImportSummary>("/solpeds/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  uploadCotizacion: (id: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api
      .post<Solped>(`/solpeds/${id}/cotizacion`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  downloadCotizacion: (id: number) => api.get(`/solpeds/${id}/cotizacion`, { responseType: "blob" }),
};
