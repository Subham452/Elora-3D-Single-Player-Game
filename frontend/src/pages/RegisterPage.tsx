import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import PageChrome from "@/components/PageChrome";

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const serverUnreachable = error != null && /server|api|network/i.test(error);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const name = displayName.trim();
    const emailTrim = email.trim();

    if (!emailTrim) {
      setError("Enter your email.");
      return;
    }
    if (!password) {
      setError("Choose a password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (name.length < 3 || name.length > 24) {
      setError("Display name must be 3–24 characters.");
      return;
    }

    setBusy(true);
    try {
      await register(emailTrim, password, name);
      navigate("/character");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageChrome
      navActions={
        <Link to="/login" className="px-4 py-2 text-sm text-white/70 transition hover:text-white">
          Sign in
        </Link>
      }
    >
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 space-y-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-white">Create your life</h1>
            <p className="text-sm text-white/50">One account, one citizen, your corner of Elora.</p>
          </div>

          <form onSubmit={onSubmit} className="elora-card space-y-5 p-8" noValidate>
            <div>
              <label htmlFor="reg-name" className="elora-label">
                Display name
              </label>
              <input
                id="reg-name"
                type="text"
                className="elora-input"
                placeholder="3–24 characters, shown in-world"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={busy}
                maxLength={32}
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="elora-label">
                Email
              </label>
              <input
                id="reg-email"
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
              <label htmlFor="reg-password" className="elora-label">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                className="elora-input"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="reg-confirm" className="elora-label">
                Confirm password
              </label>
              <input
                id="reg-confirm"
                type="password"
                autoComplete="new-password"
                className="elora-input"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              {busy ? "Creating account…" : "Create account"}
            </button>

            <p className="text-center text-sm text-white/45">
              Already have a citizen?{" "}
              <Link to="/login" className="text-emerald-300/90 transition hover:text-emerald-200">
                Sign in
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
