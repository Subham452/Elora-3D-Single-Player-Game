import * as THREE from "three";

/**
 * Day/night cycle — sun, moon, sky gradient, fog, stars, streetlamp power.
 * World time is one shared clock: t01 in [0,1) over the configured day length
 * (defaults to 10 real minutes per 24 in-world hours). One in-world day
 * counter follows it. Hour mapping: 0h = t01 0 (midnight), 6h sunrise,
 * 12h noon, 18h sunset.
 */

export interface DayNightOptions {
  /** Seconds of real time for a full 24h cycle. */
  daySeconds: number;
  /** Initial hour (0..24). */
  startHour: number;
}

const SKY_VERT = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
}
`;

const SKY_FRAG = /* glsl */ `
varying vec3 vWorldPos;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGroundHaze;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uHazeStrength;
void main() {
  vec3 dir = normalize(vWorldPos);
  float up = dir.y;
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.5, up));
  sky = mix(uGroundHaze, sky, smoothstep(-0.12, 0.02, up));
  float sunGlow = pow(max(dot(dir, normalize(uSunDir)), 0.0), 3.5);
  sky += uSunColor * sunGlow * uHazeStrength;
  gl_FragColor = vec4(sky, 1.0);
}
`;

const zenithDay = new THREE.Color(0x4d8fd3);
const horizonDay = new THREE.Color(0xa8c8e8);
const zenithNight = new THREE.Color(0x0a1024);
const horizonNight = new THREE.Color(0x1c2740);
const groundHazeDay = new THREE.Color(0x9db2b0);
const groundHazeNight = new THREE.Color(0x11161f);

const fogColor = new THREE.Color();

export class DayNightCycle {
  readonly sky: THREE.Mesh;
  private sun = new THREE.DirectionalLight(0xfff4de, 2.2);
  private moon = new THREE.DirectionalLight(0x9db4d8, 0.0);
  private hemi = new THREE.HemisphereLight(0xbdd7ff, 0x3a5237, 0.7);
  private stars: THREE.Points;
  private uniforms: {
    uZenith: { value: THREE.Color };
    uHorizon: { value: THREE.Color };
    uGroundHaze: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uSunColor: { value: THREE.Color };
    uHazeStrength: { value: number };
  };
  private daySeconds: number;
  private elapsed: number;
  private tmpV = new THREE.Vector3();
  fog = new THREE.Fog(0xa8c8e8, 150, 280);

  constructor(scene: THREE.Scene, opts: DayNightOptions) {
    this.daySeconds = opts.daySeconds;
    this.elapsed = ((opts.startHour % 24) / 24) * opts.daySeconds;

    // Sky dome
    this.uniforms = {
      uZenith: { value: zenithDay.clone() },
      uHorizon: { value: horizonDay.clone() },
      uGroundHaze: { value: groundHazeDay.clone() },
      uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
      uSunColor: { value: new THREE.Color(0xffe6c0) },
      uHazeStrength: { value: 0.28 },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(400, 24, 16),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: this.uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    scene.add(this.sky);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 320;
    this.sun.shadow.bias = -0.0019;
    const c = this.sun.shadow.camera;
    c.left = -70;
    c.right = 70;
    c.top = 70;
    c.bottom = -70;
    scene.add(this.sun, this.sun.target, this.moon, this.hemi);

    // Stars — tiny points, visible with sun below horizon.
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(380);
      v.y = Math.abs(v.y) * 0.9 + 20;
      starPos[i * 3] = v.x;
      starPos[i * 3 + 1] = v.y;
      starPos[i * 3 + 2] = v.z;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xbfd2ff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0 }),
    );
    scene.add(this.stars);

    scene.fog = this.fog;
  }

  /** Progress [0..1) through the 24h cycle. */
  get t01(): number {
    return (this.elapsed % this.daySeconds) / this.daySeconds;
  }

  get hour(): number {
    return this.t01 * 24;
  }

  get dayCount(): number {
    return Math.floor(this.elapsed / this.daySeconds) + 1;
  }

  setDaySeconds(s: number) {
    // keep the same hour while changing pace
    const t = this.t01;
    this.daySeconds = s;
    this.elapsed = t * s;
  }

  /**
   * Advance world time and update sun/moon/hemisphere/fog/sky.
   * `dt` in seconds of real time (already pause-adjusted by caller).
   */
  update(dt: number, center: THREE.Vector3, fogNear: number, fogFar: number): void {
    this.elapsed += dt;
    const hour = this.hour;

    // Sun path: elevation peaks at noon, below horizon at night.
    const sunAngle = ((hour - 6) / 24) * Math.PI * 2; // sunrise at 6:00 = 0
    const sunDir = this.tmpV.set(
      Math.cos(sunAngle),
      Math.sin(sunAngle),
      Math.sin(sunAngle * 0.35) * 0.35 + 0.55 * Math.cos(sunAngle * 0.5) * 0.2,
    );
    // Cheap and pleasing: tilt so shadows are never perfectly axial.
    sunDir.x += 0.28;
    sunDir.normalize();

    const dayness = THREE.MathUtils.smoothstep(sunDir.y, -0.14, 0.24);
    const duskness =
      1 -
      Math.min(
        1,
        Math.abs(sunDir.y) / 0.22,
      );

    // Position lights relative to the town center so shadow maps stay tight.
    this.sun.position
      .copy(center)
      .addScaledVector(sunDir, 140);
    this.sun.target.position.copy(center);
    this.sun.intensity = 2.0 * dayness;
    this.sun.color.setRGB(1, 0.95 + 0.04 * (1 - duskness), 0.88 - 0.3 * duskness);

    this.moon.position.copy(center).addScaledVector(sunDir, -140);
    this.moon.intensity = 0.5 * (1 - dayness);
    this.hemi.intensity = 0.22 + 0.62 * dayness;

    this.uniforms.uSunDir.value.copy(sunDir);
    (this.uniforms.uZenith.value as THREE.Color).copy(zenithNight).lerp(zenithDay, dayness);
    (this.uniforms.uHorizon.value as THREE.Color).copy(horizonNight).lerp(horizonDay, dayness);
    (this.uniforms.uGroundHaze.value as THREE.Color).copy(groundHazeNight).lerp(groundHazeDay, dayness);
    (this.uniforms.uSunColor.value as THREE.Color)
      .setRGB(1.0, 0.62 - 0.2 * duskness + 0.35 * dayness, 0.45 + 0.5 * dayness);
    this.uniforms.uHazeStrength.value = 0.17 + 0.22 * dayness;

    // Fog keeps the world-but-not-chunk-streaming approach honest in Phase 1.
    fogColor.copy(this.uniforms.uHorizon.value).multiplyScalar(0.96);
    this.fog.color.copy(fogColor);
    this.fog.near = fogNear;
    this.fog.far = fogFar;

    (this.stars.material as THREE.PointsMaterial).opacity = (1 - dayness) * 0.9;
    this.stars.position.copy(center);

    this.sky.position.copy(center);
  }

  /** 0..1 how much streetlights/windows should glow right now. */
  get nightFactor(): number {
    const hour = this.hour;
    const up = hour < 6.4 || hour >= 18.6;
    if (!up) {
      if (hour < 7.2) return 1 - (hour - 6.4) / 0.8;
      if (hour > 17.6) return (hour - 17.6) / 1.0;
      return 0;
    }
    return 1;
  }

  /** Human clock label, e.g. "07:41". */
  clockLabel(): string {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
}
