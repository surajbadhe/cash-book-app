import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellClickedEvent,
  ClientSideRowModelModule,
  ColDef,
  GridApi,
  GridReadyEvent,
  RowSelectionModule,
  GetRowIdFunc,
  SelectionChangedEvent,
} from 'ag-grid-community';
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
  imports: [CommonModule, ReactiveFormsModule, AgGridAngular],
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
  noBusinessAccess = false;
  showForm = false;
  formSuccess = false;
  showCategoryForm = false;
  categorySuccess = false;
  creatingCategory = false;
  categoryErrorMessage = '';
  importing = false;
  importSuccessMessage = '';
  importErrorMessage = '';
  showSessionRecoveryActions = false;
  sessionRecoveryInProgress = false;
  importIssueRows: Array<{
    kind: 'error' | 'skipped';
    rowNumber: number;
    message: string;
    date: string;
    time: string;
    cashin: string;
    cashout: string;
    category: string;
    remark: string;
  }> = [];
  showImportDetailsDialog = false;

  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  editingTransactionId: string | null = null;
  private editingOriginalTimestamp: string | null = null;
  readonly modeOptions = ['Cash', 'UPI', 'Card', 'Bank'];
  editForm = this.fb.group({
    type: this.fb.nonNullable.control<TransactionType>('cash-in'),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    category: this.fb.nonNullable.control<string>(CASH_IN_CATEGORIES[0], [Validators.required]),
    timestamp: this.fb.nonNullable.control<string>(this.nowLocal(), [Validators.required]),
    party: this.fb.nonNullable.control<string>(''),
    mode: this.fb.nonNullable.control<string>('Cash'),
    entryBy: this.fb.nonNullable.control<string>(this.defaultEntryBy()),
    note: this.fb.nonNullable.control<string>(''),
  });
  editSuccess = false;
  editError = '';

  selectedIds = new Set<string>();
  showBulkDeleteConfirm = false;
  bulkDeleteInProgress = false;
  bulkDeleteMode: 'selected' | 'all' = 'selected';

  form = this.fb.group({
    type: this.fb.nonNullable.control<TransactionType>('cash-in'),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    category: this.fb.nonNullable.control<string>(CASH_IN_CATEGORIES[0], [Validators.required]),
    timestamp: this.fb.nonNullable.control<string>(this.nowLocal(), [Validators.required]),
    party: this.fb.nonNullable.control<string>(''),
    mode: this.fb.nonNullable.control<string>('Cash'),
    entryBy: this.fb.nonNullable.control<string>(this.defaultEntryBy()),
    note: this.fb.nonNullable.control<string>(''),
  });

  categoryForm = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]),
    type: this.fb.nonNullable.control<TransactionType>('cash-in'),
  });

  filterType: 'all' | 'cash-in' | 'cash-out' = 'all';
  searchTerm = '';
  categoryFilter = '';
  partyFilter = '';
  memberFilter = '';
  paymentModeFilter = '';
  durationFilter: 'all' | 'today' | 'yesterday' | 'this-week' | 'last-7' | 'this-month' | 'last-month' = 'all';
  fromDate = '';
  toDate = '';
  datePreset: 'today' | 'yesterday' | 'this-week' | 'last-7' | 'this-month' | 'last-month' | 'custom' | '' = '';

  readonly datePresets: Array<{ label: string; value: 'today' | 'yesterday' | 'this-week' | 'last-7' | 'this-month' | 'last-month' | 'custom' }> = [
    { label: 'Today',       value: 'today' },
    { label: 'Yesterday',   value: 'yesterday' },
    { label: 'This Week',   value: 'this-week' },
    { label: 'Last 7 Days', value: 'last-7' },
    { label: 'This Month',  value: 'this-month' },
    { label: 'Last Month',  value: 'last-month' },
    { label: 'Custom',      value: 'custom' },
  ];
  readonly durationOptions: Array<{ label: string; value: 'all' | 'today' | 'yesterday' | 'this-week' | 'last-7' | 'this-month' | 'last-month' }> = [
    { label: 'All Time', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'This Week', value: 'this-week' },
    { label: 'Last 7 Days', value: 'last-7' },
    { label: 'This Month', value: 'this-month' },
    { label: 'Last Month', value: 'last-month' },
  ];
  sortBy: 'occurredAt' | 'amount' | 'categoryName' = 'occurredAt';
  sortOrder: 'asc' | 'desc' = 'desc';
  currentPage = 1;
  pageSize = 20;
  totalItems = 0;
  remoteSummary = { totalIn: 0, totalOut: 0, net: 0 };
  private activeBusinessId: string | null = null;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly agGridStyleUrls = ['assets/ag-grid/ag-grid.css', 'assets/ag-grid/ag-theme-quartz.css'];
  private gridApi: GridApi | null = null;
  readonly gridRowHeight = 60;
  readonly gridHeaderHeight = 52;
  readonly agGridModules = [
    ClientSideRowModelModule,
    RowSelectionModule,
  ];

  readonly defaultColDef: ColDef = {
    sortable: false,
    filter: false,
    floatingFilter: false,
    resizable: true,
    suppressHeaderMenuButton: true,
    cellStyle: {
      display: 'flex',
      alignItems: 'center',
    },
  };

  readonly transactionColumnDefs: ColDef[] = [
    {
      headerName: '',
      colId: 'select',
      width: 44,
      minWidth: 44,
      maxWidth: 52,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      suppressSizeToFit: true,
      resizable: false,
      sortable: false,
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    },
    {
      headerName: 'Date & Time',
      field: 'timestamp',
      minWidth: 130,
      flex: 1.2,
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
      },
      cellRenderer: (params: { value: string | null | undefined }) => this.renderDateTimeCell(params.value),
    },
    {
      headerName: 'Details',
      field: 'details',
      minWidth: 160,
      flex: 1.8,
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
      },
    },
    {
      headerName: 'Category',
      field: 'category',
      minWidth: 120,
      flex: 1.2,
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
      },
    },
    {
      headerName: 'Mode',
      field: 'mode',
      minWidth: 100,
      flex: 0.9,
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
      },
    },
    {
      headerName: 'Amount',
      field: 'transaction',
      minWidth: 110,
      flex: 1,
      headerClass: 'col-header-right',
      cellClass: 'col-cell-right',
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
      },
      valueFormatter: (params) => this.formatSignedAmount(params.value),
      cellRenderer: (params: { value: number | null | undefined }) => {
        const numericValue = Number(params.value);
        const color = numericValue >= 0 ? '#059669' : '#dc2626';
        return `<span style="color:${color};font-weight:700;">${this.formatSignedAmount(params.value)}</span>`;
      },
    },
    {
      headerName: 'Balance',
      field: 'balance',
      minWidth: 120,
      flex: 1,
      headerClass: 'col-header-right',
      cellClass: 'col-cell-right',
      valueFormatter: (params) => this.formatAmount(params.value),
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        color: '#0f172a',
        fontWeight: '700',
      },
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 112,
      minWidth: 104,
      maxWidth: 132,
      suppressSizeToFit: true,
      resizable: false,
      sortable: false,
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
      cellRenderer: (params: { data?: { raw?: CashTransaction } }) => this.renderRowActions(params.data?.raw),
    },
  ];

  readonly getRowId: GetRowIdFunc = (params) => params.data.id;

  get filteredTransactions(): CashTransaction[] {
    let result = [...this.transactions];

    if (this.dataMode !== 'cloud') {
      if (this.filterType !== 'all') {
        result = result.filter((item) => item.type === this.filterType);
      }

      if (this.searchTerm.trim()) {
        const search = this.searchTerm.trim().toLowerCase();
        result = result.filter((item) => this.buildSearchText(item).includes(search));
      }

      if (this.categoryFilter) {
        result = result.filter((item) => this.getCategoryLabel(item.category) === this.categoryFilter);
      }

      if (this.partyFilter) {
        result = result.filter((item) => this.getParty(item) === this.partyFilter);
      }

      if (this.memberFilter) {
        result = result.filter((item) => this.getEntryBy(item) === this.memberFilter);
      }

      if (this.paymentModeFilter) {
        result = result.filter((item) => this.getMode(item) === this.paymentModeFilter);
      }

      if (this.fromDate) {
        const from = new Date(`${this.fromDate}T00:00:00.000Z`).getTime();
        result = result.filter((item) => new Date(item.timestamp).getTime() >= from);
      }

      if (this.toDate) {
        const to = new Date(`${this.toDate}T23:59:59.999Z`).getTime();
        result = result.filter((item) => new Date(item.timestamp).getTime() <= to);
      }
    }

    result.sort((left, right) => this.compareTransactions(left, right));

    return result;
  }

  get totalCashIn(): number {
    if (this.dataMode === 'cloud') {
      return this.remoteSummary.totalIn;
    }

    return this.filteredTransactions
      .filter((item) => item.type === 'cash-in')
      .reduce((total, item) => total + item.amount, 0);
  }

  get totalCashOut(): number {
    if (this.dataMode === 'cloud') {
      return this.remoteSummary.totalOut;
    }

    return this.filteredTransactions
      .filter((item) => item.type === 'cash-out')
      .reduce((total, item) => total + item.amount, 0);
  }

  get netBalance(): number {
    if (this.dataMode === 'cloud') {
      return this.remoteSummary.net;
    }

    return this.totalCashIn - this.totalCashOut;
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

  get runningBalances(): number[] {
    if (this.dataMode === 'cloud') {
      return this.pagedTransactions.map((transaction) => transaction.runningBalance ?? 0);
    }

    // Sort transactions chronologically (oldest first) for correct balance calculation
    const chronological = [...this.pagedTransactions].sort(
      (a, b) => this.compareChronological(a, b)
    );

    // Calculate running balances in chronological order
    let balance = this.getOpeningBalanceForCurrentPage();
    const balanceMap = new Map<string, number>();
    chronological.forEach((transaction) => {
      balance += transaction.type === 'cash-in' ? transaction.amount : -transaction.amount;
      balanceMap.set(transaction.id, balance);
    });

    // Return balances in display order
    return this.pagedTransactions.map((t) => balanceMap.get(t.id) ?? 0);
  }

  get gridRows(): Array<{
    id: string;
    timestamp: string;
    details: string;
    transaction: number;
    remark: string;
    party: string;
    category: string;
    mode: string;
    entryBy: string;
    balance: number;
    raw: CashTransaction;
  }> {
    return this.pagedTransactions.map((transaction, index) => {
      return {
        id: transaction.id,
        timestamp: transaction.timestamp,
        details: this.getRemark(transaction),
        transaction: transaction.type === 'cash-in' ? transaction.amount : transaction.amount * -1,
        remark: this.getRemark(transaction),
        party: this.getParty(transaction),
        category: this.getCategoryLabel(transaction.category),
        mode: this.getMode(transaction),
        entryBy: this.getEntryBy(transaction),
        balance: this.runningBalances[index],
        raw: transaction,
      };
    });
  }

  get filterCategoryOptions(): string[] {
    const categories = new Set(this.transactions.map((item) => this.getCategoryLabel(item.category)));
    return [...categories].sort((a, b) => a.localeCompare(b));
  }

  get filterPartyOptions(): string[] {
    const parties = new Set(this.transactions.map((item) => this.getParty(item)).filter((value) => value !== '-'));
    return [...parties].sort((a, b) => a.localeCompare(b));
  }

  get filterMemberOptions(): string[] {
    const members = new Set(this.transactions.map((item) => this.getEntryBy(item)).filter((value) => value !== '-'));
    return [...members].sort((a, b) => a.localeCompare(b));
  }

  get filterPaymentModeOptions(): string[] {
    const modes = new Set(this.transactions.map((item) => this.getMode(item)).filter((value) => value !== '-'));
    return [...modes].sort((a, b) => a.localeCompare(b));
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

  get hasImportIssues(): boolean {
    return this.importIssueRows.length > 0;
  }

  getRemark(transaction: CashTransaction): string {
    return transaction.note?.trim() || '-';
  }

  getParty(transaction: CashTransaction): string {
    return transaction.party?.trim() || '-';
  }

  getMode(transaction: CashTransaction): string {
    return transaction.mode?.trim() || '-';
  }

  getEntryBy(transaction: CashTransaction): string {
    return transaction.entryBy?.trim() || '-';
  }

  get importErrorCount(): number {
    return this.importIssueRows.filter((row) => row.kind === 'error').length;
  }

  get importSkippedCount(): number {
    return this.importIssueRows.filter((row) => row.kind === 'skipped').length;
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

  onGridSelectionChanged(event: SelectionChangedEvent): void {
    const selectedRows = event.api.getSelectedRows() as Array<{ id: string }>;
    this.selectedIds = new Set(selectedRows.map((row) => row.id));
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.sizeColumnsToFit();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.sizeColumnsToFit();
  }

  private sizeColumnsToFit(): void {
    if (!this.gridApi) {
      return;
    }

    setTimeout(() => this.gridApi?.sizeColumnsToFit(), 0);
  }

  onGridCellClicked(event: CellClickedEvent): void {
    if (event.colDef.field !== 'actions' || !event.data) {
      return;
    }

    const target = event.event?.target as HTMLElement | null;
    const actionButton = target?.closest('button');
    const action = actionButton?.getAttribute('data-action');
    const transaction = (event.data as { raw?: CashTransaction }).raw;

    if (!action || !transaction) {
      return;
    }

    if (action === 'edit' && this.dataMode === 'cloud') {
      this.openEdit(transaction);
      return;
    }

    if (action === 'delete') {
      this.delete(transaction.id);
    }
  }

  showBulkDeleteConfirmDialog(): void {
    if (this.selectedIds.size === 0) {
      return;
    }
    this.bulkDeleteMode = 'selected';
    this.showBulkDeleteConfirm = true;
  }

  showDeleteAllMatchingConfirmDialog(): void {
    if (this.dataMode !== 'cloud' || this.totalItems === 0 || this.bulkDeleteInProgress) {
      return;
    }
    this.bulkDeleteMode = 'all';
    this.showBulkDeleteConfirm = true;
  }

  cancelBulkDelete(): void {
    if (this.bulkDeleteInProgress) {
      return;
    }
    this.showBulkDeleteConfirm = false;
    this.bulkDeleteMode = 'selected';
  }

  confirmBulkDelete(): void {
    if (this.bulkDeleteMode === 'all') {
      this.confirmBulkDeleteAllMatching();
      return;
    }

    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) {
      this.cancelBulkDelete();
      return;
            this.bulkDeleteMode = 'selected';
    }

    this.runBulkDelete(ids, 'Selected transactions deleted.');
  }

  confirmBulkDeleteAllMatching(): void {
    if (this.totalItems === 0 || this.bulkDeleteInProgress) {
      return;
    }

    this.bulkDeleteInProgress = true;
    this.collectAllMatchingTransactionIds(
      (ids) => {
        if (ids.length === 0) {
          this.bulkDeleteInProgress = false;
          this.showBulkDeleteConfirm = false;
          this.bulkDeleteMode = 'selected';
          return;
        }

        this.deleteIdsInChunks(
          ids,
          () => {
            this.bulkDeleteInProgress = false;
            this.selectedIds.clear();
            this.showBulkDeleteConfirm = false;
            this.bulkDeleteMode = 'selected';
            this.showToast('All matching transactions deleted.', 'success');
            this.loadRemote();
          },
          (err) => {
            console.error('Bulk delete all error:', err);
            this.bulkDeleteInProgress = false;
            this.showBulkDeleteConfirm = false;
            this.bulkDeleteMode = 'selected';
            this.showToast(this.getErrorMessage(err, 'Unable to delete all matching transactions.'), 'error');
          }
        );
      },
      (err) => {
        console.error('Collect IDs error:', err);
        this.bulkDeleteInProgress = false;
        this.showBulkDeleteConfirm = false;
        this.bulkDeleteMode = 'selected';
        this.showToast(this.getErrorMessage(err, 'Unable to fetch all records for deletion.'), 'error');
      }
    );
  }

  get canDeleteAllMatching(): boolean {
    return this.totalItems > this.selectedCount;
  }

  private runBulkDelete(ids: string[], successMessage: string): void {
    if (ids.length === 0 || this.bulkDeleteInProgress) {
      return;
    }

    this.bulkDeleteInProgress = true;
    this.deleteIdsInChunks(
      ids,
      () => {
        this.bulkDeleteInProgress = false;
        this.selectedIds.clear();
        this.showBulkDeleteConfirm = false;
        this.bulkDeleteMode = 'selected';
        this.showToast(successMessage, 'success');
        this.loadRemote();
      },
      (err) => {
        console.error('Bulk delete error:', err);
        this.bulkDeleteInProgress = false;
        this.showBulkDeleteConfirm = false;
        this.bulkDeleteMode = 'selected';
        this.showToast(this.getErrorMessage(err, 'Unable to delete selected transactions.'), 'error');
      }
    );
  }

  get bulkDeleteTargetCount(): number {
    return this.bulkDeleteMode === 'all' ? this.totalItems : this.selectedCount;
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    const maybeHttpError = error as { error?: { message?: string }; message?: string } | null;
    return maybeHttpError?.error?.message || maybeHttpError?.message || fallback;
  }

  private deleteIdsInChunks(
    ids: string[],
    onDone: () => void,
    onError: (error: unknown) => void,
  ): void {
    const uniqueIds = [...new Set(ids)];
    const chunkSize = 100;

    const runChunk = (startIndex: number): void => {
      if (startIndex >= uniqueIds.length) {
        onDone();
        return;
      }

      const chunk = uniqueIds.slice(startIndex, startIndex + chunkSize);
      this.subs.add(
        this.cashflowApiService.bulkDeleteTransactions(chunk).subscribe({
          next: () => runChunk(startIndex + chunkSize),
          error: onError,
        })
      );
    };

    runChunk(0);
  }

  private collectAllMatchingTransactionIds(
    onDone: (ids: string[]) => void,
    onError: (error: unknown) => void,
  ): void {
    const query = this.buildTransactionQuery();
    const limit = 200;
    const ids: string[] = [];

    const fetchPage = (page: number): void => {
      this.subs.add(
        this.cashflowApiService
          .listTransactions({
            ...query,
            page,
            limit,
          })
          .subscribe({
            next: (response) => {
              response.items.forEach((item) => {
                if (item.id) {
                  ids.push(item.id);
                }
              });

              const totalPages = Math.max(1, Math.ceil((response.total || 0) / (response.limit || limit)));
              if (page < totalPages) {
                fetchPage(page + 1);
              } else {
                onDone([...new Set(ids)]);
              }
            },
            error: onError,
          })
      );
    };

    fetchPage(1);
  }

  get currentCategories(): string[] {
    const type = this.form.controls.type.value;
    if (this.dataMode === 'cloud' && this.remoteCategories.length) {
      return this.remoteCategories.filter((c) => c.type === type).map((c) => c.name);
    }
    return type === 'cash-in' ? this.cashInCategories : this.cashOutCategories;
  }

  ngOnInit(): void {
    this.ensureAgGridStyles();
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
    this.syncEditModalState(false);
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
    if (this.noBusinessAccess) {
      this.showToast('Create a shop or accept an invite before adding transactions.', 'error');
      return;
    }

    this.showForm = !this.showForm;

    if (!this.showForm) {
      this.resetEntryForm();
    }
  }

  openAddModal(): void {
    if (this.noBusinessAccess) {
      this.showToast('Create a shop or accept an invite before adding transactions.', 'error');
      return;
    }
    this.showForm = true;
    this.resetEntryForm();
  }

  openAddModalWithType(type: TransactionType): void {
    this.showForm = true;
    this.resetEntryForm(type);
  }

  closeAddModal(): void {
    this.showForm = false;
    this.resetEntryForm();
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

  onPartyFilterChange(value: string): void {
    this.partyFilter = value;
    this.refreshFilters();
  }

  onMemberFilterChange(value: string): void {
    this.memberFilter = value;
    this.refreshFilters();
  }

  onPaymentModeFilterChange(value: string): void {
    this.paymentModeFilter = value;
    this.refreshFilters();
  }

  onDurationFilterChange(value: string): void {
    if (value === 'all') {
      this.durationFilter = 'all';
      this.fromDate = '';
      this.toDate = '';
      this.datePreset = '';
      this.refreshFilters();
      return;
    }

    const allowedValues: Array<'today' | 'yesterday' | 'this-week' | 'last-7' | 'this-month' | 'last-month'> = [
      'today', 'yesterday', 'this-week', 'last-7', 'this-month', 'last-month',
    ];
    if (!allowedValues.includes(value as any)) {
      return;
    }

    this.durationFilter = value as 'today' | 'yesterday' | 'this-week' | 'last-7' | 'this-month' | 'last-month';
    this.applyDatePreset(this.durationFilter);
  }

  onDateFilterChange(which: 'from' | 'to', value: string): void {
    if (which === 'from') {
      this.fromDate = value;
    } else {
      this.toDate = value;
    }
    this.datePreset = 'custom';
    this.refreshFilters();
  }

  applyDatePreset(preset: typeof this.datePreset): void {
    this.datePreset = preset;
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
      const s = fmt(today);
      this.fromDate = s;
      this.toDate = s;
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const s = fmt(y);
      this.fromDate = s;
      this.toDate = s;
    } else if (preset === 'this-week') {
      const start = new Date(today);
      start.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Mon
      this.fromDate = fmt(start);
      this.toDate = fmt(today);
    } else if (preset === 'last-7') {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      this.fromDate = fmt(start);
      this.toDate = fmt(today);
    } else if (preset === 'this-month') {
      this.fromDate = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
      this.toDate = fmt(today);
    } else if (preset === 'last-month') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      this.fromDate = fmt(first);
      this.toDate = fmt(last);
    } else if (preset === 'custom') {
      // keep fromDate / toDate as-is, user will pick
      return;
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
    this.durationFilter = 'all';
    this.filterType = 'all';
    this.searchTerm = '';
    this.categoryFilter = '';
    this.partyFilter = '';
    this.memberFilter = '';
    this.paymentModeFilter = '';
    this.fromDate = '';
    this.toDate = '';
    this.datePreset = '';
    this.sortBy = 'occurredAt';
    this.sortOrder = 'desc';
    this.refreshFilters();
  }

  triggerImport(input: HTMLInputElement): void {
    this.importErrorMessage = '';
    this.importSuccessMessage = '';
    this.showSessionRecoveryActions = false;
    input.click();
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!this.user) {
      this.importErrorMessage = 'Your session is no longer active. Please log in again.';
      this.showSessionRecoveryActions = true;
      input.value = '';
      return;
    }

    if (!this.isOnline) {
      this.importErrorMessage = 'You are offline. Connect to the internet to use bulk import.';
      this.showSessionRecoveryActions = false;
      input.value = '';
      return;
    }

    if (this.dataMode !== 'cloud') {
      this.importErrorMessage =
        'Your cloud session is unavailable right now. Continue session or log in again to use bulk import.';
      this.showSessionRecoveryActions = true;
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
    this.showSessionRecoveryActions = false;
    this.importSuccessMessage = '';
    this.importIssueRows = [];
    this.showImportDetailsDialog = false;

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
          this.importIssueRows = [
            ...(result.errors || []).map((row) => ({
              kind: 'error' as const,
              rowNumber: row.rowNumber,
              message: row.message,
              date: row.date,
              time: row.time || '',
              cashin: row.cashin || '',
              cashout: row.cashout || '',
              category: row.category || '',
              remark: row.remark || '',
            })),
            ...(result.skippedRows || []).map((row) => ({
              kind: 'skipped' as const,
              rowNumber: row.rowNumber,
              message: row.message,
              date: row.date,
              time: row.time || '',
              cashin: row.cashin || '',
              cashout: row.cashout || '',
              category: row.category || '',
              remark: row.remark || '',
            })),
          ].sort((left, right) => left.rowNumber - right.rowNumber);

          if (this.importIssueRows.length) {
            const errorCount = this.importErrorCount;
            const skippedCount = this.importSkippedCount;
            if (errorCount) {
              parts.push(`${errorCount} failed`);
            }
            if (skippedCount) {
              parts.push(`${skippedCount} skipped with details`);
            }
          }
          this.importSuccessMessage = parts.join(' · ');
          this.loadRemote();
        },
        error: (err) => {
          this.importErrorMessage = err?.error?.message || 'Unable to import file';
          this.showSessionRecoveryActions =
            err?.status === 401 || err?.status === 403 || this.dataMode !== 'cloud';
          this.importIssueRows = [];
          this.showImportDetailsDialog = false;
          this.importing = false;
          input.value = '';
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

  submit(closeAfterSave: boolean = false): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const preciseOccurredAt = this.buildPreciseOccurredAt(v.timestamp);

    if (this.dataMode === 'cloud' && this.user && this.isOnline) {
      const existingCat = this.remoteCategories.find((c) => c.type === v.type && c.name === v.category);

      // If category doesn't exist in remote, create it first
      const categorySource$ = existingCat
        ? of(existingCat)
        : this.cashflowApiService.createCategory({ name: v.category, type: v.type }).pipe(
            switchMap((created) => {
              this.remoteCategories = [...this.remoteCategories, created].sort((a, b) =>
                a.name.localeCompare(b.name)
              );
              return of(created);
            })
          );

      this.subs.add(
        categorySource$
          .pipe(
            switchMap((cat) =>
              this.cashflowApiService.createTransaction({
                type: v.type,
                amount: Number(v.amount),
                categoryId: cat.id!,
                occurredAt: preciseOccurredAt,
                note: v.note,
                party: v.party,
                mode: v.mode,
                entryBy: v.entryBy,
              })
            )
          )
          .subscribe({
            next: () => {
              this.showToast('Transaction created successfully!', 'success');
              if (closeAfterSave) {
                this.closeAddModal();
              } else {
                this.showFormSuccess();
              }
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
        timestamp: preciseOccurredAt,
        note: v.note,
        party: v.party,
        mode: v.mode,
        entryBy: v.entryBy,
      });
      this.showToast('Transaction created successfully!', 'success');
      if (closeAfterSave) {
        this.closeAddModal();
      } else {
        this.showFormSuccess();
      }
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

    this.showForm = false;
    this.editingTransactionId = transaction.id;
    this.editingOriginalTimestamp = transaction.timestamp;
    this.editSuccess = false;
    this.editError = '';
    this.syncEditModalState(true);

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
      party: transaction.party || '',
      mode: transaction.mode || 'Cash',
      entryBy: transaction.entryBy || this.defaultEntryBy(),
      note: transaction.note || '',
    });

    setTimeout(() => {
      this.focusEditAmountInput();
    }, 0);
  }

  closeEdit(): void {
    this.syncEditModalState(false);
    this.editingTransactionId = null;
    this.editingOriginalTimestamp = null;
    this.editSuccess = false;
    this.editError = '';
    this.editForm.reset({
      type: 'cash-in',
      amount: null,
      category: this.currentCategories[0] || CASH_IN_CATEGORIES[0],
      timestamp: this.nowLocal(),
      party: '',
      mode: 'Cash',
      entryBy: this.defaultEntryBy(),
      note: '',
    });
  }

  submitEdit(): void {
    if (!this.editingTransactionId || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const v = this.editForm.getRawValue();
    const preciseOccurredAt = this.buildPreciseOccurredAt(
      v.timestamp,
      this.editingOriginalTimestamp ?? undefined
    );
    const existingCategory = this.remoteCategories.find((c) => c.name === v.category && c.type === v.type);

    // If category doesn't exist in remote, create it first
    const categorySource$ = existingCategory
      ? of(existingCategory)
      : this.cashflowApiService.createCategory({ name: v.category, type: v.type }).pipe(
          switchMap((created) => {
            this.remoteCategories = [...this.remoteCategories, created].sort((a, b) =>
              a.name.localeCompare(b.name)
            );
            return of(created);
          })
        );

    this.subs.add(
      categorySource$
        .pipe(
          switchMap((category) =>
            this.cashflowApiService.updateTransaction(this.editingTransactionId!, {
              type: v.type,
              amount: Number(v.amount),
              categoryId: category.id!,
              occurredAt: preciseOccurredAt,
              note: v.note,
              party: v.party,
              mode: v.mode,
              entryBy: v.entryBy,
            })
          )
        )
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
    this.showSessionRecoveryActions = false;
    if (this.user && this.isOnline) {
      this.dataMode = 'cloud';
      this.loadRemote();
    } else {
      this.dataMode = 'local';
      this.remoteSummary = { totalIn: 0, totalOut: 0, net: 0 };
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
          switchMap((business) =>
            business
              ? forkJoin({
                  business: of(business),
                  categories: this.cashflowApiService.getCategories().pipe(catchError(() => of([]))),
                  transactions: this.cashflowApiService
                    .listTransactions(this.buildTransactionQuery())
                    .pipe(catchError(() => of({ items: [], page: 1, limit: this.pageSize, total: 0, summary: { totalIn: 0, totalOut: 0, net: 0 } }))),
                  settings: this.cashflowApiService.getSettings().pipe(catchError(() => of(null))),
                })
              : of({ business: null, categories: [], transactions: { items: [], page: 1, limit: this.pageSize, total: 0, summary: { totalIn: 0, totalOut: 0, net: 0 } }, settings: null })
          )
        )
        .subscribe({
          next: ({ business, categories, transactions, settings }) => {
            this.showSessionRecoveryActions = false;
            this.noBusinessAccess = !business;
            this.remoteCategories = categories;

            // Sync form category to first valid remote category
            const currentType = this.form.controls.type.value;
            const validCats = categories.filter((c) => c.type === currentType).map((c) => c.name);
            if (validCats.length && !validCats.includes(this.form.controls.category.value)) {
              this.form.controls.category.setValue(validCats[0]);
            }

            this.transactions = transactions.items.map(mapTransactionItemToCashTransaction);
            this.currentPage = transactions.page;
            this.pageSize = transactions.limit;
            this.totalItems = transactions.total;
            this.remoteSummary = transactions.summary;
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

  continueSession(): void {
    if (this.sessionRecoveryInProgress) {
      return;
    }

    this.sessionRecoveryInProgress = true;
    this.importErrorMessage = '';

    this.subs.add(
      this.authService.refreshToken().subscribe({
        next: (result) => {
          if (!result?.accessToken) {
            this.sessionRecoveryInProgress = false;
            this.showSessionRecoveryActions = true;
            this.importErrorMessage = 'Session expired. Please log in again.';
            return;
          }

          this.subs.add(
            this.authService.getCurrentUser().subscribe({
              next: () => {
                this.sessionRecoveryInProgress = false;
                this.showSessionRecoveryActions = false;
                this.load();
                this.showToast('Session restored. You can import now.', 'success');
              },
              error: () => {
                this.sessionRecoveryInProgress = false;
                this.showSessionRecoveryActions = true;
                this.importErrorMessage = 'Could not restore session. Please log in again.';
              },
            })
          );
        },
        error: () => {
          this.sessionRecoveryInProgress = false;
          this.showSessionRecoveryActions = true;
          this.importErrorMessage = 'Session expired. Please log in again.';
        },
      })
    );
  }

  reLogin(): void {
    this.authService.expireSession(true);
  }

  openImportDetailsDialog(): void {
    if (!this.importIssueRows.length) {
      return;
    }
    this.showImportDetailsDialog = true;
  }

  closeImportDetailsDialog(): void {
    this.showImportDetailsDialog = false;
  }

  private loadLocal(): void {
    this.noBusinessAccess = false;
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
    const categoryId = this.getSelectedCategoryId();
    return {
      page: this.currentPage,
      limit: this.pageSize,
      search: this.searchTerm.trim() || undefined,
      type: this.filterType === 'all' ? undefined : this.filterType,
      categoryId: categoryId || undefined,
      from: this.fromDate || undefined,
      to: this.toDate || undefined,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
    };
  }

  formatCurrency(value: number): string {
    return `₹${Number(value || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  private getSelectedCategoryId(): string {
    if (!this.categoryFilter || this.dataMode !== 'cloud') {
      return this.categoryFilter;
    }

    return this.remoteCategories.find((category) => category.name === this.categoryFilter)?.id || '';
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

  private showFormSuccess(): void {
    this.formSuccess = true;
    this.resetEntryForm();
    setTimeout(() => {
      this.formSuccess = false;
    }, 2000);
  }

  private resetEntryForm(preferredType?: TransactionType): void {
    const type = preferredType ?? this.form.controls.type.value ?? 'cash-in';
    const categories = this.getCategoriesForType(type);

    this.showCategoryForm = false;
    this.categoryErrorMessage = '';
    this.form.reset({
      type,
      amount: null,
      category: categories[0] || (type === 'cash-in' ? CASH_IN_CATEGORIES[0] : CASH_OUT_CATEGORIES[0]),
      timestamp: this.nowLocal(),
      party: '',
      mode: 'Cash',
      entryBy: this.defaultEntryBy(),
      note: '',
    });
  }

  private getCategoriesForType(type: TransactionType): string[] {
    if (this.dataMode === 'cloud' && this.remoteCategories.length) {
      return this.remoteCategories.filter((c) => c.type === type).map((c) => c.name);
    }

    return type === 'cash-in' ? this.cashInCategories : this.cashOutCategories;
  }

  private nowLocal(): string {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }

  private defaultEntryBy(): string {
    return this.user?.email?.split('@')[0] || 'Owner';
  }

  private buildPreciseOccurredAt(localDateTime: string, preserveIso?: string): string {
    if (preserveIso && this.toLocalMinuteString(preserveIso) === localDateTime) {
      return preserveIso;
    }

    const base = new Date(localDateTime);
    if (Number.isNaN(base.getTime())) {
      return new Date().toISOString();
    }

    const now = new Date();
    const candidate = new Date(base);
    candidate.setSeconds(now.getSeconds(), now.getMilliseconds());

    const usedTimestamps = new Set(this.transactions.map((transaction) => new Date(transaction.timestamp).getTime()));
    while (usedTimestamps.has(candidate.getTime())) {
      candidate.setMilliseconds(candidate.getMilliseconds() + 1);
    }

    return candidate.toISOString();
  }

  private toLocalMinuteString(isoValue: string): string {
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }

  private ensureAgGridStyles(): void {
    if (typeof document === 'undefined') {
      return;
    }

    this.agGridStyleUrls.forEach((href) => {
      const id = `ag-grid-style-${href.replace(/[^a-z0-9]/gi, '-')}`;
      if (document.getElementById(id)) {
        return;
      }

      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    });
  }

  private formatAmount(value: number | null | undefined): string {
    if (value === null || typeof value === 'undefined') {
      return '-';
    }

    return Number(value).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  private formatSignedAmount(value: number | null | undefined): string {
    if (value === null || typeof value === 'undefined') {
      return '-';
    }

    const numericValue = Number(value);
    const sign = numericValue >= 0 ? '+' : '-';
    return `${sign}${this.formatAmount(Math.abs(numericValue))}`;
  }

  private formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const dateTime = new Date(value);
    if (Number.isNaN(dateTime.getTime())) {
      return '-';
    }

    return `${dateTime.toLocaleDateString('en-GB')} ${dateTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  }

  private renderDateTimeCell(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const dateTime = new Date(value);
    if (Number.isNaN(dateTime.getTime())) {
      return '-';
    }

    const dateLabel = this.formatReadableDate(dateTime);
    const timeLabel = dateTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `<div style="display:flex;flex-direction:column;justify-content:center;align-items:flex-start;height:100%;width:100%;line-height:1.15;">
      <span style="display:block;font-weight:600;color:#0f172a;">${dateLabel}</span>
      <span style="display:block;font-size:12px;color:#64748b;margin-top:2px;">${timeLabel}</span>
    </div>`;
  }

  private renderRowActions(transaction: CashTransaction | undefined): HTMLElement | string {
    if (!transaction) {
      return '';
    }

    const container = document.createElement('div');
    container.className = 'row-actions';

    // Common button styles - applied inline to bypass AG Grid CSS specificity
    const btnStyle = 'background:none;border:none;padding:0;margin:0;cursor:pointer;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;';
    const iconStyle = 'font-family:"Material Symbols Outlined";font-size:18px;line-height:1;';

    if (this.dataMode === 'cloud') {
      const editButton = document.createElement('button');
      editButton.className = 'row-action-btn edit';
      editButton.setAttribute('data-action', 'edit');
      editButton.setAttribute('aria-label', 'Edit');
      editButton.setAttribute('title', 'Edit');
      editButton.style.cssText = btnStyle;

      const editIcon = document.createElement('span');
      editIcon.className = 'material-symbols-outlined';
      editIcon.setAttribute('aria-hidden', 'true');
      editIcon.textContent = 'edit';
      editIcon.style.cssText = iconStyle + 'color:#4f46e5;'; // Indigo
      editButton.appendChild(editIcon);

      container.appendChild(editButton);
    }

    const deleteButton = document.createElement('button');
    deleteButton.className = 'row-action-btn delete';
    deleteButton.setAttribute('data-action', 'delete');
    deleteButton.setAttribute('aria-label', 'Delete');
    deleteButton.setAttribute('title', 'Delete');
    deleteButton.style.cssText = btnStyle;

    const deleteIcon = document.createElement('span');
    deleteIcon.className = 'material-symbols-outlined';
    deleteIcon.setAttribute('aria-hidden', 'true');
    deleteIcon.textContent = 'delete';
    deleteIcon.style.cssText = iconStyle + 'color:#dc2626;'; // Red
    deleteButton.appendChild(deleteIcon);

    container.appendChild(deleteButton);

    return container;
  }

  private formatReadableDate(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cellDay = new Date(date);
    cellDay.setHours(0, 0, 0, 0);

    const diffDays = Math.round((today.getTime() - cellDay.getTime()) / 86400000);
    if (diffDays === 0) {
      return 'Today';
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private buildSearchText(transaction: CashTransaction): string {
    const signedAmount = transaction.type === 'cash-in' ? transaction.amount : transaction.amount * -1;
    return [
      this.formatDateTime(transaction.timestamp),
      transaction.type,
      transaction.type === 'cash-in' ? 'cash in' : 'cash out',
      this.formatAmount(transaction.amount),
      this.formatSignedAmount(signedAmount),
      this.getCategoryLabel(transaction.category),
      this.getRemark(transaction),
      this.getEntryBy(transaction),
      this.getMode(transaction),
      this.getParty(transaction),
    ]
      .join(' ')
      .toLowerCase();
  }

  private getOpeningBalanceForCurrentPage(): number {
    if (this.currentPage <= 1 || this.dataMode === 'cloud') {
      return 0;
    }

    // Get all transactions sorted chronologically (oldest first)
    const chronological = [...this.filteredTransactions].sort(
      (a, b) => this.compareChronological(a, b)
    );

    // Find the oldest transaction on the current page
    const currentPageTransactions = this.pagedTransactions;
    if (!currentPageTransactions.length) {
      return 0;
    }

    const oldestOnPage = [...currentPageTransactions].sort(
      (a, b) => this.compareChronological(a, b)
    )[0];

    const oldestIndex = chronological.findIndex((item) => item.id === oldestOnPage.id);
    if (oldestIndex <= 0) {
      return 0;
    }

    return chronological.slice(0, oldestIndex).reduce((total, transaction) => {
      return total + (transaction.type === 'cash-in' ? transaction.amount : -transaction.amount);
    }, 0);
  }

  private compareTransactions(left: CashTransaction, right: CashTransaction): number {
    let compare = 0;

    if (this.sortBy === 'amount') {
      const leftSigned = left.type === 'cash-out' ? left.amount * -1 : left.amount;
      const rightSigned = right.type === 'cash-out' ? right.amount * -1 : right.amount;
      compare = leftSigned - rightSigned;
    } else if (this.sortBy === 'categoryName') {
      compare = left.category.localeCompare(right.category);
    } else {
      compare = this.compareChronological(left, right);
    }

    if (compare === 0) {
      compare = left.id.localeCompare(right.id);
    }

    return this.sortOrder === 'asc' ? compare : compare * -1;
  }

  private compareChronological(left: CashTransaction, right: CashTransaction): number {
    const compare = new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
    if (compare !== 0) {
      return compare;
    }
    return left.id.localeCompare(right.id);
  }

  private focusEditAmountInput(): void {
    if (typeof document === 'undefined') {
      return;
    }

    const amountInput = document.getElementById('edit-amount-input') as HTMLInputElement | null;
    amountInput?.focus();
    amountInput?.select();
  }

  private syncEditModalState(isOpen: boolean): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  private onOnline = (): void => { this.isOnline = true; this.load(); };
  private onOffline = (): void => { this.isOnline = false; this.load(); };
}
