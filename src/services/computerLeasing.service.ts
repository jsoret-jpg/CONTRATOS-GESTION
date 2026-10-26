import { api } from "./api";
import type {
  ComputerLeasing,
  ComputerLeasingFilters,
  ComputerLeasingSummary,
  ImportSummary,
} from "../types/computerLeasing";

function buildQuery(filters: ComputerLeasingFilters): string {
  const params = new URLSearchParams();
  if (filters.company_id) params.set("company_id", String(filters.company_id));
  if (filters.proceso) params.set("proceso", filters.proceso);
  if (filters.estado) params.set("estado", filters.estado);
  if (filters.search) params.set("search", filters.search);
  if (filters.sin_contrato) params.set("sin_contrato", "true");
  else if (filters.contrato) params.set("contrato", filters.contrato);
  return params.toString();
}

export const computerLeasingService = {
  list: (filters: ComputerLeasingFilters = {}) =>
    api.get<ComputerLeasing[]>(`/leasing/computers?${buildQuery(filters)}`).then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    api.post<ComputerLeasing>("/leasing/computers", payload).then((r) => r.data),
  update: (id: number, payload: Record<string, unknown>) =>
    api.put<ComputerLeasing>(`/leasing/computers/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/leasing/computers/${id}`),
  summary: (filters: ComputerLeasingFilters = {}) =>
    api.get<ComputerLeasingSummary>(`/leasing/computers/summary/dashboard?${buildQuery(filters)}`).then((r) => r.data),
  downloadTemplate: () => api.get("/leasing/computers/template", { responseType: "blob" }),
  exportExcel: (filters: ComputerLeasingFilters = {}) =>
    api.get(`/leasing/computers/export?${buildQuery(filters)}`, { responseType: "blob" }),
  importExcel: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api
      .post<ImportSummary>("/leasing/computers/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};
