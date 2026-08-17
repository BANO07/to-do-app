import {
  Component,
  inject,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  NgZone,
} from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';
import { BackgroundStyle } from '../../../core/config/background.config';
import { PlainTexture } from '../../../core/config/preferences.config';
import { CursorMotionService } from '../../../core/services/cursor-motion.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { Subscription, combineLatest } from 'rxjs';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
  alpha: number;
  baseX: number;
  baseY: number;
}

interface Bubble {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  alpha: number;
}

interface GlassOrb {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  alpha: number;
  highlight: number;
}

interface AuroraBand {
  y: number;
  amplitude: number;
  frequency: number;
  speed: number;
  phase: number;
  alpha: number;
}

interface MeshBlob {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  alpha: number;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  twinkle: number;
  phase: number;
}

interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  alpha: number;
}

interface GridDot {
  x: number;
  y: number;
  baseAlpha: number;
}

@Component({
  selector: 'app-background',
  standalone: true,
  template: `
    <canvas #canvas class="app-background__canvas" aria-hidden="true"></canvas>
    @if (showCursorGlow) {
      <div class="app-background__cursor-glow" aria-hidden="true"></div>
    }
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        overflow: hidden;
        background: var(--bg);
      }
      :host([data-animated='true']) {
        transform: translate3d(
          calc(var(--cursor-x, 0) * 8px),
          calc(var(--cursor-y, 0) * 6px),
          0
        );
        will-change: transform;
      }
      .app-background__canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
      :host([data-canvas='false']) .app-background__canvas {
        display: none;
      }
      .app-background__cursor-glow {
        position: absolute;
        width: 420px;
        height: 420px;
        margin: -210px 0 0 -210px;
        left: var(--pointer-x, 50%);
        top: var(--pointer-y, 50%);
        background: radial-gradient(
          circle,
          color-mix(in srgb, var(--primary) 18%, transparent) 0%,
          transparent 70%
        );
        transition: left 0.12s ease-out, top 0.12s ease-out;
        will-change: left, top;
      }
    `,
  ],
  host: {
    '[attr.data-style]': 'style',
    '[attr.data-animated]': 'isAnimated',
    '[attr.data-canvas]': 'usesCanvas',
  },
})
export class AppBackgroundComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly themeService = inject(ThemeService);
  private readonly preferences = inject(PreferencesService);
  private readonly cursorMotion = inject(CursorMotionService);
  private readonly ngZone = inject(NgZone);

  style: BackgroundStyle = 'constellation';
  isAnimated = false;
  usesCanvas = false;
  showCursorGlow = false;

  private ctx!: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private bubbles: Bubble[] = [];
  private glassOrbs: GlassOrb[] = [];
  private auroraBands: AuroraBand[] = [];
  private meshBlobs: MeshBlob[] = [];
  private stars: Star[] = [];
  private rainDrops: RainDrop[] = [];
  private gridDots: GridDot[] = [];
  private grainSeed = 0;
  private animationId = 0;
  private subs: Subscription[] = [];
  private isDark = false;
  private reducedMotion = false;
  private accent: [number, number, number] = [99, 102, 241];
  private hueRange: [number, number] = [230, 280];
  private plainTexture: PlainTexture = 'none';
  private time = 0;

  ngAfterViewInit(): void {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.syncTheme();
    this.restart();

    this.subs.push(
      this.themeService.selection$.subscribe(() => {
        this.syncTheme();
        this.restart();
      }),
      combineLatest([this.preferences.plainTexture$, this.preferences.motion$]).subscribe(
        () => this.restart(),
      ),
    );

    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    this.subs.forEach((s) => s.unsubscribe());
    window.removeEventListener('resize', this.onResize);
  }

  private restart(): void {
    cancelAnimationFrame(this.animationId);
    this.style = this.themeService.currentBackground;
    this.plainTexture = this.preferences.plainTexture;

    const isPlain = this.style === 'plain';
    const plainWithTexture = isPlain && this.plainTexture !== 'none';
    this.usesCanvas = !isPlain || plainWithTexture;
    this.isAnimated =
      !this.reducedMotion &&
      this.preferences.motionScale > 0 &&
      (!isPlain || plainWithTexture);
    this.showCursorGlow =
      this.preferences.motionScale > 0 && (!isPlain || this.plainTexture === 'gradient');

    if (!this.usesCanvas) {
      return;
    }

    if (this.isAnimated || plainWithTexture) {
      this.cursorMotion.init();
    }

    if (this.reducedMotion && !plainWithTexture) {
      this.initCanvas();
      this.drawStatic();
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.initCanvas();
      this.time = 0;
      if (plainWithTexture && this.reducedMotion) {
        this.drawPlainTexture();
        return;
      }
      this.animate();
    });
  }

  private syncTheme(): void {
    this.isDark = this.themeService.current === 'dark';
    const palette = this.themeService.activePalette;
    this.accent = this.isDark ? palette.accentRgb.dark : palette.accentRgb.light;
    const range = this.isDark ? palette.particleHue.dark : palette.particleHue.light;
    this.hueRange = range;
  }

  private onResize = (): void => {
    if (!this.usesCanvas) return;
    this.initCanvas();
    if (this.reducedMotion && this.style === 'plain') {
      this.drawPlainTexture();
    } else if (this.reducedMotion) {
      this.drawStatic();
    }
  };

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    this.ctx = canvas.getContext('2d')!;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.grainSeed = Math.random() * 10000;

    if (this.style === 'plain') return;

    switch (this.style) {
      case 'constellation':
        this.particles = Array.from(
          { length: Math.min(80, Math.floor((w * h) / 18000)) },
          () => this.createParticle(true),
        );
        break;
      case 'bubbles':
        this.bubbles = Array.from({ length: Math.min(35, Math.floor((w * h) / 35000)) }, () =>
          this.createBubble(true),
        );
        break;
      case 'glass':
        this.glassOrbs = Array.from({ length: Math.min(12, Math.floor((w * h) / 80000)) }, () =>
          this.createGlassOrb(),
        );
        break;
      case 'aurora':
        this.auroraBands = Array.from({ length: 5 }, (_, i) => ({
          y: h * (0.2 + i * 0.15),
          amplitude: 40 + i * 15,
          frequency: 0.002 + i * 0.0005,
          speed: 0.0008 + i * 0.0002,
          phase: i * 1.2,
          alpha: 0.08 + i * 0.04,
        }));
        break;
      case 'mesh':
        this.meshBlobs = Array.from({ length: 6 }, () => this.createMeshBlob());
        break;
      case 'stars':
        this.stars = Array.from({ length: Math.min(120, Math.floor((w * h) / 12000)) }, () =>
          this.createStar(),
        );
        break;
      case 'rain':
        this.rainDrops = Array.from({ length: Math.min(90, Math.floor((w * h) / 15000)) }, () =>
          this.createRainDrop(true),
        );
        break;
      case 'dots':
        this.gridDots = this.createDotGrid();
        break;
    }
  }

  private getBgColor(): string {
    return (
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() ||
      (this.isDark ? '#0b0f1a' : '#f8fafc')
    );
  }

  private rgba(alpha: number): string {
    const [r, g, b] = this.accent;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private fillBase(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.ctx.fillStyle = this.getBgColor();
    this.ctx.fillRect(0, 0, w, h);
  }

  private drawCursorGlow(w: number, h: number): void {
    if (this.preferences.motionScale === 0) return;
    const { x: cx, y: cy, px, py } = this.cursorMotion.motion;

    const glowX = w * 0.75 + cx * 40;
    const glowY = h * 0.15 + cy * 30;
    const gradient = this.ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, w * 0.55);
    gradient.addColorStop(0, this.rgba(this.isDark ? 0.18 : 0.12));
    gradient.addColorStop(1, 'transparent');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, w, h);

    if (px > 0 || py > 0) {
      const cursorGlow = this.ctx.createRadialGradient(px, py, 0, px, py, 180);
      cursorGlow.addColorStop(0, this.rgba(this.isDark ? 0.12 : 0.08));
      cursorGlow.addColorStop(1, this.rgba(0));
      this.ctx.fillStyle = cursorGlow;
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  private createParticle(randomY = false): Particle {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = Math.random() * w;
    const y = randomY ? Math.random() * h : h + Math.random() * 200;
    const [hMin, hMax] = this.hueRange;
    return {
      x, y, baseX: x, baseY: y,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -(0.3 + Math.random() * 0.9),
      radius: 1.5 + Math.random() * 3.5,
      hue: hMin + Math.random() * (hMax - hMin),
      alpha: 0.35 + Math.random() * 0.45,
    };
  }

  private createBubble(randomY = false): Bubble {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const radius = 20 + Math.random() * 60;
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : h + radius,
      radius,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -(0.2 + Math.random() * 0.6),
      alpha: 0.06 + Math.random() * 0.12,
    };
  }

  private createGlassOrb(): GlassOrb {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const radius = 60 + Math.random() * 100;
    return { x: Math.random() * w, y: Math.random() * h, radius, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15, alpha: 0.04 + Math.random() * 0.08, highlight: 0.3 + Math.random() * 0.4 };
  }

  private createMeshBlob(): MeshBlob {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      radius: 120 + Math.random() * 180,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      alpha: 0.12 + Math.random() * 0.15,
    };
  }

  private createStar(): Star {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      radius: 0.8 + Math.random() * 2.2,
      alpha: 0.3 + Math.random() * 0.5,
      twinkle: 0.01 + Math.random() * 0.02,
      phase: Math.random() * Math.PI * 2,
    };
  }

  private createRainDrop(randomY = false): RainDrop {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -Math.random() * h,
      length: 12 + Math.random() * 28,
      speed: 4 + Math.random() * 8,
      alpha: 0.15 + Math.random() * 0.25,
    };
  }

  private createDotGrid(): GridDot[] {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const spacing = 32;
    const dots: GridDot[] = [];
    for (let x = spacing / 2; x < w; x += spacing) {
      for (let y = spacing / 2; y < h; y += spacing) {
        dots.push({ x, y, baseAlpha: 0.08 + Math.random() * 0.12 });
      }
    }
    return dots;
  }

  private animate = (): void => {
    this.time += 1;
    if (this.style === 'plain') {
      this.drawPlainTexture();
    } else {
      switch (this.style) {
        case 'constellation': this.drawConstellation(); break;
        case 'bubbles': this.drawBubbles(); break;
        case 'glass': this.drawGlass(); break;
        case 'aurora': this.drawAurora(); break;
        case 'mesh': this.drawMesh(); break;
        case 'stars': this.drawStars(); break;
        case 'rain': this.drawRain(); break;
        case 'dots': this.drawDots(); break;
      }
    }
    this.animationId = requestAnimationFrame(this.animate);
  };

  private drawPlainTexture(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.fillBase();

    if (this.plainTexture === 'grain') {
      const density = Math.floor((w * h) / 800);
      for (let i = 0; i < density; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const alpha = this.isDark ? 0.04 + Math.random() * 0.06 : 0.03 + Math.random() * 0.05;
        this.ctx.fillStyle = this.isDark
          ? `rgba(255, 255, 255, ${alpha})`
          : `rgba(15, 23, 42, ${alpha})`;
        this.ctx.fillRect(x, y, 1, 1);
      }
    } else if (this.plainTexture === 'gradient') {
      const { x: cx, y: cy } = this.cursorMotion.motion;
      const spots = [
        { x: w * 0.2 + cx * 20, y: h * 0.25 + cy * 15, r: w * 0.35 },
        { x: w * 0.75 + cx * 15, y: h * 0.65 + cy * 10, r: w * 0.3 },
      ];
      for (const spot of spots) {
        const g = this.ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spot.r);
        g.addColorStop(0, this.rgba(this.isDark ? 0.14 : 0.1));
        g.addColorStop(1, 'transparent');
        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, 0, w, h);
      }
    }
  }

  private drawConstellation(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const { x: cx, y: cy, px, py } = this.cursorMotion.motion;
    this.ctx.clearRect(0, 0, w, h);
    this.drawCursorGlow(w, h);

    for (const p of this.particles) {
      p.baseX += p.vx + Math.sin(p.baseY * 0.008) * 0.15;
      p.baseY += p.vy;
      if (p.baseY < -20) { Object.assign(p, this.createParticle()); p.baseY = h + 20; }
      if (p.baseX < -20) p.baseX = w + 20;
      if (p.baseX > w + 20) p.baseX = -20;
      let ox = cx * 18 * (p.radius / 3);
      let oy = cy * 14 * (p.radius / 3);
      if (px > 0 || py > 0) {
        const dx = p.baseX - px;
        const dy = p.baseY - py;
        const dist = Math.hypot(dx, dy);
        if (dist < 140 && dist > 0) {
          const force = (1 - dist / 140) * 2.2;
          ox += (dx / dist) * force * 8;
          oy += (dy / dist) * force * 8;
        }
      }
      p.x = p.baseX + ox;
      p.y = p.baseY + oy;
    }

    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i];
        const b = this.particles[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 120) {
          this.ctx.strokeStyle = this.rgba((1 - dist / 120) * (this.isDark ? 0.25 : 0.15));
          this.ctx.lineWidth = 0.8;
          this.ctx.beginPath();
          this.ctx.moveTo(a.x, a.y);
          this.ctx.lineTo(b.x, b.y);
          this.ctx.stroke();
        }
      }
    }

    for (const p of this.particles) {
      this.ctx.fillStyle = `hsla(${p.hue}, 90%, ${this.isDark ? 75 : 60}%, ${p.alpha + 0.2})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawBubbles(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const { x: cx, y: cy, px, py } = this.cursorMotion.motion;
    this.fillBase();
    this.drawCursorGlow(w, h);

    for (const b of this.bubbles) {
      b.x += b.vx + cx * 0.3;
      b.y += b.vy + cy * 0.2;
      if (px > 0 || py > 0) {
        const dx = b.x - px;
        const dy = b.y - py;
        const dist = Math.hypot(dx, dy);
        if (dist < b.radius * 3 && dist > 0) {
          const force = (1 - dist / (b.radius * 3)) * 1.5;
          b.x += (dx / dist) * force * 3;
          b.y += (dy / dist) * force * 3;
        }
      }
      if (b.y < -b.radius * 2) Object.assign(b, this.createBubble());
      if (b.x < -b.radius) b.x = w + b.radius;
      if (b.x > w + b.radius) b.x = -b.radius;

      const grad = this.ctx.createRadialGradient(b.x - b.radius * 0.3, b.y - b.radius * 0.3, 0, b.x, b.y, b.radius);
      grad.addColorStop(0, this.rgba(b.alpha + 0.15));
      grad.addColorStop(1, this.rgba(0));
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = this.rgba(this.isDark ? 0.2 : 0.15);
      this.ctx.stroke();
    }
  }

  private drawGlass(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const { x: cx, y: cy, px, py } = this.cursorMotion.motion;
    this.fillBase();
    const mesh = this.ctx.createRadialGradient(w * 0.3 + cx * 30, h * 0.2 + cy * 20, 0, w * 0.5, h * 0.5, w * 0.7);
    mesh.addColorStop(0, this.rgba(this.isDark ? 0.15 : 0.1));
    mesh.addColorStop(1, 'transparent');
    this.ctx.fillStyle = mesh;
    this.ctx.fillRect(0, 0, w, h);

    for (const orb of this.glassOrbs) {
      orb.x += orb.vx + cx * 0.08;
      orb.y += orb.vy + cy * 0.06;
      if (orb.x < -orb.radius) orb.x = w + orb.radius;
      if (orb.x > w + orb.radius) orb.x = -orb.radius;
      if (orb.y < -orb.radius) orb.y = h + orb.radius;
      if (orb.y > h + orb.radius) orb.y = -orb.radius;

      const body = this.ctx.createRadialGradient(orb.x - orb.radius * 0.25, orb.y - orb.radius * 0.25, orb.radius * 0.1, orb.x, orb.y, orb.radius);
      body.addColorStop(0, `rgba(255, 255, 255, ${orb.alpha + orb.highlight * 0.15})`);
      body.addColorStop(1, this.rgba(0));
      this.ctx.fillStyle = body;
      this.ctx.beginPath();
      this.ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${orb.highlight * (this.isDark ? 0.35 : 0.6)})`;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }

    if (px > 0 || py > 0) {
      const g = this.ctx.createRadialGradient(px, py, 0, px, py, 200);
      g.addColorStop(0, this.rgba(this.isDark ? 0.1 : 0.06));
      g.addColorStop(1, 'transparent');
      this.ctx.fillStyle = g;
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  private drawAurora(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const { x: cx, y: cy } = this.cursorMotion.motion;
    this.fillBase();
    for (const band of this.auroraBands) {
      this.ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = band.y + cx * 20 + cy * 10 + Math.sin(x * band.frequency + this.time * band.speed + band.phase) * band.amplitude;
        if (x === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.lineTo(w, h);
      this.ctx.lineTo(0, h);
      this.ctx.closePath();
      const grad = this.ctx.createLinearGradient(0, band.y - band.amplitude, 0, band.y + band.amplitude * 2);
      grad.addColorStop(0, this.rgba(0));
      grad.addColorStop(0.5, this.rgba(band.alpha));
      grad.addColorStop(1, this.rgba(0));
      this.ctx.fillStyle = grad;
      this.ctx.fill();
    }
  }

  private drawMesh(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const { x: cx, y: cy } = this.cursorMotion.motion;
    this.fillBase();

    for (const blob of this.meshBlobs) {
      blob.x += blob.vx + cx * 0.12;
      blob.y += blob.vy + cy * 0.1;
      if (blob.x < -blob.radius) blob.x = w + blob.radius;
      if (blob.x > w + blob.radius) blob.x = -blob.radius;
      if (blob.y < -blob.radius) blob.y = h + blob.radius;
      if (blob.y > h + blob.radius) blob.y = -blob.radius;

      const g = this.ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.radius);
      g.addColorStop(0, this.rgba(blob.alpha));
      g.addColorStop(0.6, this.rgba(blob.alpha * 0.4));
      g.addColorStop(1, 'transparent');
      this.ctx.fillStyle = g;
      this.ctx.beginPath();
      this.ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.drawCursorGlow(w, h);
  }

  private drawStars(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const { x: cx, y: cy } = this.cursorMotion.motion;
    this.fillBase();
    this.drawCursorGlow(w, h);

    for (const star of this.stars) {
      const twinkle = star.alpha + Math.sin(this.time * star.twinkle + star.phase) * 0.15;
      const offsetX = cx * star.radius * 2;
      const offsetY = cy * star.radius * 1.5;
      this.ctx.fillStyle = this.rgba(Math.max(0.05, twinkle));
      this.ctx.beginPath();
      this.ctx.arc(star.x + offsetX, star.y + offsetY, star.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawRain(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const { x: cx } = this.cursorMotion.motion;
    this.fillBase();

    this.ctx.strokeStyle = this.rgba(this.isDark ? 0.2 : 0.15);
    this.ctx.lineWidth = 1;
    for (const drop of this.rainDrops) {
      drop.y += drop.speed;
      drop.x += cx * 0.5 + 0.5;
      if (drop.y > h + drop.length) Object.assign(drop, this.createRainDrop());
      this.ctx.globalAlpha = drop.alpha;
      this.ctx.beginPath();
      this.ctx.moveTo(drop.x, drop.y);
      this.ctx.lineTo(drop.x - 2, drop.y + drop.length);
      this.ctx.stroke();
    }
    this.ctx.globalAlpha = 1;
  }

  private drawDots(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const { x: cx, y: cy, px, py } = this.cursorMotion.motion;
    this.fillBase();

    for (const dot of this.gridDots) {
      let alpha = dot.baseAlpha;
      if (px > 0 || py > 0) {
        const dist = Math.hypot(dot.x - px, dot.y - py);
        if (dist < 120) alpha += (1 - dist / 120) * 0.2;
      }
      const ox = cx * 3;
      const oy = cy * 2;
      this.ctx.fillStyle = this.rgba(alpha);
      this.ctx.beginPath();
      this.ctx.arc(dot.x + ox, dot.y + oy, 1.5, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawStatic(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.fillBase();
    const gradient = this.ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, this.getBgColor());
    gradient.addColorStop(0.5, this.rgba(this.isDark ? 0.12 : 0.08));
    gradient.addColorStop(1, this.rgba(this.isDark ? 0.2 : 0.04));
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, w, h);
  }
}
