import { create } from "zustand";
import type { CharacterAppearance } from "@/shared/types";

interface CharacterDraftState {
  draft: CharacterAppearance;
  setDraft: (patch: Partial<CharacterAppearance>) => void;
}

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  displayName: "",
  bodyType: "average",
  skinTone: "#f3d0b0",
  hairColor: "#4a2a13",
  topColor: "#2e6d4f",
  bottomColor: "#2b2b2b",
  hairStyle: 0,
};

export const useCharacterDraft = create<CharacterDraftState>((set) => ({
  draft: DEFAULT_APPEARANCE,
  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
}));
