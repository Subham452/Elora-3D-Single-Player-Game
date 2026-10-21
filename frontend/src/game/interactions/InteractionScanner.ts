import type { InteractableDef } from "@/game/interactions/interactions";
import type { PoiDefinition } from "@/shared/types";

/**
 * Interaction + discovery scanner.
 * Finds the best (closest, highest-priority) interactable in reach and the
 * nearest undiscovered POI. Pure scanning — input handling lives in Game.
 */
export interface InteractionResult {
  nearest: InteractableDef | null;
  newPoi: PoiDefinition | null;
}

export class InteractionScanner {
  private lastNearestId: string | null = null;
  private nearest: InteractableDef | null = null;

  constructor(
    private interactables: InteractableDef[],
    private pois: PoiDefinition[],
    private discovered: Set<string>,
    private poiRadius = 9,
    private onChange: (prompt: string | null) => void,
    private onDiscover: (poi: PoiDefinition) => void,
  ) {}

  update(px: number, py: number, pz: number): InteractionResult {
    let best: InteractableDef | null = null;
    let bestScore = Infinity;
    for (const it of this.interactables) {
      if (it.enabled && !it.enabled()) continue;
      const d = Math.hypot(it.x - px, it.z - pz);
      const dy = Math.abs((it.y ?? 0) - py);
      if (d > it.radius || dy > 3.2) continue;
      const score = d - (it.priority ?? 0) * 0.45;
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }

    if (best?.id !== this.lastNearestId) {
      this.lastNearestId = best?.id ?? null;
      this.nearest = best;
      this.onChange(best?.prompt ?? null);
    } else {
      this.nearest = best;
    }

    // Discoveries: sphere check around player.
    let newPoi: PoiDefinition | null = null;
    for (const poi of this.pois) {
      if (this.discovered.has(poi.id)) continue;
      if (Math.hypot(poi.x - px, poi.z - pz) <= this.poiRadius) {
        newPoi = poi;
        break;
      }
    }
    if (newPoi) {
      this.discovered.add(newPoi.id);
      this.onDiscover(newPoi);
    }

    return { nearest: best, newPoi };
  }

  triggerNearest(): boolean {
    if (this.nearest) {
      this.nearest.action();
      return true;
    }
    return false;
  }

  currentPrompt(): string | null {
    return this.nearest?.prompt ?? null;
  }
}
