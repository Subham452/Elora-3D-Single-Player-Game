import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_GAME_SETTINGS,
  type GameSettings,
  type QualityPreset,
} from "@/shared/types";

/** Quality preset → concrete renderer targets. */
export const QUALITY_PRESETS: Record<
  QualityPreset,
  {
    shadowMapSize: number;
    pixelRatioCap: number;
    vegetationDensity: number; // 0..1
    fogNear: number;
    fogFar: number;
    antialias: boolean;
  }
> = {
  low: { shadowMapSize: 0, pixelRatioCap: 1, vegetationDensity: 0.35, fogNear: 90, fogFar: 170, antialias: false },
  medium: { shadowMapSize: 1024, pixelRatioCap: 1.25, vegetationDensity: 0.6, fogNear: 120, fogFar: 230, antialias: false },
  high: { shadowMapSize: 2048, pixelRatioCap: 1.75, vegetationDensity: 1, fogNear: 150, fogFar: 280, antialias: true },
  ultra: { shadowMapSize: 4096, pixelRatioCap: 2, vegetationDensity: 1.25, fogNear: 170, fogFar: 320, antialias: true },
};

interface GameSettingsState {
  settings: GameSettings;
  update: (patch: Partial<GameSettings>) => void;
}

export const useGameSettings = create<GameSettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_GAME_SETTINGS,
      update: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    { name: "elora.settings" },
  ),
);
