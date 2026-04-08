import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  AppLockSettings,
  CashTransaction,
  ReportSummary,
  TransactionType,
} from '../models/cashflow.models';

const STORAGE_KEYS = {
  transactions: 'cashflow.transactions',
  lock: 'cashflow.lock',
};

@Injectable({
  providedIn: 'root',
})
export class CashflowService {
  private transactionsSubject = new BehaviorSubject<CashTransaction[]>(
    this.loadTransactions()
  );
  readonly transactions$ = this.transactionsSubject.asObservable();

  private lockSubject = new BehaviorSubject<AppLockSettings>(this.loadLockSettings());
  readonly lockSettings$ = this.lockSubject.asObservable();

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
    localStorage.setItem(STORAGE_KEYS.lock, JSON.stringify(next));
  }

  disableLock(): void {
    const next: AppLockSettings = {
      enabled: false,
      pin: null,
    };

    this.lockSubject.next(next);
    localStorage.setItem(STORAGE_KEYS.lock, JSON.stringify(next));
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
    const raw = localStorage.getItem(STORAGE_KEYS.transactions);
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
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
  }

  private loadLockSettings(): AppLockSettings {
    const raw = localStorage.getItem(STORAGE_KEYS.lock);
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
}
