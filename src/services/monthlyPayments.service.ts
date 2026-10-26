import { api } from "./api";
import type {
  ImportSummary,
  MonthlyPayment,
  MonthlyPaymentFilters,
  MonthlyPaymentSummary,
} from "../types/monthlyPayment";

function buildQuery(filters: MonthlyPaymentFilters): string {
  const params = new URLSearchParams();
  if (filters.company_id) params.set("company_id", String(filters.company_id));
  if (filters.anio) params.set("anio", String(filters.anio));
  if (filters.mes) params.set("mes", String(filters.mes));
  if (filters.tipo_servicio) params.set("tipo_servicio", filters.tipo_servicio);
  if (filters.pagada !== undefined) params.set("pagada", String(filters.pagada));
  return params.toString();
}

export const monthlyPaymentsService = {
  list: (filters: MonthlyPaymentFilters = {}) =>
    api.get<MonthlyPayment[]>(`/monthly-payments?${buildQuery(filters)}`).then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    api.post<MonthlyPayment>("/monthly-payments", payload).then((r) => r.data),
  update: (id: number, payload: Record<string, unknown>) =>
    api.put<MonthlyPayment>(`/monthly-payments/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/monthly-payments/${id}`),
  summary: () => api.get<MonthlyPaymentSummary>("/monthly-payments/summary/dashboard").then((r) => r.data),
  downloadTemplate: () => api.get("/monthly-payments/template", { responseType: "blob" }),
  exportExcel: (filters: MonthlyPaymentFilters = {}) =>
    api.get(`/monthly-payments/export?${buildQuery(filters)}`, { responseType: "blob" }),
  importExcel: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api
      .post<ImportSummary>("/monthly-payments/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};
