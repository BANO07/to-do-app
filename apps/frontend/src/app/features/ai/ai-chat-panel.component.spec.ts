import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
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

describe('AiChatPanelComponent voice integration', () => {
  let fixture: ComponentFixture<AiChatPanelComponent>;
  let component: AiChatPanelComponent;

  const panelOpenSubject = new Subject<boolean>();
  const snapshotSubject = new Subject<VoiceInputSnapshot>();
  const outputStateSubject = new Subject<{
    speaking: boolean;
    enabled: boolean;
    supported: boolean;
  }>();

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
    sendMessage: jasmine.createSpy('sendMessage').and.returnValue(
      of({
        conversation: {
          id: 'conv-1',
          title: 'Test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        assistantMessage: {
          id: 'msg-1',
          role: 'ASSISTANT',
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
      }),
    ),
    confirmAction: jasmine.createSpy('confirmAction'),
    createConversation: jasmine.createSpy('createConversation'),
    listAttachments: jasmine.createSpy('listAttachments').and.returnValue(of([])),
    uploadAttachment: jasmine.createSpy('uploadAttachment'),
    deleteAttachment: jasmine.createSpy('deleteAttachment'),
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
        conversation: {
          id: 'conv-1',
          title: 'Test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        assistantMessage: {
          id: 'msg-2',
          role: 'ASSISTANT',
          content: 'Delete permanently?',
          createdAt: new Date().toISOString(),
        },
        toolCalls: [],
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
});
