import * as THREE from "three";
import {
  DEFAULT_DAY_SECONDS,
  POIS,
  SPAWN,
  WORLD_ID,
} from "@/game/world/worldData";
import { FrontierWorldBuilder, type FrontierWorld } from "@/game/world/frontier/FrontierWorld";
import { CharacterRig } from "@/game/characters/CharacterRig";
import { VoxelPlayerController } from "@/game/characters/VoxelPlayerController";
import { CameraRig } from "@/game/camera/CameraRig";
import { DayNightCycle } from "@/game/environment/DayNightCycle";
import { InteractionScanner } from "@/game/interactions/InteractionScanner";
import { PerformanceTracker } from "@/game/performance/PerformanceTracker";
import { Ambience } from "@/game/audio/Ambience";
import { QUALITY_PRESETS } from "@/stores/settingsStore";
import { useGameStore, isTypingIntoField } from "@/stores/gameStore";
import { terrainHeight } from "@/game/world/voxel/terrainNoise";
import type {
  CharacterAppearance,
  GameSettings,
  PlayerCheckpoint,
} from "@/shared/types";

export interface GameOptions {
  container: HTMLElement;
  appearance: CharacterAppearance;
  startCheckpoint: PlayerCheckpoint | null;
  discovered: string[];
  getSettings: () => GameSettings;
  onProgress: (progress: number, label: string) => void;
  onReady: () => void;
  onDiscover: (poiId: string) => void;
  onCheckpoint: (c: PlayerCheckpoint) => void;
}

/**
 * The running world (Elora Frontier Valley). Owns renderer/scene/loop.
 * HUD + React read useGameStore; commands go through the small surface here.
 */
export class EloraGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private tracker: PerformanceTracker;
  private ambience = new Ambience();
  private rig: CameraRig;
  private cycle: DayNightCycle;
  private world!: FrontierWorld;
  private player!: VoxelPlayerController;
  private characterRig: CharacterRig | null = null;
  private scanner!: InteractionScanner;
  private raf = 0;
  private disposed = false;
  private paused = false;
  private keys = new Set<string>();
  private perfAccum = 0;
  private hudAccum = 0;
  private checkpointAccum = 0;
  private chunkAccum = 0;
  private opts: GameOptions;
  private basePixelRatio: number;
  private t = 0;

  constructor(opts: GameOptions) {
    this.opts = opts;
    this.basePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const s = opts.getSettings();
    this.renderer = new THREE.WebGLRenderer({
      antialias: QUALITY_PRESETS[s.quality].antialias,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(opts.container.clientWidth, Math.max(1, opts.container.clientHeight));
    this.renderer.shadowMap.enabled = s.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    opts.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      s.cameraFov,
      opts.container.clientWidth / Math.max(1, opts.container.clientHeight),
      0.1,
      400,
    );
    this.tracker = new PerformanceTracker(this.renderer, this.scene);
    this.cycle = new DayNightCycle(this.scene, {
      daySeconds: DEFAULT_DAY_SECONDS,
      startHour: 9.4,
    });
    this.rig = new CameraRig(this.camera, this.scene, opts.getSettings);
  }

  /** Staged, yielding construction so the loader reflects real work. */
  async build(): Promise<void> {
    const yieldFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    const report = (p: number, label: string) => this.opts.onProgress(p, label);

    report(0.04, "Seeding the valley…");
    await yieldFrame();

    // Terrain + landmarks.
    report(0.14, "Raising hills and carving the river…");
    const builder = new FrontierWorldBuilder({
      actions: {
        sitAt: (x, y, z, yaw) => this.player?.sitAt(x, y, z, yaw),
        enterCafe: () => {},
        exitCafe: () => {},
      },
      onPickup: (kind) => useGameStore.getState().addPickup(kind),
      isPicked: () => false,
    });
    // Terrain ring streams around spawn.
    builder.buildTerrain(0);
    await yieldFrame();

    report(0.34, "Building the village…");
    const w = builder.buildAll();
    this.world = w;
    this.scene.add(w.root);
    await yieldFrame();

    report(0.58, "Growing the forest…");
    await yieldFrame();

    report(0.7, "Hiring the hero…");
    this.characterRig = await CharacterRig.load((p) => {
      report(0.7 + p * 0.24, "Hiring the hero…");
    });
    const rig = this.characterRig ?? new CharacterRig(null);
    this.scene.add(rig.group);
    if (!rig.isRigged) {
      useGameStore.getState().showToast(
        "Fallback character active",
        "The rigged GLB failed to load — playing with the documented placeholder figure.",
      );
    }
    useGameStore.getState().setCharFallbacks([...rig.fallbacksUsed]);

    this.player = new VoxelPlayerController(rig, w.colliders, terrainHeight);
    this.player.onFootstep = (i) => this.ambience.footstep(i);
    const cp = this.opts.startCheckpoint;
    if (cp && cp.worldId === WORLD_ID) {
      this.player.spawn(cp.x, cp.z, cp.yaw);
    } else {
      this.player.spawn(SPAWN.x, SPAWN.z, Math.PI * 0.9);
    }
    this.player.spawned = true;

    this.scanner = new InteractionScanner(
      w.interactables,
      POIS,
      new Set(this.opts.discovered),
      8,
      (prompt) => useGameStore.getState().setPrompt(prompt),
      (poi) => {
        useGameStore.getState().addDiscovery(poi.id);
        void this.opts.onDiscover(poi.id);
      },
    );

    report(0.96, "Tuning ambience…");
    this.rig.attach(this.renderer.domElement);
    void this.ambience.attach();
    this.applyVolumes();

    report(1, "Welcome to Elora.");
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup", this.keyUp);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.applyRenderSettings();
    this.opts.onReady();
    this.clock.start();
    this.loop();
  }

  // ——————————————————————————— input ———————————————————————————
  private keyDown = (e: KeyboardEvent) => {
    const store = useGameStore.getState();
    if (isTypingIntoField()) return;
    if (e.code === "Escape") {
      e.preventDefault();
      if (store.overlay) {
        store.setOverlay(null);
        this.setPaused(false);
      } else {
        store.setOverlay("pause");
        this.setPaused(true);
      }
      return;
    }
    if (store.overlay) {
      if (e.code === "KeyM" || e.code === "KeyI") {
        store.setOverlay(null);
        this.setPaused(false);
      }
      return;
    }
    this.keys.add(e.code);
    switch (e.code) {
      case "Space":
        e.preventDefault();
        break;
      case "KeyE":
        if (this.player?.isSitting) this.player.stand();
        else this.scanner?.triggerNearest();
        break;
      case "KeyH":
        this.player?.triggerEmote("wave");
        break;
      case "KeyG":
        this.player?.triggerEmote("dance");
        break;
      case "KeyM":
        store.setOverlay("map");
        this.setPaused(true);
        break;
      case "KeyI":
        store.setOverlay("inventory");
        this.setPaused(true);
        break;
      case "Backquote":
      case "F3":
        e.preventDefault();
        store.togglePerf();
        break;
      default:
        break;
    }
  };

  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onVisibility = () => {
    if (document.hidden) this.keys.clear();
  };

  private onResize = () => {
    const el = this.opts.container;
    if (!el.clientWidth || !el.clientHeight) return;
    this.renderer.setSize(el.clientWidth, el.clientHeight);
    this.camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
    this.camera.updateProjectionMatrix();
  };

  // ——————————————————————————— commands ———————————————————————————

  /** Fast-travel to a discovered POI on dry land. */
  travelToPoi(poiId: string): boolean {
    const poi = POIS.find((p) => p.id === poiId);
    if (!poi) return false;
    if (!useGameStore.getState().discoveries.includes(poiId)) return false;
    this.player.spawn(poi.x, poi.z, Math.PI);
    return true;
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (p) this.keys.clear();
  }

  applyVolumes(): void {
    const s = this.opts.getSettings();
    this.ambience.applyVolumes(s.masterVolume, s.sfxVolume, s.musicVolume);
  }

  applyRenderSettings(): void {
    const s = this.opts.getSettings();
    const preset = QUALITY_PRESETS[s.quality];
    this.renderer.setPixelRatio(this.basePixelRatio * s.renderScale);
    this.renderer.shadowMap.enabled = s.shadows && preset.shadowMapSize > 0;
    // Global tone: keep gameplay identical across presets, no cheat.
    this.camera.far = Math.max(140, s.viewDistance * 1.8);
    this.camera.updateProjectionMatrix();
    this.applyVolumes();
  }

  playerSnapshot(): { x: number; y: number; z: number; yaw: number } {
    return {
      x: Math.round(this.player.position.x * 100) / 100,
      y: Math.round(this.player.position.y * 100) / 100,
      z: Math.round(this.player.position.z * 100) / 100,
      yaw: Math.round(this.player.rig.group.rotation.y * 1000) / 1000,
    };
  }

  triggerEmote(e: "wave" | "dance"): void {
    this.player?.triggerEmote(e);
  }

  // ——————————————————————————— main loop ———————————————————————————

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const rawDt = Math.min(0.05, this.clock.getDelta());
    if (this.paused || document.hidden) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const dt = rawDt;
    this.t += dt;

    this.tracker.beginFrame();

    const store = useGameStore.getState();
    const input = {
      moveX:
        (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
        (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0),
      moveZ:
        (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
        (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0),
      sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      jump: this.keys.has("Space"),
    };

    this.player.update(dt, input, this.rig.yaw);
    this.rig.update(dt, this.player.position);
    this.cycle.update(dt, this.player.position, 140, 250);
    this.world.update(dt, this.t);
    this.scanner.update(
      this.player.position.x,
      this.player.position.y,
      this.player.position.z,
    );
    // Terrain streaming around the player.
    this.chunkAccum += dt;
    if (this.chunkAccum > 0.6) {
      this.chunkAccum = 0;
      const radius = store.perfVisible ? 8 : Math.max(7, Math.round(this.opts.getSettings().viewDistance / 22));
      (this.world as unknown as { updateChunks?: (x: number, z: number, r: number) => void }).updateChunks?.(
        this.player.position.x,
        this.player.position.z,
        radius,
      );
    }

    // Night lights: emissive glow + real point lights near the village.
    const nf = this.cycle.nightFactor;
    (this.world.lampMat as THREE.MeshStandardMaterial).emissiveIntensity = nf * 2.4;
    for (const light of this.scene.children) {
      if (light instanceof THREE.PointLight) {
        // Only the designed warm lamps — the interior ceiling + street lamps.
        light.intensity = light.color.getHex() === 0xffd9a8 ? nf * 55 + 12 : 0;
      }
    }

    // HUD + persistence throttles.
    this.hudAccum += dt;
    if (this.hudAccum > 0.25) {
      this.hudAccum = 0;
      store.setClock(Math.round(this.cycle.hour * 10) / 10, this.cycle.dayCount);
      store.setHeading(Math.round(this.rig.headingDeg()));
      store.setSpeed(Math.round(this.player.getSpeedKmh()));
      store.setVitals(Math.round(this.player.health), Math.round(this.player.stamina));
    }
    this.perfAccum += dt;
    if (this.perfAccum > 0.25 && store.perfVisible) {
      this.perfAccum = 0;
      store.setPerf(this.tracker.sample());
    }
    this.checkpointAccum += dt;
    if (this.checkpointAccum > 40 && this.player.spawned) {
      this.checkpointAccum = 0;
      this.opts.onCheckpoint({
        worldId: WORLD_ID,
        ...this.playerSnapshot(),
      });
    }

    this.ambience.tickAmbient(nf, this.clock.elapsedTime);
    this.tracker.endFrame();
    this.renderer.render(this.scene, this.camera);
  };

  // ——————————————————————————— teardown ———————————————————————————

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.rig.dispose(this.renderer.domElement);
    this.ambience.dispose();
    // GPU cleanup
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.InstancedMesh) {
        o.geometry?.dispose();
        const m = o.material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m?.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

