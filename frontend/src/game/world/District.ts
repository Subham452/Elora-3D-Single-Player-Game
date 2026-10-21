import * as THREE from "three";
import {
  type Collider,
  type GameWorldActions,
  type InteractableDef,
} from "@/game/interactions/interactions";

/** Deterministic PRNG so the town layout is identical every session. */
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function sharedMat(
  key: string,
  def: THREE.MeshStandardMaterialParameters,
): THREE.MeshStandardMaterial {
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial(def);
    matCache.set(key, m);
  }
  return m;
}

const MAT = {
  asphalt: () => sharedMat("asphalt", { color: 0x2c3038, roughness: 0.92 }),
  sidewalk: () => sharedMat("sidewalk", { color: 0xb7b3a8, roughness: 0.85 }),
  plaza: () => sharedMat("plaza", { color: 0xcabfae, roughness: 0.8 }),
  plazaInner: () => sharedMat("plazaInner", { color: 0x9a9488, roughness: 0.7 }),
  grass: () => sharedMat("grass", { color: 0x3f7d43, roughness: 1 }),
  lawn: () => sharedMat("lawn", { color: 0x4a8b4f, roughness: 1 }),
  water: () => sharedMat("water", { color: 0x3f7fae, roughness: 0.15, metalness: 0.55 }),
  bark: () => sharedMat("bark", { color: 0x6b503c, roughness: 0.95 }),
  leafA: () => sharedMat("leafA", { color: 0x2f6d3a, roughness: 1 }),
  leafB: () => sharedMat("leafB", { color: 0x4f8a45, roughness: 1 }),
  lampPost: () => sharedMat("lampPost", { color: 0x2e3542, roughness: 0.6, metalness: 0.35 }),
  bulbMat: () => sharedMat("bulb", { color: 0xffe9b8, emissive: 0xffe2a8, emissiveIntensity: 0 }),
  windowLit: () =>
    sharedMat("windowLit", {
      color: 0x25313a,
      emissive: 0xffd98a,
      emissiveIntensity: 0,
      roughness: 0.25,
    }),
  benchWood: () => sharedMat("benchWood", { color: 0x8a5f3c, roughness: 0.85 }),
  benchIron: () => sharedMat("benchIron", { color: 0x2b2f38, roughness: 0.6, metalness: 0.4 }),
  fountainStone: () => sharedMat("fountain", { color: 0xcfc8b8, roughness: 0.75 }),
  statue: () => sharedMat("statue", { color: 0xb9a77f, roughness: 0.5, metalness: 0.25 }),
  archSign: () => sharedMat("archSign", { color: 0xefe6cf, roughness: 0.7 }),
  facadeA: () => sharedMat("facadeA", { color: 0xcfc0a6, roughness: 0.9 }),
  facadeB: () => sharedMat("facadeB", { color: 0xa59881, roughness: 0.9 }),
  facadeC: () => sharedMat("facadeC", { color: 0x9d6b52, roughness: 0.9 }),
  facadeD: () => sharedMat("facadeD", { color: 0x8c9198, roughness: 0.9 }),
  door: () => sharedMat("door", { color: 0x40362b, roughness: 0.8 }),
  interiorFloor: () => sharedMat("intFloor", { color: 0xa07a52, roughness: 0.7 }),
  interiorWall: () => sharedMat("intWall", { color: 0xd8cdb8, roughness: 0.95 }),
  counter: () => sharedMat("counter", { color: 0x6d4527, roughness: 0.6 }),
};

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export interface DistrictBuild {
  root: THREE.Group;
  interior: THREE.Group;
  colliders: Collider[];
  interactables: InteractableDef[];
  nightLamps: { bulb: THREE.Mesh; x: number; z: number }[];
  windowMat: THREE.MeshStandardMaterial;
  benchCount: number;
}

/**
 * Elora Central City v0.1 — hand-composed.
 * Roads form a cross; plaza at center; four blocks in the quadrants; park in
 * the south-east; residential row beyond the arch to the north.
 */
export function buildDistrict(
  scene: THREE.Scene,
  vegetationDensity: number,
  happinessSeed = 7,
  actions: GameWorldActions,
): DistrictBuild {
  const root = new THREE.Group();
  const interior = new THREE.Group();
  interior.position.set(260, 0, -260); // separate pocket of the world
  interior.visible = false;

  const colliders: Collider[] = [];
  const interactables: InteractableDef[] = [];
  const nightLamps: { bulb: THREE.Mesh; x: number; z: number }[] = [];

  const rnd = mulberry(happinessSeed);

  // ————————————————————————— ground plane —————————————————————————
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), MAT.grass());
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  root.add(ground);

  // Roads
  const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(9, 200), MAT.asphalt());
  roadNS.rotation.x = -Math.PI / 2;
  roadNS.receiveShadow = true;
  root.add(roadNS);

  const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(200, 9), MAT.asphalt());
  roadEW.rotation.x = -Math.PI / 2;
  roadEW.receiveShadow = true;
  root.add(roadEW);

  // Sidewalks — always exactly along both curbs.
  const sideGeoNS = new THREE.PlaneGeometry(3.2, 200);
  for (const s of [-1, 1]) {
    const sw = new THREE.Mesh(sideGeoNS, MAT.sidewalk());
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(s * 6.1, 0.045, 0);
    sw.receiveShadow = true;
    root.add(sw);
    const swE = new THREE.Mesh(new THREE.PlaneGeometry(200, 3.2), MAT.sidewalk());
    swE.rotation.x = -Math.PI / 2;
    swE.position.set(0, 0.045, s * 6.1);
    swE.receiveShadow = true;
    root.add(swE);
  }

  // ————————————————————————— Central Plaza —————————————————————————
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(19, 56), MAT.plaza());
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.06;
  plaza.receiveShadow = true;
  root.add(plaza);
  const plazaInner = new THREE.Mesh(new THREE.CircleGeometry(6.5, 40), MAT.plazaInner());
  plazaInner.rotation.x = -Math.PI / 2;
  plazaInner.position.y = 0.08;
  plazaInner.receiveShadow = true;
  root.add(plazaInner);

  // Fountain
  const fountainRim = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.5, 0.9, 32, 1, true),
    MAT.fountainStone(),
  );
  fountainRim.position.y = 0.45;
  fountainRim.castShadow = true;
  fountainRim.receiveShadow = true;
  root.add(fountainRim);
  const water = new THREE.Mesh(new THREE.CircleGeometry(3.1, 32), MAT.water());
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.72;
  root.add(water);
  const pillar = box(0.7, 1.3, 0.7, MAT.fountainStone(), 0, 0.4, 0);
  root.add(pillar);
  colliders.push({ kind: "circle", cx: 0, cz: 0, r: 3.4 });

  // Statue
  const statueBase = box(1.5, 1.2, 1.5, MAT.fountainStone(), -10, 0.1, -6);
  const statueBody = box(1.0, 2.0, 1.0, MAT.statue(), -10, 1.3, -6);
  const statueHead = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), MAT.statue());
  statueHead.position.set(-10, 3.55, -6);
  statueHead.castShadow = true;
  root.add(statueBase, statueBody, statueHead);
  colliders.push({ kind: "box", minx: -10.8, maxx: -9.2, minz: -6.8, maxz: -5.2 });

  // Benches around plaza (ring of 6 at r=16.5, facing the fountain)
  const benchPositions: { x: number; z: number; yaw: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + Math.PI / 12;
    const bx = Math.cos(ang) * 16.5;
    const bz = Math.sin(ang) * 16.5;
    const yawFacingFountain = Math.atan2(0 - bx, 0 - bz); // face center
    benchPositions.push({ x: bx, z: bz, yaw: yawFacingFountain });
  }
  // plus park benches
  benchPositions.push({ x: 26, z: 24, yaw: Math.PI });
  benchPositions.push({ x: 56, z: 46, yaw: Math.PI * 0.75 });
  benchPositions.push({ x: 40, z: 56, yaw: Math.PI * 1.5 });
  const benchDraw = buildBenchFactory(root, benchPositions, colliders, interactables, actions);

  // Lamps: ring inside plaza + avenue rows
  const lampSpots: { x: number; z: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    lampSpots.push({ x: Math.cos(ang) * 13.5, z: Math.sin(ang) * 13.5 });
  }
  for (let z = -90; z <= 90; z += 22) {
    if (Math.abs(z) < 9 || Math.abs(z + 62) < 4 || Math.abs(z - 44) < 4) continue;
    lampSpots.push({ x: -7.6, z });
    lampSpots.push({ x: 7.6, z });
  }
  for (let x = -90; x <= 90; x += 22) {
    if (Math.abs(x) < 9 || Math.abs(x - 30) < 6) continue;
    lampSpots.push({ x, z: -7.6 });
    lampSpots.push({ x, z: 7.6 });
  }

  // ————————————————————————— Buildings —————————————————————————
  const windowMat = MAT.windowLit();
  const addBuilding = (
    opt: {
      x: number; z: number; w: number; d: number; h: number;
      mat: () => THREE.Material;
      rot?: number;
      sign?: string;
      windows?: boolean;
    },
  ) => {
    const { x, z, w, d, h } = opt;
    const g = box(w, h, d, opt.mat(), x, 0.05, z);
    root.add(g);
    // Slightly lighter flat roof cap.
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.4, 0.3, d + 0.4),
      sharedMat(`roof${Math.round(w)}${Math.round(d)}`, { color: 0x6e6758, roughness: 1 }),
    );
    roof.position.set(x, 0.05 + h, z);
    roof.castShadow = true;
    root.add(roof);
    // Windows: a subtle grid of emissive quads on the +X facing side (all main facades face the avenue.
    if (opt.windows !== false) {
      const rows = Math.max(2, Math.floor((h - 4) / 3.2) + 1);
      const cols = Math.max(3, Math.floor(w / 2.8));
      const grid = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(0.9, 1.2),
        windowMat,
        rows * cols,
      );
      const mtx = new THREE.Matrix4();
      let i = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = x + w / 2 + 0.051;
          const wy = 1.6 + r * 2.6;
          const wz = z - w / 2 + 0.9 + c * ((d - 1.8) / Math.max(1, cols - 1));
          mtx.makeRotationY(Math.PI / 2);
          mtx.setPosition(wx, wy, wz);
          grid.setMatrixAt(i++, mtx);
        }
      }
      grid.receiveShadow = false;
      root.add(grid);
    }
    colliders.push({
      kind: "box",
      minx: x - w / 2,
      maxx: x + w / 2,
      minz: z - d / 2,
      maxz: z + d / 2,
    });
  };

  // WEST block: Everleaf Books (bookstore, two stories).
  addBuilding({ x: -28, z: 22, w: 22, d: 16, h: 11, mat: MAT.facadeC });
  // Doormark + sign for the bookstore, facing the avenue.
  root.add(box(2.2, 3.4, 0.3, MAT.door(), -17, 0.05, 22));

  // NORTH-WEST block: Central Café (enterable via door).
  addBuilding({ x: -26, z: -30, w: 20, d: 14, h: 9, mat: MAT.facadeA });
  const cafeDoor = box(2.1, 3.3, 0.5, MAT.door(), -16, 0.05, -30);
  root.add(cafeDoor);
  // awning strip
  root.add(box(1.4, 0.35, 6.5, MAT.benchIron(), -15.6, 3.3, -30));
  interactables.push({
    id: "door-cafe",
    x: -15.2,
    y: 0,
    z: -30,
    radius: 2.2,
    prompt: "E — Enter the Central Café",
    priority: 2,
    action: () => actions.enterCafe(),
  });

  // NORTH-EAST block: Town Hall (grand two-tier).
  addBuilding({ x: 27, z: -30, w: 22, d: 16, h: 14, mat: MAT.facadeB, windows: false });
  for (let i = 0; i < 6; i++) {
    const col = box(1.1, 8, 1.1, MAT.fountainStone(), 16.5, 0.05, -33.5 + i * 3.2);
    root.add(col);
  }
  const hallSteps = box(6, 0.45, 5, MAT.fountainStone(), 14.4, 0.05, -30);
  root.add(hallSteps);

  // SOUTH-EAST block: Solaris Studios (locked facade, decorative class).
  addBuilding({ x: 30, z: 26, w: 18, d: 16, h: 8, mat: MAT.facadeD });

  // South-west quadrant: Village cafe annex? keep lighter: small row houses.
  for (let i = 0; i < 3; i++) {
    addBuilding({
      x: -30 - i * 20,
      z: 62 + (i % 2) * 22,
      w: 13,
      d: 12,
      h: 7,
      mat: MAT.facadeA,
      windows: i % 2 === 0,
    });
  }

  // ————————————————————————— Arch (north gateway) —————————————————————————
  {
    const archL = box(2, 9, 2, MAT.archSign(), -5.6, 0.05, -62);
    const archR = box(2, 9, 2, MAT.archSign(), 5.6, 0.05, -62);
    const archTop = box(14, 1.6, 2.4, MAT.archSign(), 0, 9, -62);
    const archCap = box(16, 0.6, 2.9, MAT.fountainStone(), 0, 10.6, -62);
    root.add(archL, archR, archTop, archCap);
    colliders.push(
      { kind: "box", minx: -6.6, maxx: -4.6, minz: -63, maxz: -61 },
      { kind: "box", minx: 4.6, maxx: 6.6, minz: -63, maxz: -61 },
    );
  }

  // ————————————————————————— Willow Gardens (park) —————————————————————————
  {
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(56, 62), MAT.lawn());
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(43, 0.09, 43);
    lawn.receiveShadow = true;
    root.add(lawn);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(8.5, 40), MAT.water());
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(37, 0.12, 32);
    root.add(pond);
    const pondRim = new THREE.Mesh(
      new THREE.TorusGeometry(8.6, 0.5, 10, 48),
      MAT.fountainStone(),
    );
    pondRim.rotation.x = -Math.PI / 2;
    pondRim.position.set(37, 0.28, 32);
    pondRim.receiveShadow = true;
    root.add(pondRim);
    colliders.push({ kind: "circle", cx: 37, cz: 32, r: 8.8 });
    // crossing path — decorative
    const path = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 66), MAT.sidewalk());
    path.rotation.x = -Math.PI / 2;
    path.position.set(15.3, 0.1, 43);
    path.receiveShadow = true;
    root.add(path);
  }

  // ————————————————————————— Trees (instanced) —————————————————————————
  {
    const treeSpots: { x: number; z: number; s: number; kind: number }[] = [];
    // Sidewalk trees along the two avenues.
    for (let z = -88; z <= 88; z += 16) {
      if (Math.abs(z) < 15 || Math.abs(z + 62) < 6) continue;
      treeSpots.push({ x: -9.2, z: z + (rnd() - 0.5) * 2, s: 0.9 + rnd() * 0.35, kind: rnd() > 0.5 ? 1 : 0 });
      treeSpots.push({ x: 9.2, z: z + (rnd() - 0.5) * 2, s: 0.9 + rnd() * 0.35, kind: rnd() > 0.5 ? 1 : 0 });
    }
    for (let x = -88; x <= 88; x += 16) {
      if (Math.abs(x) < 15 || Math.abs(x - 30) < 9) continue;
      treeSpots.push({ x: x + (rnd() - 0.5) * 2, z: -9.2, s: 0.9 + rnd() * 0.3, kind: rnd() > 0.5 ? 1 : 0 });
      treeSpots.push({ x: x + (rnd() - 0.5) * 2, z: 9.2, s: 0.9 + rnd() * 0.3, kind: rnd() > 0.5 ? 1 : 0 });
    }
    // Plaza corners
    for (const [px, pz] of [[-13, -13], [13, -13], [-13, 13], [13, 13]] as const) {
      treeSpots.push({ x: px, z: pz, s: 1.15, kind: 1 });
    }
    // Park interior (density scales with the quality preset)
    const parkTarget = Math.floor(34 * vegetationDensity);
    for (let i = 0; i < parkTarget; i++) {
      const x = 16 + rnd() * 54;
      const z = 14 + rnd() * 58;
      const distPond = Math.hypot(x - 37, z - 32);
      if (distPond < 10.5) continue;
      if (Math.hypot(x - 26, z - 24) < 2.6 || Math.hypot(x - 56, z - 46) < 2.6 || Math.hypot(x - 40, z - 56) < 2.6) continue;
      treeSpots.push({ x, z, s: 0.85 + rnd() * 0.6, kind: rnd() > 0.4 ? 1 : 0 });
    }
    // Residential row trees along north-west side.
    for (let i = 0; i < 6; i++) {
      treeSpots.push({ x: -22 - i * 6.5, z: -74 - (i % 2) * 3, s: 0.9 + rnd() * 0.4, kind: rnd() > 0.5 ? 1 : 0 });
    }

    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 2.2, 7);
    trunkGeo.translate(0, 1.1, 0);
    const crownA = new THREE.IcosahedronGeometry(1.5, 1);
    crownA.scale(1, 1.15, 1);
    crownA.translate(0, 3.05, 0);
    const crownB = new THREE.ConeGeometry(1.45, 2.6, 8);
    crownB.translate(0, 3.3, 0);

    const trunkIM = new THREE.InstancedMesh(trunkGeo, MAT.bark(), treeSpots.length);
    const crownAIM = new THREE.InstancedMesh(crownA, MAT.leafA(), treeSpots.length);
    const crownBIM = new THREE.InstancedMesh(crownB, MAT.leafB(), treeSpots.length);
    const mtx = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const pos = new THREE.Vector3();
    treeSpots.forEach((t, i) => {
      pos.set(t.x, 0, t.z);
      scale.setScalar(t.s);
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
      mtx.compose(pos, quat, scale);
      trunkIM.setMatrixAt(i, mtx);
      (t.kind === 0 ? crownAIM : crownBIM).setMatrixAt(i, mtx);
      // opposite crown variant hidden at zero scale (cheap trick, keep cull simple)
      if (t.kind === 0) {
        mtx.compose(pos, quat, new THREE.Vector3(0.0001, 0.0001, 0.0001));
        crownBIM.setMatrixAt(i, mtx);
      } else {
        mtx.compose(pos, quat, new THREE.Vector3(0.0001, 0.0001, 0.0001));
        crownAIM.setMatrixAt(i, mtx);
      }
      colliders.push({ kind: "circle", cx: t.x, cz: t.z, r: 0.5 });
    });
    trunkIM.castShadow = true;
    crownAIM.castShadow = true;
    crownBIM.castShadow = true;
    trunkIM.receiveShadow = true;
    root.add(trunkIM, crownAIM, crownBIM);
  }

  // ————————————————————————— Lamps (instanced posts + emissive bulbs) —————————————————————————
  {
    const postGeo = new THREE.CylinderGeometry(0.09, 0.13, 4.6, 8);
    postGeo.translate(0, 2.3, 0);
    const armGeo = new THREE.BoxGeometry(0.9, 0.09, 0.09);
    const bulbGeo = new THREE.SphereGeometry(0.18, 10, 8);
    const lampCapMat = MAT.lampPost();
    const bulbShared = MAT.bulbMat();
    const postIM = new THREE.InstancedMesh(postGeo, lampCapMat, lampSpots.length);
    const armIM = new THREE.InstancedMesh(armGeo, lampCapMat, lampSpots.length);
    const bulbIM = new THREE.InstancedMesh(bulbGeo, bulbShared, lampSpots.length);
    const mtx = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const center = new THREE.Vector3(0, 0, 0);
    lampSpots.forEach((l, i) => {
      const faceAng = Math.atan2(center.x - l.x, center.z - l.z);
      pos.set(l.x, 0.05, l.z);
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), faceAng);
      scale.setScalar(1);
      mtx.compose(pos, quat, scale);
      postIM.setMatrixAt(i, mtx);
      pos.set(l.x + Math.sin(faceAng) * 0.45, 4.62, l.z + Math.cos(faceAng) * 0.45);
      mtx.compose(pos, quat, scale);
      armIM.setMatrixAt(i, mtx);
      pos.set(l.x + Math.sin(faceAng) * 0.85, 4.45, l.z + Math.cos(faceAng) * 0.85);
      mtx.compose(pos, quat, scale);
      bulbIM.setMatrixAt(i, mtx);
      colliders.push({ kind: "circle", cx: l.x, cz: l.z, r: 0.3 });
      nightLamps.push({ bulb: bulbIM as unknown as THREE.Mesh, x: l.x, z: l.z });
    });
    postIM.castShadow = true;
    root.add(postIM, armIM, bulbIM);
  }

  // ————————————————————————— Street props —————————————————————————
  // Flowerbed rings around plaza fountain.
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const px = Math.cos(ang) * 8.4;
    const pz = Math.sin(ang) * 8.4;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.5, 10), MAT.benchIron());
    pot.position.set(px, 0.3, pz);
    pot.castShadow = true;
    root.add(pot);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), MAT.leafB());
    bloom.position.set(px, 0.72, pz);
    bloom.castShadow = true;
    root.add(bloom);
    if (i % 3 === 0) colliders.push({ kind: "circle", cx: px, cz: pz, r: 0.5 });
  }

  // Bus shelter on the east boulevard (transit POI).
  {
    const shelter = new THREE.Group();
    shelter.add(box(4.4, 0.15, 2.2, MAT.lampPost(), 0, 0.9, 0));
    shelter.add(box(0.2, 2.2, 0.2, MAT.lampPost(), -2, 0.9, -0.9));
    shelter.add(box(0.2, 2.2, 0.2, MAT.lampPost(), 2, 0.9, -0.9));
    shelter.add(box(4.4, 2.3, 0.15, MAT.benchIron(), 0, 1.4, -0.95));
    shelter.position.set(8.6, 0, 46);
    shelter.rotation.y = Math.PI / 2;
    root.add(shelter);
    benchDraw.place(8.6, 46, Math.PI / 2, "transit-bench");
    colliders.push({ kind: "box", minx: 7.7, maxx: 9.5, minz: 43.9, maxz: 48.1 });
  }

  benchDraw.flush();

  // ————————————————————————— CENTRAL CAFÉ INTERIOR —————————————————————————
  buildInterior(interior, colliders, interactables, actions);

  scene.add(root);
  scene.add(interior);

  return {
    root,
    interior,
    colliders,
    interactables,
    nightLamps,
    windowMat,
    benchCount: benchPositions.length,
  };
}

/** Bench builder reusing instanced parts across many benches. */
function buildBenchFactory(
  root: THREE.Group,
  genericSpots: { x: number; z: number; yaw: number }[],
  colliders: Collider[],
  interactables: InteractableDef[],
  actions: GameWorldActions,
) {
  const seatGeo = new THREE.BoxGeometry(2.0, 0.09, 0.55);
  const backGeo = new THREE.BoxGeometry(2.0, 0.5, 0.08);
  const legGeo = new THREE.BoxGeometry(0.09, 0.42, 0.5);
  const seats: THREE.Matrix4[] = [];
  const backs: THREE.Matrix4[] = [];
  const legs: THREE.Matrix4[] = [];
  const spots = [...genericSpots];
  const placed: { x: number; z: number; yaw: number; id?: string }[] = [];

  function place(x: number, z: number, yaw: number, id?: string) {
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 1)) return;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const ctx = new THREE.Vector3(x, 0.44, z);
    seats.push(new THREE.Matrix4().compose(ctx, q, new THREE.Vector3(1, 1, 1)));
    backs.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x - Math.sin(yaw) * 0.26, 0.72, z - Math.cos(yaw) * 0.26),
        q,
        new THREE.Vector3(1, 1, 1),
      ),
    );
    for (const side of [-1, 1]) {
      legs.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x + Math.sin(yaw) * side * 0.85, 0.2, z + Math.cos(yaw) * side * 0.85),
          q,
          new THREE.Vector3(1, 1, 1),
        ),
      );
    }
    placed.push({ x, z, yaw, id });
  }

  // Pre-place generic spots by unique positions.
  for (const s of genericSpots) place(s.x, s.z, s.yaw);

  return {
    place,
    flush() {
      const seatIM = new THREE.InstancedMesh(seatGeo, MAT.benchWood(), seats.length);
      const backIM = new THREE.InstancedMesh(backGeo, MAT.benchWood(), backs.length);
      const legIM = new THREE.InstancedMesh(legGeo, MAT.benchIron(), legs.length);
      seats.forEach((m, i) => seatIM.setMatrixAt(i, m));
      backs.forEach((m, i) => {
        backIM.setMatrixAt(i, m);
      });
      legs.forEach((m, i) => legIM.setMatrixAt(i, m));
      seatIM.castShadow = true;
      seatIM.receiveShadow = true;
      backIM.castShadow = true;
      legIM.castShadow = true;
      root.add(seatIM, backIM, legIM);
      const seen = new Set<string>();
      for (const s of placed) {
        const key = `${Math.round(s.x)}_${Math.round(s.z)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const id = s.id ?? `bench-${key}`;
        colliders.push({
          kind: "box",
          minx: s.x - 1.0,
          maxx: s.x + 1.0,
          minz: s.z - 0.45,
          maxz: s.z + 0.45,
        });
        interactables.push({
          id,
          x: s.x,
          y: 0,
          z: s.z,
          radius: 1.55,
          priority: 4,
          prompt: "E — Sit on the bench",
          action: () => actions.sitAt(s.x, 0.42, s.z, s.yaw),
        });
      }
    },
  };
}

function buildInterior(
  interior: THREE.Group,
  colliders: Collider[],
  interactables: InteractableDef[],
  actions: GameWorldActions,
) {
  const FLOOR_X = 0;
  const FLOOR_Z = 0; // interior sits in its own pocket at (260,-260)

  const woodMat = MAT.interiorFloor();
  const wallMat = MAT.interiorWall();

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 12),
    woodMat,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(FLOOR_X, 0.0, FLOOR_Z);
  floor.receiveShadow = true;
  interior.add(floor);

  // Walls (4: north, south glassier with warm windows, west, east)
  const NWALL = 6;
  const dims = new THREE.BoxGeometry(15, 4, 0.4);
  const north = new THREE.Mesh(dims, wallMat);
  north.position.set(FLOOR_X, 2, FLOOR_Z - NWALL);
  const south = new THREE.Mesh(dims, wallMat);
  south.position.set(FLOOR_X, 2, FLOOR_Z + NWALL);
  const west = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 12), wallMat);
  west.position.set(FLOOR_X - 7.5, 2, FLOOR_Z);
  const east = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 12), wallMat);
  east.position.set(FLOOR_X + 7.5, 2, FLOOR_Z);
  interior.add(north, south, west, east);

  // Ceiling
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(15, 0.3, 12), wallMat);
  ceiling.position.set(FLOOR_X, 4.1, FLOOR_Z);
  interior.add(ceiling);

  // Windows (south wall warm glow)
  for (const i of [-3.5, 0, 3.5] as const) {
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.9),
      sharedMat("interiorWin", { color: 0xdfc898, emissive: 0xdfb87a, emissiveIntensity: 0.15 }),
    );
    win.position.set(FLOOR_X + i, 2.2, FLOOR_Z + NWALL - 0.21);
    interior.add(win);
  }

  // Counter along west with espresso machine
  const counterTop = box(5.5, 1.1, 1.2, MAT.counter(), FLOOR_X - 5.6, 0, FLOOR_Z + 1.5);
  interior.add(counterTop);
  interior.add(box(1.4, 0.8, 1.0, MAT.lampPost(), FLOOR_X - 6.4, 1.1, FLOOR_Z + 1.5));
  interior.add(box(0.8, 0.5, 0.7, MAT.door(), FLOOR_X - 4.4, 1.1, FLOOR_Z + 1.2));

  // Tables + stools (2 tables, 4 stools = 4 sit points) + bench
  const stools: [number, number, number][] = [
    [FLOOR_X - 2.2, FLOOR_Z - 2.4, Math.PI / 2],
    [FLOOR_X - 2.2, FLOOR_Z + 0.4, Math.PI / 2],
    [FLOOR_X + 2.6, FLOOR_Z - 2.4, -Math.PI / 2],
    [FLOOR_X + 2.6, FLOOR_Z + 0.4, -Math.PI / 2],
  ];
  const tableTop = new THREE.CircleGeometry(0.85, 22);
  tableTop.rotateX(-Math.PI / 2);
  for (const [tx, tz] of [
    [FLOOR_X - 1.1, FLOOR_Z - 1.0],
    [FLOOR_X + 1.5, FLOOR_Z - 1.0],
  ] as const) {
    const t = new THREE.Mesh(tableTop, MAT.benchWood());
    t.position.set(tx, 1.02, tz);
    t.castShadow = true;
    interior.add(t);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 8), MAT.benchIron());
    pole.position.set(tx, 0.5, tz);
    interior.add(pole);
  }
  for (const [sx, sz, syaw] of stools) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.9, 12), MAT.benchIron());
    stool.position.set(sx, 0.45, sz);
    stool.castShadow = true;
    interior.add(stool);
    interactables.push({
      id: `stool-${Math.round(sx)}_${Math.round(sz)}`,
      x: sx,
      y: 0,
      z: sz,
      radius: 1.35,
      priority: 3,
      prompt: "E — Take a seat",
      action: () => actions.sitAt(sx, 0.62, sz, syaw),
    });
  }

  // Cozy sofa against the east wall + bookshelf + pendant lamps
  const sofaSeat = box(3.2, 0.7, 1.2, MAT.facadeC(), FLOOR_X + 5.9, 0, FLOOR_Z - 1);
  const sofaBack = box(0.35, 0.9, 1.2, MAT.facadeC(), FLOOR_X + 6.9, 0.7, FLOOR_Z - 1);
  interior.add(sofaSeat, sofaBack);
  interactables.push({
    id: "sofa",
    x: FLOOR_X + 5.6,
    y: 0,
    z: FLOOR_Z - 1,
    radius: 1.6,
    priority: 3,
    prompt: "E — Curl up on the sofa",
    action: () => actions.sitAt(FLOOR_X + 5.9, 0.7, FLOOR_Z - 1, -Math.PI / 2),
  });

  // bookshelf decorations along north wall
  for (let i = 0; i < 4; i++) {
    interior.add(box(2.2, 2.6, 0.5, MAT.benchWood(), FLOOR_X - 4 + i * 3, 0, FLOOR_Z - 5.5));
  }

  // pendant warm lamps
  for (const lx of [-3, 1.5, 5] as const) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), MAT.bulbMat());
    lamp.position.set(FLOOR_X + lx, 3.6, FLOOR_Z);
    interior.add(lamp);
  }

  // Exit door on west wall (back to the plaza)
  const exitDoor = box(0.5, 3.2, 2.1, MAT.door(), FLOOR_X - 7.4, 0, FLOOR_Z + 4.4);
  interior.add(exitDoor);
  interactables.push({
    id: "exit-cafe",
    x: FLOOR_X - 7.4,
    y: 0,
    z: FLOOR_Z + 4.4,
    radius: 2.2,
    priority: 1,
    prompt: "E — Step outside",
    action: () => actions.exitCafe(),
  });

  // Interior colliders (keep the player inside; leave door gaps)
  const boxC = (
    x: number, z: number, w: number, d: number,
  ) => colliders.push({ kind: "box", minx: x - w / 2, maxx: x + w / 2, minz: z - d / 2, maxz: z + d / 2 });
  const IX = 260;
  const IZ = -260;
  // walls as colliders
  boxC(IX, IZ - 6, 15, 0.4);
  boxC(IX, IZ + 6, 15, 0.4);
  boxC(IX + 7.5, IZ, 0.4, 12);
  // west wall with a gap for the exit: two segments
  colliders.push({ kind: "box", minx: IX - 7.7, maxx: IX - 7.3, minz: IZ - 6, maxz: IZ + 2.2 });
  colliders.push({ kind: "box", minx: IX - 7.7, maxx: IX - 7.3, minz: IZ + 5.45, maxz: IZ + 6 });
}
