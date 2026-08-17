import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../models/app.models';
import {
  CATEGORIES_QUERY,
  CREATE_CATEGORY_MUTATION,
  DELETE_CATEGORY_MUTATION,
  UPDATE_CATEGORY_MUTATION,
} from '../graphql/operations';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly apollo = inject(Apollo);

  getCategories(): Observable<Category[]> {
    return this.apollo
      .query<{ categories: Category[] }>({
        query: CATEGORIES_QUERY,
        fetchPolicy: 'network-only',
      })
      .pipe(map(({ data }) => data.categories));
  }

  createCategory(input: CreateCategoryInput): Observable<Category> {
    return this.apollo
      .mutate<{ createCategory: Category }>({
        mutation: CREATE_CATEGORY_MUTATION,
        variables: { input },
      })
      .pipe(map(({ data }) => data!.createCategory));
  }

  updateCategory(id: string, input: UpdateCategoryInput): Observable<Category> {
    return this.apollo
      .mutate<{ updateCategory: Category }>({
        mutation: UPDATE_CATEGORY_MUTATION,
        variables: { id, input },
      })
      .pipe(map(({ data }) => data!.updateCategory));
  }

  deleteCategory(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteCategory: boolean }>({
        mutation: DELETE_CATEGORY_MUTATION,
        variables: { id },
      })
      .pipe(map(({ data }) => data!.deleteCategory));
  }
}
