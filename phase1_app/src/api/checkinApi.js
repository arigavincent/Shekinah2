import { requestWithAuth } from "./client";

export function getMyCheckInCode() {
  return requestWithAuth("/api/v1/checkin/code");
}

export function listMyCheckInHistory() {
  return requestWithAuth("/api/v1/checkin/history");
}
