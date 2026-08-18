import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../core/models/app.models';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { IconPickerComponent } from '../../../shared/components/icon-picker/icon-picker.component';

@Component({
  selector: 'app-categories-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    EmptyStateComponent,
    ConfirmDialogComponent,
    IconPickerComponent,
  ],
  template: `
    <section class="categories-page">
      <header>
        <p class="eyebrow">Organize</p>
        <h1>Categories</h1>
      </header>

      <form class="category-form glass-panel" [formGroup]="form" (ngSubmit)="createCategory()">
        <div class="category-form__fields">
          <div class="field">
            <label for="categoryName">Name</label>
            <input
              id="categoryName"
              type="text"
              formControlName="name"
              placeholder="Category name"
            />
          </div>
          <div class="field">
            <label for="categoryDescription">Description</label>
            <input
              id="categoryDescription"
              type="text"
              formControlName="description"
              placeholder="Optional description"
            />
          </div>
          <app-icon-picker formControlName="icon" />
        </div>
        @if (form.value.name) {
          <p class="category-preview">
            Preview:
            <span aria-hidden="true">{{ form.value.icon || '📁' }}</span>
            {{ form.value.name }}
          </p>
        }
        <button type="submit" class="btn btn--primary" [disabled]="form.invalid">Add category</button>
      </form>

      @if (categories.length === 0) {
        <app-empty-state
          icon="🏷️"
          title="No categories yet"
          message="Create categories to organize your tasks."
        />
      } @else {
        <div class="category-list">
          @for (category of categories; track category.id) {
            <article class="category-card glass-panel">
              <div class="category-card__info">
                <span class="category-card__icon" aria-hidden="true">{{ category.icon }}</span>
                <div>
                  <strong>{{ category.name }}</strong>
                  @if (category.description) {
                    <p>{{ category.description }}</p>
                  }
                </div>
              </div>
              <button type="button" class="btn btn--ghost" (click)="confirmDelete(category)">
                Delete
              </button>
            </article>
          }
        </div>
      }

      <app-confirm-dialog
        [open]="!!categoryToDelete"
        title="Delete category"
        message="Tasks in this category will remain but lose the category link."
        confirmLabel="Delete"
        (confirmed)="deleteCategory()"
        (cancelled)="categoryToDelete = null"
      />
    </section>
  `,
  styles: [
    `
      header { margin-bottom: 1rem; }
      .eyebrow { margin: 0; color: var(--text-muted); }
      h1 { margin: 0.25rem 0 0; }
      .category-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1.25rem;
        border-radius: 16px;
        margin-bottom: 1.25rem;
      }
      .category-form__fields {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }
      .field label {
        font-size: 0.875rem;
        font-weight: 600;
      }
      .field input {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 0.75rem;
        background: var(--input-bg);
        color: var(--text-primary);
      }
      .category-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .category-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 1rem 1.25rem;
        border-radius: 14px;
      }
      .category-card__info {
        display: flex;
        align-items: center;
        gap: 0.875rem;
      }
      .category-card__icon {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: var(--primary-soft);
        display: grid;
        place-items: center;
        font-size: 1.35rem;
        flex-shrink: 0;
      }
      .category-card p {
        margin: 0.25rem 0 0;
        color: var(--text-muted);
        font-size: 0.875rem;
      }
      .category-preview {
        margin: 0;
        font-size: 0.875rem;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
    `,
  ],
})
export class CategoriesPageComponent implements OnInit {
  private readonly categoryService = inject(CategoryService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  categories: Category[] = [];
  categoryToDelete: Category | null = null;

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(255)],
    icon: ['📁', Validators.maxLength(16)],
  });

  ngOnInit(): void {
    this.loadCategories();
  }

  createCategory(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.categoryService
      .createCategory({
        name: value.name!.trim(),
        description: value.description?.trim() || undefined,
        icon: sanitizeCategoryIcon(value.icon),
      })
      .subscribe({
        next: () => {
          this.toastService.success('Category created.');
          this.form.reset({ name: '', description: '', icon: '📁' });
          this.loadCategories();
        },
        error: () => this.toastService.error('Unable to create category. Please try again.'),
      });
  }

  confirmDelete(category: Category): void {
    this.categoryToDelete = category;
  }

  deleteCategory(): void {
    if (!this.categoryToDelete) return;
    this.categoryService.deleteCategory(this.categoryToDelete.id).subscribe({
      next: () => {
        this.toastService.success('Category deleted.');
        this.categoryToDelete = null;
        this.loadCategories();
      },
      error: () => this.toastService.error('Unable to delete category. Please try again.'),
    });
  }

  private loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories) => (this.categories = categories),
    });
  }
}

function sanitizeCategoryIcon(value: string | null | undefined): string {
  const cleaned = (value ?? '').replace(/[<>]/g, '').trim();
  return cleaned.slice(0, 16) || '📁';
}
