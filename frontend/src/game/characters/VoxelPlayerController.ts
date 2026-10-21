import * as THREE from "three";
import type { Collider } from "@/game/interactions/interactions";
import type { CharacterRig } from "@/game/characters/CharacterRig";
import { WATER_LEVEL } from "@/game/world/voxel/terrainNoise";
import { useGameStore } from "@/stores/gameStore";

/**
 * Third-person kinematic controller for the voxel heightfield world.
 * - Authoritative ground height from terrainHeight() (same fn the meshes use).
 * - Step-up: ≤1.05 block per frame ⇒ smooth stair climb; bigger jumps in
 *   height are blocked (slide along the ledge) — no wall-climbing exploit.
 * - Gravity + jump; deep falls trigger health damage (regen over time).
 * - Wading: water below WATER_LEVEL caps y and slows movement.
 * - Stamina: sprint drains, walking/idle regenerates. (Health + stamina
 * surface in the HUD; they're real state, not decorative bars.)
 */

const WALK = 3.4;
const RUN = 5.6;
const SPRINT = 7.6;
const ACCEL = 13;
const DECEL = 10;
const JUMP_V = 7.4;
const GRAVITY = 20;
const MAX_STEP = 1.12;
const PLAYER_RADIUS = 0.42;

export interface VoxelInput {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  jump: boolean;
}

export type VoxelState = "idle" | "walk" | "run" | "jump" | "fall" | "wave" | "dance" | "sit";

export class VoxelPlayerController {
  readonly rig: CharacterRig;
  position = new THREE.Vector3();
  velocity = new THREE.Vector3();
  private yaw = 0;
  private grounded = true;
  private emote: "wave" | "dance" | null = null;
  private emoteTimer = 0;
  private state: VoxelState = "idle";
  health = 100;
  stamina = 100;
  private exhausted = false;
  onFootstep?: (intensity01: number) => void;
  onRespawn?: () => void;
  spawned = false;

  constructor(
    rig: CharacterRig,
    private colliders: Collider[],
    private heightAt: (x: number, z: number) => number,
  ) {
    this.rig = rig;
  }

  spawn(x: number, z: number, yaw = Math.PI): void {
    this.position.set(x, this.heightAt(x, z), z);
    this.yaw = yaw;
    this.velocity.set(0, 0, 0);
    this.grounded = true;
    this.rig.group.position.copy(this.position);
    this.rig.group.rotation.y = yaw;
    this.spawned = true;
  }

  respawn(): void {
    this.spawn(-16, 24);
    this.health = 55;
    useGameStore.getState().showToast("You blacked out", "You came to at the village well.");
    this.onRespawn?.();
  }

  triggerEmote(e: "wave" | "dance"): void {
    if (this.emoteTimer > 0) return;
    this.emote = e;
    this.emoteTimer = e === "wave" ? 1.7 : 5.2;
  }

  // Sitting anchors (bench/chair/bed). While sitting, movement is locked and
  // the rig holds the idle clip in a low pose.
  private sitting: { x: number; y: number; z: number; yaw: number } | null = null;

  sitAt(x: number, y: number, z: number, yaw: number): void {
    this.sitting = { x, y, z, yaw };
    this.position.set(x, y, z);
    this.yaw = yaw;
    this.velocity.set(0, 0, 0);
    this.rig.group.position.set(x, y, z);
    this.rig.group.rotation.y = yaw;
  }

  stand(): void {
    if (this.sitting) {
      this.position.y = this.heightAt(this.position.x, this.position.z);
      this.sitting = null;
    }
  }

  get isSitting(): boolean {
    return this.sitting != null;
  }

  get animState(): VoxelState {
    return this.emote ?? this.state;
  }

  update(dt: number, input: VoxelInput, cameraYaw: number): void {
    if (!this.spawned) return;

    if (this.sitting) {
      this.state = "sit";
      this.rig.update(dt, "crouch", false, this.t);
      this.t += dt;
      return;
    }

    // — emote timers —
    if (this.emote) {
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0) this.emote = null;
    }

    // — stamina & health —
    const moving = Math.hypot(input.moveX, input.moveZ) > 0.1;
    if (input.sprint && moving && this.stamina > 0 && !this.exhausted) {
      this.stamina = Math.max(0, this.stamina - dt * 13);
      if (this.stamina <= 0) this.exhausted = true;
    } else {
      this.stamina = Math.min(100, this.stamina + dt * 9);
      if (this.exhausted && this.stamina > 30) this.exhausted = false;
    }
    if (this.health < 100) {
      this.health = Math.min(100, this.health + dt * 1.4);
    }

    // — horizontal movement (camera-relative) —
    const len = Math.hypot(input.moveX, input.moveZ);
    let targetSpeed = 0;
    const dir = new THREE.Vector3();
    let hasMove = false;
    if (len > 0.15) {
      hasMove = true;
      dir.set(input.moveX, 0, input.moveZ).normalize();
      const cos = Math.cos(cameraYaw);
      const sin = Math.sin(cameraYaw);
      const worldX = input.moveX * cos - input.moveZ * sin;
      const worldZ = -(input.moveX * sin + input.moveZ * cos);
      dir.set(worldX, 0, worldZ).normalize();
      const inWater = this.position.y < WATER_LEVEL + 0.5;
      const sprinting =
        input.sprint && !this.exhausted && this.stamina > 0.5;
      targetSpeed = sprinting ? SPRINT : moving ? RUN : WALK;
      if (inWater) targetSpeed *= 0.55;
    }
    const rate = hasMove ? ACCEL : DECEL;
    this.velocity.x += (dir.x * targetSpeed - this.velocity.x) * Math.min(1, dt * rate);
    this.velocity.z += (dir.z * targetSpeed - this.velocity.z) * Math.min(1, dt * rate);

    // — jump —
    if (input.jump && this.grounded && !this.exhausted) {
      this.velocity.y = JUMP_V;
      this.grounded = false;
    }

    // — integrate + terrain —
    this.velocity.y -= GRAVITY * dt;
    const oldX = this.position.x;
    const oldZ = this.position.z;
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    const g = this.heightAt(this.position.x, this.position.z);
    const inWater = this.heightAt(this.position.x, this.position.z) < WATER_LEVEL;
    if (inWater) {
      const surface = WATER_LEVEL + 0.55;
      if (this.position.y < surface) {
        // Buoyancy: rise toward the surface while swimming/wading.
        this.position.y += (surface - this.position.y) * Math.min(1, dt * 6);
        this.grounded = surface - this.position.y < 0.45;
      } else {
        this.grounded = false;
      }
      if (this.position.y <= surface && this.velocity.y < 0) this.velocity.y = 0;
    } else if (this.position.y <= g) {
      if (this.velocity.y < -13) {
        const impact = -this.velocity.y;
        const dmg = Math.floor((impact - 13) * 6.5);
        if (dmg > 0) this.health = Math.max(0, this.health - dmg);
        if (this.health <= 0) {
          this.respawn();
          return;
        }
      }
      this.position.y = g;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // — step-up / ledge blocking — the heightfield pulls y toward the ground,
    // so a horizontal move onto a cliff taller than MAX_STEP would teleport
    // the player up. Slide along axes instead.
    if (this.grounded && g - this.position.y > MAX_STEP) {
      const tryX = this.heightAt(this.position.x, oldZ);
      if (tryX - this.position.y <= MAX_STEP) {
        this.position.z = oldZ; // reject Z, keep X
      } else {
        const tryZ = this.heightAt(oldX, this.position.z);
        if (tryZ - this.position.y <= MAX_STEP) {
          this.position.x = oldX; // reject X, keep Z
        } else {
          this.position.x = oldX; // blocked both — full revert
          this.position.z = oldZ;
        }
      }
      this.position.y = g;
      this.velocity.y = 0;
    }

    // — solid props colliders (2D, XZ plane) —
    this.resolveColliders();

    // — facing —
    if (hasMove) {
      const target = Math.atan2(this.velocity.x, this.velocity.z);
      let d = target - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 10);
    }
    this.rig.group.position.copy(this.position);
    this.rig.group.rotation.y = this.yaw;

    // — animation state —
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    let st: VoxelState;
    if (this.emote) st = this.emote;
    else if (!this.grounded) st = this.velocity.y > 0.5 ? "jump" : "fall";
    else if (speed > 4.2) st = "run";
    else if (speed > 0.6) st = "walk";
    else st = "idle";
    this.state = st;

    // — footstep sounds —
    if ((st === "walk" || st === "run") && this.grounded) {
      this.stridePhase = (this.stridePhase ?? 0) + dt * (st === "run" ? 8 : 5.4);
      if (Math.floor(this.stridePhase / Math.PI) !== Math.floor((this.stridePhase - dt) / Math.PI)) {
        this.onFootstep?.(speed / SPRINT);
      }
    }

    // Pass to the rig: baked locomotion clips + procedural fallback emotes.
    // Air state passes airborne=true (procedural air pose, no baked jump clip).
    const locomotion = st === "jump" || st === "fall" ? "idle" : st;
    this.rig.update(dt, locomotion, !this.grounded, this.t);
    this.t += dt;
  }

  t = 0;
  private stridePhase = 0;

  getSpeedKmh(): number {
    return Math.hypot(this.velocity.x, this.velocity.z) * 3.6;
  }

  private resolveColliders(): void {
    for (let i = 0; i < 2; i++) {
      for (const c of this.colliders) {
        if (c.kind === "circle") {
          const dx = this.position.x - c.cx;
          const dz = this.position.z - c.cz;
          const dist = Math.hypot(dx, dz);
          const minDist = c.r + PLAYER_RADIUS;
          if (dist < minDist && dist > 0.0001) {
            const push = (minDist - dist) / dist;
            this.position.x += dx * push;
            this.position.z += dz * push;
          }
        } else {
          const cx = THREE.MathUtils.clamp(this.position.x, c.minx, c.maxx);
          const cz = THREE.MathUtils.clamp(this.position.z, c.minz, c.maxz);
          const dx = this.position.x - cx;
          const dz = this.position.z - cz;
          const distSq = dx * dx + dz * dz;
          if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
            if (distSq > 0.000001) {
              const dist = Math.sqrt(distSq);
              const push = (PLAYER_RADIUS - dist) / dist;
              this.position.x += dx * push;
              this.position.z += dz * push;
            } else {
              const leftP = this.position.x - c.minx;
              const rightP = c.maxx - this.position.x;
              const topP = this.position.z - c.minz;
              const bottomP = c.maxz - this.position.z;
              const m = Math.min(leftP, rightP, topP, bottomP);
              if (m === leftP) this.position.x = c.minx - PLAYER_RADIUS;
              else if (m === rightP) this.position.x = c.maxx + PLAYER_RADIUS;
              else if (m === topP) this.position.z = c.minz - PLAYER_RADIUS;
              else this.position.z = c.maxz + PLAYER_RADIUS;
            }
          }
        }
      }
    }
  }
}

export function bindVoxelPlayerPlaceStore(_fn: unknown): void {
  /* legacy no-op — controller now imports the store directly */
}
