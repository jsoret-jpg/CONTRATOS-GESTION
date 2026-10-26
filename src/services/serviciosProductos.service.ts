import { api } from "./api";
import type { ServicioProducto } from "../types/budget";

export const serviciosProductosService = {
  list: (incluirInactivos = false) =>
    api
      .get<ServicioProducto[]>(`/servicios-productos${incluirInactivos ? "?incluir_inactivos=true" : ""}`)
      .then((r) => r.data),
  create: (nombre: string) =>
    api.post<ServicioProducto>("/servicios-productos", { nombre }).then((r) => r.data),
  update: (id: number, payload: Record<string, unknown>) =>
    api.put<ServicioProducto>(`/servicios-productos/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/servicios-productos/${id}`),
};
