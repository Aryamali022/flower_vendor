// Thin fetch wrapper that attaches the JWT and handles errors centrally.
import { CONFIG } from "./config.js";

const TOKEN_KEY = "fs_token";
const USER_KEY = "fs_user";

export const session = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  get user() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch { return null; }
  },
  save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  get isAdmin() { return this.user?.role === "admin"; },
};

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (session.token) headers["Authorization"] = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(CONFIG.API_BASE + path, {
      method, headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError("સર્વર સાથે જોડાણ નિષ્ફળ", 0);
  }

  if (res.status === 401) {
    session.clear();
    window.dispatchEvent(new CustomEvent("auth:expired"));
    throw new ApiError("સત્ર સમાપ્ત — ફરી લોગિન કરો", 401);
  }
  if (res.status === 204) return null;

  let data = null;
  try { data = await res.json(); } catch { /* no body */ }

  if (!res.ok) {
    const msg = data?.detail || "કંઈક ખોટું થયું";
    throw new ApiError(typeof msg === "string" ? msg : "અમાન્ય માહિતી", res.status);
  }
  return data;
}

export const api = {
  get: (p) => request("GET", p),
  post: (p, b) => request("POST", p, b),
  put: (p, b) => request("PUT", p, b),
  patch: (p, b) => request("PATCH", p, b),
  del: (p) => request("DELETE", p),
};
