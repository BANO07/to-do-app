export type BackgroundStyle =
  | 'plain'
  | 'constellation'
  | 'bubbles'
  | 'glass'
  | 'aurora'
  | 'mesh'
  | 'stars'
  | 'rain'
  | 'dots';

export interface BackgroundStyleOption {
  id: BackgroundStyle;
  label: string;
  icon: string;
  description: string;
}

export const BACKGROUND_STYLES: BackgroundStyleOption[] = [
  {
    id: 'plain',
    label: 'Plain',
    icon: '⬜',
    description: 'Clean solid background, no animation',
  },
  {
    id: 'constellation',
    label: 'Constellation',
    icon: '✨',
    description: 'Connected particles that react to your cursor',
  },
  {
    id: 'bubbles',
    label: 'Bubbles',
    icon: '🫧',
    description: 'Floating soft bubbles drifting upward',
  },
  {
    id: 'glass',
    label: 'Glass',
    icon: '🔮',
    description: 'Frosted glass orbs with soft glow',
  },
  {
    id: 'aurora',
    label: 'Aurora',
    icon: '🌌',
    description: 'Flowing gradient waves',
  },
  {
    id: 'mesh',
    label: 'Mesh',
    icon: '🎨',
    description: 'Soft morphing gradient blobs',
  },
  {
    id: 'stars',
    label: 'Stars',
    icon: '⭐',
    description: 'Twinkling starfield without lines',
  },
  {
    id: 'rain',
    label: 'Rain',
    icon: '🌧️',
    description: 'Gentle falling streaks',
  },
  {
    id: 'dots',
    label: 'Dots',
    icon: '⚫',
    description: 'Minimal dotted grid pattern',
  },
];

export const DEFAULT_BACKGROUND: BackgroundStyle = 'constellation';
