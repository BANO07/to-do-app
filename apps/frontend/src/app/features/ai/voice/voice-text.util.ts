import { TTS_MAX_CHARACTERS } from './voice.types';

/** Strip lightweight markdown so TTS reads natural plain text. */
export function normalizeMarkdownForSpeech(text: string): string {
  let normalized = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^##\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\s+\n/g, '\n')
    .trim();

  if (normalized.length > TTS_MAX_CHARACTERS) {
    normalized = `${normalized.slice(0, TTS_MAX_CHARACTERS).trim()}…`;
  }

  return normalized;
}
