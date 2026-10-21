import { create } from "zustand";
import { api, setApiAccessToken, ApiError } from "@/services/api";
import type { UserDTO, CharacterAppearance } from "@/shared/types";

interface AuthState {
  hydrated: boolean;
  accessToken: string | null;
  user: UserDTO | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string>;
  setUser: (u: UserDTO | null) => void;
}

let refreshInFlight: Promise<string> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  accessToken: null,
  user: null,

  // Bootstrap: try refresh (httpOnly cookie) once at load.
  hydrate: async () => {
    try {
      const { user } = await silentRefresh();
      set({ user, accessToken: null, hydrated: true });
      // We don't receive an access token unless we also called login/refresh
      // below; try one refresh for the token.
      void get().refreshAccessToken().catch(() => {});
    } catch {
      set({ user: null, accessToken: null, hydrated: true });
    }
  },

  login: async (email, password) => {
    try {
      const res = await api.login(email, password);
      setAuth(set, res);
    } catch (err) {
      throw friendly(err);
    }
  },

  register: async (email, password, displayName) => {
    try {
      await api.register(email, password, displayName);
      // Register doesn't return tokens; log in immediately.
      await get().login(email, password);
    } catch (err) {
      throw friendly(err);
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      /* logout is best-effort; clear local state regardless */
    }
    set({ user: null, accessToken: null });
  },

  refreshAccessToken: () => {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = silentRefresh()
      .then((res) => {
        set({ user: res.user });
        return res.accessToken;
      })
      .finally(() => {
        refreshInFlight = null;
      });
    return refreshInFlight;
  },

  setUser: (user) => set({ user }),
}));

type RefreshResult = { user: UserDTO; accessToken: string };

async function silentRefresh(): Promise<RefreshResult> {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4100"}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
    mode: "cors",
  });
  if (!res.ok) throw new Error("No session");
  const data = (await res.json()) as RefreshResult;
  setApiAccessToken(data.accessToken);
  return data;
}

function setAuth(
  set: (partial: Partial<Pick<AuthState, "user" | "accessToken">>) => void,
  res: { user: UserDTO; accessToken?: string },
) {
  if (res.accessToken) setApiAccessToken(res.accessToken);
  set({ user: res.user, accessToken: res.accessToken ?? null });
}

function friendly(err: unknown): Error {
  if (err instanceof ApiError) {
    if (err.code === "VALIDATION_ERROR")
      return new Error(
        Array.isArray(err.details)
          ? (err.details as Array<{ message: string }>).map((d) => d.message).join(" · ")
          : "Invalid input.",
      );
    if (err.status === 401) return new Error("Incorrect email or password.");
    if (err.status === 409) return new Error("That email or name is already taken.");
    if (err.status === 429) return new Error("Too many attempts — wait a minute and retry.");
    if (err.status === 409) return new Error("Email or name already in use.");
  }
  return err instanceof Error ? err : new Error("Something went wrong. Is the API server running?");
}

export type { CharacterAppearance };
