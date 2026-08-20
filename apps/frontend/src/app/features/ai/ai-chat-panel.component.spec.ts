import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AiChatPanelComponent } from './ai-chat-panel.component';
import { AiService } from '../../core/services/ai.service';
import { UiShortcutService } from '../../core/services/ui-shortcut.service';
import { VoiceInputService } from './voice/voice-input.service';
import { VoiceOutputService } from './voice/voice-output.service';
import { VoicePreferencesService } from './voice/voice-preferences.service';
import {
  VoiceInputSnapshot,
  VoiceInputState,
} from './voice/voice.types';
import { AiAttachment } from '../../core/models/app.models';

describe('AiChatPanelComponent', () => {
  let fixture: ComponentFixture<AiChatPanelComponent>;
  let component: AiChatPanelComponent;

  const panelOpenSubject = new Subject<boolean>();
  const snapshotSubject = new Subject<VoiceInputSnapshot>();
  const outputStateSubject = new Subject<{
    speaking: boolean;
    enabled: boolean;
    supported: boolean;
  }>();

  const readyAttachment = (overrides: Partial<AiAttachment> = {}): AiAttachment => ({
    id: 'att-1',
    conversationId: 'conv-1',
    originalFilename: 'Single.png',
    mimeType: 'image/png',
    sizeBytes: 1024,
    status: 'READY',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  const successResponse = {
    conversation: {
      id: 'conv-1',
      title: 'Test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    assistantMessage: {
      id: 'msg-1',
      role: 'ASSISTANT' as const,
      content: 'Here is your plan.',
      createdAt: new Date().toISOString(),
    },
    toolCalls: [],
    pendingConfirmation: null,
    completed: true,
    usage: {
      dailyLimit: 20,
      used: 2,
      remaining: 18,
      resetAt: new Date().toISOString(),
      providerConfigured: true,
    },
  };

  const aiService = {
    panelOpen$: panelOpenSubject.asObservable(),
    closePanel: jasmine.createSpy('closePanel'),
    openPanel: jasmine.createSpy('openPanel'),
    getActiveConversationId: jasmine
      .createSpy('getActiveConversationId')
      .and.returnValue('conv-1'),
    setActiveConversationId: jasmine.createSpy('setActiveConversationId'),
    getUsage: jasmine.createSpy('getUsage').and.returnValue(
      of({
        dailyLimit: 20,
        used: 1,
        remaining: 19,
        resetAt: new Date().toISOString(),
        providerConfigured: true,
      }),
    ),
    listConversations: jasmine.createSpy('listConversations').and.returnValue(
      of([
        {
          id: 'conv-1',
          title: 'Test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
    ),
    getMessages: jasmine.createSpy('getMessages').and.returnValue(
      of({ items: [], limit: 50 }),
    ),
    sendMessage: jasmine.createSpy('sendMessage').and.returnValue(of(successResponse)),
    confirmAction: jasmine.createSpy('confirmAction'),
    createConversation: jasmine.createSpy('createConversation'),
    listAttachments: jasmine.createSpy('listAttachments').and.returnValue(
      of([readyAttachment()]),
    ),
    uploadAttachment: jasmine.createSpy('uploadAttachment'),
    deleteAttachment: jasmine
      .createSpy('deleteAttachment')
      .and.returnValue(of(true)),
  };

  const voiceInput = {
    snapshot$: snapshotSubject.asObservable(),
    getSnapshot: jasmine.createSpy('getSnapshot').and.returnValue({
      supported: true,
      state: VoiceInputState.Idle,
      transcript: { partial: '', final: '', current: '' },
      error: null,
      locale: 'en-US',
    }),
    isSupported: jasmine.createSpy('isSupported').and.returnValue(true),
    start: jasmine.createSpy('start'),
    stop: jasmine.createSpy('stop'),
    cancel: jasmine.createSpy('cancel'),
    acknowledgeReview: jasmine.createSpy('acknowledgeReview'),
    setLocale: jasmine.createSpy('setLocale'),
  };

  const voiceOutput = {
    state$: outputStateSubject.asObservable(),
    isSupported: jasmine.createSpy('isSupported').and.returnValue(true),
    isEnabled: jasmine.createSpy('isEnabled').and.returnValue(true),
    isSpeaking: jasmine.createSpy('isSpeaking').and.returnValue(false),
    setEnabled: jasmine.createSpy('setEnabled'),
    speak: jasmine.createSpy('speak'),
    cancel: jasmine.createSpy('cancel'),
  };

  const voicePreferences = {
    getLocale: jasmine.createSpy('getLocale').and.returnValue('en-US'),
    setLocale: jasmine.createSpy('setLocale'),
    isTtsEnabled: jasmine.createSpy('isTtsEnabled').and.returnValue(true),
    setTtsEnabled: jasmine.createSpy('setTtsEnabled'),
    preferences$: of({ locale: 'en-US', ttsEnabled: true }),
  };

  beforeEach(async () => {
    aiService.sendMessage.calls.reset();
    aiService.confirmAction.calls.reset();
    aiService.deleteAttachment.calls.reset();
    aiService.listAttachments.calls.reset();
    aiService.getMessages.calls.reset();
    aiService.sendMessage.and.returnValue(of(successResponse));
    voiceOutput.speak.calls.reset();

    await TestBed.configureTestingModule({
      imports: [AiChatPanelComponent],
      providers: [
        { provide: AiService, useValue: aiService },
        { provide: UiShortcutService, useValue: { closePanel$: of() } },
        { provide: VoiceInputService, useValue: voiceInput },
        { provide: VoiceOutputService, useValue: voiceOutput },
        { provide: VoicePreferencesService, useValue: voicePreferences },
      ],
    })
      .overrideComponent(AiChatPanelComponent, {
        set: {
          providers: [
            { provide: VoiceInputService, useValue: voiceInput },
            { provide: VoiceOutputService, useValue: voiceOutput },
            { provide: VoicePreferencesService, useValue: voicePreferences },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AiChatPanelComponent);
    component = fixture.componentInstance;
    panelOpenSubject.next(true);
    fixture.detectChanges();
    await fixture.whenStable();
    aiService.sendMessage.calls.reset();
    aiService.deleteAttachment.calls.reset();
    aiService.listAttachments.calls.reset();
    voiceOutput.speak.calls.reset();
  });

  it('places reviewed transcript into draft without auto sending', () => {
    snapshotSubject.next({
      supported: true,
      state: VoiceInputState.Reviewing,
      transcript: {
        partial: '',
        final: 'Create a task called Prepare presentation',
        current: 'Create a task called Prepare presentation',
      },
      error: null,
      locale: 'en-US',
    });

    expect(component.draft).toBe('Create a task called Prepare presentation');
    expect(aiService.sendMessage).not.toHaveBeenCalled();
    expect(voiceInput.acknowledgeReview).toHaveBeenCalled();
  });

  it('uses existing send flow after editing transcript', () => {
    component.activeConversationId = 'conv-1';
    component.draft = 'Plan my day';
    component.send();

    expect(aiService.sendMessage).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      message: 'Plan my day',
    });
  });

  it('speaks assistant response after successful chat', () => {
    component.activeConversationId = 'conv-1';
    component.draft = 'Plan my day';
    component.send();

    expect(voiceOutput.speak).toHaveBeenCalledWith('Here is your plan.');
  });

  it('does not auto confirm destructive actions through voice', () => {
    aiService.sendMessage.and.returnValue(
      of({
        ...successResponse,
        assistantMessage: {
          id: 'msg-2',
          role: 'ASSISTANT',
          content: 'Delete permanently?',
          createdAt: new Date().toISOString(),
        },
        pendingConfirmation: {
          id: 'confirm-1',
          action: 'deleteTask',
          title: 'Delete task',
          description: 'Delete permanently?',
          toolName: 'deleteTask',
        },
        completed: false,
        usage: null,
      }),
    );

    component.activeConversationId = 'conv-1';
    component.draft = 'Delete my meeting task';
    component.send();

    expect(aiService.confirmAction).not.toHaveBeenCalled();
    expect(component.pendingConfirmation?.id).toBe('confirm-1');
    expect(voiceOutput.speak).toHaveBeenCalledWith(
      'Please confirm this action on screen.',
    );
  });

  it('disables mic while sending', () => {
    component.sending = true;
    expect(component.isMicDisabled).toBeTrue();
  });

  it('disables mic while awaiting confirmation', () => {
    component.pendingConfirmation = {
      id: 'confirm-1',
      action: 'deleteTask',
      title: 'Delete task',
      description: 'Delete permanently?',
      toolName: 'deleteTask',
    };
    expect(component.isMicDisabled).toBeTrue();
  });

  describe('composer attachment state', () => {
    it('A: text + attachment → send success clears composer, keeps label on message', () => {
      component.providerConfigured = true;
      component.activeConversationId = 'conv-1';
      component.draft = 'Analyze this';
      component.composerAttachments = [readyAttachment()];

      component.send();

      const sent = aiService.sendMessage.calls.mostRecent().args[0];
      expect(sent.message).toContain('Analyze this');
      expect(sent.message).toContain('📎 Single.png');

      const userMsg = component.messages.find((m) => m.role === 'USER');
      expect(userMsg?.content).toContain('Analyze this');
      expect(userMsg?.content).toContain('📎 Single.png');

      expect(component.composerAttachments).toEqual([]);
      expect(component.draft).toBe('');
      // Must NOT soft-delete persisted attachment after send
      expect(aiService.deleteAttachment).not.toHaveBeenCalled();
    });

    it('B: attachment-only → send success clears composer, message keeps attachment label', () => {
      component.providerConfigured = true;
      component.activeConversationId = 'conv-1';
      component.draft = '';
      component.composerAttachments = [readyAttachment()];

      component.send();

      const sent = aiService.sendMessage.calls.mostRecent().args[0];
      expect(sent.message).toBe('📎 Single.png');
      expect(component.composerAttachments).toEqual([]);
      expect(aiService.deleteAttachment).not.toHaveBeenCalled();
    });

    it('C: send failure before persist restores composer attachment and draft', () => {
      aiService.sendMessage.and.returnValue(
        throwError(() => ({ message: 'Network error' })),
      );
      aiService.getMessages.and.returnValue(of({ items: [], limit: 50 }));
      component.providerConfigured = true;
      component.activeConversationId = 'conv-1';
      component.draft = 'Analyze this';
      component.composerAttachments = [readyAttachment()];

      component.send();

      expect(component.composerAttachments.length).toBe(1);
      expect(component.composerAttachments[0].id).toBe('att-1');
      expect(component.draft).toBe('Analyze this');
      expect(aiService.deleteAttachment).not.toHaveBeenCalled();
    });

    it('C1b: unsupported image model error restores attachment and draft', () => {
      const unsupported =
        "Image analysis isn't supported by the current AI model. Please use text or choose a vision-capable model.";
      aiService.sendMessage.and.returnValue(
        throwError(() => ({
          graphQLErrors: [{ message: unsupported }],
        })),
      );
      aiService.getMessages.and.returnValue(of({ items: [], limit: 50 }));
      component.providerConfigured = true;
      component.activeConversationId = 'conv-1';
      component.draft = 'What is this?';
      component.composerAttachments = [readyAttachment()];

      component.send();

      expect(component.errorMessage).toBe(unsupported);
      expect(component.composerAttachments.length).toBe(1);
      expect(component.composerAttachments[0].id).toBe('att-1');
      expect(component.draft).toBe('What is this?');
      expect(aiService.deleteAttachment).not.toHaveBeenCalled();
      expect(component.sending).toBeFalse();
    });

    it('C2: AI failure after message persist does NOT restore attachment', () => {
      const outgoing = 'Analyze this\n\n📎 Single.png';
      aiService.sendMessage.and.returnValue(
        throwError(() => ({ message: 'Provider error' })),
      );
      aiService.getMessages.and.returnValue(
        of({
          items: [
            {
              id: 'msg-user',
              role: 'USER' as const,
              content: outgoing,
              createdAt: new Date().toISOString(),
            },
          ],
          limit: 50,
        }),
      );
      component.providerConfigured = true;
      component.activeConversationId = 'conv-1';
      component.draft = 'Analyze this';
      component.composerAttachments = [readyAttachment()];

      component.send();

      expect(component.composerAttachments).toEqual([]);
      expect(component.draft).toBe('');
      expect(component.messages.some((m) => m.content.includes('📎 Single.png'))).toBeTrue();
    });

    it('D: resets file input after successful send so same file can be reselected', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      Object.defineProperty(fileInput, 'value', {
        writable: true,
        value: 'C:\\fakepath\\Single.png',
      });
      component.fileInput = { nativeElement: fileInput };

      component.providerConfigured = true;
      component.activeConversationId = 'conv-1';
      component.draft = 'Hi';
      component.composerAttachments = [readyAttachment()];

      component.send();

      expect(fileInput.value).toBe('');
      expect(component.composerAttachments).toEqual([]);
    });

    it('E: conversation reload after send does not reintroduce composer chips', () => {
      component.providerConfigured = true;
      component.activeConversationId = 'conv-1';
      component.draft = 'Analyze this';
      component.composerAttachments = [readyAttachment()];

      component.send();
      expect(component.composerAttachments).toEqual([]);

      aiService.getMessages.and.returnValue(
        of({
          items: [
            {
              id: 'msg-user',
              role: 'USER',
              content: 'Analyze this\n\n📎 Single.png',
              createdAt: new Date().toISOString(),
            },
          ],
          limit: 50,
        }),
      );

      component.selectConversation('conv-1');

      expect(component.composerAttachments).toEqual([]);
      expect(aiService.listAttachments).not.toHaveBeenCalled();
      expect(component.messages.some((m) => m.content.includes('📎 Single.png'))).toBeTrue();
    });

    it('F: multiple attachments → all labels on message, composer empty', () => {
      component.providerConfigured = true;
      component.activeConversationId = 'conv-1';
      component.draft = 'Compare';
      component.composerAttachments = [
        readyAttachment({ id: 'att-1', originalFilename: 'a.png' }),
        readyAttachment({
          id: 'att-2',
          originalFilename: 'b.png',
          mimeType: 'image/png',
        }),
      ];

      component.send();

      const sent = aiService.sendMessage.calls.mostRecent().args[0];
      expect(sent.message).toContain('📎 a.png');
      expect(sent.message).toContain('📎 b.png');
      expect(component.composerAttachments).toEqual([]);
      expect(aiService.deleteAttachment).not.toHaveBeenCalled();
    });

    it('clears composer immediately while request is in flight (no dual chip)', () => {
      const pending = new Subject<typeof successResponse>();
      aiService.sendMessage.and.returnValue(pending.asObservable());
      component.providerConfigured = true;
      component.activeConversationId = 'conv-1';
      component.draft = 'Analyze this';
      component.composerAttachments = [readyAttachment()];

      component.send();

      expect(component.sending).toBeTrue();
      expect(component.composerAttachments).toEqual([]);
      expect(
        component.messages.some((m) => m.content.includes('📎 Single.png')),
      ).toBeTrue();

      pending.next(successResponse);
      pending.complete();
      expect(component.composerAttachments).toEqual([]);
    });

    it('prevents duplicate send while a request is in flight', () => {
      const pending = new Subject<typeof successResponse>();
      aiService.sendMessage.and.returnValue(pending.asObservable());
      component.providerConfigured = true;
      component.activeConversationId = 'conv-1';
      component.draft = 'Hello';

      component.send();
      expect(aiService.sendMessage.calls.count()).toBe(1);
      expect(component.canSend).toBeFalse();

      component.draft = 'Again';
      component.send();
      expect(aiService.sendMessage.calls.count()).toBe(1);

      pending.complete();
    });

    it('only removes successfully queued attachments; keeps unsent composer chips', () => {
      const pending = new Subject<typeof successResponse>();
      aiService.sendMessage.and.returnValue(pending.asObservable());
      component.providerConfigured = true;
      component.activeConversationId = 'conv-1';
      component.draft = 'Compare';
      component.composerAttachments = [
        readyAttachment({ id: 'att-1', originalFilename: 'a.png' }),
        readyAttachment({ id: 'att-2', originalFilename: 'b.png' }),
      ];

      // Snapshot is taken at send — both are sent
      component.send();
      expect(component.composerAttachments).toEqual([]);

      // Simulate a late upload completing after send started
      component.composerAttachments = [
        readyAttachment({ id: 'att-3', originalFilename: 'c.png' }),
      ];
      pending.next(successResponse);
      pending.complete();

      // Success clear only removes the sent snapshot ids, not a newer chip
      expect(component.composerAttachments.length).toBe(1);
      expect(component.composerAttachments[0].id).toBe('att-3');
    });

    it('disables send when draft and composer attachments are empty', () => {
      component.providerConfigured = true;
      component.draft = '';
      component.composerAttachments = [];
      expect(component.canSend).toBeFalse();
    });

    it('clones attachment objects so composer and message state are independent', () => {
      const shared = readyAttachment();
      component.providerConfigured = true;
      component.activeConversationId = 'conv-1';
      component.draft = 'Hi';
      component.composerAttachments = [shared];

      component.send();

      shared.originalFilename = 'mutated.png';
      expect(component.composerAttachments).toEqual([]);
    });
  });

  describe('stop generating', () => {
    beforeEach(() => {
      component.open = true;
      component.providerConfigured = true;
      component.activeConversationId = 'conv-1';
      fixture.detectChanges();
    });

    it('A: send sets isGenerating true and shows Stop button', () => {
      const pending = new Subject<typeof successResponse>();
      aiService.sendMessage.and.returnValue(pending.asObservable());
      component.draft = 'Hello';

      component.send();
      fixture.detectChanges();

      expect(component.isGenerating).toBeTrue();
      expect(component.sending).toBeTrue();
      const stopBtn = fixture.nativeElement.querySelector(
        'button.btn--stop',
      ) as HTMLButtonElement | null;
      expect(stopBtn).toBeTruthy();
      expect(stopBtn!.textContent).toContain('Stop');
      expect(
        fixture.nativeElement.querySelector('button.btn--primary'),
      ).toBeNull();

      pending.complete();
    });

    it('B: Stop cancels the active request and restores Send', () => {
      const pending = new Subject<typeof successResponse>();
      aiService.sendMessage.and.returnValue(pending.asObservable());
      component.draft = 'Hello';

      component.send();
      const activeSub = (component as unknown as { activeSendSub: { unsubscribe: () => void } })
        .activeSendSub;
      const unsubscribeSpy = spyOn(activeSub, 'unsubscribe').and.callThrough();

      component.stopGenerating();
      fixture.detectChanges();

      expect(unsubscribeSpy).toHaveBeenCalled();
      expect(component.isGenerating).toBeFalse();
      expect(component.sending).toBeFalse();
      expect(fixture.nativeElement.querySelector('button.btn--stop')).toBeNull();
      const sendBtn = fixture.nativeElement.querySelector(
        'button.btn--primary',
      ) as HTMLButtonElement | null;
      expect(sendBtn).toBeTruthy();
      expect(sendBtn!.textContent).toContain('Send');
    });

    it('C: successful AI response clears isGenerating and restores Send', () => {
      component.draft = 'Plan my day';

      component.send();
      fixture.detectChanges();

      expect(component.isGenerating).toBeFalse();
      expect(fixture.nativeElement.querySelector('button.btn--stop')).toBeNull();
      expect(
        fixture.nativeElement.querySelector('button.btn--primary')?.textContent,
      ).toContain('Send');
    });

    it('D: normal request error clears isGenerating and keeps error handling', () => {
      aiService.sendMessage.and.returnValue(
        throwError(() => ({ message: 'Network error' })),
      );
      component.draft = 'Hello';

      component.send();

      expect(component.isGenerating).toBeFalse();
      expect(component.errorMessage).toBe('Network error');
      expect(component.draft).toBe('Hello');
    });

    it('E: cancellation must NOT display a generic error', () => {
      const pending = new Subject<typeof successResponse>();
      aiService.sendMessage.and.returnValue(pending.asObservable());
      component.draft = 'Hello';

      component.send();
      component.stopGenerating();

      expect(component.errorMessage).toBe('');
      // Late abort-style error must also be ignored
      pending.error({ name: 'AbortError', message: 'The user aborted a request.' });
      expect(component.errorMessage).toBe('');
    });

    it('F: user message remains after cancellation', () => {
      const pending = new Subject<typeof successResponse>();
      aiService.sendMessage.and.returnValue(pending.asObservable());
      component.draft = 'Keep me';

      component.send();
      component.stopGenerating();

      expect(component.messages.some((m) => m.content === 'Keep me')).toBeTrue();
      expect(component.messages.some((m) => m.role === 'ASSISTANT')).toBeFalse();
    });

    it('G: user can send another message after cancellation', () => {
      const pending = new Subject<typeof successResponse>();
      aiService.sendMessage.and.returnValue(pending.asObservable());
      component.draft = 'First';

      component.send();
      component.stopGenerating();

      aiService.sendMessage.and.returnValue(of(successResponse));
      aiService.sendMessage.calls.reset();
      component.draft = 'Second';
      expect(component.canSend).toBeTrue();
      component.send();

      expect(aiService.sendMessage).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        message: 'Second',
      });
      expect(component.isGenerating).toBeFalse();
    });

    it('H: attachment + message Stop does not restore composer attachments', () => {
      const pending = new Subject<typeof successResponse>();
      aiService.sendMessage.and.returnValue(pending.asObservable());
      component.draft = 'Analyze this';
      component.composerAttachments = [readyAttachment()];

      component.send();
      expect(component.composerAttachments).toEqual([]);

      component.stopGenerating();

      expect(component.composerAttachments).toEqual([]);
      expect(aiService.deleteAttachment).not.toHaveBeenCalled();
      expect(
        component.messages.some((m) => m.content.includes('📎 Single.png')),
      ).toBeTrue();
    });

    it('I: attachment-only Stop does not restore or delete attachments', () => {
      const pending = new Subject<typeof successResponse>();
      aiService.sendMessage.and.returnValue(pending.asObservable());
      component.draft = '';
      component.composerAttachments = [readyAttachment()];

      component.send();
      component.stopGenerating();

      expect(component.composerAttachments).toEqual([]);
      expect(aiService.deleteAttachment).not.toHaveBeenCalled();
      expect(component.messages.some((m) => m.content === '📎 Single.png')).toBeTrue();
    });

    it('J: Stop clicked multiple times does not throw or duplicate handling', () => {
      const pending = new Subject<typeof successResponse>();
      aiService.sendMessage.and.returnValue(pending.asObservable());
      component.draft = 'Hello';

      component.send();
      expect(() => {
        component.stopGenerating();
        component.stopGenerating();
        component.stopGenerating();
      }).not.toThrow();
      expect(component.isGenerating).toBeFalse();
      expect(component.errorMessage).toBe('');
      expect(component.messages.filter((m) => m.role === 'USER').length).toBe(1);
    });

    it('keeps assistant response when Stop is clicked after success', () => {
      component.draft = 'Plan my day';

      component.send();
      expect(component.messages.some((m) => m.role === 'ASSISTANT')).toBeTrue();

      component.stopGenerating();

      expect(component.messages.some((m) => m.content === 'Here is your plan.')).toBeTrue();
      expect(component.isGenerating).toBeFalse();
    });

    it('does not restore composer attachments after Stop', () => {
      const pending = new Subject<typeof successResponse>();
      aiService.sendMessage.and.returnValue(pending.asObservable());
      component.draft = 'Hi';
      component.composerAttachments = [readyAttachment()];

      component.send();
      expect(component.composerAttachments).toEqual([]);

      component.stopGenerating();
      expect(component.composerAttachments).toEqual([]);

      // A later successful send of a new attachment still clears composer
      aiService.sendMessage.and.returnValue(of(successResponse));
      component.composerAttachments = [readyAttachment({ id: 'att-2' })];
      component.draft = 'Again';
      component.send();
      expect(component.composerAttachments).toEqual([]);
    });
  });
});
