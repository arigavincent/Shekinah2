const TOKEN_KEY = "shekinah.admin.token";
const USER_KEY = "shekinah.admin.user";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "member" | "admin" | "super_admin";
  isActive: boolean;
  passwordResetRequired?: boolean;
  createdAt: string;
};

export function saveSession(token: string, user: AdminUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AdminUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
