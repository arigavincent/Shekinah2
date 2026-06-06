import { request } from "./client";

export async function getHomeContent() {
  return request("/api/v1/home");
}
