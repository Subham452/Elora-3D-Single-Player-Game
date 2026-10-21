import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import CharacterPreviewCanvas from "@/game/CharacterPreviewCanvas";

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : ""))
    .toUpperCase()
    .slice(0, 2);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [signingOut, setSigningOut] = useState(false);

  // Hydration/token bootstrap runs at app boot (PageChrome); brief blank
  // moment while the session resolves.
  if (!user) return null;

  const appearance = user.profile.appearance;
  const coins = user.profile.coins;
  const discoveries = [...user.profile.discoveries].slice(-6).reverse();

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      navigate("/");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-white/5 bg-[#0a0f14]/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <span className="text-[15px] uppercase tracking-[0.28em]">
            <span className="font-bold text-white">EL</span>
            <span className="font-light text-white/65">ORA</span>
          </span>

          <div className="flex items-center gap-5">
            <span
              className="flex items-center gap-2 rounded-full border border-yellow-500/25 bg-yellow-500/10 px-3 py-1 text-sm text-yellow-200/90"
              title="Your ELORA coins"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 4.5v7M6 6.2h3.2a1.3 1.3 0 0 1 0 2.6H6.8h2.4a1.3 1.3 0 0 1 0 2.6H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              {coins}
            </span>

            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-200">
                {initials(user.displayName)}
              </span>
              <span className="hidden text-sm text-white/70 sm:block">{user.displayName}</span>
            </div>

            <button
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
              className="text-sm text-white/40 transition hover:text-white/75 disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Welcome back, {user.displayName}
          </h1>
          <p className="elora-mono text-xs uppercase tracking-[0.25em] text-white/40">
            World status: Online — Central City v0.1 (single-player phase)
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* PLAY */}
          <section className="elora-card relative overflow-hidden p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(560px 300px at 90% 0%, rgba(61,138,99,0.18), transparent 65%)",
              }}
            />
            <div className="relative space-y-5">
              <span className="elora-mono text-xs uppercase tracking-[0.3em] text-emerald-300/80">
              Enter the world
              </span>
              <h2 className="text-4xl font-semibold tracking-tight text-white">Central City</h2>
              <p className="max-w-md text-sm leading-relaxed text-white/50">
                Phase 1: wander the town, find points of interest, and keep the look you saved. Your
                checkpoint restores where you left off once world saves are wired.
              </p>
              <button type="button" className="elora-btn-primary px-8 py-3 text-base" onClick={() => navigate("/world")}>
                ▶ Play now
              </button>
            </div>
          </section>

          {/* Character summary */}
          <section className="elora-card overflow-hidden">
            <div className="h-[260px]">
              <CharacterPreviewCanvas draft={appearance} turntable={false} />
            </div>
            <div className="space-y-3 border-t border-white/5 p-5">
              <p className="font-medium text-white">{appearance.displayName || user.displayName}</p>
              <p className="elora-mono text-xs uppercase tracking-[0.2em] text-white/40">
                {appearance.bodyType} · hairstyle {appearance.hairStyle}
              </p>
              <button type="button" className="elora-btn-secondary w-full" onClick={() => navigate("/character")}>
                Edit Character
              </button>
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Recent discoveries */}
          <section className="elora-card p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/60">
              Recent discoveries
            </h3>
            {discoveries.length === 0 ? (
              <p className="text-sm text-white/40">
                No discoveries yet — they will appear as you explore the town.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {discoveries.map((d) => (
                  <li key={d.poiId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-white/75">{d.poiId}</span>
                    <span className="elora-mono text-xs text-white/35">
                      {new Date(d.discoveredAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Settings (defers to in-game menu) */}
          <section className="elora-card flex flex-col justify-between p-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">Settings</h3>
              <p className="text-sm text-white/40">
                Graphics, audio and controls live in the in-game menu for now — open it with Esc once
                you&apos;re in the world.
              </p>
            </div>
            <button type="button" className="elora-btn-secondary mt-5" onClick={() => navigate("/world")}>
              Open world menu
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
