import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
};

function adminToken() {
  const token = getToken();
  if (!token) throw new Error("Admin login required");
  return token;
}

export function listMembers(query: string) {
  return apiRequest<{ members: Member[]; available: string[] }>(`/api/v1/admin/members?query=${encodeURIComponent(query)}`, {
    token: adminToken()
  });
}

export function setMemberPermissions(id: string, permissions: string[]) {
  return apiRequest<{ permissions: string[] }>(`/api/v1/admin/members/${id}/permissions`, {
    method: "PATCH",
    token: adminToken(),
    body: { permissions }
  });
}
