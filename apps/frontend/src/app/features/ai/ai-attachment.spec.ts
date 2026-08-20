import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { of, throwError } from 'rxjs';
import { AiService } from '../../core/services/ai.service';
import { AiAttachment } from '../../core/models/app.models';
import { AiChatPanelComponent } from './ai-chat-panel.component';
import { UiShortcutService } from '../../core/services/ui-shortcut.service';
import { VoiceInputService } from './voice/voice-input.service';
import { VoiceOutputService } from './voice/voice-output.service';
import { VoicePreferencesService } from './voice/voice-preferences.service';
import { SPEECH_RECOGNITION_FACTORY } from './voice/voice-input.service';
import { Subject } from 'rxjs';

function makeAttachment(overrides: Partial<AiAttachment> = {}): AiAttachment {
  return {
    id: 'att-1',
    originalFilename: 'report.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    status: 'READY',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AiChatPanelComponent - Attachment UI', () => {
  let aiServiceSpy: jasmine.SpyObj<AiService>;
  let component: AiChatPanelComponent;

  const mockVoiceInput = {
    isSupported: () => false,
    snapshot$: new Subject(),
    getSnapshot: () => ({ state: 'Idle', transcript: { current: '' }, error: null }),
    start: jasmine.createSpy('start'),
    stop: jasmine.createSpy('stop'),
    cancel: jasmine.createSpy('cancel'),
    setLocale: jasmine.createSpy('setLocale'),
    acknowledgeReview: jasmine.createSpy('acknowledgeReview'),
  };

  const mockVoiceOutput = {
    isSupported: () => false,
    isEnabled: () => false,
    state$: new Subject(),
    speak: jasmine.createSpy('speak'),
    cancel: jasmine.createSpy('cancel'),
    setEnabled: jasmine.createSpy('setEnabled'),
  };

  const mockVoicePreferences = {
    getLocale: () => 'en-US',
    isTtsEnabled: () => false,
    preferences$: new Subject(),
    setLocale: jasmine.createSpy('setLocale'),
    setTtsEnabled: jasmine.createSpy('setTtsEnabled'),
  };

  beforeEach(async () => {
    aiServiceSpy = jasmine.createSpyObj(
      'AiService',
      [
        'getUsage',
        'listConversations',
        'getMessages',
        'listAttachments',
        'uploadAttachment',
        'deleteAttachment',
        'createConversation',
        'sendMessage',
        'confirmAction',
        'getActiveConversationId',
        'setActiveConversationId',
        'closePanel',
      ],
      { panelOpen$: of(false) },
    );

    aiServiceSpy.getUsage.and.returnValue(
      of({ dailyLimit: 20, remaining: 20, used: 0, resetAt: new Date().toISOString(), providerConfigured: true }),
    );
    aiServiceSpy.listConversations.and.returnValue(of([]));
    aiServiceSpy.getMessages.and.returnValue(of({ items: [], limit: 50 }));
    aiServiceSpy.listAttachments.and.returnValue(of([]));
    aiServiceSpy.getActiveConversationId.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [AiChatPanelComponent],
      providers: [
        { provide: AiService, useValue: aiServiceSpy },
        {
          provide: UiShortcutService,
          useValue: { closePanel$: new Subject() },
        },
      ],
    })
      .overrideComponent(AiChatPanelComponent, {
        set: {
          providers: [
            { provide: VoiceInputService, useValue: mockVoiceInput },
            { provide: VoiceOutputService, useValue: mockVoiceOutput },
            { provide: VoicePreferencesService, useValue: mockVoicePreferences },
            { provide: SPEECH_RECOGNITION_FACTORY, useValue: null },
          ],
        },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(AiChatPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('composer attachment state', () => {
    it('should clear composer attachments when selecting a conversation', () => {
      component.composerAttachments = [makeAttachment()];
      component.selectConversation('conv-1');
      expect(component.composerAttachments).toEqual([]);
      // Conversation inventory is NOT loaded into the composer
      expect(aiServiceSpy.listAttachments).not.toHaveBeenCalled();
    });

    it('should clear composer state when switching conversations', () => {
      component.composerAttachments = [makeAttachment()];
      component.selectConversation('conv-2');
      expect(component.composerAttachments).toEqual([]);
    });
  });

  describe('removeComposerAttachment', () => {
    it('should call deleteAttachment and remove from composer list', () => {
      const att = makeAttachment();
      component.composerAttachments = [att];
      aiServiceSpy.deleteAttachment.and.returnValue(of(true));
      component.removeComposerAttachment(att);
      expect(aiServiceSpy.deleteAttachment).toHaveBeenCalledWith({ id: att.id });
      expect(component.composerAttachments.length).toBe(0);
    });

    it('should set error message on delete failure', () => {
      const att = makeAttachment();
      component.composerAttachments = [att];
      aiServiceSpy.deleteAttachment.and.returnValue(throwError(() => new Error('server error')));
      component.removeComposerAttachment(att);
      // Composer chip is removed immediately; error is set if backend delete fails
      expect(component.composerAttachments.length).toBe(0);
      expect(component.attachmentError).toBeTruthy();
    });
  });

  describe('attachmentIcon', () => {
    it('should return image icon for image MIME types', () => {
      expect(component.attachmentIcon('image/png')).toBe('🖼');
    });

    it('should return PDF icon', () => {
      expect(component.attachmentIcon('application/pdf')).toBe('📄');
    });

    it('should return CSV icon', () => {
      expect(component.attachmentIcon('text/csv')).toBe('📊');
    });
  });

  describe('formatSize', () => {
    it('should format bytes correctly', () => {
      expect(component.formatSize(512)).toBe('512 B');
      expect(component.formatSize(2048)).toBe('2.0 KB');
      expect(component.formatSize(2 * 1024 * 1024)).toBe('2.0 MB');
    });
  });

  describe('send flow - unchanged', () => {
    it('should still use existing AiService.sendMessage', () => {
      aiServiceSpy.sendMessage.and.returnValue(
        of({
          conversation: { id: 'conv-1', title: null, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
          assistantMessage: null,
          toolCalls: [],
          pendingConfirmation: null,
          completed: true,
          usage: null,
        }),
      );
      component.activeConversationId = 'conv-1';
      component.draft = 'Summarize the attached file.';
      component.send();
      expect(aiServiceSpy.sendMessage).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        message: 'Summarize the attached file.',
      });
    });
  });

  describe('onFileSelected - client-side validation', () => {
    it('should reject unsupported file type and set attachmentError', () => {
      component.activeConversationId = 'conv-1';
      const file = new File(['content'], 'file.exe', { type: 'application/octet-stream' });
      const event = { target: { files: [file], value: '' } } as unknown as Event;
      component.onFileSelected(event);
      expect(component.attachmentError).toBeTruthy();
      expect(aiServiceSpy.uploadAttachment).not.toHaveBeenCalled();
    });
  });
});
