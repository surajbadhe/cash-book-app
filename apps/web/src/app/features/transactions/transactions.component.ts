import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/auth.models';
import {
  CASH_IN_CATEGORIES,
  CASH_OUT_CATEGORIES,
  CashTransaction,
  TransactionType,
} from '../../core/models/cashflow.models';
import {
  CategoryItem,
  mapTransactionItemToCashTransaction,
} from '../../core/models/cashflow-api.models';
import { CashflowApiService } from '../../core/services/cashflow-api.service';
import { CashflowService } from '../../core/services/cashflow.service';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './transactions.component.html',
  styleUrls: ['./transactions.component.scss'],
})
export class TransactionsComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private cashflowService = inject(CashflowService);
  private cashflowApiService = inject(CashflowApiService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private subs = new Subscription();

  user: User | null = null;
  transactions: CashTransaction[] = [];
  remoteCategories: CategoryItem[] = [];
  cashInCategories = [...CASH_IN_CATEGORIES];
  cashOutCategories = [...CASH_OUT_CATEGORIES];

  dataMode: 'cloud' | 'local' = 'local';
  isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  currencyCode = 'INR';
  loading = false;
  showForm = false;
  formSuccess = false;
  showCategoryForm = false;
  categorySuccess = false;
  creatingCategory = false;
  categoryErrorMessage = '';

  form = this.fb.group({
    type: this.fb.nonNullable.control<TransactionType>('cash-in'),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    category: this.fb.nonNullable.control<string>(CASH_IN_CATEGORIES[0], [Validators.required]),
    timestamp: this.fb.nonNullable.control<string>(this.nowLocal(), [Validators.required]),
    note: this.fb.nonNullable.control<string>(''),
  });

  categoryForm = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]),
    type: this.fb.nonNullable.control<TransactionType>('cash-in'),
  });

  filterType: 'all' | 'cash-in' | 'cash-out' = 'all';

  get filteredTransactions(): CashTransaction[] {
    if (this.filterType === 'all') return this.transactions;
    return this.transactions.filter((t) => t.type === this.filterType);
  }

  get currentCategories(): string[] {
    const type = this.form.controls.type.value;
    if (this.dataMode === 'cloud' && this.remoteCategories.length) {
      return this.remoteCategories.filter((c) => c.type === type).map((c) => c.name);
    }
    return type === 'cash-in' ? this.cashInCategories : this.cashOutCategories;
  }

  ngOnInit(): void {
    this.subs.add(
      this.authService.currentUser$.subscribe((user) => {
        this.user = user;
        this.load();
      })
    );

    this.subs.add(
      this.form.controls.type.valueChanges.subscribe((type) => {
        const cats = type === 'cash-in' ? this.cashInCategories : this.cashOutCategories;
        const remoteCats = this.remoteCategories.filter((c) => c.type === type).map((c) => c.name);
        this.form.controls.category.setValue(
          this.dataMode === 'cloud' && remoteCats.length ? remoteCats[0] : cats[0]
        );
      })
    );

    // Open form if navigated with ?add=1
    this.route.queryParams.subscribe((p) => {
      if (p['add'] === '1') this.showForm = true;
    });

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

  toggleForm(): void {
    this.showForm = !this.showForm;
    this.formSuccess = false;

    if (!this.showForm) {
      this.resetEntryForm();
    }
  }

  setFilter(f: 'all' | 'cash-in' | 'cash-out'): void {
    this.filterType = f;
  }

  toggleCategoryForm(): void {
    this.showCategoryForm = !this.showCategoryForm;
    this.categoryErrorMessage = '';
    this.categorySuccess = false;
    this.categoryForm.reset({
      name: '',
      type: this.form.controls.type.value,
    });
  }

  submitCategory(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const value = this.categoryForm.getRawValue();
    const name = value.name.trim();
    const type = value.type;

    if (!name) {
      this.categoryErrorMessage = 'Category name is required';
      return;
    }

    this.categoryErrorMessage = '';

    if (this.dataMode === 'cloud' && this.user && this.isOnline) {
      this.creatingCategory = true;
      this.subs.add(
        this.cashflowApiService.createCategory({ name, type }).subscribe({
          next: (created) => {
            this.remoteCategories = [...this.remoteCategories, created].sort(
              (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
            );
            this.form.controls.type.setValue(type);
            this.form.controls.category.setValue(created.name);
            this.categorySuccess = true;
            this.showCategoryForm = false;
            this.categoryForm.reset({ name: '', type });
          },
          error: (err) => {
            this.categoryErrorMessage = err?.error?.message || 'Unable to create category';
          },
          complete: () => {
            this.creatingCategory = false;
          },
        })
      );
      return;
    }

    const targetList = type === 'cash-in' ? this.cashInCategories : this.cashOutCategories;
    const exists = targetList.some((item) => item.toLowerCase() === name.toLowerCase());
    if (exists) {
      this.categoryErrorMessage = 'Category already exists';
      return;
    }

    targetList.push(name);
    this.form.controls.type.setValue(type);
    this.form.controls.category.setValue(name);
    this.categorySuccess = true;
    this.showCategoryForm = false;
    this.categoryForm.reset({ name: '', type });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();

    if (this.dataMode === 'cloud' && this.user && this.isOnline) {
      const cat = this.remoteCategories.find((c) => c.type === v.type && c.name === v.category);
      if (!cat?.id) {
        this.form.controls.category.markAsTouched();
        this.form.controls.category.setErrors({ required: true });
        return;
      }

      this.subs.add(
        this.cashflowApiService
          .createTransaction({
            type: v.type,
            amount: Number(v.amount),
            categoryId: cat.id,
            occurredAt: new Date(v.timestamp).toISOString(),
            note: v.note,
          })
          .subscribe(() => {
            this.resetForm();
            this.loadRemote();
          })
      );
    } else {
      this.cashflowService.addTransaction({
        type: v.type,
        amount: Number(v.amount),
        category: v.category,
        timestamp: new Date(v.timestamp).toISOString(),
        note: v.note,
      });
      this.resetForm();
    }
  }

  delete(id: string): void {
    if (this.dataMode === 'cloud' && this.user && this.isOnline) {
      this.subs.add(this.cashflowApiService.deleteTransaction(id).subscribe(() => this.loadRemote()));
    } else {
      this.cashflowService.deleteTransaction(id);
    }
  }

  private load(): void {
    if (this.user && this.isOnline) {
      this.dataMode = 'cloud';
      this.loadRemote();
    } else {
      this.dataMode = 'local';
      this.loadLocal();
    }
  }

  private loadRemote(): void {
    this.loading = true;
    const name = this.user!.email ? `${this.user!.email.split('@')[0]}'s Business` : 'My Business';
    this.subs.add(
      this.cashflowApiService
        .ensureBusinessSetup(name)
        .pipe(
          switchMap(() =>
            forkJoin({
              categories: this.cashflowApiService.getCategories().pipe(catchError(() => of([]))),
              transactions: this.cashflowApiService
                .listTransactions({ page: 1, limit: 200 })
                .pipe(catchError(() => of({ items: [], page: 1, limit: 200, total: 0, summary: { totalIn: 0, totalOut: 0, net: 0 } }))),
              settings: this.cashflowApiService.getSettings().pipe(catchError(() => of(null))),
            })
          )
        )
        .subscribe({
          next: ({ categories, transactions, settings }) => {
            this.remoteCategories = categories;
            this.transactions = transactions.items.map(mapTransactionItemToCashTransaction);
            this.currencyCode = settings?.currency || 'INR';
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
        this.transactions = [...txns].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        this.loading = false;
      })
    );
  }

  private resetForm(): void {
    this.formSuccess = true;
    this.categorySuccess = false;
    this.resetEntryForm();
    setTimeout(() => { this.formSuccess = false; }, 2000);
  }

  private resetEntryForm(): void {
    this.showCategoryForm = false;
    this.categoryErrorMessage = '';
    this.form.reset({
      type: 'cash-in',
      amount: null,
      category: this.currentCategories[0] || CASH_IN_CATEGORIES[0],
      timestamp: this.nowLocal(),
      note: '',
    });
  }

  private nowLocal(): string {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }

  private onOnline = (): void => { this.isOnline = true; this.load(); };
  private onOffline = (): void => { this.isOnline = false; this.load(); };
}
