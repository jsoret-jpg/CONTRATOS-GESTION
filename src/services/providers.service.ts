import { api } from "./api";

export interface Provider {
  id: number;
  name: string;
  tax_id: string | null;
  contact_info: string | null;
  is_active: boolean;
}

export const providersService = {
  list: () => api.get<Provider[]>("/providers").then((r) => r.data),
  findOrCreate: (name: string) => api.post<Provider>("/providers", { name }).then((r) => r.data),
};
