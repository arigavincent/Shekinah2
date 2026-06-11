import { request, requestWithAuth } from "./client";

export function listTestimonies() {
  return request("/api/v1/testimonies");
}

export function listMyTestimonies() {
  return requestWithAuth("/api/v1/testimonies/mine");
}

export function submitTestimony(payload) {
  return requestWithAuth("/api/v1/testimonies", {
    method: "POST",
    body: payload
  });
}

export function likeTestimony(id) {
  return requestWithAuth(`/api/v1/testimonies/${id}/like`, {
    method: "POST"
  });
}
