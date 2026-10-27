import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type GivingTransaction = {
  id: string;
  category: string;
  method: string;
  phone: string;
  amount: number;
  note: string;
  status: "pending" | "success" | "failed" | "cancelled" | string;
  checkoutRequestId: string;
  merchantRequestId: string;
  mpesaReceiptNumber: string;
  resultCode: number | null;
  resultDescription: string;
  createdAt: string;
  updatedAt: string;
  providerReference?: string;
  payerName?: string;
};

export type Paybill = { enabled: boolean; paybill: string; account: string; accountHint: string; name: string };
export type Bank = {
  enabled: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  swiftCode: string;
  reference: string;
};
export type GivingDetails = { mpesa: Paybill; airtel: Paybill; bank: Bank; note: string; categories: string[] };

function adminToken() {
  const token = getToken();

  if (!token) {
    throw new Error("Admin login required");
  }

  return token;
}

export function listGivingTransactions() {
  return apiRequest<{ transactions: GivingTransaction[] }>(
    "/api/v1/admin/giving/transactions",
    {
      token: adminToken()
    }
  );
}

export function getGivingDetails() {
  return apiRequest<{ details: GivingDetails }>("/api/v1/admin/giving/details", { token: adminToken() });
}

export function saveGivingDetails(details: GivingDetails) {
  return apiRequest<{ details: GivingDetails }>("/api/v1/admin/giving/details", {
    method: "PUT",
    token: adminToken(),
    body: details
  });
}

// Finance marks a paybill/bank gift as received ("success") or not found ("failed").
export function reviewGivingTransaction(id: string, status: "success" | "failed") {
  return apiRequest<{ transaction: GivingTransaction }>(`/api/v1/admin/giving/transactions/${id}`, {
    method: "PATCH",
    token: adminToken(),
    body: { status }
  });
}
