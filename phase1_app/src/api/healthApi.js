import { request } from "./client";

export async function getApiHealth() {
  return request("/api/v1/healthz");
}
