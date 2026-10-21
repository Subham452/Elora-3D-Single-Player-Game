import * as THREE from "three";
import {
  buildAvatar,
  animateAvatar,
  type LocomotionState,
} from "@/game/avatars/avatar";
import type { Collider } from "@/game/interactions/interactions";
import type { CharacterAppearance } from "@/shared/types";

/**
 * Kinematic third-person character controller.
 * Ground: y=0 hemisphere everywhere (roads/sidewalk lawn share the plane;
 * stepping curves aren't simulated — curbs are visually raised a few cm and
 * the character simply walks over them; jump/land uses plain gravity).
 * XZ collision: circle player vs box/circle colliders, resolved axis-by-axis
 * for stable framing along walls, plus gentle slide (no sticky corners).
 */

const WALK = 2.15;
const RUN = 4.4;
const SPRINT = 6.3;
const ACCEL = 14;
const DECEL = 11;
const JUMP_V = 5.0;
const GRAVITY = 15.5;

export interface PlayerInput {
  moveX: number; // -1..1  (A/D)
  moveZ: number; // -1..1  (W/S)  — W is "forward" = camera forward
  sprint: boolean;
  jump: boolean;
}

export class PlayerController {
  group: THREE.Group;
  position = new THREE.Vector3();
  private velocity = new THREE.Vector3();
  private yaw = 0;
  private grounded = true;
  private state: LocomotionState = "idle";
  private emoteTimer = 0;
  private emote: "wave" | "dance" | null = null;
  private sitting: { x: number; y: number; z: number; yaw: number } | null = null;
  private animT = 0;
  private walkPhase = 0;
  onFootstep?: (speed01: number) => void;
  private lastFootPhase = 0;

  readonly radius = 0.38;

  constructor(
    appearance: CharacterAppearance,
    private colliders: Collider[],
  ) {
    const { group, parts } = buildAvatar(appearance);
    this.group = group;
    this.parts = parts;
    group.position.copy(this.position);
  }

  parts: Record<string, THREE.Object3D>;

  get isSitting(): boolean {
    return this.sitting != null;
  }

  jumpRequested = false;

  /** External emote triggers (H wave / G dance). */
  triggerEmote(e: "wave" | "dance"): void {
    if (this.sitting) this.stand();
    this.emote = e;
    this.emoteTimer = e === "wave" ? 1.7 : 5.2;
  }

  sitAt(x: number, y: number, z: number, yaw: number): void {
    this.sitting = { x, y, z, yaw };
    this.position.set(x, y, z);
    this.yaw = yaw;
    this.group.position.set(x, y, z);
    this.group.rotation.y = yaw;
  }

  stand(): void {
    const wasSitting = this.sitting;
    this.sitting = null;
    if (wasSitting) {
      // Step out in front of the seat.
      this.position.y = 0;
      this.position.x += Math.sin(this.yaw) * 0.7;
      this.position.z += Math.cos(this.yaw) * 0.7;
      this.resolveCollisions(0.02);
    }
  }

  respawn(x: number, z: number, yaw = 0): void {
    this.sitting = null;
    this.position.set(x, 0, z);
    this.yaw = yaw;
    this.velocity.set(0, 0, 0);
    this.group.position.set(x, 0, z);
    this.group.rotation.y = yaw;
  }

  /**
   * @param cameraYaw  current camera azimuth (rad): W means "away from camera".
   * @param dt         delta seconds.
   */
  update(dt: number, input: PlayerInput, cameraYaw: number): void {
    this.animT += dt;
    const wantJump = !this.sitting && input.jump && this.grounded;
    if (wantJump) {
      this.velocity.y = JUMP_V;
      this.grounded = false;
    }

    if (this.sitting) {
      this.state = "sit";
      animateAvatar(this.parts, "sit", this.animT, dt);
      return;
    }

    // Desired horizontal direction from camera-space input.
    const ix = input.moveX;
    const iz = input.moveZ;
    const len = Math.hypot(ix, iz);
    let targetSpeed = 0;
    const dir = new THREE.Vector3();
    let hasMove = false;

    if (len > 0.06) {
      hasMove = true;
      dir.set(ix, 0, iz).normalize();
      // Map camera-space input into world space. The rig's camera sits at
      // target + dir(yaw), looking back along -dir, so screen-forward W maps
      // to (-sin yaw, -cos yaw) in world XZ.
      const cos = Math.cos(cameraYaw);
      const sin = Math.sin(cameraYaw);
      const worldX = ix * cos - iz * sin;
      const worldZ = -(ix * sin + iz * cos);
      dir.set(worldX, 0, worldZ).normalize();
      const letSprint = input.sprint && iz > 0.3; // only sprint forward
      targetSpeed = letSprint ? SPRINT : iz > 0.3 ? RUN : WALK;
    }

    const accel = hasMove ? ACCEL : DECEL;
    this.velocity.x += (dir.x * targetSpeed - this.velocity.x) * Math.min(1, dt * accel);
    this.velocity.z += (dir.z * targetSpeed - this.velocity.z) * Math.min(1, dt * accel);

    // Jump/ground handling
    this.velocity.y -= GRAVITY * dt;
    this.position.addScaledVector(this.velocity, dt);
    if (this.position.y < 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.grounded = true;
    }

    // Collisions
    this.resolveCollisions(dt);

    // Bounds: keep inside the district footprint
    this.position.x = THREE.MathUtils.clamp(this.position.x, -195, 195);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -195, 195);

    // Facing
    if (hasMove) {
      const target = Math.atan2(this.velocity.x, this.velocity.z);
      let d = target - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 11);
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;

    // Locomotion state machine (emotes win, then air, then speed).
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    let state: LocomotionState;
    if (this.emote) state = this.emote;
    else if (!this.grounded) state = this.velocity.y > 0.1 ? "jump" : "fall";
    else if (speed > 0.35) state = speed > 5 ? "run" : speed > 2.6 ? "run" : "walk";
    else state = "idle";

    // Footstep callbacks on stride cycle.
    if (state === "walk" || state === "run") {
      this.walkPhase += dt * (state === "run" ? 8.4 : 5.6);
      const phase = Math.floor((this.walkPhase / Math.PI) % 2);
      if (phase !== this.lastFootPhase) {
        this.lastFootPhase = phase;
        this.onFootstep?.(speed / SPRINT);
      }
    }

    this.state = state;
    animateAvatar(this.parts, state, this.animT, dt);

    if (this.emote) {
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0) this.emote = null;
    }
  }

  private resolveCollisions(dt: number): void {
    // Two iterations for corner cases.
    for (let i = 0; i < 2; i++) {
      for (const c of this.colliders) {
        if (c.kind === "circle") {
          const dx = this.position.x - c.cx;
          const dz = this.position.z - c.cz;
          const dist = Math.hypot(dx, dz);
          const minDist = c.r + this.radius;
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
          if (distSq < this.radius * this.radius) {
            if (distSq > 0.000001) {
              const dist = Math.sqrt(distSq);
              const push = (this.radius - dist) / dist;
              this.position.x += dx * push;
              this.position.z += dz * push;
            } else {
              // Center is inside the box — eject along least-penetration axis.
              const left = this.position.x - c.minx;
              const right = c.maxx - this.position.x;
              const top = this.position.z - c.minz;
              const bottom = c.maxz - this.position.z;
              const min = Math.min(left, right, top, bottom);
              if (min === left) this.position.x = c.minx - this.radius;
              else if (min === right) this.position.x = c.maxx + this.radius;
              else if (min === top) this.position.z = c.minz - this.radius;
              else this.position.z = c.maxz + this.radius;
            }
          }
        }
      }
    }
    void dt;
  }

  getSpeedKmh(): number {
    return Math.hypot(this.velocity.x, this.velocity.z) * 3.6;
  }

  currentAnimPhase(): number {
    return this.walkPhase;
  }

  get animKey(): LocomotionState {
    return this.state;
  }
}
