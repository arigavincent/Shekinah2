import { getCurrentUser, loginUser, registerUser } from "../../api/authApi";
import {
  clearAuthToken,
  getAuthToken,
  saveAuthToken
} from "../../storage/authTokenStorage";

export async function registerAndSaveSession({ name, email, password }) {
  const response = await registerUser({ name, email, password });

  if (!response?.token || !response?.user) {
    throw new Error("Invalid register response");
  }

  await saveAuthToken(response.token);

  return {
    token: response.token,
    user: response.user
  };
}

export async function loginAndSaveSession({ email, password }) {
  const response = await loginUser({ email, password });

  if (!response?.token || !response?.user) {
    throw new Error("Invalid login response");
  }

  await saveAuthToken(response.token);

  return {
    token: response.token,
    user: response.user
  };
}

export async function loadSavedSession() {
  const token = await getAuthToken();

  if (!token) {
    return {
      token: null,
      user: null
    };
  }

  try {
    const response = await getCurrentUser(token);

    return {
      token,
      user: response.user
    };
  } catch (error) {
    await clearAuthToken();
    throw error;
  }
}

export async function logoutSession() {
  await clearAuthToken();
}
