import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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

interface Summary {
  totalIn: number;
  totalOut: number;
  profit: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private cashflowService = inject(CashflowService);
  private cashflowApiService = inject(CashflowApiService);
  private businessContext = inject(BusinessContextService);
  private router = inject(Router);
  private subs = new Subscription();

  user: User | null = null;
  recentTransactions: CashTransaction[] = [];
  dailySummary: Summary = { totalIn: 0, totalOut: 0, profit: 0 };
  weeklySummary: Summary = { totalIn: 0, totalOut: 0, profit: 0 };
  monthlySummary: Summary = { totalIn: 0, totalOut: 0, profit: 0 };

  dataMode: 'cloud' | 'local' = 'local';
  isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  currencyCode = 'INR';
  loading = true;
  private activeBusinessId: string | null = null;

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
    this.subs.unsubscribe();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
    }
  }

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  get displayName(): string {
    return this.user?.email?.split('@')[0] ?? '';
  }

  get today(): string {
    return new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  navigateToAdd(): void {
    this.router.navigate(['/transactions'], { queryParams: { add: '1' } });
  }

  private load(): void {
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
    const businessName = this.user!.email
      ? `${this.user!.email.split('@')[0]}'s Business`
      : 'My Business';

    this.subs.add(
      this.businessContext
          .ensureBusinessReady(businessName)
        .pipe(
          switchMap(() =>
            forkJoin({
              transactions: this.cashflowApiService
                .listTransactions({ page: 1, limit: 5 })
                .pipe(catchError(() => of({ items: [], page: 1, limit: 5, total: 0, summary: { totalIn: 0, totalOut: 0, net: 0 } }))),
              dashboard: this.cashflowApiService
                .getDashboardReport(new Date().toISOString().split('T')[0])
                .pipe(catchError(() => of(null))),
              settings: this.cashflowApiService.getSettings().pipe(catchError(() => of(null))),
            })
          )
        )
        .subscribe({
          next: ({ transactions, dashboard, settings }) => {
            this.recentTransactions = transactions.items.map(mapTransactionItemToCashTransaction).slice(0, 5);
            this.currencyCode = settings?.currency || 'INR';
            this.applyDashboard(dashboard);
            this.loading = false;
          },
          error: () => {
            this.dataMode = 'local';
            this.loadLocal();
          },
        })
    );
  }

  private loadLocal(): void {
    this.subs.add(
      this.cashflowService.transactions$.subscribe((txns) => {
        const sorted = [...txns].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        this.recentTransactions = sorted.slice(0, 5);
        const now = new Date();
        this.dailySummary = this.calcSummary(txns.filter((t) => this.isSameDay(new Date(t.timestamp), now)));
        this.weeklySummary = this.calcSummary(txns.filter((t) => this.isThisWeek(new Date(t.timestamp), now)));
        this.monthlySummary = this.calcSummary(txns.filter((t) =>
          new Date(t.timestamp).getMonth() === now.getMonth() &&
          new Date(t.timestamp).getFullYear() === now.getFullYear()
        ));
        this.loading = false;
      })
    );
  }

  private applyDashboard(d: DashboardReportResponse | null): void {
    if (!d) return;
    this.dailySummary = { totalIn: d.daily.totalIn, totalOut: d.daily.totalOut, profit: d.daily.net };
    this.weeklySummary = { totalIn: d.weekly.totalIn, totalOut: d.weekly.totalOut, profit: d.weekly.net };
    this.monthlySummary = { totalIn: d.monthly.totalIn, totalOut: d.monthly.totalOut, profit: d.monthly.net };
  }

  private calcSummary(txns: CashTransaction[]): Summary {
    const totalIn = txns.filter((t) => t.type === 'cash-in').reduce((s, t) => s + t.amount, 0);
    const totalOut = txns.filter((t) => t.type === 'cash-out').reduce((s, t) => s + t.amount, 0);
    return { totalIn, totalOut, profit: totalIn - totalOut };
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  private isThisWeek(d: Date, now: Date): boolean {
    const day = now.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const start = new Date(now); start.setDate(now.getDate() + offset); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }

  private onOnline = (): void => { this.isOnline = true; this.load(); };
  private onOffline = (): void => { this.isOnline = false; this.load(); };
}
