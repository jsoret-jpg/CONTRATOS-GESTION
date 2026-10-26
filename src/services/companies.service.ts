import { api } from "./api";
import type { Company } from "../types/company";

export const companiesService = {
  list: () => api.get<Company[]>("/companies").then((r) => r.data),
};
