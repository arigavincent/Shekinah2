import { requestWithAuth } from "./client";

export function getMyCheckInCode() {
  return requestWithAuth("/api/v1/checkin/code");
}
