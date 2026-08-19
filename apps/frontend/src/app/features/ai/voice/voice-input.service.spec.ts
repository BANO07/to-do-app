import { VoiceInputService } from './voice-input.service';
import { VoicePreferencesService } from './voice-preferences.service';
import { VoiceInputState } from './voice.types';

describe('VoiceInputService', () => {
  let service: VoiceInputService;
  let preferences: VoicePreferencesService;
  let recognitionInstance: MockSpeechRecognition;
  let RecognitionCtor: jasmine.Spy;

  class MockSpeechRecognition {
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onstart: ((event: Event) => void) | null = null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
    onend: ((event: Event) => void) | null = null;
    start = jasmine.createSpy('start').and.callFake(() => {
      this.onstart?.(new Event('start'));
    });
    stop = jasmine.createSpy('stop').and.callFake(() => {
      this.onend?.(new Event('end'));
    });
    abort = jasmine.createSpy('abort').and.callFake(() => {
      this.onerror?.({
        error: 'aborted',
        message: 'aborted',
      } as SpeechRecognitionErrorEvent);
      this.onend?.(new Event('end'));
    });
  }

  function makeRecognitionInstance(): MockSpeechRecognition {
    recognitionInstance = new MockSpeechRecognition();
    return recognitionInstance;
  }

  beforeEach(() => {
    localStorage.clear();
    recognitionInstance = new MockSpeechRecognition();
    RecognitionCtor = jasmine.createSpy('SpeechRecognition').and.callFake(makeRecognitionInstance);
    preferences = new VoicePreferencesService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  function createServiceWithMic(): VoiceInputService {
    return new VoiceInputService(
      preferences,
      () => RecognitionCtor() as SpeechRecognition,
    );
  }

  function createServiceWithoutMic(): VoiceInputService {
    return new VoiceInputService(preferences, null);
  }

  function emitResult(transcript: string, isFinal: boolean): void {
    const alternative = { transcript, confidence: 1 } as SpeechRecognitionAlternative;
    const result = {
      isFinal,
      length: 1,
      item: () => alternative,
      0: alternative,
    } as unknown as SpeechRecognitionResult;

    const results = {
      length: 1,
      item: () => result,
      0: result,
    } as unknown as SpeechRecognitionResultList;

    recognitionInstance.onresult?.({
      resultIndex: 0,
      results,
    } as SpeechRecognitionEvent);
  }

  it('reports unsupported when no factory is provided and no browser API is accessible', () => {
    // Skip if browser provides native SpeechRecognition (Chrome, Edge).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) {
      pending('Native SpeechRecognition available in this browser — test only meaningful without it');
      return;
    }
    service = createServiceWithoutMic();
    expect(service.isSupported()).toBeFalse();
    expect(service.getSnapshot().state).toBe(VoiceInputState.Unsupported);
  });

  it('reports supported when factory is provided', () => {
    service = createServiceWithMic();
    expect(service.isSupported()).toBeTrue();
    expect(service.getSnapshot().state).toBe(VoiceInputState.Idle);
  });

  it('starts recognition with locale and settings', () => {
    preferences.setLocale('en-IN');
    service = createServiceWithMic();
    service.start();

    expect(RecognitionCtor).toHaveBeenCalled();
    expect(recognitionInstance.interimResults).toBeTrue();
    expect(recognitionInstance.continuous).toBeFalse();
    expect(recognitionInstance.maxAlternatives).toBe(1);
    expect(recognitionInstance.start).toHaveBeenCalled();
    expect(recognitionInstance.lang).toBe('en-IN');
  });

  it('prevents duplicate start while active', () => {
    service = createServiceWithMic();
    service.start();
    service.start();
    expect(RecognitionCtor).toHaveBeenCalledTimes(1);
  });

  it('captures interim and final transcripts without duplication', () => {
    service = createServiceWithMic();
    service.start();
    emitResult('Create a task', false);
    emitResult('Create a task', true);
    service.stop();

    expect(service.getSnapshot().transcript.current).toBe('Create a task');
    expect(service.getSnapshot().state).toBe(VoiceInputState.Reviewing);
  });

  it('maps permission denied errors', () => {
    service = createServiceWithMic();
    service.start();
    recognitionInstance.onerror?.({
      error: 'not-allowed',
      message: 'denied',
    } as SpeechRecognitionErrorEvent);

    expect(service.getSnapshot().error?.code).toBe('not-allowed');
    expect(service.getSnapshot().error?.message).toContain('permission');
  });

  it('maps no-speech errors on empty end', () => {
    service = createServiceWithMic();
    service.start();
    service.stop();
    expect(service.getSnapshot().error?.code).toBe('no-speech');
  });

  it('maps audio-capture and network errors', () => {
    service = createServiceWithMic();
    service.start();
    recognitionInstance.onerror?.({
      error: 'audio-capture',
      message: 'capture',
    } as SpeechRecognitionErrorEvent);
    expect(service.getSnapshot().error?.code).toBe('audio-capture');

    service.start();
    recognitionInstance.onerror?.({
      error: 'network',
      message: 'network',
    } as SpeechRecognitionErrorEvent);
    expect(service.getSnapshot().error?.code).toBe('network');
  });

  it('cancel aborts active recognition safely', () => {
    service = createServiceWithMic();
    service.start();
    service.cancel();
    expect(recognitionInstance.abort).toHaveBeenCalled();
    expect(service.getSnapshot().state).toBe(VoiceInputState.Idle);
  });

  it('acknowledges review and returns to idle', () => {
    service = createServiceWithMic();
    service.start();
    emitResult('Plan my day', true);
    service.stop();
    expect(service.getSnapshot().state).toBe(VoiceInputState.Reviewing);
    service.acknowledgeReview();
    expect(service.getSnapshot().state).toBe(VoiceInputState.Idle);
  });
});
