import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { AiService } from '../../core/services/ai.service';
import {
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
              <div class="ai-panel__composer-row">
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
                <button
                  type="button"
                  class="btn btn--primary"
                  [disabled]="sending || confirming || !draft.trim() || !providerConfigured || draftTooLong"
                  (click)="send()"
                >
                  Send
                </button>
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
        grid-template-columns: auto 1fr auto;
        gap: 0.75rem;
        align-items: end;
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
  private readonly voiceInput = inject(VoiceInputService);
  private readonly voiceOutput = inject(VoiceOutputService);
  private readonly voicePreferences = inject(VoicePreferencesService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLElement>;
  @ViewChild('composer') composer?: ElementRef<HTMLTextAreaElement>;

  open = false;
  draft = '';
  sending = false;
  confirming = false;
  messagesLoading = false;
  conversationsLoading = false;
  errorMessage = '';
  voiceErrorMessage = '';
  voiceLiveStatus = '';
  providerConfigured = true;
  usage: { dailyLimit: number; remaining: number } | null = null;

  conversations: AiConversation[] = [];
  messages: AiMessage[] = [];
  activeConversationId: string | null = null;
  pendingConfirmation: AiPendingConfirmation | null = null;
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

  get draftTooLong(): boolean {
    return this.draft.trim().length > AI_MESSAGE_MAX_LENGTH;
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
    this.voiceOutput.cancel();
    this.loadMessages(id);
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
    const message = this.draft.trim();
    if (!message || this.sending || this.draftTooLong) {
      return;
    }

    if (!this.activeConversationId) {
      this.startNewConversationAndSend(message);
      return;
    }

    this.dispatchMessage(this.activeConversationId, message);
  }

  private startNewConversationAndSend(message: string): void {
    this.aiService.createConversation().subscribe({
      next: (conversation) => {
        this.conversations = [conversation, ...this.conversations];
        this.selectConversation(conversation.id);
        this.dispatchMessage(conversation.id, message);
      },
      error: () => {
        this.errorMessage = 'Unable to create a conversation.';
      },
    });
  }

  private dispatchMessage(conversationId: string, message: string): void {
    this.sending = true;
    this.errorMessage = '';
    this.voiceErrorMessage = '';
    this.pendingConfirmation = null;
    this.latestToolCalls = [];
    this.voiceInput.cancel();
    this.voiceOutput.cancel();
    this.draft = '';

    const optimistic: AiMessage = {
      id: `local-${Date.now()}`,
      role: 'USER',
      content: message,
      createdAt: new Date().toISOString(),
    };
    this.messages = [...this.messages, optimistic];
    this.scrollToBottom();

    this.aiService.sendMessage({ conversationId, message }).subscribe({
      next: (response) => {
        this.sending = false;
        this.usage = response.usage ?? this.usage;
        this.conversations = this.conversations.map((item) =>
          item.id === response.conversation.id ? response.conversation : item,
        );
        if (response.assistantMessage) {
          this.messages = [...this.messages, response.assistantMessage];
        }
        this.latestToolCalls = response.toolCalls ?? [];
        this.pendingConfirmation = response.pendingConfirmation ?? null;
        this.handleAssistantSpeech(response.pendingConfirmation, response.assistantMessage?.content);
        this.scrollToBottom();
      },
      error: (error) => {
        this.sending = false;
        this.errorMessage =
          error?.graphQLErrors?.[0]?.message ??
          error?.message ??
          'Unable to send message.';
        this.messages = this.messages.filter((item) => item.id !== optimistic.id);
        this.draft = message;
      },
    });
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
