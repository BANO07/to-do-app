export enum VoiceInputState {
  Idle = 'Idle',
  CheckingSupport = 'CheckingSupport',
  Unsupported = 'Unsupported',
  RequestingMic = 'RequestingMic',
  Listening = 'Listening',
  Transcribing = 'Transcribing',
  Reviewing = 'Reviewing',
  Error = 'Error',
}

export enum VoicePanelState {
  Idle = 'Idle',
  Listening = 'Listening',
  Transcribing = 'Transcribing',
  Reviewing = 'Reviewing',
  Sending = 'Sending',
  WaitingAssistant = 'WaitingAssistant',
  Speaking = 'Speaking',
  AwaitingConfirmation = 'AwaitingConfirmation',
  Confirming = 'Confirming',
  Unsupported = 'Unsupported',
  Error = 'Error',
}

export type VoiceRecognitionErrorCode =
  | 'unsupported'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'aborted'
  | 'unknown';

export interface VoiceRecognitionError {
  code: VoiceRecognitionErrorCode;
  message: string;
}

export interface VoiceTranscript {
  partial: string;
  final: string;
  current: string;
}

export interface VoiceConfig {
  locale: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
}

export interface VoicePreferences {
  locale: string;
  ttsEnabled: boolean;
}

export interface VoiceOutputState {
  speaking: boolean;
  enabled: boolean;
  supported: boolean;
}

export interface VoiceInputSnapshot {
  supported: boolean;
  state: VoiceInputState;
  transcript: VoiceTranscript;
  error: VoiceRecognitionError | null;
  locale: string;
}

export const DEFAULT_VOICE_LOCALE = 'en-US';

export const VOICE_LOCALE_OPTIONS: readonly string[] = [
  'en-US',
  'en-IN',
  'en-GB',
  'hi-IN',
  'ta-IN',
  'te-IN',
  'mr-IN',
  'fr-FR',
  'de-DE',
  'es-ES',
];

export const AI_MESSAGE_MAX_LENGTH = 4000;

export const TTS_MAX_CHARACTERS = 2000;
