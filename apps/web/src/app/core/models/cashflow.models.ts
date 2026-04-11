export type TransactionType = 'cash-in' | 'cash-out';

export interface CashTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  timestamp: string;
  runningBalance?: number;
  note?: string;
  party?: string;
  mode?: string;
  entryBy?: string;
}

export interface ReportSummary {
  totalIn: number;
  totalOut: number;
  profit: number;
  countIn: number;
  countOut: number;
}

export interface AppLockSettings {
  enabled: boolean;
  pin: string | null;
}

export const CASH_IN_CATEGORIES: string[] = [
  'Food Sales',
  'Beverage Sales',
  'Online Orders',
  'Catering',
  'Other Income',
];

export const CASH_OUT_CATEGORIES: string[] = [
  'Inventory',
  'Utilities',
  'Rent',
  'Staff Wages',
  'Maintenance',
  'Transport',
  'Marketing',
  'Other Expense',
];
