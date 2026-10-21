/** Actions the world/interior can invoke on the running game. */
export interface GameWorldActions {
  /** Sit onto a spot (bench/stool) facing `yaw` rad. */
  sitAt: (x: number, y: number, z: number, yaw: number) => void;
  enterCafe: () => void;
  exitCafe: () => void;
}

export interface InteractableDef {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  prompt: string;
  /** Lower wins when two interactables overlap. */
  priority?: number;
  action: () => void;
  enabled?: () => boolean;
}

export type Collider =
  | { kind: "box"; minx: number; maxx: number; minz: number; maxz: number }
  | { kind: "circle"; cx: number; cz: number; r: number };
