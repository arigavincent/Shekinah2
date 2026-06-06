const envBaseUrl =
  typeof process !== "undefined" &&
  process.env &&
  process.env.EXPO_PUBLIC_API_BASE_URL
    ? process.env.EXPO_PUBLIC_API_BASE_URL
    : null;

export const API_CONFIG = {
  baseUrl: envBaseUrl || "http://localhost:3000",
  timeoutMs: 10000
};
