import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_TOKEN_KEY = "shekinah.phase2.authToken";

export async function saveAuthToken(token) {
  if (!token || typeof token !== "string") {
    throw new Error("Valid auth token is required");
  }

  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function getAuthToken() {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function clearAuthToken() {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}
