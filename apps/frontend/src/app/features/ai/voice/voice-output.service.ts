import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { VoicePreferencesService } from './voice-preferences.service';
import { normalizeMarkdownForSpeech } from './voice-text.util';
import { DEFAULT_VOICE_LOCALE, VoiceOutputState } from './voice.types';

export interface VoiceSpeakOptions {
  locale?: string;
}

@Injectable()
export class VoiceOutputService implements OnDestroy {
  private voices: SpeechSynthesisVoice[] = [];
  private voicesChangedHandler: (() => void) | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;

  private readonly stateSubject = new BehaviorSubject<VoiceOutputState>({
    speaking: false,
    enabled: true,
    supported: this.detectSupport(),
  });

  readonly state$ = this.stateSubject.asObservable();

  constructor(private readonly preferences: VoicePreferencesService) {
    this.stateSubject.next({
      ...this.stateSubject.value,
      enabled: this.preferences.isTtsEnabled(),
    });
    this.bindVoices();
  }

  ngOnDestroy(): void {
    this.cancel();
    this.unbindVoices();
  }

  isSupported(): boolean {
    return this.detectSupport();
  }

  isSpeaking(): boolean {
    return this.stateSubject.value.speaking;
  }

  isEnabled(): boolean {
    return this.stateSubject.value.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.preferences.setTtsEnabled(enabled);
    this.stateSubject.next({
      ...this.stateSubject.value,
      enabled,
    });
    if (!enabled) {
      this.cancel();
    }
  }

  speak(text: string, options?: VoiceSpeakOptions): void {
    if (!this.isSupported() || !this.isEnabled()) {
      return;
    }

    const normalized = normalizeMarkdownForSpeech(text);
    if (!normalized.trim()) {
      return;
    }

    this.cancel();

    const utterance = new SpeechSynthesisUtterance(normalized);
    const locale = options?.locale ?? this.preferences.getLocale() ?? DEFAULT_VOICE_LOCALE;
    utterance.lang = locale;
    const voice = this.selectVoice(locale);
    if (voice) {
      try {
        utterance.voice = voice;
      } catch {
        // Some browsers reject mock or mismatched voice objects.
      }
    }

    utterance.onstart = () => {
      this.stateSubject.next({
        ...this.stateSubject.value,
        speaking: true,
      });
    };

    utterance.onend = () => {
      this.clearSpeakingState();
    };

    utterance.onerror = () => {
      this.clearSpeakingState();
    };

    this.utterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  cancel(): void {
    if (!this.isSupported()) {
      return;
    }

    window.speechSynthesis.cancel();
    this.utterance = null;
    this.clearSpeakingState();
  }

  getVoices(): SpeechSynthesisVoice[] {
    return [...this.voices];
  }

  selectVoice(locale: string): SpeechSynthesisVoice | null {
    const voices = this.voices.length
      ? this.voices
      : window.speechSynthesis.getVoices();
    if (!voices.length) {
      return null;
    }

    const normalized = locale.toLowerCase();
    const exact = voices.find(
      (voice) => voice.lang.toLowerCase() === normalized,
    );
    if (exact) {
      return exact;
    }

    const languagePrefix = normalized.split('-')[0];
    const prefixMatch = voices.find((voice) =>
      voice.lang.toLowerCase().startsWith(`${languagePrefix}-`),
    );
    if (prefixMatch) {
      return prefixMatch;
    }

    return voices[0] ?? null;
  }

  private bindVoices(): void {
    if (!this.isSupported()) {
      return;
    }

    this.refreshVoices();
    this.voicesChangedHandler = () => this.refreshVoices();
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      this.voicesChangedHandler,
    );
  }

  private unbindVoices(): void {
    if (this.voicesChangedHandler) {
      window.speechSynthesis.removeEventListener(
        'voiceschanged',
        this.voicesChangedHandler,
      );
      this.voicesChangedHandler = null;
    }
  }

  private refreshVoices(): void {
    this.voices = window.speechSynthesis.getVoices();
  }

  private clearSpeakingState(): void {
    this.utterance = null;
    this.stateSubject.next({
      ...this.stateSubject.value,
      speaking: false,
    });
  }

  private detectSupport(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }
}
