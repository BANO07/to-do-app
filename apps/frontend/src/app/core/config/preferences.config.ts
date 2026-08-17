export type MotionIntensity = 'off' | 'subtle' | 'normal';
export type PlainTexture = 'none' | 'grain' | 'gradient';
export type DefaultLandingPage = 'dashboard' | 'today' | 'upcoming';

export interface MotionIntensityOption {
  id: MotionIntensity;
  label: string;
}

export interface PlainTextureOption {
  id: PlainTexture;
  label: string;
  icon: string;
}

export interface DefaultLandingOption {
  id: DefaultLandingPage;
  label: string;
  icon: string;
  path: string;
}

export const MOTION_INTENSITY_OPTIONS: MotionIntensityOption[] = [
  { id: 'off', label: 'Off' },
  { id: 'subtle', label: 'Subtle' },
  { id: 'normal', label: 'Normal' },
];

export const PLAIN_TEXTURE_OPTIONS: PlainTextureOption[] = [
  { id: 'none', label: 'None', icon: '⬜' },
  { id: 'grain', label: 'Grain', icon: '🌫️' },
  { id: 'gradient', label: 'Gradient', icon: '🎨' },
];

export const DEFAULT_LANDING_OPTIONS: DefaultLandingOption[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠', path: '/dashboard' },
  { id: 'today', label: 'Today', icon: '☀️', path: '/tasks/today' },
  { id: 'upcoming', label: 'Upcoming', icon: '📅', path: '/tasks/upcoming' },
];

export const MOTION_SCALE: Record<MotionIntensity, number> = {
  off: 0,
  subtle: 0.4,
  normal: 1,
};

export const DEFAULT_MOTION: MotionIntensity = 'normal';
export const DEFAULT_PLAIN_TEXTURE: PlainTexture = 'none';
export const DEFAULT_LANDING: DefaultLandingPage = 'dashboard';
