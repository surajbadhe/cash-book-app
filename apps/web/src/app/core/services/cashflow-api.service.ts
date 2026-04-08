import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiEnvelope,
  AppSettings,
  BusinessProfile,
  CategoryItem,
  DashboardReportResponse,
  normalizeId,
  TransactionListResponse,
} from '../models/cashflow-api.models';
import { TransactionType } from '../models/cashflow.models';

@Injectable({
  providedIn: 'root',
})
export class CashflowApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  ensureBusinessSetup(defaultBusinessName: string): Observable<BusinessProfile> {
    return this.getMyBusiness().pipe(
      switchMap((business) => {
        if (business) {
          return of(business);
        }

        return this.createBusiness({
          name: defaultBusinessName,
          type: 'restaurant',
          currency: 'INR',
          timezone: 'Asia/Kolkata',
        }).pipe(
          switchMap((created) => this.seedDefaultCategories().pipe(map(() => created)))
        );
      })
    );
  }

  getMyBusiness(): Observable<BusinessProfile | null> {
    return this.http.get<ApiEnvelope<BusinessProfile>>(`${this.apiUrl}/businesses/me`).pipe(
      map((response) => normalizeId(response.data)),
      catchError(() => of(null))
    );
  }

  createBusiness(payload: Partial<BusinessProfile>): Observable<BusinessProfile> {
    return this.http
      .post<ApiEnvelope<BusinessProfile>>(`${this.apiUrl}/businesses`, payload)
      .pipe(map((response) => normalizeId(response.data)));
  }

  getCategories(type?: TransactionType): Observable<CategoryItem[]> {
    const query = type ? `?type=${type}&active=true` : '?active=true';
    return this.http.get<ApiEnvelope<CategoryItem[]>>(`${this.apiUrl}/categories${query}`).pipe(
      map((response) => response.data.map((item) => normalizeId(item)).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)))
    );
  }

  seedDefaultCategories(): Observable<CategoryItem[]> {
    return this.http
      .post<ApiEnvelope<CategoryItem[]>>(`${this.apiUrl}/categories/seed-defaults`, {})
      .pipe(map((response) => response.data.map((item) => normalizeId(item))));
  }

  createCategory(payload: {
    name: string;
    type: TransactionType;
    color?: string;
    icon?: string;
    sortOrder?: number;
  }): Observable<CategoryItem> {
    const sanitizedPayload = {
      ...payload,
      name: payload.name.trim(),
    };

    return this.http
      .post<ApiEnvelope<CategoryItem>>(`${this.apiUrl}/categories`, sanitizedPayload)
      .pipe(map((response) => normalizeId(response.data)));
  }

  listTransactions(params: Record<string, string | number | undefined> = {}): Observable<TransactionListResponse> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.http
      .get<ApiEnvelope<TransactionListResponse>>(`${this.apiUrl}/transactions${suffix}`)
      .pipe(map((response) => ({
        ...response.data,
        items: response.data.items.map((item) => normalizeId(item)),
      })));
  }

  createTransaction(payload: {
    type: TransactionType;
    amount: number;
    categoryId: string;
    occurredAt: string;
    note?: string;
  }): Observable<void> {
    const sanitizedPayload = {
      ...payload,
      note: payload.note?.trim() || undefined,
    };

    return this.http
      .post<ApiEnvelope<unknown>>(`${this.apiUrl}/transactions`, sanitizedPayload)
      .pipe(map(() => void 0));
  }

  deleteTransaction(id: string): Observable<void> {
    return this.http.delete<ApiEnvelope<unknown>>(`${this.apiUrl}/transactions/${id}`).pipe(map(() => void 0));
  }

  getDashboardReport(date: string): Observable<DashboardReportResponse> {
    return this.http
      .get<ApiEnvelope<DashboardReportResponse>>(`${this.apiUrl}/reports/dashboard?date=${date}`)
      .pipe(map((response) => response.data));
  }

  getSettings(): Observable<AppSettings | null> {
    return this.http.get<ApiEnvelope<AppSettings>>(`${this.apiUrl}/settings`).pipe(
      map((response) => normalizeId(response.data)),
      catchError(() => of(null))
    );
  }
}
