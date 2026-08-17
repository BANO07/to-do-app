import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TaskFilterInput } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class TaskFilterService {
  private readonly filterSubject = new BehaviorSubject<TaskFilterInput>({});
  readonly filter$ = this.filterSubject.asObservable();

  setSearch(search: string): void {
    this.filterSubject.next({ ...this.filterSubject.value, search, page: 1 });
  }

  updateFilter(partial: TaskFilterInput): void {
    this.filterSubject.next({ ...this.filterSubject.value, ...partial });
  }

  get current(): TaskFilterInput {
    return this.filterSubject.value;
  }
}
