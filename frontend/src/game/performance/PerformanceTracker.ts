import * as THREE from "three";
import type { PerfSample } from "@/stores/gameStore";

/**
 * Real renderer metrics — no fake numbers. Reads renderer.info each frame,
 * smooths frame time, and lets the HUD poll at a throttled rate.
 */
export class PerformanceTracker {
  private frameMsEma = 16.7;
  private lastNow = performance.now();
  private entities = 0;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
  ) {}

  beginFrame(): void {
    const now = performance.now();
    const frameMs = now - this.lastNow;
    this.lastNow = now;
    this.frameMsEma += (frameMs - this.frameMsEma) * 0.08;
  }

  endFrame(): void {
    this.entities = 0;
    this.scene.traverseVisible(() => {
      this.entities++;
    });
  }

  sample(): PerfSample {
    const drawCalls = this.renderer.info.render.calls;
    const tris = this.renderer.info.render.triangles;
    const fps = this.frameMsEma > 0 ? 1000 / this.frameMsEma : 0;
    return {
      fps: Math.round(fps),
      frameMs: Math.round(this.frameMsEma * 10) / 10,
      draws: drawCalls,
      tris,
      entities: this.entities,
    };
  }
}
