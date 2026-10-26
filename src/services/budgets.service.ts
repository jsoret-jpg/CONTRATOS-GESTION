import { api } from "./api";
import type { AnnualBudget, Budget, BudgetFilters, BudgetMovement, BudgetSummary } from "../types/budget";

function buildQuery(filters: BudgetFilters): string {
  const params = new URLSearchParams();
  if (filters.company_id) params.set("company_id", String(filters.company_id));
  if (filters.servicio_producto_id) params.set("servicio_producto_id", String(filters.servicio_producto_id));
  if (filters.anio) params.set("anio", String(filters.anio));
  if (filters.mes) params.set("mes", String(filters.mes));
  return params.toString();
}

export const budgetsService = {
  list: (filters: BudgetFilters = {}) => api.get<Budget[]>(`/budgets?${buildQuery(filters)}`).then((r) => r.data),
  create: (payload: Record<string, unknown>) => api.post<Budget>("/budgets", payload).then((r) => r.data),
  update: (id: number, payload: Record<string, unknown>) =>
    api.put<Budget>(`/budgets/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/budgets/${id}`),
  summary: (filters: { anio?: number; company_id?: number; servicio_producto_id?: number } = {}) => {
    const params = new URLSearchParams();
    if (filters.anio) params.set("anio", String(filters.anio));
    if (filters.company_id) params.set("company_id", String(filters.company_id));
    if (filters.servicio_producto_id) params.set("servicio_producto_id", String(filters.servicio_producto_id));
    return api.get<BudgetSummary>(`/budgets/summary/dashboard?${params.toString()}`).then((r) => r.data);
  },
  movements: (budgetId: number) =>
    api.get<BudgetMovement[]>(`/budgets/${budgetId}/movements`).then((r) => r.data),
  createCompensation: (budgetId: number, payload: Record<string, unknown>) =>
    api.post<BudgetMovement>(`/budgets/${budgetId}/compensations`, payload).then((r) => r.data),
  removeMovement: (movementId: number) => api.delete(`/budgets/movements/${movementId}`),
  // Vista anual: año + empresa + servicio con los 12 meses en un solo lugar.
  listAnnual: (filters: BudgetFilters = {}) =>
    api.get<AnnualBudget[]>(`/budgets/annual?${buildQuery(filters)}`).then((r) => r.data),
  upsertAnnual: (payload: { company_id: number; servicio_producto_id: number; anio: number; montos: Record<string, string> }) =>
    api.post<AnnualBudget>("/budgets/annual", payload).then((r) => r.data),
};
