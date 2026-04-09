import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  AppLockSettings,
  CashTransaction,
  ReportSummary,
  TransactionType,
} from '../models/cashflow.models';
import { AuthService } from './auth.service';
import { User } from '../models/auth.models';

const STORAGE_KEYS = {
  transactions: 'cashflow.transactions',
  lock: 'cashflow.lock',
};

@Injectable({
  providedIn: 'root',
})
export class CashflowService {
  private readonly authService = inject(AuthService);
  private storageScope = 'guest';

  private transactionsSubject = new BehaviorSubject<CashTransaction[]>([]);
  readonly transactions$ = this.transactionsSubject.asObservable();

  private lockSubject = new BehaviorSubject<AppLockSettings>({ enabled: false, pin: null });
  readonly lockSettings$ = this.lockSubject.asObservable();

  constructor() {
    localStorage.removeItem(STORAGE_KEYS.transactions);
    localStorage.removeItem(STORAGE_KEYS.lock);

    this.storageScope = this.resolveStorageScope(this.authService.currentUser);
    this.transactionsSubject.next(this.loadTransactions());
    this.lockSubject.next(this.loadLockSettings());

    this.authService.currentUser$.subscribe((user) => {
      const nextScope = this.resolveStorageScope(user);
      if (nextScope === this.storageScope) {
        return;
      }

      this.storageScope = nextScope;
      this.transactionsSubject.next(this.loadTransactions());
      this.lockSubject.next(this.loadLockSettings());
    });
  }

  get transactions(): CashTransaction[] {
    return this.transactionsSubject.value;
  }

  get lockSettings(): AppLockSettings {
    return this.lockSubject.value;
  }

  addTransaction(payload: {
    type: TransactionType;
    amount: number;
    category: string;
    timestamp: string;
    note?: string;
  }): void {
    const transaction: CashTransaction = {
      id: this.createId(),
      type: payload.type,
      amount: payload.amount,
      category: payload.category,
      timestamp: payload.timestamp,
      note: payload.note?.trim() || undefined,
    };

    const next = [transaction, ...this.transactionsSubject.value];
    this.transactionsSubject.next(next);
    this.persistTransactions(next);
  }

  deleteTransaction(id: string): void {
    const next = this.transactionsSubject.value.filter((transaction) => transaction.id !== id);
    this.transactionsSubject.next(next);
    this.persistTransactions(next);
  }

  getSummary(transactions: CashTransaction[]): ReportSummary {
    const totalIn = this.getTotalByType(transactions, 'cash-in');
    const totalOut = this.getTotalByType(transactions, 'cash-out');

    return {
      totalIn,
      totalOut,
      profit: totalIn - totalOut,
      countIn: transactions.filter((transaction) => transaction.type === 'cash-in').length,
      countOut: transactions.filter((transaction) => transaction.type === 'cash-out').length,
    };
  }

  upsertLock(pin: string): void {
    const next: AppLockSettings = {
      enabled: true,
      pin,
    };

    this.lockSubject.next(next);
    localStorage.setItem(this.storageKey('lock'), JSON.stringify(next));
  }

  disableLock(): void {
    const next: AppLockSettings = {
      enabled: false,
      pin: null,
    };

    this.lockSubject.next(next);
    localStorage.setItem(this.storageKey('lock'), JSON.stringify(next));
  }

  validatePin(pin: string): boolean {
    return !!this.lockSettings.pin && pin === this.lockSettings.pin;
  }

  private getTotalByType(transactions: CashTransaction[], type: TransactionType): number {
    return transactions
      .filter((transaction) => transaction.type === type)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  private loadTransactions(): CashTransaction[] {
    const raw = localStorage.getItem(this.storageKey('transactions'));
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as CashTransaction[];
      return parsed.filter(
        (transaction) =>
          !!transaction.id &&
          !!transaction.category &&
          !!transaction.timestamp &&
          Number.isFinite(transaction.amount)
      );
    } catch {
      return [];
    }
  }

  private persistTransactions(transactions: CashTransaction[]): void {
    localStorage.setItem(this.storageKey('transactions'), JSON.stringify(transactions));
  }

  private loadLockSettings(): AppLockSettings {
    const raw = localStorage.getItem(this.storageKey('lock'));
    if (!raw) {
      return {
        enabled: false,
        pin: null,
      };
    }

    try {
      const parsed = JSON.parse(raw) as AppLockSettings;
      return {
        enabled: !!parsed.enabled,
        pin: parsed.pin ?? null,
      };
    } catch {
      return {
        enabled: false,
        pin: null,
      };
    }
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private storageKey(type: keyof typeof STORAGE_KEYS): string {
    return `${STORAGE_KEYS[type]}.${this.storageScope}`;
  }

  private resolveStorageScope(user: User | null): string {
    if (user?.id) {
      return `user:${user.id}`;
    }

    const storedUserRaw = localStorage.getItem('user');
    if (!storedUserRaw) {
      return 'guest';
    }

    try {
      const storedUser = JSON.parse(storedUserRaw) as Partial<User> & { sub?: string };
      const id = storedUser.id || storedUser.sub;
      if (id) {
        return `user:${id}`;
      }
    } catch {
      return 'guest';
    }

    return 'guest';
  }
}
