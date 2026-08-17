import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <img
      [src]="currentSrc"
      [alt]="name"
      [style.width.px]="size"
      [style.height.px]="size"
      class="user-avatar"
      referrerpolicy="no-referrer"
      (error)="onError()"
    />
  `,
  styles: [
    `
      .user-avatar {
        border-radius: 999px;
        object-fit: cover;
        flex-shrink: 0;
        background: var(--primary-soft);
      }
    `,
  ],
})
export class UserAvatarComponent implements OnChanges {
  @Input({ required: true }) name!: string;
  @Input() avatarUrl?: string | null;
  @Input() size = 40;

  currentSrc = '';
  private usedFallback = false;

  ngOnChanges(): void {
    this.usedFallback = false;
    this.currentSrc = this.resolvePrimarySrc();
  }

  onError(): void {
    if (!this.usedFallback) {
      this.usedFallback = true;
      this.currentSrc = this.buildFallbackSrc();
    }
  }

  private resolvePrimarySrc(): string {
    if (this.avatarUrl?.trim()) {
      return this.avatarUrl.trim();
    }
    return this.buildFallbackSrc();
  }

  private buildFallbackSrc(): string {
    const label = encodeURIComponent(this.name || 'User');
    return `https://ui-avatars.com/api/?name=${label}&background=6366f1&color=fff&size=${this.size * 2}`;
  }
}
