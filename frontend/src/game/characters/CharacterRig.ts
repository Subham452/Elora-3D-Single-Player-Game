import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * Rigged character loader + animation state machine.
 *
 * Asset: public/assets/characters/elora-player.glb (three.js Soldier.glb —
 * see docs/CREDITS.md). Rigged humanoid, clips available in-file:
 *   Idle, Walk, Run (+ TPose we ignore).
 *
 * CLIP CONTRACT (documented in docs/ASSET_PIPELINE.md — replace model here):
 *   required: idle, walk, run
 *   optional: jump, fall, wave, dance, crouch
 * Missing optional clips fall back to documented PROCEDURAL limb motion
 * applied on top of the skeleton after mixer sampling — deliberately not
 * pretending a baked clip exists; `fallbacksUsed` reports what is active.
 */

// Where the asset lives (local, documented — never a remote URL).
export const PLAYER_MODEL_URL = "/assets/characters/elora-player.glb";
/** Model faces +Z in bind pose; tweak here if you swap the GLB. */
export const MODEL_YAW_OFFSET = 0;
/** Rendered height target (world units/meters). */
export const TARGET_HEIGHT = 1.78;

export type ClipName = "idle" | "walk" | "run" | "wave" | "dance" | "crouch";

interface ProceduralPose {
  /** arm/leg bone rotation overrides while active. */
  armSwing: [number, number];
  legSwing: [number, number];
  torsoLean: number;
  hopBob: number;
}

export class CharacterRig {
  group = new THREE.Group(); // outer (we control yaw + position)
  private inner: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Partial<Record<ClipName, THREE.AnimationAction>> = {};
  private current: ClipName = "idle";
  /** Names of contracts fulfilled procedurally (shown in the info panel). */
  readonly fallbacksUsed = new Set<string>();

  static async load(onProgress?: (p: number) => void, useFallbackOnFailure = true): Promise<CharacterRig | null> {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(PLAYER_MODEL_URL, (e) => {
        if (e.total > 0) onProgress?.(e.loaded / e.total);
      });
      const rig = new CharacterRig(gltf);
      return rig;
    } catch (err) {
      if (!useFallbackOnFailure) return null;
      console.warn(
        "[elora] Character GLB failed to load — using documented procedural fallback:",
        err,
      );
      const rig = new CharacterRig(null);
      return rig;
    }
  }

  constructor(gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>> | null) {
    if (gltf) {
      const scene = skeletonClone(gltf.scene) as THREE.Group;
      // normalize height + faces +Z offset
      const box = new THREE.Box3().setFromObject(scene);
      const size = new THREE.Vector3();
      box.getSize(size);
      const scale = TARGET_HEIGHT / Math.max(0.01, size.y);
      scene.scale.setScalar(scale);
      // lift feet to y=0
      const box2 = new THREE.Box3().setFromObject(scene);
      scene.position.y -= box2.min.y;
      scene.rotation.y = MODEL_YAW_OFFSET;
      this.inner = scene;
      this.group.add(scene);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });

      this.mixer = new THREE.AnimationMixer(scene);
      const byName = new Map<string, THREE.AnimationClip>();
      for (const clip of gltf.animations) byName.set(clip.name.toLowerCase(), clip);
      // In-file clips (case-insensitive).
      this.actions.idle = byName.has("idle") ? this.mixer.clipAction(byName.get("idle")!) : undefined;
      this.actions.walk = byName.has("walk") ? this.mixer.clipAction(byName.get("walk")!) : undefined;
      this.actions.run = byName.has("run") ? this.mixer.clipAction(byName.get("run")!) : undefined;
      for (const n of ["wave", "dance", "crouch"] as const) {
        if (byName.has(n)) {
          this.actions[n] = this.mixer.clipAction(byName.get(n)!);
        }
      }
      // Start the idle clip.
      this.actions.idle?.play();
    } else {
      // Procedural fallback figure (capsule person) so gameplay never halts.
      this.fallbacksUsed.add("idle");
      this.fallbacksUsed.add("walk");
      this.fallbacksUsed.add("run");
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.26, 0.7, 4, 12),
        new THREE.MeshStandardMaterial({ color: 0x3a6fb0, roughness: 0.8 }),
      );
      body.position.y = 0.85;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xe0ac69, roughness: 0.9 }),
      );
      head.position.y = 1.55;
      const mark = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 1.5, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 1, transparent: true, opacity: 0.35 }),
      );
      mark.position.set(0, 0.85, -0.14);
      body.castShadow = true;
      head.castShadow = true;
      this.group.add(body, head, mark);
    }
  }

  get isRigged(): boolean {
    return this.mixer != null;
  }

  /** Animation state machine: cross-fade to the requested clip (baked). */
  private setClip(name: ClipName, fadeTime = 0.22): boolean {
    const target = this.actions[name];
    if (!target) return false;
    if (this.current === name) return true;
    const from = this.actions[this.current];
    from?.fadeOut(fadeTime);
    target.reset().fadeIn(fadeTime).play();
    this.current = name;
    return true;
  }

  /**
   * Drive the character. `locomotion` chooses clip; when a clip is missing 
   * (e.g. wave/dance/crouch in the shipped asset) procedural fallback stands in.
   * `airborne`: if true, uses procedural air pose (no baked jump clip).
   */
  update(
    dt: number,
    locomotion: ClipName,
    airborne: boolean,
    proceduralT: number,
  ): void {
    if (this.inner == null) return;
    this.mixer?.update(dt);

    if (airborne) {
      // Documented fallback: pose arms up + slight leg tuck procedurally.
      this.applyProceduralAir(proceduralT);
      return;
    }

    if (locomotion === "idle" || locomotion === "walk" || locomotion === "run") {
      if (this.setClip(locomotion)) this.clearProcedural();
      return;
    }

    // Optional clips (wave/dance/crouch) — baked if present.
    if (this.actions[locomotion]) {
      this.setClip(locomotion);
      this.clearProceduralSoftly();
      return;
    }

    // Procedural fallback motions standing in for missing clips.
    this.fallbacksUsed.add(locomotion);
    this.applyProceduralEmote(locomotion, proceduralT);
  }

  private armL: THREE.Object3D | null = null;
  private armR: THREE.Object3D | null = null;
  private legL: THREE.Object3D | null = null;
  private legR: THREE.Object3D | null = null;
  private torso: THREE.Object3D | null = null;

  private findBones(): void {
    if (this.inner == null || this.armL != null) return;
    // Common bone names across humanoid rigs (case-insensitive heuristic).
    const all: THREE.Object3D[] = [];
    this.inner.traverse((o) => {
      if ((o as THREE.Bone).isBone) all.push(o);
    });
    const pick = (re: RegExp) => all.find((b) => re.test(b.name.toLowerCase()));
    this.armL = pick(/(arm.*l|l.*arm|leftarm|arm_l)/) ?? pick(/shoulder.*l/) ?? null;
    this.armR = pick(/(arm.*r|r.*arm|rightarm|arm_r)/) ?? pick(/shoulder.*r/) ?? null;
    this.legL = pick(/(leg.*l|upleg.*l|thigh.*l|leg_l)/) ?? null;
    this.legR = pick(/(leg.*r|upleg.*r|thigh.*r|leg_r)/) ?? null;
    this.torso = pick(/(spine|torso|chest)/) ?? null;
  }

  private procPose: ProceduralPose = {
    armSwing: [0, 0],
    legSwing: [0, 0],
    torsoLean: 0,
    hopBob: 0,
  };

  private applyProceduralEmote(name: ClipName, t: number): void {
    this.findBones();
    const P = this.procPose;
    if (name === "wave") {
      P.armSwing = [-2.4 + Math.sin(t * 6.8) * 0.35, 0];
    } else if (name === "dance") {
      P.armSwing = [-1.5 + Math.sin(t * 4.4) * 0.7, -1.5 + Math.sin(t * 4.4 + Math.PI) * 0.7];
      P.hopBob = Math.abs(Math.sin(t * 4.4)) * 0.06;
    } else {
      P.armSwing = [0, 0];
    }
    P.legSwing = [0, 0];
    this.writePose();
  }

  private applyProceduralAir(t: number): void {
    this.findBones();
    const P = this.procPose;
    P.armSwing = [-2.2, -2.2]; // arms up (jump stretch)
    P.legSwing = [0.45, -0.3];
    P.hopBob = Math.sin(t * 2) * 0.01;
    P.torsoLean = 0.08;
    this.writePose();
  }

  private writePose(): void {
    const P = this.procPose;
    // Direct assignment — applied after mixer update, overriding baked poses.
    if (this.armL) this.armL.rotation.x = P.armSwing[0];
    if (this.armR) this.armR.rotation.x = P.armSwing[1];
    if (this.legL) this.legL.rotation.x = P.legSwing[0];
    if (this.legR) this.legR.rotation.x = P.legSwing[1];
    if (this.torso) this.torso.rotation.x = P.torsoLean;
    if (this.inner && P.hopBob) this.inner.position.y = P.hopBob;
    else if (this.inner) this.inner.position.y = 0;
  }

  private clearProcedural(): void {
    const P = this.procPose;
    P.armSwing = [0, 0];
    P.legSwing = [0, 0];
    P.torsoLean = 0;
    P.hopBob = 0;
  }

  private clearProceduralSoftly(): void {
    this.clearProcedural();
  }
}

