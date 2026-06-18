import { request } from "./client";

export async function getServeSettings() {
  return request("/api/v1/settings/serve");
}
