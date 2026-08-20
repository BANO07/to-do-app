import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import {
  AiAttachment,
  AiChatInput,
  AiChatResponse,
  AiConfirmActionResponse,
  AiConversation,
  AiMessage,
  AiMessagesPage,
  AiUsageStatus,
  ConfirmAiActionInput,
  DeleteAiAttachmentInput,
  UploadAiAttachmentInput,
} from '../models/app.models';
import {
  AI_CHAT_MUTATION,
  AI_CONVERSATION_ATTACHMENTS_QUERY,
  AI_CONVERSATIONS_QUERY,
  AI_MESSAGES_QUERY,
  AI_USAGE_QUERY,
  CLEAR_AI_CONVERSATION_MUTATION,
  CONFIRM_AI_ACTION_MUTATION,
  CREATE_AI_CONVERSATION_MUTATION,
  DELETE_AI_ATTACHMENT_MUTATION,
  DELETE_AI_CONVERSATION_MUTATION,
  UPLOAD_AI_ATTACHMENT_MUTATION,
} from '../graphql/operations';

const ACTIVE_CONVERSATION_KEY = 'todo-app.ai.activeConversationId';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly apollo = inject(Apollo);
  private readonly panelOpenSubject = new BehaviorSubject<boolean>(false);

  readonly panelOpen$ = this.panelOpenSubject.asObservable();

  openPanel(): void {
    this.panelOpenSubject.next(true);
  }

  closePanel(): void {
    this.panelOpenSubject.next(false);
  }

  togglePanel(): void {
    this.panelOpenSubject.next(!this.panelOpenSubject.value);
  }

  getActiveConversationId(): string | null {
    return sessionStorage.getItem(ACTIVE_CONVERSATION_KEY);
  }

  setActiveConversationId(id: string | null): void {
    if (id) {
      sessionStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
    } else {
      sessionStorage.removeItem(ACTIVE_CONVERSATION_KEY);
    }
  }

  getUsage(): Observable<AiUsageStatus> {
    return this.apollo
      .query<{ aiUsage: AiUsageStatus }>({
        query: AI_USAGE_QUERY,
        fetchPolicy: 'network-only',
      })
      .pipe(map(({ data }) => data.aiUsage));
  }

  listConversations(): Observable<AiConversation[]> {
    return this.apollo
      .query<{ aiConversations: AiConversation[] }>({
        query: AI_CONVERSATIONS_QUERY,
        fetchPolicy: 'network-only',
      })
      .pipe(map(({ data }) => data.aiConversations));
  }

  getMessages(
    conversationId: string,
    limit = 50,
  ): Observable<AiMessagesPage> {
    return this.apollo
      .query<{ aiMessages: AiMessagesPage }>({
        query: AI_MESSAGES_QUERY,
        variables: { conversationId, limit },
        fetchPolicy: 'network-only',
      })
      .pipe(map(({ data }) => data.aiMessages));
  }

  createConversation(): Observable<AiConversation> {
    return this.apollo
      .mutate<{ createAiConversation: AiConversation }>({
        mutation: CREATE_AI_CONVERSATION_MUTATION,
      })
      .pipe(
        map(({ data }) => data!.createAiConversation),
        tap((conversation) => this.setActiveConversationId(conversation.id)),
      );
  }

  sendMessage(input: AiChatInput): Observable<AiChatResponse> {
    return this.apollo
      .mutate<{ aiChat: AiChatResponse }>({
        mutation: AI_CHAT_MUTATION,
        variables: { input },
      })
      .pipe(map(({ data }) => data!.aiChat));
  }

  confirmAction(input: ConfirmAiActionInput): Observable<AiConfirmActionResponse> {
    return this.apollo
      .mutate<{ confirmAiAction: AiConfirmActionResponse }>({
        mutation: CONFIRM_AI_ACTION_MUTATION,
        variables: { input },
      })
      .pipe(map(({ data }) => data!.confirmAiAction));
  }

  deleteConversation(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteAiConversation: boolean }>({
        mutation: DELETE_AI_CONVERSATION_MUTATION,
        variables: { id },
      })
      .pipe(map(({ data }) => data!.deleteAiConversation));
  }

  clearConversation(id: string): Observable<AiConversation> {
    return this.apollo
      .mutate<{ clearAiConversation: AiConversation }>({
        mutation: CLEAR_AI_CONVERSATION_MUTATION,
        variables: { id },
      })
      .pipe(map(({ data }) => data!.clearAiConversation));
  }

  listAttachments(conversationId: string): Observable<AiAttachment[]> {
    return this.apollo
      .query<{ aiConversationAttachments: AiAttachment[] }>({
        query: AI_CONVERSATION_ATTACHMENTS_QUERY,
        variables: { conversationId },
        fetchPolicy: 'network-only',
      })
      .pipe(map(({ data }) => data.aiConversationAttachments));
  }

  uploadAttachment(input: UploadAiAttachmentInput): Observable<AiAttachment> {
    return this.apollo
      .mutate<{ uploadAiAttachment: AiAttachment }>({
        mutation: UPLOAD_AI_ATTACHMENT_MUTATION,
        variables: { input },
      })
      .pipe(map(({ data }) => data!.uploadAiAttachment));
  }

  deleteAttachment(input: DeleteAiAttachmentInput): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteAiAttachment: boolean }>({
        mutation: DELETE_AI_ATTACHMENT_MUTATION,
        variables: { input },
      })
      .pipe(map(({ data }) => data!.deleteAiAttachment));
  }
}
