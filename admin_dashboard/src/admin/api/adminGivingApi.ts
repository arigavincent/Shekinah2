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
};

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
