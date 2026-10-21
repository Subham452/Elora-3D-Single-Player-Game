/**
 * Phase-1 ambience: procedural placeholder audio (documented in
 * docs/ASSET_PIPELINE.md — curated SFX/music arrives Phase 2).
 *
 * - Wind bed: filtered white noise, slow LFO.
 * - Birdsong: sparse FM blips while the sun is up.
 * - Crickets: rhythmic ticks at night.
 * - Footsteps: soft noise taps triggered by the controller's stride.
 * All routed through master/sfx/music gains from the real settings store.
 */
export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private started = false;
  private nextBirdAt = 0;
  private nextCricketAt = 0;
  private noiseBuffer: AudioBuffer | null = null;

  async attach(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {});
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.musicGain = ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.master.connect(ctx.destination);

    // Wind bed — looped noise → lowpass → gain LFO.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    const wind = ctx.createBufferSource();
    wind.buffer = buf;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 420;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.035;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(windGain.gain);
    wind.connect(windFilter).connect(windGain).connect(this.musicGain);
    wind.start();
    lfo.start();
  }

  applyVolumes(master: number, sfx: number, music: number): void {
    if (!this.master || !this.sfxGain || !this.musicGain) return;
    const t = this.ctx?.currentTime ?? 0;
    this.master.gain.setTargetAtTime(Math.max(0.0001, master), t, 0.25);
    this.sfxGain.gain.setTargetAtTime(Math.max(0.0001, sfx), t, 0.2);
    this.musicGain.gain.setTargetAtTime(Math.max(0.0001, music), t, 0.2);
  }

  /** Sparse ambient chirps/ticks — call every frame with `nightFactor`. */
  tickAmbient(nightFactor: number, nowSec: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain) return;
    if (nightFactor < 0.5) {
      if (nowSec > this.nextBirdAt) {
        this.nextBirdAt = nowSec + 4 + Math.random() * 7;
        const base = 2100 + Math.random() * 1600;
        const dur = 0.16 + Math.random() * 0.2;
        const osc = ctx.createOscillator();
        osc.type = "sine";
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(dur < 0.24 ? 0.05 : 0.035, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        osc.frequency.setValueAtTime(base, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(base * 1.19, ctx.currentTime + dur * 0.7);
        osc.connect(g).connect(this.sfxGain);
        osc.start();
        osc.stop(ctx.currentTime + dur + 0.05);
      }
    } else if (nowSec > this.nextCricketAt) {
      this.nextCricketAt = nowSec + 0.55 + Math.random() * 1.6;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
        const at = ctx.currentTime + i * 0.09;
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = 4200;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.018, at + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
        osc.connect(g).connect(this.sfxGain);
        osc.start(at);
        osc.stop(at + 0.09);
      }
    }
  }

  footstep(intensity01: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer || !this.sfxGain) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 700 + Math.random() * 300;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const vol = 0.05 + intensity01 * 0.035;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.playbackRate.value = 0.92 + Math.random() * 0.16;
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t, Math.random() * 1.5, 0.12);
  }

  dispose(): void {
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.started = false;
  }
}
