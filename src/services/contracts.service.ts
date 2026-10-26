import { api } from "./api";
import type { Contract, ContractFilters, ContractSummary, ImportSummary } from "../types/contract";

function buildQuery(filters: ContractFilters): string {
  const params = new URLSearchParams();
  if (filters.company_id) params.set("company_id", String(filters.company_id));
  if (filters.tipo_contrato) params.set("tipo_contrato", filters.tipo_contrato);
  if (filters.estado) params.set("estado", filters.estado);
  if (filters.search) params.set("search", filters.search);
  return params.toString();
}

export const contractsService = {
  list: (filters: ContractFilters = {}) =>
    api.get<Contract[]>(`/contracts?${buildQuery(filters)}`).then((r) => r.data),
  get: (id: number) => api.get<Contract>(`/contracts/${id}`).then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    api.post<Contract>("/contracts", payload).then((r) => r.data),
  update: (id: number, payload: Record<string, unknown>) =>
    api.put<Contract>(`/contracts/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/contracts/${id}`),
  summary: () => api.get<ContractSummary>("/contracts/summary/dashboard").then((r) => r.data),
  downloadTemplate: () => api.get("/contracts/template", { responseType: "blob" }),
  exportExcel: (filters: ContractFilters = {}) =>
    api.get(`/contracts/export?${buildQuery(filters)}`, { responseType: "blob" }),
  importExcel: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api
      .post<ImportSummary>("/contracts/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  uploadFile: (id: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api
      .post<Contract>(`/contracts/${id}/archivo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  downloadFile: (id: number) => api.get(`/contracts/${id}/archivo`, { responseType: "blob" }),
  removeFile: (id: number) => api.delete(`/contracts/${id}/archivo`),
};
