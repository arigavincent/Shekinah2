import { request, requestWithAuth } from "./client";

export function listReadingPlans({ mine = false } = {}) {
  return mine ? requestWithAuth("/api/v1/reading-plans/mine") : request("/api/v1/reading-plans");
}

export function getReadingPlan(id, { mine = false } = {}) {
  return mine
    ? requestWithAuth(`/api/v1/reading-plans/${id}/mine`)
    : request(`/api/v1/reading-plans/${id}`);
}

export function completeReadingPlanDay(id, dayNumber) {
  return requestWithAuth(`/api/v1/reading-plans/${id}/days/${dayNumber}/complete`, {
    method: "POST"
  });
}

export function saveReadingPlanNote(id, dayNumber, note) {
  return requestWithAuth(`/api/v1/reading-plans/${id}/days/${dayNumber}/note`, {
    method: "PUT",
    body: { note }
  });
}

export function updateReadingPlanReminder(id, enabled, reminderTime) {
  return requestWithAuth(`/api/v1/reading-plans/${id}/reminder`, {
    method: "PATCH",
    body: { enabled, reminderTime }
  });
}
