import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

// Boot-time hydration. App.tsx imports the page modules eagerly, so this runs
// once on first load for any route — including protected ones, where App's
// <Protected> gate is waiting on `hydrated` before it ever mounts a page.
let hydrateStarted = false;
if (!hydrateStarted) {
  hydrateStarted = true;
  void useAuthStore.getState().hydrate();
}

/** Small mushroom-cap + leaf vein glyph used next to the wordmark. */
export function EloraGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3.5c4.6 0 8.3 3.2 8.3 7.2H3.7c0-4 3.7-7.2 8.3-7.2Z"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 10.7c.1 3.2.4 6 1.4 9.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.6 15.4c1.4-1.6 3.4-2.3 5.6-2.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** "EL" solid + "ORA" light wordmark with glyph. */
export function EloraWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 text-[15px] uppercase tracking-[0.28em] ${className}`}>
      <EloraGlyph className="h-4.5 w-4.5 text-emerald-400/90" />
      <span>
        <span className="font-bold text-white">EL</span>
        <span className="font-light text-white/65">ORA</span>
      </span>
    </span>
  );
}

interface PageChromeProps {
  children: ReactNode;
  /** Extra nav items rendered on the right side (links/buttons). */
  navActions?: ReactNode;
  showFooter?: boolean;
  showBanner?: boolean;
}

/** Shared shell: translucent sticky nav, optional status banner + footer. */
export default function PageChrome({ children, navActions, showFooter = false, showBanner = false }: PageChromeProps) {
  return (
    <div className="flex min-h-screen flex-col">
      {showBanner && (
        <div className="bg-emerald-500/10 text-center text-[13px] leading-relaxed text-emerald-200/90">
          <div className="mx-auto max-w-6xl px-6 py-2">
            ELORA is in early development — Central City is playable now as single-player Phase 1. Multiplayer
            comes later.
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0f14]/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link to="/" aria-label="ELORA — back to home" className="transition hover:opacity-80">
            <EloraWordmark />
          </Link>
          <div className="flex items-center gap-3">{navActions}</div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      {showFooter && (
        <footer className="mt-24 border-t border-white/5">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <EloraWordmark />
              <p className="max-w-md text-sm text-white/45">
                Early development build — Central City v0.1, single-player Phase 1. Features described here are
                the plan, not promises; we&apos;ll say so when each one ships.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-white/45 md:items-end">
              <div className="flex items-center gap-4">
                <a href="#" className="transition hover:text-white/80">
                  Privacy
                </a>
                <a href="#" className="transition hover:text-white/80">
                  Terms
                </a>
              </div>
              <span>© 2026 ELORA</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
