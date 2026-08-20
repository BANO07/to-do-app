import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AI_PROVIDER } from './ai.tokens';
import { AiUsage } from './entities/ai-usage.entity';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiAttachment } from './entities/ai-attachment.entity';
import { AiUsageRepository } from './ai-usage.repository';
import { AiConversationRepository } from './ai-conversation.repository';
import { AIUsageService } from './ai-usage.service';
import { AiMinuteRateLimiter } from './ai-minute-rate-limiter.service';
import { AIService } from './ai.service';
import { AIConversationService } from './ai-conversation.service';
import { AiConfirmationService } from './ai-confirmation.service';
import { AiChatService } from './ai-chat.service';
import { AiToolsService } from './tools/ai-tools.service';
import { AiProductivityService } from './productivity/ai-productivity.service';
import { AiResolver } from './ai.resolver';
import { GeminiProvider } from './providers/gemini.provider';
import { UnavailableAiProvider } from './providers/unavailable-ai.provider';
import { AiAttachmentRepository } from './attachments/ai-attachment.repository';
import { AiAttachmentService } from './attachments/ai-attachment.service';
import { AiAttachmentResolver } from './attachments/ai-attachment.resolver';
import { AttachmentContentExtractor } from './attachments/attachment-content-extractor';
import { LocalAttachmentStorage } from './attachments/local-attachment-storage';
import { ATTACHMENT_STORAGE } from './attachments/attachment-storage.interface';
import { TasksModule } from '../tasks/tasks.module';
import { CategoriesModule } from '../categories/categories.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiUsage, AiConversation, AiMessage, AiAttachment]),
    TasksModule,
    CategoriesModule,
    DashboardModule,
    CalendarModule,
  ],
  providers: [
    AiUsageRepository,
    AiConversationRepository,
    AIUsageService,
    AiMinuteRateLimiter,
    AIService,
    AIConversationService,
    AiConfirmationService,
    AiChatService,
    AiToolsService,
    AiProductivityService,
    AiResolver,
    GeminiProvider,
    UnavailableAiProvider,
    AiAttachmentRepository,
    AiAttachmentService,
    AiAttachmentResolver,
    AttachmentContentExtractor,
    LocalAttachmentStorage,
    {
      provide: ATTACHMENT_STORAGE,
      useClass: LocalAttachmentStorage,
    },
    {
      provide: AI_PROVIDER,
      inject: [ConfigService, GeminiProvider, UnavailableAiProvider],
      useFactory: (
        configService: ConfigService,
        geminiProvider: GeminiProvider,
        unavailableProvider: UnavailableAiProvider,
      ) => {
        const provider = configService.get<string>('AI_PROVIDER') ?? 'gemini';
        return provider === 'gemini' ? geminiProvider : unavailableProvider;
      },
    },
  ],
  exports: [AIService, AIUsageService, AiAttachmentService],
})
export class AiModule {}
