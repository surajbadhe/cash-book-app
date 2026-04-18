import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/auth.models';
import { CashTransaction } from '../../core/models/cashflow.models';
import {
  DashboardReportResponse,
  mapTransactionItemToCashTransaction,
} from '../../core/models/cashflow-api.models';
import { CashflowApiService } from '../../core/services/cashflow-api.service';
import { BusinessContextService } from '../../core/services/business-context.service';
import { CashflowService } from '../../core/services/cashflow.service';

interface CategoryStat {
  category: string;
  total: number;
  percentage: number;
  color: string;
}

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
})
export class ReportsComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private cashflowService = inject(CashflowService);
  private cashflowApiService = inject(CashflowApiService);
  private businessContext = inject(BusinessContextService);
  private subs = new Subscription();

  user: User | null = null;
  currencyCode = 'INR';
  dataMode: 'cloud' | 'local' = 'local';
  isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  loading = true;
  noBusinessAccess = false;
  private activeBusinessId: string | null = null;
  private loadSub?: Subscription;

  period: 'all' | 'daily' | 'weekly' | 'monthly' | 'custom' = 'all';
  fromDate = '';
  toDate = '';

  totalIn = 0;
  totalOut = 0;
  net = 0;
  categoryStats: CategoryStat[] = [];
  incomeStats: CategoryStat[] = [];

  ngOnInit(): void {
    this.subs.add(
      this.authService.currentUser$.subscribe((user) => {
        this.user = user;
        this.load();
      })
    );
    this.subs.add(
      this.businessContext.currentBusiness$.subscribe((business) => {
        const nextBusinessId = business?.id ?? null;
        if (this.activeBusinessId === nextBusinessId) {
          return;
        }

        this.activeBusinessId = nextBusinessId;
        this.prepareForBusinessChange();
        if (this.user && this.isOnline) {
          this.load();
        }
      })
    );

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onOnline);
      window.addEventListener('offline', this.onOffline);
    }
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
    this.subs.unsubscribe();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
    }
  }

  setPeriod(p: 'all' | 'daily' | 'weekly' | 'monthly' | 'custom'): void {
    this.period = p;
    if (p === 'custom') {
      const today = this.formatDateInput(new Date());
      this.fromDate = this.fromDate || today;
      this.toDate = this.toDate || today;
    }
    this.load();
  }

  onCustomDateChange(which: 'from' | 'to', value: string): void {
    if (which === 'from') {
      this.fromDate = value;
    } else {
      this.toDate = value;
    }

    if (this.period !== 'custom') {
      this.period = 'custom';
    }

    this.load();
  }

  private load(): void {
    this.loadSub?.unsubscribe();
    this.loading = true;
    if (this.user && this.isOnline) {
      this.dataMode = 'cloud';
      this.loadRemote();
    } else {
      this.dataMode = 'local';
      this.loadLocal();
    }
  }

  private loadRemote(): void {
    const name = this.user!.email ? `${this.user!.email.split('@')[0]}'s Business` : 'My Business';
    const customRange = this.getNormalizedCustomRange();
    this.loadSub = this.businessContext
      .ensureBusinessReady(name)
      .pipe(
        switchMap((business) =>
          business
            ? forkJoin({
                business: of(business),
                transactions: this.fetchAllReportTransactions(customRange).pipe(
                  catchError(() => of({ items: [], page: 1, limit: 500, total: 0, summary: { totalIn: 0, totalOut: 0, net: 0 } }))
                ),
                dashboard:
                  this.period === 'custom' || this.period === 'all'
                    ? of(null)
                    : this.cashflowApiService
                        .getDashboardReport(new Date().toISOString().split('T')[0])
                        .pipe(catchError(() => of(null))),
                settings: this.cashflowApiService.getSettings().pipe(catchError(() => of(null))),
              })
            : of({ business: null, transactions: { items: [], page: 1, limit: 500, total: 0, summary: { totalIn: 0, totalOut: 0, net: 0 } }, dashboard: null, settings: null })
        )
      )
      .subscribe({
        next: ({ business, transactions, dashboard, settings }) => {
          this.noBusinessAccess = !business;
          this.currencyCode = settings?.currency || 'INR';
          const txns = transactions.items.map(mapTransactionItemToCashTransaction);
          if (business && dashboard) {
            this.applyRemote(dashboard, txns);
          } else {
            this.applyCloudTransactionSummary(txns, transactions.summary);
          }
          this.loading = false;
          this.businessContext.completeBusinessSwitch();
        },
        error: () => {
          this.dataMode = 'local';
          this.loadLocal();
        },
      });
  }

  private loadLocal(): void {
    this.noBusinessAccess = false;
    this.loadSub = this.cashflowService.transactions$.subscribe((txns) => {
      this.applyLocal(txns);
      this.loading = false;
      this.businessContext.completeBusinessSwitch();
    });
  }

  private prepareForBusinessChange(): void {
    this.loadSub?.unsubscribe();
    this.loading = true;
    this.noBusinessAccess = false;
    this.totalIn = 0;
    this.totalOut = 0;
    this.net = 0;
    this.categoryStats = [];
    this.incomeStats = [];
  }

  private applyRemote(d: DashboardReportResponse, txns: CashTransaction[]): void {
    const periodData = this.period === 'daily' ? d.daily : this.period === 'weekly' ? d.weekly : d.monthly;
    this.totalIn = periodData.totalIn;
    this.totalOut = periodData.totalOut;
    this.net = periodData.net;

    const filtered = this.filterByPeriod(txns);
    this.buildCategoryStats(filtered.filter((t) => t.type === 'cash-out'));

    if (this.period === 'monthly' && d.expenseCategories?.length) {
      this.categoryStats = d.expenseCategories.map((item, i) => ({
        category: item.category,
        total: item.amount,
        percentage: item.percentage,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
    }

    const incomeFiltered = this.filterByPeriod(txns).filter((t) => t.type === 'cash-in');
    this.buildIncomeStats(incomeFiltered);
    if (this.period === 'monthly' && d.incomeCategories?.length) {
      this.incomeStats = d.incomeCategories.map((item, i) => ({
        category: item.category,
        total: item.amount,
        percentage: item.percentage,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
    }
  }

  private applyLocal(txns: CashTransaction[]): void {
    const filtered = this.filterByPeriod(txns);
    this.totalIn = filtered.filter((t) => t.type === 'cash-in').reduce((s, t) => s + t.amount, 0);
    this.totalOut = filtered.filter((t) => t.type === 'cash-out').reduce((s, t) => s + t.amount, 0);
    this.net = this.totalIn - this.totalOut;
    this.buildCategoryStats(filtered.filter((t) => t.type === 'cash-out'));
    this.buildIncomeStats(filtered.filter((t) => t.type === 'cash-in'));
  }

  private filterByPeriod(txns: CashTransaction[]): CashTransaction[] {
    const now = new Date();
    return txns.filter((t) => {
      const d = new Date(t.timestamp);
      if (this.period === 'all') {
        return true;
      }

      if (this.period === 'custom') {
        const customRange = this.getNormalizedCustomRange();
        if (!customRange) {
          return true;
        }

        const start = new Date(`${customRange.from}T00:00:00.000Z`);
        const end = new Date(`${customRange.to}T23:59:59.999Z`);
        return d >= start && d <= end;
      }

      if (this.period === 'daily') {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      }
      if (this.period === 'weekly') {
        const day = now.getDay(); const offset = day === 0 ? -6 : 1 - day;
        const start = new Date(now); start.setDate(now.getDate() + offset); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
        return d >= start && d <= end;
      }
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }

  private applyCloudTransactionSummary(
    txns: CashTransaction[],
    summary: { totalIn: number; totalOut: number; net: number }
  ): void {
    this.totalIn = summary.totalIn;
    this.totalOut = summary.totalOut;
    this.net = summary.net;
    this.buildCategoryStats(txns.filter((t) => t.type === 'cash-out'));
    this.buildIncomeStats(txns.filter((t) => t.type === 'cash-in'));
  }

  private fetchAllReportTransactions(customRange: { from: string; to: string } | null) {
    const baseParams = {
      limit: 500,
      from: customRange?.from,
      to: customRange?.to,
    };

    return this.cashflowApiService.listTransactions({ ...baseParams, page: 1 }).pipe(
      switchMap((firstPage) => {
        const totalPages = Math.max(1, Math.ceil(firstPage.total / firstPage.limit));
        if (totalPages === 1) {
          return of(firstPage);
        }

        const requests = Array.from({ length: totalPages - 1 }, (_, index) =>
          this.cashflowApiService.listTransactions({
            ...baseParams,
            page: index + 2,
          })
        );

        return forkJoin(requests).pipe(
          switchMap((remainingPages) =>
            of({
              ...firstPage,
              items: [
                ...firstPage.items,
                ...remainingPages.flatMap((page) => page.items),
              ],
            })
          )
        );
      })
    );
  }

  private buildCategoryStats(expenses: CashTransaction[]): void {
    const total = expenses.reduce((s, t) => s + t.amount, 0);
    const grouped = new Map<string, number>();
    expenses.forEach((t) => grouped.set(t.category, (grouped.get(t.category) || 0) + t.amount));
    this.categoryStats = [...grouped.entries()]
      .map(([category, amount], i) => ({
        category,
        total: amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .sort((a, b) => b.total - a.total);
  }

  private buildIncomeStats(income: CashTransaction[]): void {
    const total = income.reduce((s, t) => s + t.amount, 0);
    const grouped = new Map<string, number>();
    income.forEach((t) => grouped.set(t.category, (grouped.get(t.category) || 0) + t.amount));
    this.incomeStats = [...grouped.entries()]
      .map(([category, amount], i) => ({
        category,
        total: amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .sort((a, b) => b.total - a.total);
  }

  private getNormalizedCustomRange(): { from: string; to: string } | null {
    if (this.period !== 'custom') {
      return null;
    }

    if (!this.fromDate && !this.toDate) {
      return null;
    }

    const from = this.fromDate || this.toDate;
    const to = this.toDate || this.fromDate;

    if (!from || !to) {
      return null;
    }

    return from <= to ? { from, to } : { from: to, to: from };
  }

  private formatDateInput(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private onOnline = (): void => { this.isOnline = true; this.load(); };
  private onOffline = (): void => { this.isOnline = false; this.load(); };
}
