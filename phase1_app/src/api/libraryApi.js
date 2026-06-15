import { request } from "./client";

export function listLibraryItems(params = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return request(`/api/v1/library${suffix}`);
}

export function getLibraryItem(id) {
  return request(`/api/v1/library/${id}`);
}
