import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  DEFAULT_VOICE_LOCALE,
  VoicePreferences,
} from './voice.types';

const STORAGE_LOCALE_KEY = 'todo-app.voice.locale';
const STORAGE_TTS_KEY = 'todo-app.voice.ttsEnabled';

@Injectable({ providedIn: 'root' })
export class VoicePreferencesService {
  private readonly preferencesSubject = new BehaviorSubject<VoicePreferences>(
    this.loadPreferences(),
  );

  readonly preferences$ = this.preferencesSubject.asObservable();

  getLocale(): string {
    return this.preferencesSubject.value.locale;
  }

  setLocale(locale: string): void {
    const normalized = this.normalizeLocale(locale);
    this.updatePreferences({ locale: normalized });
    this.persist(STORAGE_LOCALE_KEY, normalized);
  }

  isTtsEnabled(): boolean {
    return this.preferencesSubject.value.ttsEnabled;
  }

  setTtsEnabled(enabled: boolean): void {
    this.updatePreferences({ ttsEnabled: enabled });
    this.persist(STORAGE_TTS_KEY, String(enabled));
  }

  getDefaultLocale(): string {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return this.normalizeLocale(navigator.language);
    }
    return DEFAULT_VOICE_LOCALE;
  }

  isValidLocale(locale: string): boolean {
    return /^[a-z]{2}(-[A-Za-z0-9]+)*$/i.test(locale.trim());
  }

  private loadPreferences(): VoicePreferences {
    const defaultLocale = this.getDefaultLocale();
    return {
      locale: this.readLocale(defaultLocale),
      ttsEnabled: this.readTtsEnabled(true),
    };
  }

  private readLocale(fallback: string): string {
    const stored = this.readStorage(STORAGE_LOCALE_KEY);
    if (stored && this.isValidLocale(stored)) {
      return this.normalizeLocale(stored);
    }
    return fallback;
  }

  private readTtsEnabled(fallback: boolean): boolean {
    const stored = this.readStorage(STORAGE_TTS_KEY);
    if (stored === null) {
      return fallback;
    }
    return stored === 'true';
  }

  private normalizeLocale(locale: string): string {
    const trimmed = locale.trim();
    if (!this.isValidLocale(trimmed)) {
      return DEFAULT_VOICE_LOCALE;
    }
    const [language, region] = trimmed.split('-');
    return region
      ? `${language.toLowerCase()}-${region.toUpperCase()}`
      : language.toLowerCase();
  }

  private updatePreferences(partial: Partial<VoicePreferences>): void {
    this.preferencesSubject.next({
      ...this.preferencesSubject.value,
      ...partial,
    });
  }

  private readStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private persist(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage failures — in-memory preferences still apply.
    }
  }
}
