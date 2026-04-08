import { Injectable } from '@nestjs/common';
import { BusinessService } from '../business/business.service';
import { Transaction } from '../transaction/schemas/transaction.schema';
import { TransactionService } from '../transaction/transaction.service';

@Injectable()
export class ReportService {
  constructor(
    private readonly businessService: BusinessService,
    private readonly transactionService: TransactionService,
  ) {}

  async getDashboardReport(userId: string, dateInput?: string) {
    const business = await this.businessService.findByOwnerId(userId);
    const selectedDate = dateInput ? new Date(`${dateInput}T00:00:00.000Z`) : new Date();

    const dayStart = new Date(selectedDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const weekStart = this.getWeekStart(selectedDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    const monthStart = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const [dailyTransactions, weeklyTransactions, monthlyTransactions] = await Promise.all([
      this.transactionService.getTransactionsForRange(business.id, dayStart, dayEnd),
      this.transactionService.getTransactionsForRange(business.id, weekStart, weekEnd),
      this.transactionService.getTransactionsForRange(business.id, monthStart, monthEnd),
    ]);

    const expenseCategories = this.buildExpenseCategories(monthlyTransactions);
    const incomeCategories = this.buildIncomeCategories(monthlyTransactions);

    return {
      date: dayStart.toISOString().slice(0, 10),
      daily: this.buildSummary(dailyTransactions),
      weekly: this.buildSummary(weeklyTransactions),
      monthly: this.buildSummary(monthlyTransactions),
      profitLoss: this.buildSummary(monthlyTransactions),
      expenseCategories,
      incomeCategories,
    };
  }

  async getExpensesByCategory(userId: string, from: string, to: string) {
    const business = await this.businessService.findByOwnerId(userId);
    const transactions = await this.transactionService.getTransactionsForRange(
      business.id,
      new Date(`${from}T00:00:00.000Z`),
      new Date(`${to}T23:59:59.999Z`),
    );

    const items = this.buildExpenseCategories(transactions);
    const totalExpense = items.reduce((sum, item) => sum + item.amount, 0);

    return {
      totalExpense,
      items,
    };
  }

  private buildSummary(transactions: Transaction[]) {
    const totalIn = transactions
      .filter((item) => item.type === 'cash-in')
      .reduce((sum, item) => sum + item.amount, 0);
    const totalOut = transactions
      .filter((item) => item.type === 'cash-out')
      .reduce((sum, item) => sum + item.amount, 0);

    return {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      cashInCount: transactions.filter((item) => item.type === 'cash-in').length,
      cashOutCount: transactions.filter((item) => item.type === 'cash-out').length,
    };
  }

  private buildExpenseCategories(transactions: Transaction[]) {
    const totals = new Map<string, number>();
    const expenseTransactions = transactions.filter((item) => item.type === 'cash-out');
    const totalExpense = expenseTransactions.reduce((sum, item) => sum + item.amount, 0);

    for (const item of expenseTransactions) {
      totals.set(item.categoryName, (totals.get(item.categoryName) ?? 0) + item.amount);
    }

    return [...totals.entries()]
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpense > 0 ? Number(((amount / totalExpense) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private buildIncomeCategories(transactions: Transaction[]) {
    const totals = new Map<string, number>();
    const incomeTransactions = transactions.filter((item) => item.type === 'cash-in');
    const totalIncome = incomeTransactions.reduce((sum, item) => sum + item.amount, 0);

    for (const item of incomeTransactions) {
      totals.set(item.categoryName, (totals.get(item.categoryName) ?? 0) + item.amount);
    }

    return [...totals.entries()]
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalIncome > 0 ? Number(((amount / totalIncome) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private getWeekStart(date: Date) {
    const result = new Date(date);
    const day = result.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    result.setUTCDate(result.getUTCDate() + diff);
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }
}
