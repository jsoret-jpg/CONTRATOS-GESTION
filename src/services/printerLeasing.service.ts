import { api } from "./api";
import type {
  AllocationSummary,
  CostCenter,
  ImportSummary,
  PecuariaCompany,
  PrinterAllocation,
  PrinterConsumption,
  PrinterConsumptionCompany,
  PrinterInvoice,
} from "../types/printerLeasing";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") usp.set(key, String(value));
  });
  return usp.toString();
}

export const printerLeasingService = {
  pecuariaCompanies: () =>
    api.get<PecuariaCompany[]>("/printer-leasing/pecuaria-companies").then((r) => r.data),
  consumptionCompanies: () =>
    api.get<PrinterConsumptionCompany[]>("/printer-leasing/consumption-companies").then((r) => r.data),

  costCenters: {
    list: (pecuaria_company_id?: number, search?: string) =>
      api
        .get<CostCenter[]>(`/printer-leasing/cost-centers?${buildQuery({ pecuaria_company_id, search })}`)
        .then((r) => r.data),
    create: (payload: Record<string, unknown>) =>
      api.post<CostCenter>("/printer-leasing/cost-centers", payload).then((r) => r.data),
    update: (id: number, payload: Record<string, unknown>) =>
      api.put<CostCenter>(`/printer-leasing/cost-centers/${id}`, payload).then((r) => r.data),
    remove: (id: number) => api.delete(`/printer-leasing/cost-centers/${id}`),
    downloadTemplate: () => api.get("/printer-leasing/cost-centers/template", { responseType: "blob" }),
    importExcel: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api
        .post<ImportSummary>("/printer-leasing/cost-centers/import", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data);
    },
  },

  consumption: {
    list: (filters: {
      anio?: number;
      mes?: number;
      usuario?: string;
      pecuaria_company_id?: number;
      proceso?: string;
      cost_center_id?: number;
    }) => api.get<PrinterConsumption[]>(`/printer-leasing/consumption?${buildQuery(filters)}`).then((r) => r.data),
    create: (payload: Record<string, unknown>) =>
      api.post<PrinterConsumption>("/printer-leasing/consumption", payload).then((r) => r.data),
    remove: (id: number) => api.delete(`/printer-leasing/consumption/${id}`),
    downloadTemplate: () => api.get("/printer-leasing/consumption/template", { responseType: "blob" }),
    importExcel: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api
        .post<ImportSummary>("/printer-leasing/consumption/import", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data);
    },
  },

  invoices: {
    list: (filters: { printer_company_id?: number; anio?: number; mes?: number }) =>
      api.get<PrinterInvoice[]>(`/printer-leasing/invoices?${buildQuery(filters)}`).then((r) => r.data),
    create: (payload: Record<string, unknown>) =>
      api.post<PrinterInvoice>("/printer-leasing/invoices", payload).then((r) => r.data),
    remove: (id: number) => api.delete(`/printer-leasing/invoices/${id}`),
    calculateAllocation: (id: number) =>
      api.post<PrinterAllocation[]>(`/printer-leasing/invoices/${id}/calcular-prorrateo`).then((r) => r.data),
  },

  allocations: {
    list: (filters: {
      printer_invoice_id?: number;
      anio?: number;
      mes?: number;
      usuario?: string;
      pecuaria_company_id?: number;
      proceso?: string;
    }) => api.get<PrinterAllocation[]>(`/printer-leasing/allocations?${buildQuery(filters)}`).then((r) => r.data),
    summary: (filters: { anio?: number; mes?: number; pecuaria_company_id?: number } = {}) =>
      api
        .get<AllocationSummary>(`/printer-leasing/allocations/summary?${buildQuery(filters)}`)
        .then((r) => r.data),
  },
};
