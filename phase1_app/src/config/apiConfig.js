const envBaseUrl =
  typeof process !== "undefined" &&
  process.env &&
  process.env.EXPO_PUBLIC_API_BASE_URL
    ? process.env.EXPO_PUBLIC_API_BASE_URL
    : null;

export const API_CONFIG = {
  baseUrl: envBaseUrl || "https://shekinah-sons-backend.onrender.com",
  timeoutMs: 10000
};
