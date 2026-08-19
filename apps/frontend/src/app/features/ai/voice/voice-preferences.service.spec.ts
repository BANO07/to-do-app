import { VoicePreferencesService } from './voice-preferences.service';

describe('VoicePreferencesService', () => {
  let service: VoicePreferencesService;

  beforeEach(() => {
    localStorage.clear();
    service = new VoicePreferencesService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults locale from navigator when nothing is stored', () => {
    expect(service.getLocale()).toBeTruthy();
  });

  it('persists and restores locale', () => {
    service.setLocale('hi-IN');
    expect(service.getLocale()).toBe('hi-IN');
    expect(localStorage.getItem('todo-app.voice.locale')).toBe('hi-IN');
  });

  it('defaults TTS to enabled', () => {
    expect(service.isTtsEnabled()).toBeTrue();
  });

  it('persists TTS enabled state', () => {
    service.setTtsEnabled(false);
    expect(service.isTtsEnabled()).toBeFalse();
    expect(localStorage.getItem('todo-app.voice.ttsEnabled')).toBe('false');
  });

  it('falls back when stored locale is invalid', () => {
    expect(service.isValidLocale('not-a-locale')).toBeFalse();
    service.setLocale('not-a-locale');
    expect(service.getLocale()).toBe('en-US');
  });

  it('handles unavailable localStorage safely', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    expect(() => service.setLocale('en-US')).not.toThrow();
    expect(service.getLocale()).toBe('en-US');
  });
});
