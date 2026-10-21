import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildAvatar, animateAvatar } from "@/game/avatars/avatar";
import type { CharacterAppearance } from "@/shared/types";

/**
 * Rotating, orbit-lit character preview used by the character creator.
 * Own small three renderer — isolated from the game engine so the creator
 * page works before/without entering the world.
 */
export default function CharacterPreviewCanvas({
  draft,
  turntable = true,
}: {
  draft: CharacterAppearance;
  turntable?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 480;
    const height = mount.clientHeight || 560;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d141a);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 1.35, 3.4);
    camera.lookAt(new THREE.Vector3(0, 1.0, 0));

    // Key light (warm rim), fill, soft bounce from below.
    const key = new THREE.DirectionalLight(0xfff2dd, 2.6);
    key.position.set(2.4, 4.5, 2.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    scene.add(new THREE.HemisphereLight(0x9fc6ff, 0x24361f, 0.7));
    const rim = new THREE.SpotLight(0x7fd3ff, 14, 12, Math.PI / 5, 0.6, 1.4);
    rim.position.set(-2.6, 3.4, -2.4);
    scene.add(rim);

    // Turntable disc + soft ground for shadows.
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.15, 0.08, 48),
      new THREE.MeshStandardMaterial({ color: 0x1a2731, roughness: 0.4, metalness: 0.15 }),
    );
    disc.position.y = -0.04;
    disc.receiveShadow = true;
    scene.add(disc);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 32),
      new THREE.ShadowMaterial({ opacity: 0.35 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Avatar (rebuilt when appearance identity changes).
    let avatarGroup: THREE.Group | null = null;
    let parts: Record<string, THREE.Object3D> = {};
    let appearanceCache = "";
    const appearanceKey = () =>
      [
        draftRef.current.bodyType,
        draftRef.current.skinTone,
        draftRef.current.hairColor,
        draftRef.current.topColor,
        draftRef.current.bottomColor,
        draftRef.current.hairStyle,
      ].join("|");

    let raf = 0;
    const clock = new THREE.Clock();

    const tick = () => {
      const t = clock.getElapsedTime();
      const key2 = appearanceKey();
      if (key2 !== appearanceCache) {
        if (avatarGroup) {
          scene.remove(avatarGroup);
          disposeGroup(avatarGroup);
        }
        const built = buildAvatar({ ...draftRef.current, displayName: draftRef.current.displayName || "Preview" });
        avatarGroup = built.group;
        parts = built.parts;
        scene.add(avatarGroup);
        appearanceCache = key2;
      }
      if (turntable && avatarGroup) avatarGroup.rotation.y = t * 0.55;
      animateAvatar(parts, "idle", t, 1 / 60);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const mo = new ResizeObserver(onResize);
    mo.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      if (avatarGroup) disposeGroup(avatarGroup);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [turntable]);

  return <div ref={mountRef} className="h-full w-full" />;
}

function disposeGroup(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
}
