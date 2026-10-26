import { api } from "./api";
import type { CurrentUser } from "../types/auth";

export interface UserPayload {
  username: string;
  email: string;
  full_name: string;
  role_id: number;
  is_active: boolean;
  password?: string;
}

export const usersService = {
  list: () => api.get<CurrentUser[]>("/users").then((r) => r.data),
  create: (payload: UserPayload) => api.post<CurrentUser>("/users", payload).then((r) => r.data),
  update: (id: number, payload: Partial<UserPayload>) =>
    api.put<CurrentUser>(`/users/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/users/${id}`),
};
