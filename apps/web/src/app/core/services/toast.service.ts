import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastMessage {
  text: string;
  type: 'success' | 'error';
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly toastSubject = new BehaviorSubject<ToastMessage | null>(null);
  readonly toast$ = this.toastSubject.asObservable();

  private timer: ReturnType<typeof setTimeout> | null = null;

  show(text: string, type: 'success' | 'error' = 'success'): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.toastSubject.next({ text, type });
    this.timer = setTimeout(() => {
      this.toastSubject.next(null);
      this.timer = null;
    }, 3500);
  }

  success(text: string): void {
    this.show(text, 'success');
  }

  error(text: string): void {
    this.show(text, 'error');
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.toastSubject.next(null);
  }
}
