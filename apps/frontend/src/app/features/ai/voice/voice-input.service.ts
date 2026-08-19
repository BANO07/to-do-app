import { Injectable, InjectionToken, Inject, OnDestroy, Optional } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { VoicePreferencesService } from './voice-preferences.service';
import {
  DEFAULT_VOICE_LOCALE,
  VoiceInputSnapshot,
  VoiceInputState,
  VoiceRecognitionError,
  VoiceRecognitionErrorCode,
  VoiceTranscript,
} from './voice.types';

export const SPEECH_RECOGNITION_FACTORY = new InjectionToken<
  (() => SpeechRecognition) | null
>('SPEECH_RECOGNITION_FACTORY');

const EMPTY_TRANSCRIPT: VoiceTranscript = {
  partial: '',
  final: '',
  current: '',
};

@Injectable()
export class VoiceInputService implements OnDestroy {
  private recognition: SpeechRecognition | null = null;
  private active = false;
  private cancelled = false;
  private finalizedSegments: string[] = [];
  private partialSegment = '';

  private readonly snapshotSubject: BehaviorSubject<VoiceInputSnapshot>;

  readonly snapshot$;

  constructor(
    private readonly preferences: VoicePreferencesService,
    @Optional() @Inject(SPEECH_RECOGNITION_FACTORY)
    private readonly recognitionFactory: (() => SpeechRecognition) | null,
  ) {
    this.snapshotSubject = new BehaviorSubject(
      this.buildSnapshot(VoiceInputState.Idle, EMPTY_TRANSCRIPT, null),
    );
    this.snapshot$ = this.snapshotSubject.asObservable();
    this.refreshSupportState();
  }

  ngOnDestroy(): void {
    this.teardownRecognition(true);
  }

  isSupported(): boolean {
    return this.recognitionFactory !== null || this.getRecognitionConstructor() !== null;
  }

  getSnapshot(): VoiceInputSnapshot {
    return this.snapshotSubject.value;
  }

  start(): void {
    if (!this.isSupported()) {
      this.setError('unsupported', 'Voice input is not supported in this browser.');
      return;
    }

    if (this.active) {
      return;
    }

    this.cancelled = false;
    this.finalizedSegments = [];
    this.partialSegment = '';
    this.updateSnapshot(VoiceInputState.RequestingMic, EMPTY_TRANSCRIPT, null);

    try {
      this.recognition = this.createRecognition();
      this.attachHandlers(this.recognition);
      this.recognition.start();
      this.active = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.teardownRecognition(true);
      this.setError('unknown', `Unable to start voice input: ${msg}`);
    }
  }

  stop(): void {
    if (!this.active || !this.recognition) {
      return;
    }

    this.updateSnapshot(VoiceInputState.Transcribing, this.currentTranscript(), null);
    try {
      this.recognition.stop();
    } catch {
      this.handleEnd();
    }
  }

  cancel(): void {
    this.cancelled = true;
    if (!this.recognition) {
      this.resetToIdle();
      return;
    }

    try {
      this.recognition.abort();
    } catch {
      this.teardownRecognition(true);
      this.resetToIdle();
    }
  }

  acknowledgeReview(): void {
    if (this.snapshotSubject.value.state === VoiceInputState.Reviewing) {
      this.resetToIdle();
    }
  }

  clearError(): void {
    if (this.snapshotSubject.value.state === VoiceInputState.Error) {
      this.resetToIdle();
    }
  }

  setLocale(locale: string): void {
    this.preferences.setLocale(locale);
    if (this.recognition) {
      this.recognition.lang = this.preferences.getLocale();
    }
    this.updateSnapshot(
      this.snapshotSubject.value.state,
      this.snapshotSubject.value.transcript,
      this.snapshotSubject.value.error,
    );
  }

  private refreshSupportState(): void {
    if (!this.isSupported()) {
      this.snapshotSubject.next(
        this.buildSnapshot(VoiceInputState.Unsupported, EMPTY_TRANSCRIPT, null),
      );
      return;
    }

    this.snapshotSubject.next(
      this.buildSnapshot(VoiceInputState.Idle, EMPTY_TRANSCRIPT, null),
    );
  }

  private createRecognition(): SpeechRecognition {
    if (this.recognitionFactory) {
      const recognition = this.recognitionFactory();
      recognition.lang = this.preferences.getLocale() || DEFAULT_VOICE_LOCALE;
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      return recognition;
    }
    const ctor = this.getRecognitionConstructor();
    if (!ctor) {
      throw new Error('SpeechRecognition unavailable');
    }

    const recognition = new ctor();
    recognition.lang = this.preferences.getLocale() || DEFAULT_VOICE_LOCALE;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    return recognition;
  }

  private attachHandlers(recognition: SpeechRecognition): void {
    recognition.onstart = () => {
      this.updateSnapshot(VoiceInputState.Listening, EMPTY_TRANSCRIPT, null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result.item(0)?.transcript?.trim() ?? '';
        if (!transcript) {
          continue;
        }

        if (result.isFinal) {
          this.finalizedSegments.push(transcript);
          this.partialSegment = '';
        } else {
          interim = transcript;
        }
      }

      this.partialSegment = interim;
      this.updateSnapshot(
        VoiceInputState.Listening,
        this.currentTranscript(),
        null,
      );
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted' && this.cancelled) {
        return;
      }
      const mapped = this.mapBrowserError(event.error);
      this.setError(mapped.code, mapped.message);
    };

    recognition.onend = () => {
      this.handleEnd();
    };
  }

  private handleEnd(): void {
    const transcript = this.currentTranscript();
    this.teardownRecognition(false);

    if (this.cancelled) {
      this.resetToIdle();
      return;
    }

    if (this.snapshotSubject.value.error) {
      return;
    }

    if (!transcript.current.trim()) {
      this.setError('no-speech', 'No speech detected. Try again or type your message.');
      return;
    }

    this.updateSnapshot(VoiceInputState.Reviewing, transcript, null);
  }

  private currentTranscript(): VoiceTranscript {
    const final = this.finalizedSegments.join(' ').trim();
    const partial = this.partialSegment.trim();
    const current = [final, partial].filter(Boolean).join(' ').trim();

    return {
      final,
      partial,
      current,
    };
  }

  private teardownRecognition(clearHandlers: boolean): void {
    if (this.recognition && clearHandlers) {
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
    }

    this.recognition = null;
    this.active = false;
  }

  private resetToIdle(): void {
    this.finalizedSegments = [];
    this.partialSegment = '';
    this.cancelled = false;
    this.updateSnapshot(VoiceInputState.Idle, EMPTY_TRANSCRIPT, null);
  }

  private setError(code: VoiceRecognitionErrorCode, message: string): void {
    this.teardownRecognition(true);
    this.updateSnapshot(VoiceInputState.Error, this.currentTranscript(), {
      code,
      message,
    });
  }

  private mapBrowserError(error: string): VoiceRecognitionError {
    switch (error) {
      case 'not-allowed':
      case 'service-not-allowed':
        return {
          code: error as VoiceRecognitionErrorCode,
          message:
            'Microphone permission was denied. You can keep typing your message.',
        };
      case 'no-speech':
        return {
          code: 'no-speech',
          message: 'No speech detected. Try again or type your message.',
        };
      case 'audio-capture':
        return {
          code: 'audio-capture',
          message: 'Microphone is unavailable. Check your device settings.',
        };
      case 'network':
        return {
          code: 'network',
          message: 'Voice recognition failed due to a network error.',
        };
      case 'aborted':
        return {
          code: 'aborted',
          message: 'Voice input was cancelled.',
        };
      default:
        return {
          code: 'unknown',
          message: 'Voice input failed. Please try again or type your message.',
        };
    }
  }

  private getRecognitionConstructor(): SpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') {
      return null;
    }
    // Prefer explicit assignment (allows tests to inject a mock).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
  }

  private buildSnapshot(
    state: VoiceInputState,
    transcript: VoiceTranscript,
    error: VoiceRecognitionError | null,
  ): VoiceInputSnapshot {
    return {
      supported: this.isSupported(),
      state,
      transcript,
      error,
      locale: this.preferences.getLocale(),
    };
  }

  private updateSnapshot(
    state: VoiceInputState,
    transcript: VoiceTranscript,
    error: VoiceRecognitionError | null,
  ): void {
    this.snapshotSubject.next(this.buildSnapshot(state, transcript, error));
  }
}
