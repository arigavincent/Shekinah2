import {
  getCurrentUser,
  loginUser,
  registerUser
} from "../../api/authApi";
import {
  clearAuthToken,
  getAuthToken,
  saveAuthToken
} from "../../storage/authTokenStorage";

function normalizeAuthResponse(response) {
  if (!response?.token || !response?.user) {
    throw new Error("Invalid auth response from server.");
  }

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
    return {
      token: null,
      user: null
    };
  }
}

export async function loginAndSaveSession({ email, password }) {
  const response = normalizeAuthResponse(
    await loginUser({
      email: email.trim().toLowerCase(),
      password
    })
  );

  await saveAuthToken(response.token);

  return response;
}

export async function registerAndSaveSession({ name, email, password }) {
  const response = normalizeAuthResponse(
    await registerUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password
    })
  );

  await saveAuthToken(response.token);

  return response;
}

export async function logoutSession() {
  await clearAuthToken();
}
