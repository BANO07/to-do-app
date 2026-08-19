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

const STARTER_PROMPTS = [
  "What's on my plate today?",
  'What tasks are overdue?',
  'How is my productivity today?',
  'Create a task for preparing a presentation',
  'Plan my tasks for today',
];

@Component({
  selector: 'app-ai-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, AiConfirmationCardComponent],
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
            <button type="button" class="btn btn--ghost" (click)="startNewConversation()">
              New chat
            </button>
            <button type="button" class="btn-icon" (click)="close()" aria-label="Close AI panel">
              ✕
            </button>
          </div>
        </header>

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
              </div>
            }

            <footer class="ai-panel__composer">
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
                [disabled]="sending || confirming || !draft.trim() || !providerConfigured"
                (click)="send()"
              >
                Send
              </button>
            </footer>
            @if (!providerConfigured) {
              <p class="ai-panel__state ai-panel__state--error">
                AI is not configured on the server.
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
        display: grid;
        grid-template-columns: 1fr auto;
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
  providerConfigured = true;
  usage: { dailyLimit: number; remaining: number } | null = null;

  conversations: AiConversation[] = [];
  messages: AiMessage[] = [];
  activeConversationId: string | null = null;
  pendingConfirmation: AiPendingConfirmation | null = null;
  latestToolCalls: AiToolCallResult[] = [];

  readonly starterPrompts = STARTER_PROMPTS;

  ngOnInit(): void {
    this.aiService.panelOpen$
      .pipe(takeUntil(this.destroy$))
      .subscribe((open) => {
        this.open = open;
        if (open) {
          this.bootstrap();
        }
      });

    this.shortcuts.closePanel$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.open) {
          this.close();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.open) {
      this.close();
    }
  }

  close(): void {
    this.aiService.closePanel();
  }

  bootstrap(): void {
    this.errorMessage = '';
    this.loadUsage();
    this.loadConversations();
    const storedId = this.aiService.getActiveConversationId();
    if (storedId) {
      this.selectConversation(storedId);
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
    if (!message || this.sending) {
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
    this.pendingConfirmation = null;
    this.latestToolCalls = [];
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
    this.aiService
      .confirmAction({ confirmationId: this.pendingConfirmation.id })
      .subscribe({
        next: (response) => {
          this.confirming = false;
          this.pendingConfirmation = null;
          if (response.assistantMessage) {
            this.messages = [...this.messages, response.assistantMessage];
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

  formatToolMessage(message: AiMessage): string {
    try {
      const parsed = JSON.parse(message.content) as { summary?: string };
      return parsed.summary ?? 'Tool finished.';
    } catch {
      return message.content;
    }
  }

  relativeTime(value: string): string {
    const diffMs = new Date(value).getTime() - Date.now();
    const minutes = Math.round(diffMs / 60000);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      minutes,
      'minute',
    );
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
