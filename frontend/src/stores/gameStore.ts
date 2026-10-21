import { create } from "zustand";
import type { PoiDefinition, PlayerCheckpoint } from "@/shared/types";
import { POIS } from "@/game/world/worldData";

/** Engine → React bridge. Engine writes; HUD components subscribe. */
export type UiOverlay = null | "map" | "settings" | "pause" | "inventory";

export interface PerfSample {
  fps: number;
  frameMs: number;
  draws: number;
  tris: number;
  entities: number;
}

interface GameState {
  phase: "loading" | "playing";
  loadProgress: number;
  loadLabel: string;
  prompt: string | null;
  hour: number;
  dayCount: number;
  headingDeg: number;
  speedKmh: number;
  inside: boolean;
  place: string;
  discoveries: string[];
  toast: { id: number; title: string; body: string } | null;
  overlay: UiOverlay;
  pointerLocked: boolean;
  playerName: string;
  coins: number;
  perf: PerfSample;
  perfVisible: boolean;
  hintVisible: boolean;
  checkpoint: PlayerCheckpoint | null;
  /** Character vitals (real controller state; 0..100). */
  health: number;
  stamina: number;
  /** Collected pickups: kind → count (hotbar). */
  hotbar: { seeds: number; blooms: number; shards: number };
  /** Fallback clips active on the character (info panel). */
  charFallbacks: string[];

  setPhase: (p: GameState["phase"]) => void;
  setLoad: (progress: number, label: string) => void;
  setPrompt: (prompt: string | null) => void;
  setClock: (hour: number, dayCount: number) => void;
  setHeading: (deg: number) => void;
  setSpeed: (kmh: number) => void;
  setInside: (inside: boolean) => void;
  setPlace: (place: string) => void;
  addDiscovery: (poiId: string) => void;
  showToast: (title: string, body: string) => void;
  clearToast: () => void;
  setOverlay: (o: UiOverlay) => void;
  setPointerLocked: (v: boolean) => void;
  setPlayer: (name: string, coins: number) => void;
  setPerf: (p: PerfSample) => void;
  togglePerf: () => void;
  setHint: (v: boolean) => void;
  setCheckpoint: (c: PlayerCheckpoint) => void;
  setVitals: (health: number, stamina: number) => void;
  addPickup: (kind: "seed" | "bloom" | "stoneShard") => void;
  setCharFallbacks: (list: string[]) => void;
}

export const useGameStore = create<GameState>((set) => ({
  phase: "loading",
  loadProgress: 0,
  loadLabel: "",
  prompt: null,
  hour: 9,
  dayCount: 1,
  headingDeg: 0,
  speedKmh: 0,
  inside: false,
  place: "Elora Central City",
  discoveries: [],
  toast: null,
  overlay: null,
  pointerLocked: false,
  playerName: "",
  coins: 0,
  perf: { fps: 0, frameMs: 0, draws: 0, tris: 0, entities: 0 },
  perfVisible: false,
  hintVisible: true,
  checkpoint: null,
  health: 100,
  stamina: 100,
  hotbar: { seeds: 0, blooms: 0, shards: 0 },
  charFallbacks: [],

  setPhase: (phase) => set({ phase }),
  setLoad: (loadProgress, loadLabel) => set({ loadProgress, loadLabel }),
  setPrompt: (prompt) => set({ prompt }),
  setClock: (hour, dayCount) => set({ hour, dayCount }),
  setHeading: (headingDeg) => set({ headingDeg }),
  setSpeed: (speedKmh) => set({ speedKmh }),
  setInside: (inside) => set({ inside }),
  setPlace: (place) => set({ place }),
  addDiscovery: (poiId) =>
    set((s) =>
      s.discoveries.includes(poiId)
        ? s
        : {
            discoveries: [...s.discoveries, poiId],
            toast: {
              id: Date.now(),
              title: "Location discovered",
              body: POIS.find((p) => p.id === poiId)?.name ?? poiId,
            },
          },
    ),
  showToast: (title, body) =>
    set({ toast: { id: Date.now(), title, body } }),
  clearToast: () => set({ toast: null }),
  setOverlay: (overlay) => set({ overlay }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  setPlayer: (playerName, coins) => set({ playerName, coins }),
  setPerf: (perf) => set({ perf }),
  togglePerf: () => set((s) => ({ perfVisible: !s.perfVisible })),
  setHint: (hintVisible) => set({ hintVisible }),
  setCheckpoint: (checkpoint) => set({ checkpoint }),
  setVitals: (health, stamina) => set({ health, stamina }),
  addPickup: (kind) =>
    set((s) => ({
      hotbar: {
        ...s.hotbar,
        [kind === "seed" ? "seeds" : kind === "bloom" ? "blooms" : "shards"]:
          s.hotbar[kind === "seed" ? "seeds" : kind === "bloom" ? "blooms" : "shards"] + 1,
      },
      toast: {
        id: Date.now(),
        title: "Picked up",
        body:
          kind === "seed"
            ? "Golden Seed added to your pouch."
            : kind === "bloom"
              ? "Valley Bloom added to your pouch."
              : "Stone Shard added to your pouch.",
      },
    })),
  setCharFallbacks: (charFallbacks) => set({ charFallbacks }),
}));

/** True when user is typing into a text field — keyboard must not be stolen. */
export function isTypingIntoField(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
}

export function poiDiscovered(poi: PoiDefinition): boolean {
  return useGameStore.getState().discoveries.includes(poi.id);
}
