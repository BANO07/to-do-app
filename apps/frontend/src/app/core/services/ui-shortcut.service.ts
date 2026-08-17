import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UiShortcutService {
  private readonly newTaskSubject = new Subject<void>();
  private readonly closePanelSubject = new Subject<void>();
  private readonly focusSearchSubject = new Subject<void>();

  readonly newTask$ = this.newTaskSubject.asObservable();
  readonly closePanel$ = this.closePanelSubject.asObservable();
  readonly focusSearch$ = this.focusSearchSubject.asObservable();

  triggerNewTask(): void {
    this.newTaskSubject.next();
  }

  triggerClosePanel(): void {
    this.closePanelSubject.next();
  }

  triggerFocusSearch(): void {
    this.focusSearchSubject.next();
  }
}
