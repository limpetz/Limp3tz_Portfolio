/**
 * Canvas-based Particle System for Neon Arcade Stage
 * Provides retro-arcade 'sparkle' effects for coins and 'dust' effects for landing & running.
 */

export interface ParticleSystemConfig {
  gravity?: number;
}

export type ParticleKind = 'sparkle_star' | 'sparkle_diamond' | 'sparkle_ring' | 'dust_puff' | 'dust_crumb' | 'floating_text';

export interface BaseParticle {
  id: number;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  glowColor?: string;
  size: number;
  maxSize?: number;
  alpha: number;
  rotation: number;
  rotSpeed: number;
  drag: number;
  twinkleFreq?: number;
  text?: string;
}

const SPARKLE_PALETTE = ['#ffd23f', '#fff385', '#ffffff', '#00e5ff', '#ff2d78'];
const DUST_PALETTE = ['#3d3864', '#554d86', '#7267a8', '#8f83cc', '#00e5ff55'];

export class ArcadeParticleSystem {
  private particles: BaseParticle[] = [];
  private nextId = 1;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;

  public attachCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.resize();
  }

  public resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || this.canvas.parentElement?.clientWidth || 800;
    this.height = rect.height || this.canvas.parentElement?.clientHeight || 600;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  public clear() {
    this.particles = [];
  }

  /**
   * Trigger dust cloud effect on landing
   * @param x Foot landing center X
   * @param y Foot landing ground Y
   */
  public triggerLandingDust(x: number, y: number) {
    const particleCount = 20;

    // Leftward billowing dust
    for (let i = 0; i < particleCount / 2; i++) {
      const speed = 40 + Math.random() * 140;
      const angle = Math.PI + (Math.random() * 0.45 - 0.2); // pointing left and slightly up
      const color = DUST_PALETTE[Math.floor(Math.random() * DUST_PALETTE.length)];
      const maxLife = 0.35 + Math.random() * 0.35;
      const initialSize = 4 + Math.random() * 5;

      this.particles.push({
        id: this.nextId++,
        kind: 'dust_puff',
        x: x - 6 + (Math.random() * 8 - 4),
        y: y + (Math.random() * 4 - 2),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        life: 0,
        maxLife,
        color,
        size: initialSize,
        maxSize: initialSize * (1.8 + Math.random() * 0.8),
        alpha: 0.85,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 3,
        drag: 0.9,
      });
    }

    // Rightward billowing dust
    for (let i = 0; i < particleCount / 2; i++) {
      const speed = 40 + Math.random() * 140;
      const angle = 0 - (Math.random() * 0.45 - 0.2); // pointing right and slightly up
      const color = DUST_PALETTE[Math.floor(Math.random() * DUST_PALETTE.length)];
      const maxLife = 0.35 + Math.random() * 0.35;
      const initialSize = 4 + Math.random() * 5;

      this.particles.push({
        id: this.nextId++,
        kind: 'dust_puff',
        x: x + 6 + (Math.random() * 8 - 4),
        y: y + (Math.random() * 4 - 2),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        life: 0,
        maxLife,
        color,
        size: initialSize,
        maxSize: initialSize * (1.8 + Math.random() * 0.8),
        alpha: 0.85,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 3,
        drag: 0.9,
      });
    }

    // Micro pixel crumbs/debris bouncing on impact
    for (let i = 0; i < 8; i++) {
      const vx = (Math.random() - 0.5) * 180;
      const vy = -30 - Math.random() * 70;
      this.particles.push({
        id: this.nextId++,
        kind: 'dust_crumb',
        x: x + (Math.random() * 20 - 10),
        y: y - 2,
        vx,
        vy,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.2,
        color: Math.random() > 0.4 ? '#00e5ff' : '#ffd23f',
        size: 2 + Math.floor(Math.random() * 2),
        alpha: 1,
        rotation: 0,
        rotSpeed: 0,
        drag: 0.95,
      });
    }
  }

  /**
   * Trigger light running footstep dust puff
   * @param x Foot contact X
   * @param y Foot contact Y
   * @param moveDir -1 for moving left (kick dust right), 1 for moving right (kick dust left)
   */
  public triggerFootstepDust(x: number, y: number, moveDir: number) {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const speed = 25 + Math.random() * 40;
      const vx = -moveDir * speed;
      const vy = -10 - Math.random() * 20;
      const initialSize = 3 + Math.random() * 4;

      this.particles.push({
        id: this.nextId++,
        kind: 'dust_puff',
        x: x - moveDir * 10 + (Math.random() * 6 - 3),
        y: y + (Math.random() * 4 - 2),
        vx,
        vy,
        life: 0,
        maxLife: 0.28 + Math.random() * 0.15,
        color: DUST_PALETTE[Math.floor(Math.random() * DUST_PALETTE.length)],
        size: initialSize,
        maxSize: initialSize * 1.6,
        alpha: 0.7,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 2,
        drag: 0.92,
      });
    }
  }

  /**
   * Trigger radiant arcade sparkle effect when picking up coins
   * @param x Pickup center X
   * @param y Pickup center Y
   * @param amount Optional intensity multiplier
   * @param showFloatingScore Optional "+100" popup
   */
  public triggerCoinSparkle(x: number, y: number, amount: number = 18, showFloatingScore: boolean = true) {
    // 1. Radiant shockwave ring
    this.particles.push({
      id: this.nextId++,
      kind: 'sparkle_ring',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0.35,
      color: '#ffd23f',
      glowColor: '#ffffff',
      size: 4,
      maxSize: 38,
      alpha: 1,
      rotation: 0,
      rotSpeed: 0,
      drag: 1,
    });

    // 2. 4-pointed radiant sparkle stars
    const starCount = Math.floor(amount * 0.65);
    for (let i = 0; i < starCount; i++) {
      const angle = (Math.PI * 2 * i) / starCount + (Math.random() * 0.4 - 0.2);
      const speed = 70 + Math.random() * 170;
      const color = SPARKLE_PALETTE[Math.floor(Math.random() * SPARKLE_PALETTE.length)];
      const maxLife = 0.5 + Math.random() * 0.35;
      const size = 6 + Math.random() * 7;

      this.particles.push({
        id: this.nextId++,
        kind: 'sparkle_star',
        x: x + (Math.random() * 10 - 5),
        y: y + (Math.random() * 10 - 5),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0,
        maxLife,
        color,
        glowColor: '#ffffff',
        size,
        alpha: 1,
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 12,
        drag: 0.93,
        twinkleFreq: 12 + Math.random() * 16,
      });
    }

    // 3. Glittering diamond twinkles
    const diamondCount = Math.floor(amount * 0.5);
    for (let i = 0; i < diamondCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      const color = i % 2 === 0 ? '#ffd23f' : '#ffffff';
      const maxLife = 0.4 + Math.random() * 0.3;

      this.particles.push({
        id: this.nextId++,
        kind: 'sparkle_diamond',
        x: x + (Math.random() * 8 - 4),
        y: y + (Math.random() * 8 - 4),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        life: 0,
        maxLife,
        color,
        size: 3 + Math.random() * 3,
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 8,
        drag: 0.94,
        twinkleFreq: 18 + Math.random() * 10,
      });
    }

    // 4. Floating +100 text indicator
    if (showFloatingScore) {
      this.particles.push({
        id: this.nextId++,
        kind: 'floating_text',
        x,
        y: y - 10,
        vx: 0,
        vy: -75,
        life: 0,
        maxLife: 0.75,
        color: '#ffd23f',
        glowColor: '#ff2d78',
        size: 11,
        alpha: 1,
        rotation: 0,
        rotSpeed: 0,
        drag: 0.96,
        text: '+100',
      });
    }
  }

  /**
   * Update physics and render all particles onto the attached canvas
   * @param dt Elapsed delta time in seconds
   */
  public updateAndRender(dt: number) {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const dpr = this.dpr;
    const stageWidth = this.width;
    const stageHeight = this.height;

    // Clear whole canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.particles.length === 0) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    const activeParticles: BaseParticle[] = [];

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) continue;

      const progress = p.life / p.maxLife;

      // Apply drag friction
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);

      // Kind-specific physics
      if (p.kind === 'sparkle_star' || p.kind === 'sparkle_diamond') {
        p.vy += 80 * dt; // gentle gravity on sparkles
      } else if (p.kind === 'dust_crumb') {
        p.vy += 320 * dt; // gravity on debris
      } else if (p.kind === 'dust_puff') {
        p.vy -= 12 * dt; // slight thermal rise for dust
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotSpeed * dt;

      // Opacity calculation
      if (p.kind === 'floating_text') {
        p.alpha = Math.max(0, 1 - Math.pow(progress, 2));
      } else {
        const baseFade = Math.max(0, 1 - progress);
        if (p.twinkleFreq) {
          // Twinkling sparkle shimmer
          const shimmer = 0.6 + 0.4 * Math.sin(p.life * p.twinkleFreq);
          p.alpha = baseFade * shimmer;
        } else {
          p.alpha = baseFade;
        }
      }

      // Drawing routines
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

      switch (p.kind) {
        case 'sparkle_star': {
          this.drawSparkleStar(ctx, p.x, p.y, p.size, p.rotation, p.color, p.glowColor);
          break;
        }
        case 'sparkle_diamond': {
          this.drawDiamond(ctx, p.x, p.y, p.size, p.rotation, p.color);
          break;
        }
        case 'sparkle_ring': {
          const r = p.size + (p.maxSize! - p.size) * progress;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, 2.5 * (1 - progress));
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.stroke();
          break;
        }
        case 'dust_puff': {
          const curSize = p.size + ((p.maxSize || p.size * 1.5) - p.size) * progress;
          this.drawDustPuff(ctx, p.x, p.y, curSize, p.color);
          break;
        }
        case 'dust_crumb': {
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
          break;
        }
        case 'floating_text': {
          if (p.text) {
            ctx.font = 'bold 11px "Press Start 2P", monospace, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.glowColor || '#000';
            ctx.shadowBlur = 4;
            // 8-bit text stroke
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeText(p.text, p.x, p.y);
            ctx.fillText(p.text, p.x, p.y);
          }
          break;
        }
      }

      ctx.restore();
      activeParticles.push(p);
    }

    ctx.restore();
    this.particles = activeParticles;
  }

  /**
   * Draw a 4-pointed retro arcade star
   */
  private drawSparkleStar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    rotation: number,
    color: string,
    glowColor?: string
  ) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 6;
    }

    const outer = size;
    const inner = size * 0.22;

    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const aOuter = (i * Math.PI) / 2;
      const aInner = aOuter + Math.PI / 4;
      if (i === 0) {
        ctx.moveTo(Math.cos(aOuter) * outer, Math.sin(aOuter) * outer);
      } else {
        ctx.lineTo(Math.cos(aOuter) * outer, Math.sin(aOuter) * outer);
      }
      ctx.lineTo(Math.cos(aInner) * inner, Math.sin(aInner) * inner);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Center radiant diamond dot
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1, -1, 2, 2);

    ctx.restore();
  }

  /**
   * Draw a diamond glint
   */
  private drawDiamond(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    rotation: number,
    color: string
  ) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.65, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.65, 0);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw soft arcade pixel dust cloud
   */
  private drawDustPuff(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    color: string
  ) {
    ctx.fillStyle = color;
    // Draw stepped pixel circle puff for authentic retro aesthetic
    const r = size;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Secondary smaller offset puff to create billowy smoke look
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.25, r * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx + r * 0.3, cy - r * 0.15, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}
