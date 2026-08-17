import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../core/models/app.models';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-categories-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    EmptyStateComponent,
    ConfirmDialogComponent,
  ],
  template: `
    <section class="categories-page">
      <header>
        <p class="eyebrow">Organize</p>
        <h1>Categories</h1>
      </header>

      <form class="category-form" [formGroup]="form" (ngSubmit)="createCategory()">
        <input type="text" formControlName="name" placeholder="Category name" aria-label="Category name" />
        <input type="text" formControlName="icon" placeholder="Icon (emoji)" aria-label="Category icon" />
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
            <article class="category-card">
              <div>
                <strong>{{ category.icon }} {{ category.name }}</strong>
                @if (category.description) {
                  <p>{{ category.description }}</p>
                }
              </div>
              <button type="button" class="btn btn--ghost" (click)="confirmDelete(category)">Delete</button>
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
        display: grid;
        grid-template-columns: 2fr 1fr auto;
        gap: 0.75rem;
        margin-bottom: 1.25rem;
      }
      .category-form input {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 0.75rem;
        background: var(--surface);
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
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface);
      }
      .category-card p {
        margin: 0.25rem 0 0;
        color: var(--text-muted);
        font-size: 0.875rem;
      }
      @media (max-width: 768px) {
        .category-form {
          grid-template-columns: 1fr;
        }
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
    icon: ['📁', Validators.maxLength(50)],
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
        icon: value.icon || undefined,
      })
      .subscribe({
        next: () => {
          this.toastService.success('Category created.');
          this.form.reset({ name: '', icon: '📁' });
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
