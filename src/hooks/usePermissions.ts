import { useEffect, useState } from "react";

import { api } from "../services/api";

export function usePermissions() {
  const [permissions, setPermissions] = useState<Set<string> | null>(null);

  useEffect(() => {
    api.get<string[]>("/auth/permissions").then((res) => {
      setPermissions(new Set(res.data));
    });
  }, []);

  function can(moduleCode: string, action: string): boolean {
    if (!permissions) return false;
    return permissions.has(`${moduleCode}:${action}`);
  }

  return { can, isLoading: permissions === null };
}
