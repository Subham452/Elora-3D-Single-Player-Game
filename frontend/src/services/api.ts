import type {
  AuthResponse,
  UserDTO,
  CharacterAppearance,
  PlayerCheckpoint,
  DiscoveryEntry,
} from "@/shared/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4100";

/**
 * Wire contract (verified live against backend):
 * - register: POST /api/auth/register { email, password, displayName } -> { user }
 * - login:    POST /api/auth/login    { email, password } -> { user, accessToken, refreshToken? }
 * - refresh:  POST /api/auth/refresh (cookie or body) -> { user, accessToken }
 * - PATCH /api/me/appearance — FLAT appearance fields
 * - POST  /api/me/checkpoint — FLAT { worldId, x, y, z, yaw }
 * - POST  /api/me/discover  — { poiId }
 */
export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let accessToken: string | null = null;
export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers = {}, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, {
    mode: "cors",
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; code?: string; details?: unknown };
    throw new ApiError(res.status, err.code ?? "UNKNOWN", err.error ?? res.statusText, err.details);
  }
  return data as T;
}

export const api = {
  register: (email: string, password: string, displayName: string) =>
    request<{ user: UserDTO }>("/api/auth/register", {
      method: "POST",
      json: { email, password, displayName },
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      json: { email, password },
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<UserDTO>("/api/me"),
  updateAppearance: (appearance: CharacterAppearance) =>
    request<UserDTO>("/api/me/appearance", {
      method: "PATCH",
      json: appearance,
    }),
  saveCheckpoint: (checkpoint: PlayerCheckpoint) =>
    request<{ checkpoint: PlayerCheckpoint }>("/api/me/checkpoint", {
      method: "POST",
      json: checkpoint,
    }),
  discover: (poiId: string) =>
    request<{ discoveries: DiscoveryEntry[] }>("/api/me/discover", {
      method: "POST",
      json: { poiId },
    }),
};

export { API_URL };
