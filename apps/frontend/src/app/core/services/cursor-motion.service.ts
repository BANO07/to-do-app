import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { PreferencesService } from './preferences.service';

/** Normalized cursor position from center: x/y in roughly -1..1 */
export interface CursorMotion {
  x: number;
  y: number;
  px: number;
  py: number;
}

@Injectable({ providedIn: 'root' })
export class CursorMotionService implements OnDestroy {
  private readonly ngZone = inject(NgZone);
  private readonly preferences = inject(PreferencesService);

  private targetX = 0;
  private targetY = 0;
  private currentX = 0;
  private currentY = 0;
  private px = 0;
  private py = 0;
  private rafId = 0;
  private active = false;
  private motionSub?: Subscription;

  constructor() {
    this.motionSub = this.preferences.motion$.subscribe(() => {
      if (this.preferences.motionScale === 0) {
        this.stop();
        this.resetVars();
      } else if (!this.active) {
        this.init();
      }
    });
  }

  init(): void {
    if (this.active || typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (this.preferences.motionScale === 0) {
      this.resetVars();
      return;
    }

    this.active = true;
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('mousemove', this.onMove, { passive: true });
      window.addEventListener('touchmove', this.onTouch, { passive: true });
      this.tick();
    });
  }

  ngOnDestroy(): void {
    this.stop();
    this.motionSub?.unsubscribe();
  }

  get motion(): CursorMotion {
    const scale = this.preferences.motionScale;
    return {
      x: this.currentX * scale,
      y: this.currentY * scale,
      px: scale > 0 ? this.px : 0,
      py: scale > 0 ? this.py : 0,
    };
  }

  private stop(): void {
    this.active = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('touchmove', this.onTouch);
  }

  private resetVars(): void {
    const root = document.documentElement;
    root.style.setProperty('--cursor-x', '0');
    root.style.setProperty('--cursor-y', '0');
  }

  private onMove = (event: MouseEvent): void => {
    this.setTarget(event.clientX, event.clientY);
  };

  private onTouch = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (touch) {
      this.setTarget(touch.clientX, touch.clientY);
    }
  };

  private setTarget(clientX: number, clientY: number): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.px = clientX;
    this.py = clientY;
    this.targetX = (clientX / w - 0.5) * 2;
    this.targetY = (clientY / h - 0.5) * 2;
  }

  private tick = (): void => {
    if (!this.active) return;

    const scale = this.preferences.motionScale;
    this.currentX += (this.targetX - this.currentX) * 0.08;
    this.currentY += (this.targetY - this.currentY) * 0.08;

    const root = document.documentElement;
    root.style.setProperty('--cursor-x', (this.currentX * scale).toFixed(4));
    root.style.setProperty('--cursor-y', (this.currentY * scale).toFixed(4));
    root.style.setProperty('--pointer-x', scale > 0 ? `${this.px}px` : '50%');
    root.style.setProperty('--pointer-y', scale > 0 ? `${this.py}px` : '50%');

    this.rafId = requestAnimationFrame(this.tick);
  };
}
