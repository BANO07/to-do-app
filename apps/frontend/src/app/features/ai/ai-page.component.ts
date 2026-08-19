import { Component, OnInit, inject } from '@angular/core';
import { AiService } from '../../core/services/ai.service';

@Component({
  selector: 'app-ai-page',
  standalone: true,
  template: `
    <section class="ai-page">
      <h1>AI Assistant</h1>
      <p>Use the panel on the right to chat about your tasks, reminders, and productivity.</p>
    </section>
  `,
  styles: [
    `
      .ai-page {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      p {
        color: var(--text-muted);
      }
    `,
  ],
})
export class AiPageComponent implements OnInit {
  private readonly aiService = inject(AiService);

  ngOnInit(): void {
    this.aiService.openPanel();
  }
}
