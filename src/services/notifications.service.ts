import { api } from "./api";
import type { Notification, NotificationRecipient, NotificationSummary } from "../types/notification";

export const notificationsService = {
  list: (modulo?: string, leida?: boolean) => {
    const params = new URLSearchParams();
    if (modulo) params.set("modulo", modulo);
    if (leida !== undefined) params.set("leida", String(leida));
    return api.get<Notification[]>(`/notifications?${params.toString()}`).then((r) => r.data);
  },
  summary: () => api.get<NotificationSummary>("/notifications/summary").then((r) => r.data),
  markRead: (id: number) => api.put<Notification>(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.put<{ marcadas: number }>("/notifications/read-all").then((r) => r.data),
  recipients: {
    list: () => api.get<NotificationRecipient[]>("/notifications/recipients").then((r) => r.data),
    create: (email: string) =>
      api.post<NotificationRecipient>("/notifications/recipients", { email }).then((r) => r.data),
    remove: (id: number) => api.delete(`/notifications/recipients/${id}`),
  },
  sendDigestEmail: () =>
    api.post<{ enviado: boolean; mensaje: string }>("/notifications/send-email").then((r) => r.data),
};
