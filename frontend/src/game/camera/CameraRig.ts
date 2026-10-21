import * as THREE from "three";
import type { GameSettings } from "@/shared/types";

/**
 * Third-person camera rig.
 * - Pointer lock mouse orbit (yaw/pitch), wheel zoom.
 * - Collision probe: shorten the boom if a wall would clip between the
 *   character head and the would-be camera position.
 * - Sensitivity/invertY/FOV come from the real settings store.
 */
export class CameraRig {
  yaw = Math.PI;
  pitch = 0.32;
  distance = 5.6;
  private targetDistance = 5.6;
  private desired = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();
  private ray = new THREE.Raycaster();
  private fwd = new THREE.Vector3();
  attached = false;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private scene: THREE.Scene,
    private settings: () => GameSettings,
  ) {}

  attach(canvas: HTMLElement): void {
    this.attached = true;
    canvas.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mouseup", this.onMouseUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }

  dispose(canvas: HTMLElement): void {
    this.attached = false;
    canvas.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mouseup", this.onMouseUp);
    canvas.removeEventListener("wheel", this.onWheel);
  }

  private dragging = false;
  private onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    this.dragging = true;
  };
  private onMouseUp = () => {
    this.dragging = false;
  };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.targetDistance = THREE.MathUtils.clamp(
      this.targetDistance + e.deltaY * 0.0035,
      2.2,
      10.5,
    );
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.dragging) return;
    this.addLook(e.movementX || 0, e.movementY || 0);
  };

  private addLook(dx: number, dy: number) {
    const s = this.settings();
    const sens = s.mouseSensitivity * 0.0026;
    this.yaw -= dx * sens;
    this.pitch -= (s.invertY ? -dy : dy) * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -0.55, 1.18);
  }

  /** Where the camera looks — just above the player's head. */
  targetPoint(target: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    out.copy(target);
    out.y += 1.62;
    return out;
  }

  update(dt: number, target: THREE.Vector3): void {
    this.distance += (this.targetDistance - this.distance) * Math.min(1, dt * 8);

    this.targetPoint(target, this.lookTarget);

    const dir = this.fwd.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );

    // Candidate camera pos, then collide: cast from lookTarget outward.
    this.desired.copy(this.lookTarget).addScaledVector(dir, this.distance);
    this.ray.set(this.lookTarget, dir);
    this.ray.far = this.distance;
    const hits = this.ray.intersectObjects(this.scene.children, true);
    let final = this.distance;
    if (hits.length > 0 && hits[0].distance < this.distance) {
      final = Math.max(0.6, hits[0].distance - 0.35);
    }
    // Smooth the boom when uncovering, but snap when occluded (avoids wall peek).
    if (final < this.distance) {
      this.distance = final;
    } else {
      this.distance += (final - this.distance) * Math.min(1, dt * 4.5);
    }

    this.desired.copy(this.lookTarget).addScaledVector(dir, this.distance);
    const fovChanged = Math.abs(this.camera.fov - this.settings().cameraFov) > 0.01;
    if (fovChanged) {
      this.camera.fov = this.settings().cameraFov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.copy(this.desired);
    this.camera.lookAt(this.lookTarget);
  }

  /** Compass heading in degrees where -Z is north = 0°, clockwise positive. */
  headingDeg(): number {
    // Player's view forward is (-sin yaw, -cos yaw); heading = atan2(east, north).
    const deg = -THREE.MathUtils.radToDeg(this.yaw);
    return ((deg % 360) + 360) % 360;
  }
}

