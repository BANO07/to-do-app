import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
  actionLabel?: string;
  action?: () => void;
  durationMs?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  readonly toasts$ = this.toastsSubject.asObservable();
  private counter = 0;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  show(message: string, type: ToastMessage['type'] = 'info', durationMs = 4000): void {
    this.push({ message, type, durationMs });
  }

  success(message: string, durationMs = 4000): void {
    this.push({ message, type: 'success', durationMs });
  }

  successWithAction(
    message: string,
    actionLabel: string,
    action: () => void,
    durationMs = 5000,
  ): void {
    this.push({ message, type: 'success', actionLabel, action, durationMs });
  }

  error(message: string): void {
    this.push({ message, type: 'error', durationMs: 5000 });
  }

  runAction(toast: ToastMessage): void {
    toast.action?.();
    this.dismiss(toast.id);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toastsSubject.next(this.toastsSubject.value.filter((t) => t.id !== id));
  }

  private push(partial: Omit<ToastMessage, 'id'>): void {
    const toast: ToastMessage = { id: ++this.counter, ...partial };
    const current = this.toastsSubject.value;
    this.toastsSubject.next([...current, toast]);
    const timer = setTimeout(() => this.dismiss(toast.id), partial.durationMs ?? 4000);
    this.timers.set(toast.id, timer);
  }
}
