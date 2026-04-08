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
import { BusinessContextService } from '../../core/services/business-context.service';
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
  private businessContext = inject(BusinessContextService);
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
  importing = false;
  importSuccessMessage = '';
  importErrorMessage = '';
  importDetailedErrors: Array<{
    rowNumber: number;
    message: string;
    date: string;
    amount: string;
    category: string;
  }> = [];
  showImportErrorDetails = false;

  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  editingTransactionId: string | null = null;
  editForm = this.fb.group({
    type: this.fb.nonNullable.control<TransactionType>('cash-in'),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    category: this.fb.nonNullable.control<string>(CASH_IN_CATEGORIES[0], [Validators.required]),
    timestamp: this.fb.nonNullable.control<string>(this.nowLocal(), [Validators.required]),
    note: this.fb.nonNullable.control<string>(''),
  });
  editSuccess = false;
  editError = '';

  selectedIds = new Set<string>();
  showBulkDeleteConfirm = false;

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
  searchTerm = '';
  categoryFilter = '';
  fromDate = '';
  toDate = '';
  sortBy: 'occurredAt' | 'amount' | 'categoryName' = 'occurredAt';
  sortOrder: 'asc' | 'desc' = 'desc';
  currentPage = 1;
  pageSize = 20;
  totalItems = 0;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  get filteredTransactions(): CashTransaction[] {
    let result = [...this.transactions];

    if (this.dataMode === 'cloud') {
      return result;
    }

    if (this.filterType !== 'all') {
      result = result.filter((item) => item.type === this.filterType);
    }

    if (this.searchTerm.trim()) {
      const search = this.searchTerm.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.category.toLowerCase().includes(search) ||
          (item.note || '').toLowerCase().includes(search)
      );
    }

    if (this.categoryFilter) {
      result = result.filter((item) => item.category === this.categoryFilter);
    }

    if (this.fromDate) {
      const from = new Date(`${this.fromDate}T00:00:00.000Z`).getTime();
      result = result.filter((item) => new Date(item.timestamp).getTime() >= from);
    }

    if (this.toDate) {
      const to = new Date(`${this.toDate}T23:59:59.999Z`).getTime();
      result = result.filter((item) => new Date(item.timestamp).getTime() <= to);
    }

    result.sort((left, right) => {
      let compare = 0;

      if (this.sortBy === 'amount') {
        const leftSigned = left.type === 'cash-out' ? left.amount * -1 : left.amount;
        const rightSigned = right.type === 'cash-out' ? right.amount * -1 : right.amount;
        compare = leftSigned - rightSigned;
      } else if (this.sortBy === 'categoryName') {
        compare = left.category.localeCompare(right.category);
      } else {
        compare = new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
      }

      return this.sortOrder === 'asc' ? compare : compare * -1;
    });

    return result;
  }

  get pagedTransactions(): CashTransaction[] {
    if (this.dataMode === 'cloud') {
      return this.filteredTransactions;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTransactions.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get startItemIndex(): number {
    if (!this.totalItems) {
      return 0;
    }
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endItemIndex(): number {
    if (!this.totalItems) {
      return 0;
    }
    return Math.min(this.currentPage * this.pageSize, this.totalItems);
  }

  get filterCategoryOptions(): string[] {
    if (this.dataMode === 'cloud') {
      return this.remoteCategories.map((category) => category.id || '').filter(Boolean);
    }

    const categories = new Set(this.transactions.map((item) => item.category));
    return [...categories].sort((a, b) => a.localeCompare(b));
  }

  getCategoryLabel(categoryValue: string): string {
    if (this.dataMode === 'cloud') {
      return this.remoteCategories.find((category) => category.id === categoryValue)?.name || categoryValue;
    }

    return categoryValue;
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  toggleSelect(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  toggleSelectAll(): void {
    if (this.selectedIds.size === this.pagedTransactions.length) {
      this.selectedIds.clear();
    } else {
      this.pagedTransactions.forEach((t) => this.selectedIds.add(t.id));
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  get isAllSelected(): boolean {
    return this.pagedTransactions.length > 0 && this.selectedIds.size === this.pagedTransactions.length;
  }

  showBulkDeleteConfirmDialog(): void {
    if (this.selectedIds.size === 0) {
      return;
    }
    this.showBulkDeleteConfirm = true;
  }

  cancelBulkDelete(): void {
    this.showBulkDeleteConfirm = false;
  }

  confirmBulkDelete(): void {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) {
      this.cancelBulkDelete();
      return;
    }

    this.subs.add(
      this.cashflowApiService.bulkDeleteTransactions(ids).subscribe({
        next: (result) => {
          this.selectedIds.clear();
          this.showBulkDeleteConfirm = false;
          this.loadRemote();
        },
        error: (err) => {
          console.error('Bulk delete error:', err);
          this.showBulkDeleteConfirm = false;
        },
      })
    );
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
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
    }
  }

  toggleForm(): void {
    this.showForm = !this.showForm;

    if (!this.showForm) {
      this.resetEntryForm();
    }
  }

  setFilter(f: 'all' | 'cash-in' | 'cash-out'): void {
    this.filterType = f;
    this.refreshFilters();
  }

  onSearchInput(value: string): void {
    this.searchTerm = value;

    if (this.dataMode !== 'cloud') {
      this.refreshFilters();
      return;
    }

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.refreshFilters();
    }, 350);
  }

  onCategoryFilterChange(value: string): void {
    this.categoryFilter = value;
    this.refreshFilters();
  }

  onDateFilterChange(which: 'from' | 'to', value: string): void {
    if (which === 'from') {
      this.fromDate = value;
    } else {
      this.toDate = value;
    }
    this.refreshFilters();
  }

  onSortChange(value: string): void {
    const [sortBy, sortOrder] = value.split(':');
    if (
      (sortBy === 'occurredAt' || sortBy === 'amount' || sortBy === 'categoryName') &&
      (sortOrder === 'asc' || sortOrder === 'desc')
    ) {
      this.sortBy = sortBy;
      this.sortOrder = sortOrder;
      this.refreshFilters();
    }
  }

  onPageSizeChange(value: string): void {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 10 || parsed > 200) {
      return;
    }

    this.pageSize = parsed;
    this.currentPage = 1;
    this.refreshFilters(false);
  }

  goToPage(page: number): void {
    const target = Math.min(Math.max(page, 1), this.totalPages);
    if (target === this.currentPage) {
      return;
    }

    this.currentPage = target;
    if (this.dataMode === 'cloud') {
      this.loadRemote();
    }
  }

  get selectedSortOption(): string {
    return `${this.sortBy}:${this.sortOrder}`;
  }

  resetFilters(): void {
    this.filterType = 'all';
    this.searchTerm = '';
    this.categoryFilter = '';
    this.fromDate = '';
    this.toDate = '';
    this.sortBy = 'occurredAt';
    this.sortOrder = 'desc';
    this.refreshFilters();
  }

  triggerImport(input: HTMLInputElement): void {
    this.importErrorMessage = '';
    this.importSuccessMessage = '';
    input.click();
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!this.user || !this.isOnline || this.dataMode !== 'cloud') {
      this.importErrorMessage = 'Bulk import is available only when you are signed in and online.';
      input.value = '';
      return;
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.tsv') && !lowerName.endsWith('.txt')) {
      this.importErrorMessage = 'Please upload a CSV, TSV, or TXT file.';
      input.value = '';
      return;
    }

    this.importing = true;
    this.importErrorMessage = '';
    this.importSuccessMessage = '';
    this.importDetailedErrors = [];
    this.showImportErrorDetails = false;

    this.subs.add(
      this.cashflowApiService.importTransactions(file).subscribe({
        next: (result) => {
          const parts = [`Imported ${result.createdCount} transaction(s)`];
          if (result.skippedCount) {
            parts.push(`${result.skippedCount} skipped`);
          }
          if (result.categoriesCreated) {
            parts.push(`${result.categoriesCreated} category(s) added`);
          }
          if (result.errors.length) {
            parts.push(`${result.errors.length} row error(s) — view details`);
            this.importDetailedErrors = result.errors;
            this.showImportErrorDetails = true;
          }
          this.importSuccessMessage = parts.join(' · ');
          this.loadRemote();
        },
        error: (err) => {
          this.importErrorMessage = err?.error?.message || 'Unable to import file';
          this.importDetailedErrors = [];
          this.showImportErrorDetails = false;
        },
        complete: () => {
          this.importing = false;
          input.value = '';
        },
      })
    );
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
               this.showToast(this.categoryErrorMessage, 'error');
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
          .subscribe({
            next: () => {
              this.resetForm();
              this.loadRemote();
            },
            error: (err) => {
              this.showToast(
                err?.error?.message || 'Failed to create transaction',
                'error'
              );
            },
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

  openEdit(transaction: CashTransaction): void {
    if (this.dataMode !== 'cloud') {
      return;
    }

    this.editingTransactionId = transaction.id;
    this.editSuccess = false;
    this.editError = '';

    const category = this.remoteCategories.find((c) => c.name === transaction.category);
    const type = transaction.type as TransactionType;
    const dateStr = new Date(transaction.timestamp);
    const localDateTime = new Date(dateStr.getTime() - dateStr.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);

    this.editForm.reset({
      type,
      amount: transaction.amount,
      category: transaction.category,
      timestamp: localDateTime,
      note: transaction.note || '',
    });
  }

  closeEdit(): void {
    this.editingTransactionId = null;
    this.editSuccess = false;
    this.editError = '';
    this.editForm.reset({
      type: 'cash-in',
      amount: null,
      category: this.currentCategories[0] || CASH_IN_CATEGORIES[0],
      timestamp: this.nowLocal(),
      note: '',
    });
  }

  submitEdit(): void {
    if (!this.editingTransactionId || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const v = this.editForm.getRawValue();
    const category = this.remoteCategories.find((c) => c.name === v.category);

    if (!category?.id) {
      this.editError = 'Category not found';
      return;
    }

    this.subs.add(
      this.cashflowApiService
        .updateTransaction(this.editingTransactionId, {
          type: v.type,
          amount: Number(v.amount),
          categoryId: category.id,
          occurredAt: new Date(v.timestamp).toISOString(),
          note: v.note,
        })
        .subscribe({
          next: () => {
            this.editSuccess = true;
            setTimeout(() => {
              this.closeEdit();
              this.loadRemote();
            }, 1500);
          },
          error: (err) => {
            this.editError = err?.error?.message || 'Unable to update transaction';
          },
        })
    );
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
      this.businessContext
        .ensureBusinessReady(name)
        .pipe(
          switchMap(() =>
            forkJoin({
              categories: this.cashflowApiService.getCategories().pipe(catchError(() => of([]))),
              transactions: this.cashflowApiService
                .listTransactions(this.buildTransactionQuery())
                .pipe(catchError(() => of({ items: [], page: 1, limit: this.pageSize, total: 0, summary: { totalIn: 0, totalOut: 0, net: 0 } }))),
              settings: this.cashflowApiService.getSettings().pipe(catchError(() => of(null))),
            })
          )
        )
        .subscribe({
          next: ({ categories, transactions, settings }) => {
            this.remoteCategories = categories;
            this.transactions = transactions.items.map(mapTransactionItemToCashTransaction);
            this.currentPage = transactions.page;
            this.pageSize = transactions.limit;
            this.totalItems = transactions.total;
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
        this.totalItems = this.filteredTransactions.length;
        if (this.currentPage > this.totalPages) {
          this.currentPage = this.totalPages;
        }
        this.loading = false;
      })
    );
  }

  private buildTransactionQuery(): Record<string, string | number | undefined> {
    return {
      page: this.currentPage,
      limit: this.pageSize,
      search: this.searchTerm.trim() || undefined,
      type: this.filterType === 'all' ? undefined : this.filterType,
      categoryId: this.categoryFilter || undefined,
      from: this.fromDate || undefined,
      to: this.toDate || undefined,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
    };
  }

  private refreshFilters(resetPage: boolean = true): void {
    if (resetPage) {
      this.currentPage = 1;
    }

    if (this.dataMode === 'cloud' && this.user && this.isOnline) {
      this.loadRemote();
      return;
    }

    this.totalItems = this.filteredTransactions.length;
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
  }

  private showToast(message: string, type: 'success' | 'error' = 'success'): void {
    // Clear existing timer if any
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastMessage = message;
    this.toastType = type;

    // Auto-dismiss after 3.5 seconds
    this.toastTimer = setTimeout(() => {
      this.toastMessage = null;
      this.toastTimer = null;
    }, 3500);
  }

  private resetForm(): void {
    this.categorySuccess = false;
    this.resetEntryForm();
    this.showToast('Transaction created successfully!', 'success');
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
