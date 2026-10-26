import { api } from "./api";
import type { Invoice } from "../types/invoice";

export const invoicesService = {
  list: (solpedId: number) => api.get<Invoice[]>(`/solpeds/${solpedId}/facturas`).then((r) => r.data),
  create: (solpedId: number, payload: Record<string, unknown>) =>
    api.post<Invoice>(`/solpeds/${solpedId}/facturas`, payload).then((r) => r.data),
  update: (solpedId: number, invoiceId: number, payload: Record<string, unknown>) =>
    api.put<Invoice>(`/solpeds/${solpedId}/facturas/${invoiceId}`, payload).then((r) => r.data),
  remove: (solpedId: number, invoiceId: number) =>
    api.delete(`/solpeds/${solpedId}/facturas/${invoiceId}`),
};
