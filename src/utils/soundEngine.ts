/**
 * Synthesized 8-Bit Web Audio API Sound Engine
 * Generates retro arcade sound effects and chiptune background music
 * with zero external MP3 dependencies.
 */

class RetroSoundEngine {
  private ctx: AudioContext | null = null;
  public sfxEnabled: boolean = true;
  public musicEnabled: boolean = true;
  private bgmAudio: HTMLAudioElement | null = null;
  private masterGain: GainNode | null = null;
  /** False while the owning scene is off-screen; see setSceneActive(). */
  private sceneActive: boolean = true;

  private getBgm(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.bgmAudio) {
      // BASE_URL resolves the public folder against whatever base Vite is
      // built with (root '/' in dev and on AI Studio).
      this.bgmAudio = new Audio(`${import.meta.env.BASE_URL}background_music.mp3?v=2`);
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = 0.55;
      this.bgmAudio.preload = 'auto';
    }
    return this.bgmAudio;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public initUserGesture() {
    this.getContext();
    if (this.musicEnabled) {
      this.playMusic();
    }
  }

  public playMusic() {
    // Never start the soundtrack while the owning scene is off-screen —
    // `setSceneActive` decides when it may play.
    if (!this.sceneActive) return;
    const bgm = this.getBgm();
    if (bgm && bgm.paused) {
      bgm.play().catch(() => {
        // Autoplay may be delayed until first user click
      });
    }
  }

  public stopMusic() {
    const bgm = this.getBgm();
    if (bgm) {
      bgm.pause();
    }
  }

  /**
   * Tell the engine whether the scene that owns the soundtrack is on screen.
   *
   * When the arcade stage scrolls out of view (or the tab is hidden) the
   * chiptune is paused and the synth context suspended, so nothing keeps
   * playing off-screen. The user's `musicEnabled` toggle is deliberately left
   * untouched, so returning to the stage restores exactly the state they chose
   * — turning music off in the HUD still keeps it off.
   */
  public setSceneActive(active: boolean) {
    this.sceneActive = active;
    const bgm = this.getBgm();
    if (!active) {
      if (bgm && !bgm.paused) bgm.pause();
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
      return;
    }
    if (this.musicEnabled) this.playMusic();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private playTone(
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = 'square',
    volume: number = 0.08
  ) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    } catch {
      // Audio node scheduling error safe catch
    }
  }

  public playBlip(freq: number = 880, duration: number = 0.05, vol: number = 0.08) {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    this.playTone(freq, ctx.currentTime, duration, 'square', vol);
  }

  public playJump() {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(170, t);
      osc.frequency.exponentialRampToValueAtTime(760, t + 0.2);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.28);
    } catch {
      // Audio safety catch
    }
  }

  public playCoin() {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.playTone(988, t, 0.08, 'square', 0.09);
    this.playTone(1319, t + 0.08, 0.22, 'square', 0.09);
  }

  public playBump() {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    this.playTone(110, ctx.currentTime, 0.08, 'square', 0.12);
  }

  public playLand() {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    this.playTone(150, ctx.currentTime, 0.04, 'triangle', 0.06);
  }

  public playTurn() {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Subtle retro swoosh: quick soft pitch drop
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(260, t + 0.08);

      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.1);
    } catch {
      // Audio safety catch
    }
  }

  public playPower() {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      this.playTone(f, t + i * 0.08, 0.12, 'square', 0.07);
    });
  }

  public playHurt() {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.22);
    } catch {
      // Audio safety catch
    }
  }

  public playHeal() {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((f, i) => {
      this.playTone(f, t + i * 0.06, 0.1, 'triangle', 0.09);
    });
  }

  public playItemPickup() {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.playTone(587.33, t, 0.06, 'square', 0.08);
    this.playTone(880, t + 0.06, 0.15, 'square', 0.09);
  }

  public playStart() {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    [392, 494, 587, 784].forEach((f, i) => {
      this.playTone(f, t + i * 0.09, 0.14, 'square', 0.08);
    });
  }

  public playKonami() {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => {
      this.playTone(f, t + i * 0.07, 0.12, 'square', 0.09);
    });
  }

  public playInspect() {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const f = 600 + Math.floor(Math.random() * 400);
    this.playTone(f, ctx.currentTime, 0.05, 'triangle', 0.07);
  }

  public playTrophy() {
    if (!this.sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => {
      this.playTone(f, t + i * 0.08, 0.2, 'square', 0.09);
    });
  }

  public toggleMusic(forceState?: boolean): boolean {
    const nextState = forceState !== undefined ? forceState : !this.musicEnabled;
    this.musicEnabled = nextState;

    if (this.musicEnabled) {
      // playMusic() no-ops while the scene is off-screen; stopMusic() below
      // still silences an already-playing track when the user toggles off.
      this.playMusic();
    } else {
      this.stopMusic();
    }
    return this.musicEnabled;
  }

  public toggleSfx(forceState?: boolean): boolean {
    this.sfxEnabled = forceState !== undefined ? forceState : !this.sfxEnabled;
    if (this.sfxEnabled) {
      this.playBlip(880, 0.05, 0.07);
    }
    return this.sfxEnabled;
  }
}

export const sound = new RetroSoundEngine();
