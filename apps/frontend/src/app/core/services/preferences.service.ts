import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  DEFAULT_LANDING,
  DEFAULT_LANDING_OPTIONS,
  DEFAULT_MOTION,
  DEFAULT_PLAIN_TEXTURE,
  DefaultLandingOption,
  DefaultLandingPage,
  MOTION_INTENSITY_OPTIONS,
  MOTION_SCALE,
  MotionIntensity,
  MotionIntensityOption,
  PLAIN_TEXTURE_OPTIONS,
  PlainTexture,
  PlainTextureOption,
} from '../config/preferences.config';

export type {
  MotionIntensity,
  PlainTexture,
  DefaultLandingPage,
} from '../config/preferences.config';

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly motionKey = 'todo-app-motion-intensity';
  private readonly textureKey = 'todo-app-plain-texture';
  private readonly landingKey = 'todo-app-default-landing';
  private readonly compactKey = 'todo-app-compact-layout';

  private readonly motionSubject = new BehaviorSubject<MotionIntensity>(DEFAULT_MOTION);
  private readonly textureSubject = new BehaviorSubject<PlainTexture>(DEFAULT_PLAIN_TEXTURE);
  private readonly landingSubject = new BehaviorSubject<DefaultLandingPage>(DEFAULT_LANDING);
  private readonly compactSubject = new BehaviorSubject<boolean>(false);

  readonly motion$ = this.motionSubject.asObservable();
  readonly plainTexture$ = this.textureSubject.asObservable();
  readonly defaultLanding$ = this.landingSubject.asObservable();
  readonly compactLayout$ = this.compactSubject.asObservable();

  readonly motionOptions: MotionIntensityOption[] = MOTION_INTENSITY_OPTIONS;
  readonly plainTextureOptions: PlainTextureOption[] = PLAIN_TEXTURE_OPTIONS;
  readonly landingOptions: DefaultLandingOption[] = DEFAULT_LANDING_OPTIONS;

  get motionIntensity(): MotionIntensity {
    return this.motionSubject.value;
  }

  get motionScale(): number {
    return MOTION_SCALE[this.motionIntensity];
  }

  get plainTexture(): PlainTexture {
    return this.textureSubject.value;
  }

  get defaultLanding(): DefaultLandingPage {
    return this.landingSubject.value;
  }

  get defaultLandingPath(): string {
    return (
      DEFAULT_LANDING_OPTIONS.find((o) => o.id === this.defaultLanding)?.path ??
      '/dashboard'
    );
  }

  get compactLayout(): boolean {
    return this.compactSubject.value;
  }

  init(): void {
    const motion = this.readEnum(
      localStorage.getItem(this.motionKey),
      MOTION_INTENSITY_OPTIONS.map((o) => o.id),
      DEFAULT_MOTION,
    );
    const texture = this.readEnum(
      localStorage.getItem(this.textureKey),
      PLAIN_TEXTURE_OPTIONS.map((o) => o.id),
      DEFAULT_PLAIN_TEXTURE,
    );
    const landing = this.readEnum(
      localStorage.getItem(this.landingKey),
      DEFAULT_LANDING_OPTIONS.map((o) => o.id),
      DEFAULT_LANDING,
    );
    const compact = localStorage.getItem(this.compactKey) === 'true';
    this.apply(motion, texture, landing, compact);
  }

  setMotionIntensity(value: MotionIntensity): void {
    this.apply(value, this.plainTexture, this.defaultLanding, this.compactLayout);
  }

  setPlainTexture(value: PlainTexture): void {
    this.apply(this.motionIntensity, value, this.defaultLanding, this.compactLayout);
  }

  setDefaultLanding(value: DefaultLandingPage): void {
    this.apply(this.motionIntensity, this.plainTexture, value, this.compactLayout);
  }

  setCompactLayout(value: boolean): void {
    this.apply(this.motionIntensity, this.plainTexture, this.defaultLanding, value);
  }

  private apply(
    motion: MotionIntensity,
    texture: PlainTexture,
    landing: DefaultLandingPage,
    compact: boolean,
  ): void {
    const scale = MOTION_SCALE[motion];
    document.documentElement.style.setProperty('--motion-scale', String(scale));
    document.documentElement.toggleAttribute('data-compact', compact);

    localStorage.setItem(this.motionKey, motion);
    localStorage.setItem(this.textureKey, texture);
    localStorage.setItem(this.landingKey, landing);
    localStorage.setItem(this.compactKey, String(compact));

    this.motionSubject.next(motion);
    this.textureSubject.next(texture);
    this.landingSubject.next(landing);
    this.compactSubject.next(compact);
  }

  private readEnum<T extends string>(raw: string | null, allowed: T[], fallback: T): T {
    return raw && allowed.includes(raw as T) ? (raw as T) : fallback;
  }
}
