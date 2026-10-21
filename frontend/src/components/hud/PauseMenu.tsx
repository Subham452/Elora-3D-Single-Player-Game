import { useGameStore } from "@/stores/gameStore";
import { api, setApiAccessToken } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";

export default function PauseMenu({
  onResume,
  onOpenSettings,
  onExitWorld,
}: {
  onResume: () => void;
  onOpenSettings: () => void;
  onExitWorld: () => void | Promise<void>;
}) {
  const setOverlay = useGameStore((s) => s.setOverlay);
  const checkpoint = useGameStore((s) => s.checkpoint);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0f14d9] backdrop-blur-sm">
      <div className="elora-card w-[min(440px,92vw)] p-6">
        <h2 className="elora-h1 mb-1 text-2xl">Paused</h2>
        <p className="mb-6 text-sm text-white/45">
          {checkpoint
            ? `Checkpoint at (${Math.round(checkpoint.x)}, ${Math.round(checkpoint.z)}) — saving every 40s.`
            : "Checkpoint pending…"}
        </p>
        <div className="flex flex-col gap-2.5">
          <button type="button" className="elora-btn-primary" onClick={onResume}>
            Resume
          </button>
          <button type="button" className="elora-btn-secondary" onClick={onOpenSettings}>
            Settings
          </button>
          <button
            type="button"
            className="elora-btn-secondary"
            onClick={async () => { await onExitWorld(); }}
          >
            Save & Return to Launcher
          </button>
          <button
            type="button"
            className="mt-2 text-xs text-white/40 hover:text-white/70"
            onClick={async () => {
              try { await api.logout(); } catch { /* best-effort */ }
              setApiAccessToken(null);
              useAuthStore.getState().logout();
              setOverlay(null);
            }}
          >
            Log out of ELORA
          </button>
        </div>
      </div>
    </div>
  );
}
