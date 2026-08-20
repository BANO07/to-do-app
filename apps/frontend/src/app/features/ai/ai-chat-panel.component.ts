import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, Subscription, takeUntil, finalize } from 'rxjs';
import { AiService } from '../../core/services/ai.service';
import {
  AiAttachment,
  AiConversation,
  AiMessage,
  AiPendingConfirmation,
  AiToolCallResult,
} from '../../core/models/app.models';
import { AiConfirmationCardComponent } from './ai-confirmation-card.component';
import { UiShortcutService } from '../../core/services/ui-shortcut.service';
import { VoiceInputService } from './voice/voice-input.service';
import { VoiceOutputService } from './voice/voice-output.service';
import { VoicePreferencesService } from './voice/voice-preferences.service';
import {
  AI_MESSAGE_MAX_LENGTH,
  VOICE_LOCALE_OPTIONS,
  VoiceInputSnapshot,
  VoiceInputState,
} from './voice/voice.types';

const STARTER_PROMPTS = [
  'Plan my day',
  "What's overdue?",
  'What should I work on first?',
  'How productive was I this week?',
  'Create a high priority task to submit the report Friday',
  'Set a reminder 30 minutes before my meeting',
];

const CONFIRMATION_TTS_PROMPT =
  'Please confirm this action on screen.';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.csv', '.png', '.jpg', '.jpeg', '.webp'];

const MAX_FILE_SIZE_MB = 10;

@Component({
  selector: 'app-ai-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, AiConfirmationCardComponent],
  providers: [VoiceInputService, VoiceOutputService, VoicePreferencesService],
  template: `
    @if (open) {
      <div class="ai-panel-backdrop" (click)="close()" aria-hidden="true"></div>
      <aside class="ai-panel glass-panel" role="dialog" aria-label="AI assistant">
        <header class="ai-panel__header">
          <div>
            <strong>AI Assistant</strong>
            @if (usage) {
              <span>{{ usage.remaining }} of {{ usage.dailyLimit }} requests left today</span>
            }
          </div>
          <div class="ai-panel__header-actions">
            @if (voiceInputSupported) {
              <label class="ai-panel__locale">
                <span class="sr-only">Voice language</span>
                <select
                  [ngModel]="voiceLocale"
                  (ngModelChange)="onVoiceLocaleChange($event)"
                  [disabled]="micBusy"
                >
                  @for (locale of voiceLocaleOptions; track locale) {
                    <option [value]="locale">{{ locale }}</option>
                  }
                </select>
              </label>
            }
            <button
              type="button"
              class="btn-icon"
              [class.ai-panel__tts--off]="!ttsEnabled"
              [attr.aria-label]="ttsEnabled ? 'Disable voice responses' : 'Enable voice responses'"
              [attr.aria-pressed]="ttsEnabled"
              [disabled]="!voiceOutputSupported"
              (click)="toggleTts()"
            >
              {{ ttsEnabled ? '🔊' : '🔇' }}
            </button>
            <button type="button" class="btn btn--ghost" (click)="startNewConversation()">
              New chat
            </button>
            <button type="button" class="btn-icon" (click)="close()" aria-label="Close AI panel">
              ✕
            </button>
          </div>
        </header>

        <div
          class="sr-only"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ voiceLiveStatus }}
        </div>

        <div class="ai-panel__body">
          <section class="ai-panel__conversations" aria-label="Conversations">
            @if (conversationsLoading) {
              <p class="ai-panel__state">Loading conversations…</p>
            } @else if (conversations.length === 0) {
              <p class="ai-panel__state">No conversations yet.</p>
            } @else {
              @for (conversation of conversations; track conversation.id) {
                <button
                  type="button"
                  class="ai-panel__conversation"
                  [class.ai-panel__conversation--active]="conversation.id === activeConversationId"
                  (click)="selectConversation(conversation.id)"
                >
                  <span>{{ conversation.title || 'New conversation' }}</span>
                  <small>{{ relativeTime(conversation.updatedAt) }}</small>
                </button>
              }
            }
          </section>

          <section class="ai-panel__chat">
            @if (!activeConversationId) {
              <div class="ai-panel__empty">
                <h3>Ask about your tasks</h3>
                <p>Get help planning, reviewing, and updating your todo list.</p>
                <div class="ai-panel__prompts">
                  @for (prompt of starterPrompts; track prompt) {
                    <button type="button" class="btn btn--ghost" (click)="usePrompt(prompt)">
                      {{ prompt }}
                    </button>
                  }
                </div>
              </div>
            } @else {
              <div class="ai-panel__messages" #messagesContainer>
                @if (messagesLoading) {
                  <p class="ai-panel__state">Loading messages…</p>
                } @else if (messages.length === 0) {
                  <p class="ai-panel__state">Send a message to start this conversation.</p>
                } @else {
                  @for (message of messages; track message.id) {
                    <article
                      class="ai-panel__message"
                      [class.ai-panel__message--user]="message.role === 'USER'"
                      [class.ai-panel__message--assistant]="message.role === 'ASSISTANT'"
                      [class.ai-panel__message--tool]="message.role === 'TOOL'"
                    >
                      @if (message.role === 'TOOL') {
                        <span class="ai-panel__tool-badge">
                          {{ message.toolName || 'Tool' }}
                          ·
                          {{ message.toolStatus === 'success' ? 'Done' : 'Failed' }}
                        </span>
                        <p>{{ formatToolMessage(message) }}</p>
                      } @else if (message.role === 'ASSISTANT') {
                        <div
                          class="ai-panel__message-content"
                          [innerHTML]="formatAssistantContent(message.content)"
                        ></div>
                      } @else {
                        <p>{{ message.content }}</p>
                      }
                    </article>
                  }
                }

                @if (pendingConfirmation) {
                  <app-ai-confirmation-card
                    [title]="pendingConfirmation.title"
                    [description]="pendingConfirmation.description"
                    [busy]="confirming"
                    (confirmed)="confirmPending()"
                    (cancelled)="pendingConfirmation = null"
                  />
                }

                @if (latestToolCalls.length > 0 && !pendingConfirmation) {
                  <div class="ai-panel__tool-results">
                    @for (toolCall of latestToolCalls; track toolCall.toolCallId || toolCall.toolName) {
                      <div class="ai-panel__tool-result">
                        <span>{{ toolCall.toolName }}</span>
                        <p>{{ toolCall.summary }}</p>
                      </div>
                    }
                  </div>
                }

                @if (sending) {
                  <p class="ai-panel__state">Thinking…</p>
                }
                @if (errorMessage) {
                  <p class="ai-panel__state ai-panel__state--error">{{ errorMessage }}</p>
                }
                @if (voiceErrorMessage) {
                  <p class="ai-panel__state ai-panel__state--error">{{ voiceErrorMessage }}</p>
                }
              </div>
            }

            <footer class="ai-panel__composer">
              @if (voiceListening || voiceTranscribing) {
                <div class="ai-panel__voice-status" aria-hidden="true">
                  @if (voiceListening) {
                    <span class="ai-panel__voice-indicator ai-panel__voice-indicator--active">🎙 Listening…</span>
                  }
                  @if (voiceTranscribing) {
                    <span class="ai-panel__voice-indicator">Transcribing…</span>
                  }
                  @if (voiceSnapshot.transcript.current) {
                    <p class="ai-panel__voice-preview">"{{ voiceSnapshot.transcript.current }}"</p>
                  }
                </div>
              }
              @if (ttsSpeaking) {
                <p class="ai-panel__voice-indicator">🔊 Speaking…</p>
              }

              @if (composerAttachments.length > 0) {
                <div class="ai-panel__attachments" aria-label="Pending attachments">
                  @for (att of composerAttachments; track att.id) {
                    <div class="ai-panel__attachment" [class.ai-panel__attachment--uploading]="att.status === 'UPLOADING'" [class.ai-panel__attachment--failed]="att.status === 'FAILED'">
                      <span class="ai-panel__attachment-icon">{{ attachmentIcon(att.mimeType) }}</span>
                      <span class="ai-panel__attachment-name" [title]="att.originalFilename">{{ att.originalFilename }}</span>
                      <span class="ai-panel__attachment-size">{{ formatSize(att.sizeBytes) }}</span>
                      @if (att.status === 'UPLOADING') {
                        <span class="ai-panel__attachment-status">Uploading…</span>
                      } @else if (att.status === 'FAILED') {
                        <span class="ai-panel__attachment-status ai-panel__attachment-status--failed">Failed</span>
                      }
                      <button
                        type="button"
                        class="btn-icon ai-panel__attachment-remove"
                        [attr.aria-label]="'Remove ' + att.originalFilename"
                        [disabled]="sending || confirming"
                        (click)="removeComposerAttachment(att)"
                      >✕</button>
                    </div>
                  }
                </div>
              }
              @if (attachmentError) {
                <p class="ai-panel__state ai-panel__state--error">{{ attachmentError }}</p>
              }

              <div class="ai-panel__composer-row">
                <input
                  #fileInput
                  type="file"
                  class="sr-only"
                  [accept]="allowedFileTypes"
                  [disabled]="!activeConversationId || uploading || sending || confirming"
                  (change)="onFileSelected($event)"
                  aria-hidden="true"
                  tabindex="-1"
                />
                <button
                  type="button"
                  class="btn-icon ai-panel__attach"
                  aria-label="Attach file"
                  [disabled]="!activeConversationId || uploading || sending || confirming"
                  [title]="activeConversationId ? 'Attach a file to this conversation' : 'Start a conversation to attach files'"
                  (click)="triggerFileInput()"
                >
                  📎
                </button>
                <button
                  type="button"
                  class="btn-icon ai-panel__mic"
                  [class.ai-panel__mic--active]="voiceListening"
                  [attr.aria-label]="voiceListening ? 'Stop voice input' : 'Start voice input'"
                  [disabled]="isMicDisabled"
                  [title]="micTooltip"
                  (mousedown)="onMicPress($event)"
                  (mouseup)="onMicRelease($event)"
                  (mouseleave)="onMicRelease($event)"
                  (touchstart)="onMicPress($event)"
                  (touchend)="onMicRelease($event)"
                  (touchcancel)="onMicRelease($event)"
                >
                  🎙
                </button>
                <textarea
                  #composer
                  rows="3"
                  placeholder="Ask about your tasks…"
                  [(ngModel)]="draft"
                  [disabled]="sending || confirming || !providerConfigured"
                  (keydown)="onComposerKeydown($event)"
                ></textarea>
                @if (sending) {
                  <button
                    type="button"
                    class="btn btn--stop"
                    aria-label="Stop generating"
                    title="Stop generating"
                    (click)="stopGenerating()"
                  >
                    <span aria-hidden="true">■</span>
                    Stop
                  </button>
                } @else {
                  <button
                    type="button"
                    class="btn btn--primary"
                    [disabled]="!canSend"
                    (click)="send()"
                  >
                    Send
                  </button>
                }
              </div>
              @if (draftTooLong) {
                <p class="ai-panel__state ai-panel__state--error">
                  Voice input is too long. Please shorten it before sending.
                </p>
              }
            </footer>
            @if (!providerConfigured) {
              <p class="ai-panel__state ai-panel__state--error">
                AI is not configured on the server.
              </p>
            }
            @if (!voiceInputSupported) {
              <p class="ai-panel__state">
                Voice input is not supported in this browser. You can still type your message.
              </p>
            }
          </section>
        </div>
      </aside>
    }
  `,
  styles: [
    `
      .ai-panel-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.35);
        z-index: 850;
      }
      .ai-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: min(920px, 100vw);
        height: 100vh;
        z-index: 860;
        display: flex;
        flex-direction: column;
        border-left: 1px solid var(--border);
        background: var(--surface);
        box-shadow: var(--shadow-lg);
      }
      .ai-panel__header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--border);
      }
      .ai-panel__header span {
        display: block;
        color: var(--text-muted);
        font-size: 0.75rem;
      }
      .ai-panel__header-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .ai-panel__locale select {
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 0.35rem 0.5rem;
        background: var(--surface-muted);
        font-size: 0.75rem;
      }
      .ai-panel__tts--off {
        opacity: 0.65;
      }
      .ai-panel__body {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: 220px 1fr;
      }
      .ai-panel__conversations {
        border-right: 1px solid var(--border);
        padding: 0.75rem;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .ai-panel__conversation {
        border: 1px solid transparent;
        background: transparent;
        text-align: left;
        border-radius: 10px;
        padding: 0.65rem 0.75rem;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .ai-panel__conversation small {
        color: var(--text-muted);
        font-size: 0.7rem;
      }
      .ai-panel__conversation--active,
      .ai-panel__conversation:hover {
        background: var(--primary-soft);
        border-color: color-mix(in srgb, var(--primary) 25%, transparent);
      }
      .ai-panel__chat {
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
      }
      .ai-panel__messages {
        flex: 1;
        overflow: auto;
        padding: 1rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .ai-panel__message {
        max-width: 85%;
        border-radius: 14px;
        padding: 0.75rem 0.875rem;
        background: var(--surface-muted);
      }
      .ai-panel__message p {
        margin: 0;
        white-space: pre-wrap;
      }
      .ai-panel__message-content {
        white-space: normal;
      }
      .ai-panel__message-content h4 {
        margin: 0 0 0.35rem;
        font-size: 0.95rem;
      }
      .ai-panel__message-content ol,
      .ai-panel__message-content ul {
        margin: 0.35rem 0 0;
        padding-left: 1.25rem;
      }
      .ai-panel__message-content li + li {
        margin-top: 0.25rem;
      }
      .ai-panel__message-content p {
        margin: 0.35rem 0 0;
      }
      .ai-panel__message-content strong {
        font-weight: 600;
      }
      .ai-panel__message--user {
        align-self: flex-end;
        background: var(--primary-soft);
      }
      .ai-panel__message--tool {
        align-self: stretch;
        max-width: 100%;
        border: 1px dashed var(--border);
      }
      .ai-panel__tool-badge {
        display: inline-block;
        margin-bottom: 0.35rem;
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .ai-panel__tool-results {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .ai-panel__tool-result {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 0.65rem 0.75rem;
        background: var(--surface-muted);
      }
      .ai-panel__tool-result span {
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .ai-panel__tool-result p {
        margin: 0.25rem 0 0;
        font-size: 0.875rem;
      }
      .ai-panel__composer {
        border-top: 1px solid var(--border);
        padding: 0.875rem 1.25rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .ai-panel__composer-row {
        display: grid;
        grid-template-columns: auto auto 1fr auto;
        gap: 0.75rem;
        align-items: end;
      }
      .ai-panel__attach {
        align-self: end;
        margin-bottom: 0.35rem;
      }
      .ai-panel__attachments {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        padding: 0.5rem 0;
        border-top: 1px solid var(--border);
      }
      .ai-panel__attachment {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.375rem 0.5rem;
        border-radius: 8px;
        background: var(--surface-muted);
        border: 1px solid var(--border);
        font-size: 0.8125rem;
      }
      .ai-panel__attachment--uploading {
        opacity: 0.7;
      }
      .ai-panel__attachment--failed {
        border-color: var(--danger);
      }
      .ai-panel__attachment-icon {
        font-size: 1rem;
        flex-shrink: 0;
      }
      .ai-panel__attachment-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 200px;
      }
      .ai-panel__attachment-size {
        color: var(--text-muted);
        font-size: 0.75rem;
        flex-shrink: 0;
      }
      .ai-panel__attachment-status {
        font-size: 0.75rem;
        color: var(--text-muted);
        flex-shrink: 0;
      }
      .ai-panel__attachment-status--failed {
        color: var(--danger);
      }
      .ai-panel__attachment-remove {
        flex-shrink: 0;
        font-size: 0.75rem;
        padding: 0.125rem 0.25rem;
      }
      .ai-panel__composer textarea {
        width: 100%;
        resize: vertical;
        min-height: 72px;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 0.75rem;
        background: var(--surface-muted);
      }
      .btn--stop {
        align-self: end;
        margin-bottom: 0.35rem;
        background: var(--surface-muted);
        color: var(--text-primary);
        border: 1px solid var(--border);
        white-space: nowrap;
        gap: 0.4rem;
      }
      .btn--stop:hover {
        border-color: var(--danger);
        color: var(--danger);
        background: color-mix(in srgb, var(--danger) 10%, transparent);
      }
      .btn--stop span {
        font-size: 0.65rem;
        line-height: 1;
      }
      .ai-panel__mic {
        align-self: end;
        margin-bottom: 0.35rem;
      }
      .ai-panel__mic--active {
        color: var(--danger);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--danger) 35%, transparent);
      }
      .ai-panel__voice-status {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .ai-panel__voice-indicator {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--text-muted);
      }
      .ai-panel__voice-indicator--active {
        color: var(--danger);
        font-weight: 600;
      }
      .ai-panel__voice-preview {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--text-muted);
        font-style: italic;
      }
      .ai-panel__empty {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 1.5rem;
        gap: 0.75rem;
      }
      .ai-panel__empty p,
      .ai-panel__state {
        margin: 0;
        color: var(--text-muted);
      }
      .ai-panel__state--error {
        color: var(--danger);
      }
      .ai-panel__prompts {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
      }
      @media (max-width: 768px) {
        .ai-panel__body {
          grid-template-columns: 1fr;
        }
        .ai-panel__conversations {
          display: none;
        }
      }
    `,
  ],
})
export class AiChatPanelComponent implements OnInit, OnDestroy {
  private readonly aiService = inject(AiService);
  private readonly shortcuts = inject(UiShortcutService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdRef = inject(ChangeDetectorRef);
  private readonly voiceInput = inject(VoiceInputService);
  private readonly voiceOutput = inject(VoiceOutputService);
  private readonly voicePreferences = inject(VoicePreferencesService);
  private readonly destroy$ = new Subject<void>();
  /** Active aiChat subscription — unsubscribing aborts the Apollo HTTP request. */
  private activeSendSub: Subscription | null = null;
  /** True when the user intentionally stopped the current generation. */
  private cancelledByUser = false;

  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLElement>;
  @ViewChild('composer') composer?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  open = false;
  draft = '';
  /** True while an aiChat request is in flight (also drives Stop button / Thinking…). */
  sending = false;
  confirming = false;
  messagesLoading = false;
  conversationsLoading = false;
  errorMessage = '';
  voiceErrorMessage = '';
  attachmentError = '';
  voiceLiveStatus = '';
  providerConfigured = true;
  usage: { dailyLimit: number; remaining: number } | null = null;

  conversations: AiConversation[] = [];
  messages: AiMessage[] = [];
  activeConversationId: string | null = null;
  pendingConfirmation: AiPendingConfirmation | null = null;

  /**
   * Pending attachments for the NEXT send only.
   * Independent from conversation history / backend READY inventory.
   * Never assign listAttachments() results into this array.
   */
  composerAttachments: AiAttachment[] = [];
  /**
   * Snapshot of attachments accepted into the current in-flight send.
   * Used to restore the composer only when the request fails before the
   * user message is persisted. Cleared on success / Stop.
   */
  private inFlightSentAttachments: AiAttachment[] | null = null;
  uploading = false;
  latestToolCalls: AiToolCallResult[] = [];

  voiceSnapshot: VoiceInputSnapshot = this.voiceInput.getSnapshot();
  voiceLocale = this.voicePreferences.getLocale();
  ttsEnabled = this.voicePreferences.isTtsEnabled();
  ttsSpeaking = false;
  micPressed = false;

  readonly starterPrompts = STARTER_PROMPTS;
  readonly voiceLocaleOptions = VOICE_LOCALE_OPTIONS;

  get voiceInputSupported(): boolean {
    return this.voiceInput.isSupported();
  }

  get voiceOutputSupported(): boolean {
    return this.voiceOutput.isSupported();
  }

  get voiceListening(): boolean {
    return this.voiceSnapshot.state === VoiceInputState.Listening;
  }

  get voiceTranscribing(): boolean {
    return this.voiceSnapshot.state === VoiceInputState.Transcribing;
  }

  get micBusy(): boolean {
    return (
      this.sending ||
      this.confirming ||
      !!this.pendingConfirmation ||
      this.voiceListening ||
      this.voiceTranscribing
    );
  }

  get isMicDisabled(): boolean {
    return (
      !this.voiceInputSupported ||
      this.sending ||
      this.confirming ||
      !!this.pendingConfirmation
    );
  }

  get micTooltip(): string {
    if (!this.voiceInputSupported) {
      return 'Voice input is not supported in this browser';
    }
    if (this.pendingConfirmation) {
      return 'Confirm or cancel the pending action first';
    }
    if (this.sending || this.confirming) {
      return 'Wait for the assistant to finish';
    }
    return this.voiceListening ? 'Release to stop' : 'Hold to speak';
  }

  /** Alias for generation lifecycle — same source of truth as `sending`. */
  get isGenerating(): boolean {
    return this.sending;
  }

  get draftTooLong(): boolean {
    return this.draft.trim().length > AI_MESSAGE_MAX_LENGTH;
  }

  /** READY attachments currently pending in the composer. */
  get readyComposerAttachments(): AiAttachment[] {
    return this.composerAttachments.filter((a) => a.status === 'READY');
  }

  /**
   * Send is allowed when there is text and/or at least one READY composer attachment.
   * Empty text with no pending attachments is invalid.
   */
  get canSend(): boolean {
    if (
      this.sending ||
      this.confirming ||
      !this.providerConfigured ||
      this.draftTooLong ||
      this.uploading
    ) {
      return false;
    }
    const hasText = this.draft.trim().length > 0;
    const hasAttachment = this.readyComposerAttachments.length > 0;
    return hasText || hasAttachment;
  }

  get allowedFileTypes(): string {
    return ALLOWED_MIME_TYPES.join(',');
  }

  ngOnInit(): void {
    this.voiceOutput.setEnabled(this.ttsEnabled);

    this.aiService.panelOpen$
      .pipe(takeUntil(this.destroy$))
      .subscribe((open) => {
        this.open = open;
        if (open) {
          this.bootstrap();
        } else {
          this.voiceInput.cancel();
          this.voiceOutput.cancel();
        }
      });

    this.shortcuts.closePanel$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.open) {
          this.close();
        }
      });

    this.voiceInput.snapshot$
      .pipe(takeUntil(this.destroy$))
      .subscribe((snapshot) => {
        this.voiceSnapshot = snapshot;
        this.updateVoiceLiveStatus();

        if (snapshot.state === VoiceInputState.Reviewing && snapshot.transcript.current) {
          this.draft = snapshot.transcript.current;
          this.voiceErrorMessage = '';
          this.voiceInput.acknowledgeReview();
          this.composer?.nativeElement.focus();
        }

        if (snapshot.error) {
          this.voiceErrorMessage = snapshot.error.message;
        }
      });

    this.voiceOutput.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.ttsSpeaking = state.speaking;
        this.ttsEnabled = state.enabled;
        this.updateVoiceLiveStatus();
      });

    this.voicePreferences.preferences$
      .pipe(takeUntil(this.destroy$))
      .subscribe((preferences) => {
        this.voiceLocale = preferences.locale;
      });
  }

  ngOnDestroy(): void {
    this.cancelledByUser = true;
    this.activeSendSub?.unsubscribe();
    this.activeSendSub = null;
    this.voiceInput.cancel();
    this.voiceOutput.cancel();
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !this.open) {
      return;
    }

    if (this.voiceListening || this.voiceTranscribing) {
      event.preventDefault();
      this.voiceInput.cancel();
      return;
    }

    if (this.ttsSpeaking) {
      event.preventDefault();
      this.voiceOutput.cancel();
      return;
    }

    this.close();
  }

  close(): void {
    this.voiceInput.cancel();
    this.voiceOutput.cancel();
    this.aiService.closePanel();
  }

  bootstrap(): void {
    this.errorMessage = '';
    this.voiceErrorMessage = '';
    this.loadUsage();
    this.loadConversations();
    const storedId = this.aiService.getActiveConversationId();
    if (storedId) {
      this.selectConversation(storedId);
    }
  }

  toggleTts(): void {
    this.voiceOutput.setEnabled(!this.voiceOutput.isEnabled());
  }

  onVoiceLocaleChange(locale: string): void {
    this.voicePreferences.setLocale(locale);
    this.voiceInput.setLocale(locale);
  }

  onMicPress(event: Event): void {
    event.preventDefault();
    if (this.isMicDisabled) {
      return;
    }

    if (this.ttsSpeaking) {
      this.voiceOutput.cancel();
    }

    this.micPressed = true;
    this.voiceErrorMessage = '';
    this.voiceInput.start();
  }

  onMicRelease(event: Event): void {
    event.preventDefault();
    if (!this.micPressed) {
      return;
    }

    this.micPressed = false;
    if (this.voiceListening || this.voiceSnapshot.state === VoiceInputState.RequestingMic) {
      this.voiceInput.stop();
    }
  }

  loadUsage(): void {
    this.aiService.getUsage().subscribe({
      next: (usage) => {
        this.usage = usage;
        this.providerConfigured = usage.providerConfigured;
      },
      error: () => {
        this.providerConfigured = false;
      },
    });
  }

  loadConversations(): void {
    this.conversationsLoading = true;
    this.aiService.listConversations().subscribe({
      next: (conversations) => {
        this.conversations = conversations;
        this.conversationsLoading = false;
        if (!this.activeConversationId && conversations.length > 0) {
          this.selectConversation(conversations[0].id);
        }
      },
      error: () => {
        this.conversationsLoading = false;
        this.errorMessage = 'Unable to load conversations.';
      },
    });
  }

  selectConversation(id: string): void {
    this.activeConversationId = id;
    this.aiService.setActiveConversationId(id);
    this.pendingConfirmation = null;
    this.latestToolCalls = [];
    // Composer pending state is session-local — never hydrate it from conversation
    // attachment inventory (that race was reintroducing chips after send).
    this.composerAttachments = [];
    this.attachmentError = '';
    this.voiceOutput.cancel();
    this.loadMessages(id);
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!input) {
      return;
    }
    // Reset the input so the same file can be re-selected after removal/send
    input.value = '';

    if (!file) {
      return;
    }
    if (!this.activeConversationId) {
      return;
    }

    this.attachmentError = '';

    // Client-side validation
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      this.attachmentError = 'Unsupported file type.';
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      this.attachmentError = 'Unsupported file type.';
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      this.attachmentError = `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`;
      return;
    }

    this.uploading = true;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:...;base64," prefix
      const base64 = result.split(',')[1];
      if (!base64 || !this.activeConversationId) {
        this.uploading = false;
        return;
      }

      this.aiService
        .uploadAttachment({
          conversationId: this.activeConversationId,
          filename: file.name,
          mimeType: file.type,
          base64Data: base64,
        })
        .subscribe({
          next: (attachment) => {
            this.uploading = false;
            // Clone so composer state never shares a mutable reference with
            // message/history objects.
            const pending: AiAttachment = { ...attachment };
            this.composerAttachments = [
              ...this.composerAttachments.filter((a) => a.id !== pending.id),
              pending,
            ].filter((a) => a.status !== 'DELETED');
            this.cdRef.markForCheck();
          },
          error: (error) => {
            this.uploading = false;
            this.attachmentError =
              error?.graphQLErrors?.[0]?.message ??
              error?.message ??
              'Unable to upload file.';
            this.cdRef.markForCheck();
          },
        });
    };
    reader.onerror = () => {
      this.uploading = false;
      this.attachmentError = 'Unable to read file.';
    };
    reader.readAsDataURL(file);
  }

  /**
   * Remove a pending composer attachment (user cancelled before send).
   * Soft-deletes the unused upload from the conversation inventory.
   */
  removeComposerAttachment(attachment: AiAttachment): void {
    this.attachmentError = '';
    this.composerAttachments = this.composerAttachments.filter(
      (a) => a.id !== attachment.id,
    );
    this.aiService.deleteAttachment({ id: attachment.id }).subscribe({
      error: () => {
        this.attachmentError = 'Unable to remove attachment.';
      },
    });
  }

  attachmentIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return '🖼';
    }
    if (mimeType === 'application/pdf') {
      return '📄';
    }
    if (mimeType.includes('wordprocessingml')) {
      return '📝';
    }
    if (mimeType === 'text/csv') {
      return '📊';
    }
    return '📎';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  loadMessages(conversationId: string): void {
    this.messagesLoading = true;
    this.aiService.getMessages(conversationId).subscribe({
      next: (page) => {
        this.messages = page.items;
        this.messagesLoading = false;
        this.scrollToBottom();
      },
      error: () => {
        this.messagesLoading = false;
        this.errorMessage = 'Unable to load messages.';
      },
    });
  }

  startNewConversation(): void {
    this.aiService.createConversation().subscribe({
      next: (conversation) => {
        this.conversations = [conversation, ...this.conversations];
        this.selectConversation(conversation.id);
        this.draft = '';
        this.composer?.nativeElement.focus();
      },
      error: () => {
        this.errorMessage = 'Unable to create a conversation.';
      },
    });
  }

  usePrompt(prompt: string): void {
    this.draft = prompt;
    if (!this.activeConversationId) {
      this.startNewConversationAndSend(prompt);
      return;
    }
    void this.send();
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  send(): void {
    if (!this.canSend) {
      return;
    }

    const draftText = this.draft.trim();
    // Snapshot + clone pending attachments BEFORE any state mutation so
    // message history and composer state stay independent.
    const pendingSnapshot = this.readyComposerAttachments.map((a) => ({ ...a }));
    const outgoingMessage = this.buildOutgoingUserContent(draftText, pendingSnapshot);

    if (!this.activeConversationId) {
      this.startNewConversationAndSend(outgoingMessage, pendingSnapshot);
      return;
    }

    this.dispatchMessage(this.activeConversationId, outgoingMessage, pendingSnapshot);
  }

  /**
   * Abort the in-flight aiChat request (Apollo unsubscribe → HTTP abort).
   * Keeps the optimistic user message. Does NOT restore composer attachments
   * (they were already moved into the sent message bubble).
   * Does not surface a generic error.
   */
  stopGenerating(): void {
    if (!this.sending && !this.activeSendSub) {
      return;
    }
    this.cancelledByUser = true;
    this.inFlightSentAttachments = null;
    this.activeSendSub?.unsubscribe();
    this.activeSendSub = null;
    this.sending = false;
    this.errorMessage = '';
    this.cdRef.markForCheck();
  }

  private startNewConversationAndSend(
    outgoingMessage: string,
    pendingSnapshot: AiAttachment[] = [],
  ): void {
    this.aiService.createConversation().subscribe({
      next: (conversation) => {
        this.conversations = [conversation, ...this.conversations];
        this.selectConversation(conversation.id);
        this.dispatchMessage(conversation.id, outgoingMessage, pendingSnapshot);
      },
      error: () => {
        this.errorMessage = 'Unable to create a conversation.';
      },
    });
  }

  private dispatchMessage(
    conversationId: string,
    outgoingMessage: string,
    pendingSnapshot: AiAttachment[] = [],
  ): void {
    // Tear down any prior in-flight send before starting another.
    this.activeSendSub?.unsubscribe();
    this.activeSendSub = null;
    this.cancelledByUser = false;
    this.sending = true;
    this.errorMessage = '';
    this.voiceErrorMessage = '';
    this.attachmentError = '';
    this.pendingConfirmation = null;
    this.latestToolCalls = [];
    this.voiceInput.cancel();
    this.voiceOutput.cancel();

    const previousDraft = this.draft;
    this.draft = '';

    // Capture sent attachments, then clear composer immediately so the chip
    // is not duplicated next to the optimistic user message during Thinking…
    this.inFlightSentAttachments =
      pendingSnapshot.length > 0
        ? pendingSnapshot.map((a) => ({ ...a }))
        : null;
    this.clearComposerPendingAttachments(pendingSnapshot.map((a) => a.id));

    const optimistic: AiMessage = {
      id: `local-${Date.now()}`,
      role: 'USER',
      content: outgoingMessage,
      createdAt: new Date().toISOString(),
    };
    this.messages = [...this.messages, optimistic];
    this.scrollToBottom();

    this.activeSendSub = this.aiService
      .sendMessage({ conversationId, message: outgoingMessage })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.sending = false;
          this.activeSendSub = null;
          this.cdRef.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          // Stop won the race — do not apply a late response.
          if (this.cancelledByUser) {
            return;
          }
          this.inFlightSentAttachments = null;
          this.usage = response.usage ?? this.usage;
          this.conversations = this.conversations.map((item) =>
            item.id === response.conversation.id ? response.conversation : item,
          );
          if (response.assistantMessage) {
            this.messages = [...this.messages, response.assistantMessage];
          }
          this.latestToolCalls = response.toolCalls ?? [];
          this.pendingConfirmation = response.pendingConfirmation ?? null;
          // Composer was already cleared on send; ensure it stays empty.
          this.clearComposerPendingAttachments(pendingSnapshot.map((a) => a.id));
          this.handleAssistantSpeech(
            response.pendingConfirmation,
            response.assistantMessage?.content,
          );
          this.scrollToBottom();
          this.cdRef.markForCheck();
        },
        error: (error) => {
          if (this.isRequestCancellation(error)) {
            // Intentional stop — keep user message; do not restore attachments.
            this.inFlightSentAttachments = null;
            this.errorMessage = '';
            this.cdRef.markForCheck();
            return;
          }

          this.errorMessage =
            error?.graphQLErrors?.[0]?.message ??
            error?.message ??
            'Unable to send message.';
          this.handleSendFailure(conversationId, optimistic, previousDraft, outgoingMessage);
        },
      });
  }

  /**
   * After a failed aiChat request, sync with the server.
   * The backend persists the user message before calling the provider, so a
   * late provider failure must NOT restore already-sent attachments.
   * Restore composer + draft only when the user message was never persisted.
   */
  private handleSendFailure(
    conversationId: string,
    optimistic: AiMessage,
    previousDraft: string,
    outgoingMessage: string,
  ): void {
    const snapshot = this.inFlightSentAttachments;
    this.inFlightSentAttachments = null;

    this.aiService.getMessages(conversationId).subscribe({
      next: (page) => {
        this.messages = page.items;
        const persisted = page.items.some(
          (item) =>
            item.role === 'USER' &&
            (item.content === outgoingMessage ||
              item.content.includes(outgoingMessage) ||
              outgoingMessage.includes(item.content)),
        );

        if (!persisted) {
          // Failure before message creation — allow retry.
          this.draft = previousDraft;
          this.restoreComposerAttachments(snapshot);
        }
        // If persisted: leave composer empty; draft stays cleared.
        this.cdRef.markForCheck();
      },
      error: () => {
        // Cannot sync — fall back to client-side undo for retry.
        this.messages = this.messages.filter((item) => item.id !== optimistic.id);
        this.draft = previousDraft;
        this.restoreComposerAttachments(snapshot);
        this.cdRef.markForCheck();
      },
    });
  }

  private restoreComposerAttachments(snapshot: AiAttachment[] | null): void {
    if (!snapshot?.length) {
      return;
    }
    const existingIds = new Set(this.composerAttachments.map((a) => a.id));
    const toRestore = snapshot
      .filter((a) => !existingIds.has(a.id))
      .map((a) => ({ ...a }));
    if (toRestore.length === 0) {
      return;
    }
    this.composerAttachments = [...this.composerAttachments, ...toRestore];
  }

  private isRequestCancellation(error: unknown): boolean {
    if (this.cancelledByUser) {
      return true;
    }
    if (!error || typeof error !== 'object') {
      return false;
    }
    const err = error as {
      name?: string;
      message?: string;
      networkError?: { name?: string; message?: string };
    };
    const name = err.name ?? err.networkError?.name ?? '';
    const message = `${err.message ?? ''} ${err.networkError?.message ?? ''}`;
    return (
      name === 'AbortError' ||
      /AbortError/i.test(name) ||
      /aborted|cancelled|canceled|Observable cancelled/i.test(message)
    );
  }

  /**
   * Clears pending composer chips after they are accepted into a send
   * (or after a confirmed success). Does NOT delete backend attachment
   * records. Resets the file input so the same file can be selected again.
   */
  private clearComposerPendingAttachments(pendingIds: string[]): void {
    if (pendingIds.length === 0) {
      this.resetFileInput();
      return;
    }

    const idSet = new Set(pendingIds);
    this.composerAttachments = this.composerAttachments.filter(
      (a) => !idSet.has(a.id),
    );
    this.attachmentError = '';
    this.resetFileInput();
  }

  private resetFileInput(): void {
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  /** Persist attachment labels into the user message so history stays visible. */
  private buildOutgoingUserContent(
    text: string,
    pendingSnapshot: AiAttachment[],
  ): string {
    const label = this.formatAttachmentLabel(pendingSnapshot);
    if (text && label) {
      return `${text}\n\n${label}`;
    }
    return text || label;
  }

  private formatAttachmentLabel(pendingSnapshot: AiAttachment[]): string {
    if (pendingSnapshot.length === 0) {
      return '';
    }
    if (pendingSnapshot.length === 1) {
      return `📎 ${pendingSnapshot[0].originalFilename}`;
    }
    return pendingSnapshot.map((a) => `📎 ${a.originalFilename}`).join('\n');
  }

  confirmPending(): void {
    if (!this.pendingConfirmation || this.confirming) {
      return;
    }

    this.confirming = true;
    this.voiceOutput.cancel();
    this.aiService
      .confirmAction({ confirmationId: this.pendingConfirmation.id })
      .subscribe({
        next: (response) => {
          this.confirming = false;
          this.pendingConfirmation = null;
          if (response.assistantMessage) {
            this.messages = [...this.messages, response.assistantMessage];
            this.handleAssistantSpeech(null, response.assistantMessage.content);
          }
          this.latestToolCalls = [response.toolResult];
          this.scrollToBottom();
        },
        error: () => {
          this.confirming = false;
          this.errorMessage = 'Unable to confirm that action.';
        },
      });
  }

  private handleAssistantSpeech(
    pendingConfirmation: AiPendingConfirmation | null | undefined,
    assistantContent?: string | null,
  ): void {
    if (!this.voiceOutput.isEnabled()) {
      return;
    }

    if (pendingConfirmation) {
      this.voiceOutput.speak(CONFIRMATION_TTS_PROMPT);
      return;
    }

    if (assistantContent?.trim()) {
      this.voiceOutput.speak(assistantContent);
    }
  }

  formatToolMessage(message: AiMessage): string {
    try {
      const parsed = JSON.parse(message.content) as { summary?: string };
      return parsed.summary ?? 'Tool finished.';
    } catch {
      return message.content;
    }
  }

  formatAssistantContent(content: string): SafeHtml {
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const withHeadings = escaped.replace(
      /^## (.+)$/gm,
      '<h4>$1</h4>',
    );

    const withBold = withHeadings.replace(
      /\*\*(.+?)\*\*/g,
      '<strong>$1</strong>',
    );

    const lines = withBold.split('\n');
    const htmlParts: string[] = [];
    let listType: 'ol' | 'ul' | null = null;

    const closeList = () => {
      if (listType) {
        htmlParts.push(`</${listType}>`);
        listType = null;
      }
    };

    for (const line of lines) {
      const numbered = line.match(/^\d+\.\s+(.+)$/);
      const bulleted = line.match(/^[-*]\s+(.+)$/);

      if (numbered) {
        if (listType !== 'ol') {
          closeList();
          listType = 'ol';
          htmlParts.push('<ol>');
        }
        htmlParts.push(`<li>${numbered[1]}</li>`);
        continue;
      }

      if (bulleted) {
        if (listType !== 'ul') {
          closeList();
          listType = 'ul';
          htmlParts.push('<ul>');
        }
        htmlParts.push(`<li>${bulleted[1]}</li>`);
        continue;
      }

      closeList();
      if (line.trim()) {
        htmlParts.push(`<p>${line}</p>`);
      }
    }

    closeList();
    return this.sanitizer.bypassSecurityTrustHtml(htmlParts.join(''));
  }

  relativeTime(value: string): string {
    const diffMs = new Date(value).getTime() - Date.now();
    const minutes = Math.round(diffMs / 60000);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      minutes,
      'minute',
    );
  }

  private updateVoiceLiveStatus(): void {
    if (this.voiceListening) {
      this.voiceLiveStatus = 'Listening';
      return;
    }
    if (this.voiceTranscribing) {
      this.voiceLiveStatus = 'Transcribing';
      return;
    }
    if (this.ttsSpeaking) {
      this.voiceLiveStatus = 'Speaking';
      return;
    }
    if (this.sending) {
      this.voiceLiveStatus = 'Waiting for assistant';
      return;
    }
    if (this.pendingConfirmation) {
      this.voiceLiveStatus = 'Awaiting confirmation';
      return;
    }
    if (this.voiceErrorMessage) {
      this.voiceLiveStatus = this.voiceErrorMessage;
      return;
    }
    this.voiceLiveStatus = '';
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const element = this.messagesContainer?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }
}
