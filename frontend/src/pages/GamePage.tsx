import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EloraGame } from "@/game/Game";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { useGameSettings } from "@/stores/settingsStore";
import { api, setApiAccessToken, API_URL } from "@/services/api";
import Hud from "@/components/hud/Hud";
import MapPanel from "@/components/hud/MapPanel";
import SettingsPanel from "@/components/hud/SettingsPanel";
import PauseMenu from "@/components/hud/PauseMenu";
import InventoryPanel from "@/components/hud/InventoryPanel";
import { WORLD_ID } from "@/game/world/worldData";

export default function GamePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<EloraGame | null>(null);
  const navigate = useNavigate();
  const phase = useGameStore((s) => s.phase);
  const user = useAuthStore((s) => s.user);

  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || gameRef.current) return;

    const appearance = user?.profile.appearance;
    if (!appearance) {
      setFatal("No saved character — create one from the dashboard first.");
      return;
    }

    // Seed player identity into HUD.
    const store = useGameStore.getState();
    store.setPlayer(appearance.displayName, user.profile.coins);
    store.setHint(true);

    let disposed = false;
    const settingsStore = useGameSettings.getState();

  const game = new EloraGame({
      container,
      appearance,
      startCheckpoint:
        user.profile.checkpoint?.worldId === WORLD_ID ? user.profile.checkpoint : null,
      discovered: user.profile.discoveries.map((d) => d.poiId),
      getSettings: () => useGameSettings.getState().settings,
      onProgress: (p, label) => useGameStore.getState().setLoad(p, label),
      onReady: () => useGameStore.getState().setPhase("playing"),
      onDiscover: (poiId: string) => {
        void api.discover(poiId).catch(() => {
          /* offline-friendly: discovery stays client-side this session */
        });
      },
      onCheckpoint: (c) => {
        useGameStore.getState().setCheckpoint(c);
        void api.saveCheckpoint(c).catch(() => {});
      },
    });
    gameRef.current = game;
    // Dev-only hook for automated verification (keyboard tests, perf probes).
    if (import.meta.env.DEV) {
      (window as unknown as { __elora?: unknown }).__elora = {
        game,
        store: useGameStore,
      };
    }

    const authCleanup = useAuthStore.subscribe((s) => {
      if (s.accessToken) setApiAccessToken(s.accessToken);
    });
    setApiAccessToken(useAuthStore.getState().accessToken);

    game.build().catch((err) => {
      console.error("[elora] world build failed", err);
      if (!disposed) setFatal(String(err?.message ?? err));
    });
    // Settings changes apply live.
    const unsubSettings = useGameSettings.subscribe(() => {
      game.applyRenderSettings();
    });

    // Persist checkpoint when leaving the page.
    const onBeforeUnload = () => {
      const st = useGameStore.getState();
      if (st.checkpoint) {
        void fetch(`${API_URL}/api/me/checkpoint`, {
          method: "POST",
          keepalive: true,
          mode: "cors",
          headers: {
            "Content-Type": "application/json",
            ...(useAuthStore.getState().accessToken
              ? { Authorization: `Bearer ${useAuthStore.getState().accessToken}` }
              : {}),
          },
          body: JSON.stringify(st.checkpoint),
        }).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      disposed = true;
      window.removeEventListener("beforeunload", onBeforeUnload);
      unsubSettings();
      authCleanup();
      game.dispose();
      gameRef.current = null;
      const st = useGameStore.getState();
      st.setOverlay(null);
      st.setPhase("loading");
      st.setPrompt(null);
      st.setLoad(0, "");
      st.setInside(false);
      st.setPlace("Elora Central City");
      void settingsStore; // read at build time; live reads use the getter
    };
  }, [user]);

  const overlay = useGameStore((s) => s.overlay);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0f14]">
      <div ref={containerRef} className="absolute inset-0" />

      {phase === "playing" && <Hud gameRef={gameRef} />}

      {phase === "playing" && overlay === "map" && (
        <MapPanel gameRef={gameRef} />
      )}
      {phase === "playing" && overlay === "settings" && (
        <SettingsPanel onClose={() => useGameStore.getState().setOverlay(null)} />
      )}
      {phase === "playing" && overlay === "pause" && (
        <PauseMenu
          onResume={() => {
            useGameStore.getState().setOverlay(null);
            gameRef.current?.setPaused(false);
          }}
          onOpenSettings={() => useGameStore.getState().setOverlay("settings")}
          onExitWorld={async () => {
            // Save state before leaving.
            const st = useGameStore.getState();
            if (st.checkpoint) await api.saveCheckpoint(st.checkpoint).catch(() => {});
            navigate("/dashboard");
          }}
        />
      )}
      {phase === "playing" && overlay === "inventory" && <InventoryPanel />}

      {phase === "loading" && !fatal && <LoadingOverlay />}
      {fatal && <FatalOverlay message={fatal} />}
    </div>
  );
}

function LoadingOverlay() {
  const progress = useGameStore((s) => s.loadProgress);
  const label = useGameStore((s) => s.loadLabel);
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0f14]">
      <div className="w-full max-w-md px-8 text-center">
        <h1 className="elora-h1 mb-2 text-3xl text-white">
          EL<span className="font-light text-white/60">ORA</span>
        </h1>
        <p className="mb-10 text-xs uppercase tracking-[0.3em] text-white/40">
          Elora Central City
        </p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500/80 to-emerald-300/90 transition-all duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className="elora-mono mt-4 text-sm text-white/60">{label}</p>
      </div>
    </div>
  );
}

function FatalOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0a0f14] px-8 text-center">
      <p className="text-lg font-semibold text-white">The world couldn't load</p>
      <p className="max-w-md text-sm text-white/60 elora-mono">{message}</p>
      <a href="/dashboard" className="elora-btn-primary">
        Back to launcher
      </a>
    </div>
  );
}
