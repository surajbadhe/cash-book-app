import { ApiResponse } from './auth.models';
import { CashTransaction, TransactionType } from './cashflow.models';

export interface BusinessProfile {
  id?: string;
  _id?: string;
  ownerId: string;
  name: string;
  type: 'restaurant' | 'retail' | 'general';
  currency: string;
  timezone: string;
  phone?: string;
  address?: string;
}

export interface CategoryItem {
  id?: string;
  _id?: string;
  businessId: string;
  name: string;
  type: TransactionType;
  color?: string;
  icon?: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface TransactionItem {
  id?: string;
  _id?: string;
  businessId: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  categoryName: string;
  occurredAt: string;
  note?: string;
  source?: string;
  deviceId?: string;
  localRef?: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string | null;
}

export interface TransactionListResponse {
  items: TransactionItem[];
  page: number;
  limit: number;
  total: number;
  summary: {
    totalIn: number;
    totalOut: number;
    net: number;
  };
}

export interface DashboardReportResponse {
  date: string;
  daily: CashSummary;
  weekly: CashSummary;
  monthly: CashSummary;
  profitLoss: CashSummary;
  expenseCategories: ExpenseCategorySummary[];
  incomeCategories: ExpenseCategorySummary[];
}

export interface CashSummary {
  totalIn: number;
  totalOut: number;
  net: number;
  cashInCount?: number;
  cashOutCount?: number;
}

export interface ExpenseCategorySummary {
  category: string;
  amount: number;
  percentage: number;
}

export interface AppSettings {
  id?: string;
  _id?: string;
  businessId: string;
  currency: string;
  timezone: string;
  defaultOpeningCash: number;
  allowNegativeCash: boolean;
  lowCashAlertEnabled: boolean;
  dailyReminderTime?: string;
}

export type ApiEnvelope<T> = ApiResponse<T>;

export function normalizeId<T extends { id?: string; _id?: string }>(item: T): T & { id: string } {
  return {
    ...item,
    id: item.id ?? item._id ?? '',
  };
}

export function mapTransactionItemToCashTransaction(item: TransactionItem): CashTransaction {
  const normalized = normalizeId(item);
  return {
    id: normalized.id,
    type: normalized.type,
    amount: normalized.amount,
    category: normalized.categoryName,
    timestamp: normalized.occurredAt,
    note: normalized.note,
  };
}
