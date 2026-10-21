import * as THREE from "three";
import type { CharacterAppearance } from "@/shared/types";

/**
 * ELORA avatar — PHASE 1 PROCEDURAL PLACEHOLDER.
 *
 * Per docs/ASSET_PIPELINE.md: this is an original, coherent stand-in until a
 * rigged GLB avatar is licensed/built. The replacement interface is:
 *   - `buildAvatar(appearance): THREE.Group`  (any mesh content)
 *   - `animateAvatar(avatar, state, t)`       (locomotion/emote/facial)
 * A future rigged avatar implements the same two functions in one file swap.
 */

export type LocomotionState =
  | "idle"
  | "walk"
  | "run"
  | "jump"
  | "fall"
  | "sit"
  | "wave"
  | "dance";

export interface AvatarOptions {
  /** Pair (id, group) for every named bone/limb — enables animation + preview. */
  parts: Record<string, THREE.Object3D>;
  baseHeight: number;
}

const SKIN = new THREE.MeshStandardMaterial({ roughness: 0.85 });
const CLOTH = new THREE.MeshStandardMaterial({ roughness: 0.9 });
const CLOTH_DARK = new THREE.MeshStandardMaterial({ roughness: 0.95 });
const HAIR = new THREE.MeshStandardMaterial({ roughness: 0.7 });
const EYE = new THREE.MeshStandardMaterial({ emissive: 0x111111, color: 0x1a1a1a, roughness: 0.3 });

let materialUid = 0;

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.matId = materialUid++;
  return m;
}

/**
 * Builds the full avatar rig as a named-parts group (all parts added under
 * `avatar.userData.parts`). Bulky enough to look intentional, light enough
 * for many instances (few polys per figure).
 */
export function buildAvatar(a: CharacterAppearance): {
  group: THREE.Group;
  parts: Record<string, THREE.Object3D>;
  baseHeight: number;
} {
  // — palette —
  SKIN.color.set(a.skinTone);
  CLOTH.color.set(a.topColor);
  CLOTH_DARK.color.set(a.bottomColor);
  HAIR.color.set(a.hairColor);

  const parts: Record<string, THREE.Object3D> = {};

  // Body proportions per body type.
  const bulk =
    a.bodyType === "athletic" ? 1.1 : a.bodyType === "slim" ? 0.92 : 1.0;
  const limbScale = a.bodyType === "slim" ? 1.03 : a.bodyType === "athletic" ? 1.0 : 0.97;

  const group = new THREE.Group();
  group.name = "avatar";

  // — torso (rounded via capsule) —
  const torso = new THREE.Group();
  torso.position.y = 1.12;
  const torsoMesh = mesh(
    new THREE.CapsuleGeometry(0.22 * bulk, 0.42, 6, 12),
    CLOTH,
  );
  torso.add(torsoMesh);

  // torso neck
  const neck = mesh(new THREE.CapsuleGeometry(0.07, 0.1, 4, 8), SKIN);
  neck.position.y = 0.34;
  torso.add(neck);

  // — head —
  const head = new THREE.Group();
  head.name = "head";
  head.position.y = 0.5;
  const headMesh = mesh(new THREE.SphereGeometry(0.19, 20, 16), SKIN);
  headMesh.scale.set(1, 1.05, 0.95);
  head.add(headMesh);

  // — hair (style 0..3 procedural) —
  const hair = mesh(new THREE.SphereGeometry(0.195, 18, 14, 0, Math.PI * 2, 0, a.hairStyle === 1 ? Math.PI * 0.75 : Math.PI * 0.62), HAIR);
  hair.scale.set(1.02, 1.05, 1);
  hair.position.y = 0.01;
  head.add(hair);
  if (a.hairStyle === 2 || a.hairStyle === 3) {
    // ponytail/bun style extras
    const knot = mesh(new THREE.SphereGeometry(0.07, 12, 10), HAIR);
    knot.position.set(0, 0.14, -0.16);
    head.add(knot);
    if (a.hairStyle === 3) {
      const strand = mesh(new THREE.CapsuleGeometry(0.04, 0.14, 4, 8), HAIR);
      strand.position.set(0, -0.02, -0.19);
      head.add(strand);
    }
  }

  // — eyes (two tiny dark spheres on a slightly forward-arched face) —
  const eyeGeo = new THREE.SphereGeometry(0.022, 8, 8);
  for (const sx of [-1, 1]) {
    const eye = mesh(eyeGeo, EYE);
    eye.position.set(0.065 * sx, 0.02, 0.165);
    head.add(eye);
  }
  torso.add(head);
  parts.head = head;

  // — arms —
  const upperArmGeo = new THREE.CapsuleGeometry(0.055 * limbScale, 0.26, 4, 8);
  const shoulderY = torso.position.y + 0.24;
  const armL = new THREE.Group();
  armL.name = "armL";
  armL.position.set(-0.26 * bulk, shoulderY, 0);
  const armLMesh = mesh(upperArmGeo, SKIN);
  armLMesh.position.y = -0.17;
  armL.add(armLMesh);
  const armR = new THREE.Group();
  armR.name = "armR";
  armR.position.set(0.26 * bulk, shoulderY, 0);
  const armRMesh = mesh(upperArmGeo, SKIN);
  armRMesh.position.y = -0.17;
  armR.add(armRMesh);
  group.add(armL, armR);
  parts.armL = armL;
  parts.armR = armR;

  // — legs —
  const legGeo = new THREE.CapsuleGeometry(0.075 * limbScale, 0.5, 4, 8);
  const legYLift = 0.92;
  const legL = new THREE.Group();
  legL.name = "legL";
  legL.position.set(-0.115, legYLift, 0);
  const legLMesh = mesh(legGeo, CLOTH_DARK);
  legLMesh.position.y = -0.32;
  legL.add(legLMesh);
  const legR = new THREE.Group();
  legR.name = "legR";
  legR.position.set(0.115, legYLift, 0);
  const legRMesh = mesh(legGeo, CLOTH_DARK);
  legRMesh.position.y = -0.32;
  legR.add(legRMesh);
  group.add(legL, legR);
  parts.legL = legL;
  parts.legR = legR;

  // — hip anchor + shoes —
  const hips = mesh(new THREE.CapsuleGeometry(0.19 * bulk, 0.1, 4, 10), CLOTH_DARK);
  hips.position.y = 0.95;
  group.add(hips);

  for (const sx of [-1, 1]) {
    const shoe = mesh(new THREE.BoxGeometry(0.13, 0.07, 0.24), CLOTH_DARK);
    shoe.position.set(0.115 * sx, 0.05, 0.02);
    group.add(shoe);
  }

  group.add(torso);
  parts.torso = torso;

  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return { group, parts, baseHeight: group.position.y };
}

let scratchShock = new THREE.Vector3();

/**
 * Animate the named parts. `state` drives locomotion; `t` is the animation
 * clock (seconds). Stateless — safe from any loop.
 */
export function animateAvatar(
  parts: Record<string, THREE.Object3D>,
  state: LocomotionState,
  t: number,
  dt: number,
): void {
  const armL = parts.armL as THREE.Group | undefined;
  const armR = parts.armR as THREE.Group | undefined;
  const legL = parts.legL as THREE.Group | undefined;
  const legR = parts.legR as THREE.Group | undefined;
  const head = parts.head as THREE.Group | undefined;
  const torso = parts.torso as THREE.Group | undefined;
  if (!armL || !armR || !legL || !legR || !head || !torso) return;

  const decay = Math.min(1, dt * 9); // smooth transitions
  const lerpRot = (
    o: THREE.Group,
    x: number,
    z: number = 0,
  ) => {
    o.rotation.x += (x - o.rotation.x) * decay;
    o.rotation.z += (z - o.rotation.z) * decay;
  };

  switch (state) {
    case "idle": {
      const breathe = Math.sin(t * 1.6) * 0.022;
      head.rotation.x += (breathe * 0.4 - head.rotation.x) * decay;
      head.rotation.z += (Math.sin(t * 0.4) * 0.05 - head.rotation.z) * decay;
      torso.position.y += (1.12 + breathe * 0.3 - torso.position.y) * decay;
      lerpRot(armL, 0.06 + breathe, -0.12);
      lerpRot(armR, 0.06 - breathe, 0.12);
      lerpRot(legL, 0, 0.02);
      lerpRot(legR, 0, -0.02);
      break;
    }
    case "walk": {
      const stride = t * 5.4;
      const armSwing = Math.sin(stride) * 0.5;
      lerpRot(armL, armSwing, -0.08);
      lerpRot(armR, -armSwing, 0.08);
      lerpRot(legL, Math.cos(stride) * 0.42, 0);
      lerpRot(legR, -Math.cos(stride) * 0.42, 0);
      torso.position.y += (1.12 + Math.abs(Math.sin(stride)) * 0.02 - torso.position.y) * decay;
      break;
    }
    case "run": {
      const stride = t * 8.2;
      lerpRot(armL, Math.sin(stride) * 0.85, -0.12);
      lerpRot(armR, -Math.sin(stride) * 0.85, 0.12);
      lerpRot(legL, Math.cos(stride) * 0.62, 0);
      lerpRot(legR, -Math.cos(stride) * 0.62, 0);
      torso.position.y += (1.12 + Math.abs(Math.sin(stride)) * 0.04 - torso.position.y) * decay;
      bodyRotate(torso, 0.14, decay);
      break;
    }
    case "jump":
    case "fall": {
      const up = state === "jump";
      lerpRot(armL, up ? -2.4 : -1.1, -0.25);
      lerpRot(armR, up ? -2.4 : -1.1, 0.25);
      lerpRot(legL, up ? 0.55 : 0.25);
      lerpRot(legR, up ? -0.35 : -0.15);
      break;
    }
    case "sit": {
      lerpRot(armL, 0, -0.5);
      lerpRot(armR, 0, 0.5);
      lerpRot(legL, -1.55);
      lerpRot(legR, -1.55);
      head.rotation.x += (Math.sin(t * 0.8) * 0.04 - head.rotation.x) * decay;
      break;
    }
    case "wave": {
      const armUp = -2.55;
      armR.rotation.x += (armUp - armR.rotation.x) * decay;
      armR.rotation.z += (0.35 + Math.sin(t * 7) * 0.35 - armR.rotation.z) * decay;
      lerpRot(armL, 0.05, -0.1);
      lerpRot(legL, 0);
      lerpRot(legR, 0);
      head.rotation.z += (Math.sin(t * 1.2) * 0.06 - head.rotation.z) * decay;
      break;
    }
    case "dance": {
      const beat = t * 4.4;
      lerpRot(armL, -1.4 + Math.sin(beat) * 0.75, -0.4);
      lerpRot(armR, -1.4 + Math.sin(beat + Math.PI) * 0.75, 0.4);
      lerpRot(legL, Math.sin(beat) * 0.2, 0.08);
      lerpRot(legR, -Math.sin(beat) * 0.2, -0.08);
      torso.rotation.z += (Math.sin(beat * 0.5) * 0.12 - torso.rotation.z) * decay;
      torso.position.y += (1.12 + Math.abs(Math.sin(beat)) * 0.055 - torso.position.y) * decay;
      head.rotation.z += (Math.sin(beat * 0.5 + Math.PI / 2) * 0.16 - head.rotation.z) * decay;
      break;
    }
  }
}

function bodyRotate(torso: THREE.Group, targetZ: number, decay: number) {
  torso.rotation.z += (targetZ - torso.rotation.z) * decay;
}

/** Mannequin silhouette for the character creator + shadow projection debug. */
export function resetAvatarForPreview(group: THREE.Group): void {
  scratchShock.set(0, 0, 0);
  group.position.copy(scratchShock);
  group.rotation.set(0, 0, 0);
}
