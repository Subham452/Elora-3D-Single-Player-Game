import { useGameSettings } from "@/stores/settingsStore";
import { useGameStore } from "@/stores/gameStore";
import type { QualityPreset } from "@/shared/types";

/** Full settings; every control feeds the real settings store and the live game. */
export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useGameSettings((s) => s.settings);
  const update = useGameSettings((s) => s.update);
  const setOverlay = useGameStore((s) => s.setOverlay);

  const qualityOptions: { value: QualityPreset; label: string }[] = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "ultra", label: "Ultra" },
  ];

  const notify = () => useGameStore.getState().showToast("Settings saved", "Applied to the live renderer.");

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0f14f2] backdrop-blur-sm">
      <div className="elora-card max-h-[86vh] w-[min(560px,92vw)] overflow-y-auto p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white/95">Settings</h2>
          <button
            type="button"
            className="elora-btn-secondary px-4 py-2"
            onClick={() => {
              setOverlay(null);
              onClose();
            }}
          >
            Back · Esc
          </button>
        </div>

        <section className="mb-6">
          <div className="elora-label mb-2">Graphics</div>
          <div className="grid grid-cols-4 gap-2">
            {qualityOptions.map((q) => (
              <button
                key={q.value}
                type="button"
                onClick={() => {
                  update({ quality: q.value });
                }}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  settings.quality === q.value
                    ? "bg-emerald-500/20 text-white ring-1 ring-emerald-400/50"
                    : "bg-white/[0.05] text-white/60 ring-1 ring-white/10 hover:bg-white/10"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          <label className="mb-2 mt-4 flex items-center gap-3 text-sm text-white/80">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-400"
              checked={settings.shadows}
              onChange={(e) => update({ shadows: e.target.checked })}
            />
            Shadows (PCF soft)
          </label>

          <Field label={`Render scale — ${settings.renderScale.toFixed(2)}×`}>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              className="w-full accent-emerald-400"
              value={settings.renderScale}
              onChange={(e) => update({ renderScale: Number(e.target.value) })}
            />
          </Field>

          <Field label={`View distance — ${Math.round(settings.viewDistance)}m`}>
            <input
              type="range"
              min={120}
              max={340}
              step={10}
              className="w-full accent-emerald-400"
              value={settings.viewDistance}
              onChange={(e) => update({ viewDistance: Number(e.target.value) })}
            />
          </Field>

          <Field label={`Camera FOV — ${settings.cameraFov}°`}>
            <input
              type="range"
              min={45}
              max={90}
              step={1}
              className="w-full accent-emerald-400"
              value={settings.cameraFov}
              onChange={(e) => update({ cameraFov: Number(e.target.value) })}
            />
          </Field>
        </section>

        <section className="mb-6">
          <div className="elora-label mb-2">Sound</div>
          <Field label={`Master — ${Math.round(settings.masterVolume * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              className="w-full accent-emerald-400"
              value={settings.masterVolume}
              onChange={(e) => update({ masterVolume: Number(e.target.value) })}
            />
          </Field>
          <Field label={`Ambience — ${Math.round(settings.musicVolume * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              className="w-full accent-emerald-400"
              value={settings.musicVolume}
              onChange={(e) => update({ musicVolume: Number(e.target.value) })}
            />
          </Field>
          <Field label={`Effects — ${Math.round(settings.sfxVolume * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              className="w-full accent-emerald-400"
              value={settings.sfxVolume}
              onChange={(e) => update({ sfxVolume: Number(e.target.value) })}
            />
          </Field>
        </section>

        <section>
          <div className="elora-label mb-2">Controls</div>
          <Field label={`Mouse sensitivity — ${settings.mouseSensitivity.toFixed(2)}`}>
            <input
              type="range"
              min={0.2}
              max={3}
              step={0.05}
              className="w-full accent-emerald-400"
              value={settings.mouseSensitivity}
              onChange={(e) => update({ mouseSensitivity: Number(e.target.value) })}
            />
          </Field>
          <label className="flex items-center gap-3 text-sm text-white/80">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-400"
              checked={settings.invertY}
              onChange={(e) => update({ invertY: e.target.checked })}
            />
            Invert camera Y
          </label>
        </section>

        <button
          type="button"
          className="elora-btn-primary mt-6 w-full"
          onClick={() => {
            notify();
            setOverlay(null);
            onClose();
          }}
        >
          Done
        </button>
        <p className="mt-3 text-[11px] text-white/40">
          Quality presets change shadow resolution, pixel-ratio cap, fog distance, antialiasing
          and vegetation radius on the live renderer.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 mt-3 block">
      <span className="mb-1 block text-xs text-white/60">{label}</span>
      {children}
    </label>
  );
}
