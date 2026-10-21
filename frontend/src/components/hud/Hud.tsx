import { useEffect, useState, type MutableRefObject } from "react";
import { useGameStore } from "@/stores/gameStore";
import { POIS } from "@/game/world/worldData";
import type { EloraGame } from "@/game/Game";

type GameRef = MutableRefObject<EloraGame | null>;

export default function Hud({ gameRef }: { gameRef: GameRef }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      <CompassBit />
      <ClockBit />
      <VitalsBit />
      <HotbarBit />
      <PromptBit />
      <HintBit />
      <ToastBit />
      <NameBit />
      <ActionBar gameRef={gameRef} />
      <PerfBit />
    </div>
  );
}

/** Top-center compass ribbon: N markers glide under a fixed caret. */
function CompassBit() {
  const heading = useGameStore((s) => s.headingDeg);
  const marks: { at: number; label: string; strong: boolean }[] = [
    { at: 0, label: "N", strong: true },
    { at: 45, label: "NE", strong: false },
    { at: 90, label: "E", strong: true },
    { at: 135, label: "SE", strong: false },
    { at: 180, label: "S", strong: true },
    { at: 225, label: "SW", strong: false },
    { at: 270, label: "W", strong: true },
    { at: 315, label: "NW", strong: false },
  ];
  return (
    <div className="absolute left-1/2 top-3 flex w-[320px] -translate-x-1/2 flex-col items-center">
      <div className="relative h-8 w-full overflow-hidden rounded-lg bg-black/35 backdrop-blur-sm">
        {marks.map((m, i) => {
          let d = m.at - heading;
          d = ((d % 360) + 540) % 360 - 180;
          const px = 160 + d * 1.8;
          if (px < -30 || px > 330) return null;
          return (
            <span
              key={i}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] ${
                m.strong ? "font-bold text-white/90" : "text-white/40"
              }`}
              style={{ left: px }}
            >
              {m.label}
            </span>
          );
        })}
        <div className="absolute left-1/2 top-0 h-full w-px bg-emerald-300/70" />
      </div>
    </div>
  );
}

/** Top-right clock + day. */
function ClockBit() {
  const hour = useGameStore((s) => s.hour);
  const day = useGameStore((s) => s.dayCount);
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  const phase =
    hour < 6.5 ? "Night" : hour < 10 ? "Morning" : hour < 17 ? "Afternoon" : hour < 19.5 ? "Dusk" : "Night";
  return (
    <div className="absolute right-4 top-3 rounded-xl bg-black/40 px-4 py-2 text-right backdrop-blur-sm">
      <div className="elora-mono text-lg leading-4 text-white/90">
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-white/50">
        {phase} · Day {day}
      </div>
    </div>
  );
}

/** Real player vitals fed by the controller. */
function VitalsBit() {
  const health = useGameStore((s) => s.health);
  const stamina = useGameStore((s) => s.stamina);
  return (
    <div className="absolute bottom-6 left-6 w-52">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/60">
        Health
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/45 ring-1 ring-white/10">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${health}%`,
            background: "linear-gradient(90deg,#3f6f3f,#63a35d)",
          }}
        />
      </div>
      <div className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-wider text-white/60">
        Stamina
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/45 ring-1 ring-white/10">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${stamina}%`,
            background: "linear-gradient(90deg,#3d6e86,#7fc3e0)",
          }}
        />
      </div>
    </div>
  );
}

/** Hotbar collected items (seeds / blooms / shards). */
function HotbarBit() {
  const hotbar = useGameStore((s) => s.hotbar);
  const slots: { icon: string; count: number; label: string }[] = [
    { icon: "🌾", count: hotbar.seeds, label: "Golden Seeds" },
    { icon: "🌸", count: hotbar.blooms, label: "Valley Blooms" },
    { icon: "💠", count: hotbar.shards, label: "Stone Shards" },
  ];
  return (
    <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
      {slots.map((s) => (
        <div
          key={s.label}
          className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-black/45 backdrop-blur-sm ring-1 ring-white/10"
          title={s.label}
        >
          <span className="text-lg leading-5">{s.icon}</span>
          <span className="elora-mono text-[11px] text-white/70">{s.count}</span>
        </div>
      ))}
    </div>
  );
}

/** Contextual interaction prompt just above the hotbar. */
function PromptBit() {
  const prompt = useGameStore((s) => s.prompt);
  if (!prompt) return null;
  const body = prompt.startsWith("E — ") ? prompt.slice(4) : prompt;
  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-xl bg-black/55 px-3 py-2 backdrop-blur-sm ring-1 ring-white/15">
        <kbd className="elora-mono rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold text-white">
          E
        </kbd>
        <span className="text-sm text-white/85">{body}</span>
      </div>
    </div>
  );
}

/** Bottom-left controls hint that fades out after a while. */
function HintBit() {
  const visible = useGameStore((s) => s.hintVisible);
  const [t] = useState(() => setTimeout(() => useGameStore.getState().setHint(false), 16000));
  useEffect(() => () => clearTimeout(t), [t]);
  if (!visible) return null;
  const rows: [string, string][] = [
    ["W A S D", "move"],
    ["Shift", "run (stamina)"],
    ["Space", "jump"],
    ["E", "interact / stand"],
    ["Mouse drag", "look"],
    ["Wheel", "zoom"],
    ["H / G", "wave / dance"],
    ["M", "world map"],
    ["I", "bag & character"],
    ["Esc", "pause"],
    ["`", "performance"],
  ];
  return (
    <div className="absolute bottom-6 right-4 rounded-xl bg-black/40 px-4 py-3 backdrop-blur-sm ring-1 ring-white/10">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/45">
        Controls
      </div>
      <table className="border-separate border-spacing-x-3 border-spacing-y-0.5 text-[11px]">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="elora-mono text-white/75">{k}</td>
              <td className="text-white/45">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Discovery / pickup toasts. */
function ToastBit() {
  const toast = useGameStore((s) => s.toast);
  const clear = useGameStore((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clear, 3800);
    return () => clearTimeout(t);
  }, [toast, clear]);
  if (!toast) return null;
  return (
    <div className="absolute left-1/2 top-14 -translate-x-1/2">
      <div className="rounded-xl bg-black/60 px-4 py-2.5 text-center backdrop-blur-sm ring-1 ring-emerald-400/30">
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300/90">
          {toast.title}
        </div>
        <div className="mt-0.5 text-sm text-white/85">{toast.body}</div>
      </div>
    </div>
  );
}

function NameBit() {
  const name = useGameStore((s) => s.playerName);
  const place = useGameStore((s) => s.place);
  return (
    <div className="absolute left-4 top-3">
      <div className="text-sm font-semibold text-white/90">{name || "Traveler"}</div>
      <div className="text-[11px] text-white/45">{place}</div>
    </div>
  );
}

function ActionBar({ gameRef }: { gameRef: GameRef }) {
  const setOverlay = useGameStore((s) => s.setOverlay);
  const hintOn = useGameStore((s) => s.hintVisible);
  void hintOn;
  const btn =
    "pointer-events-auto accent-gradient pointer-events-auto rounded-lg bg-black/45 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-sm ring-1 ring-white/10 hover:bg-black/60 transition";
  return (
    <div className="absolute bottom-24 right-4 flex gap-2">
      <button
        type="button"
        className={btn}
        onClick={() => {
          gameRef.current?.triggerEmote("wave");
        }}
      >
        Wave
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => {
          gameRef.current?.triggerEmote("dance");
        }}
      >
        Dance
      </button>
      <button type="button" className={btn} onClick={() => setOverlay("map")}>
        Map
      </button>
      <button type="button" className={btn} onClick={() => setOverlay("inventory")}>
        Bag
      </button>
      <button type="button" className={btn} onClick={() => setOverlay("pause")}>
        Menu
      </button>
    </div>
  );
}

/** Real perf panel sampled by the engine (`F3` / backquote). */
function PerfBit() {
  const visible = useGameStore((s) => s.perfVisible);
  const perf = useGameStore((s) => s.perf);
  if (!visible) return null;
  const rows: [string, string][] = [
    ["FPS", `${perf.fps}`],
    ["Frame", `${perf.frameMs} ms`],
    ["Draw calls", `${perf.draws}`],
    ["Triangles", `${perf.tris}`],
    ["Entities", `${perf.entities}`],
  ];
  return (
    <div className="absolute left-1/2 top-12 -translate-x-1/2 rounded-lg bg-black/70 px-3 py-2 backdrop-blur-sm">
      <table className="elora-mono text-[11px]">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="pr-4 text-white/50">{k}</td>
              <td className="text-right text-emerald-300/90">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Re-exported so overlays can render POI lists without import loops. */
export { POIS };
export type { GameRef };
