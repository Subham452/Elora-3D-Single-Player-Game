import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import PageChrome from "@/components/PageChrome";

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const serverUnreachable = error != null && /server|api|network/i.test(error);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setBusy(true);
    try {
      await login(email.trim(), password);
      const user = useAuthStore.getState().user;
      // Returning citizens go to the launcher; brand-new ones (no appearance
      // saved yet) land in the character creator.
      navigate(user?.profile?.appearance?.displayName ? "/dashboard" : "/character");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageChrome
      navActions={
        <Link to="/register" className="px-4 py-2 text-sm text-white/70 transition hover:text-white">
          Create account
        </Link>
      }
    >
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 space-y-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-white">Welcome back</h1>
            <p className="text-sm text-white/50">Sign in to continue your life in Elora.</p>
          </div>

          <form onSubmit={onSubmit} className="elora-card space-y-5 p-8" noValidate>
            <div>
              <label htmlFor="login-email" className="elora-label">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                className="elora-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="elora-label">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                className="elora-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
                {serverUnreachable && (
                  <p className="mt-1 text-xs text-red-200/70">
                    Server unreachable — make sure the ELORA API backend is running, then try again.
                  </p>
                )}
              </div>
            )}

            <button type="submit" className="elora-btn-primary w-full py-3" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>

            <p className="text-center text-sm text-white/45">
              New to Elora?{" "}
              <Link to="/register" className="text-emerald-300/90 transition hover:text-emerald-200">
                Create an account
              </Link>
            </p>
          </form>

          <p className="mt-6 text-center text-sm">
            <Link to="/" className="text-white/40 transition hover:text-white/70">
              ← Back to elora.game
            </Link>
          </p>
        </div>
      </div>
    </PageChrome>
  );
}
