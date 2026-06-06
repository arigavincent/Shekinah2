import { request } from "./client";

export function startMpesaGiving(payload) {
  return request("/api/v1/giving/mpesa/stk-push", {
    method: "POST",
    body: payload
  });
}

export function getGivingTransaction(id) {
  return request(`/api/v1/giving/transactions/${id}`);
}
