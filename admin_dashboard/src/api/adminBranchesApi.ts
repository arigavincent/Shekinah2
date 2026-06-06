import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type Branch = {
  id: string;
  name: string;
  address: string;
  services: string;
  phone: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type BranchPayload = {
  name: string;
  address: string;
  services: string;
  phone: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
};

function adminToken() {
  const token = getToken();

  if (!token) {
    throw new Error("Admin login required");
  }

  return token;
}

export function listBranches() {
  return apiRequest<{ branches: Branch[] }>("/api/v1/admin/branches", {
    token: adminToken()
  });
}

export function createBranch(payload: BranchPayload) {
  return apiRequest<{ branch: Branch }>("/api/v1/admin/branches", {
    method: "POST",
    token: adminToken(),
    body: payload
  });
}

export function updateBranch(id: string, payload: Partial<BranchPayload>) {
  return apiRequest<{ branch: Branch }>(`/api/v1/admin/branches/${id}`, {
    method: "PATCH",
    token: adminToken(),
    body: payload
  });
}

export function deleteBranch(id: string) {
  return apiRequest<null>(`/api/v1/admin/branches/${id}`, {
    method: "DELETE",
    token: adminToken()
  });
}
