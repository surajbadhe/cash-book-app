import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, switchMap, tap } from 'rxjs';
import { CashflowApiService } from './cashflow-api.service';
import { BusinessProfile } from '../models/cashflow-api.models';

const STORAGE_KEY_PREFIX = 'currentBusinessId';

@Injectable({
  providedIn: 'root',
})
export class BusinessContextService {
  private readonly api = inject(CashflowApiService);

  private readonly businessesSubject = new BehaviorSubject<BusinessProfile[]>([]);
  readonly businesses$ = this.businessesSubject.asObservable();

  private readonly currentBusinessSubject = new BehaviorSubject<BusinessProfile | null>(null);
  readonly currentBusiness$ = this.currentBusinessSubject.asObservable();

  private readonly switchingBusinessSubject = new BehaviorSubject<boolean>(false);
  readonly switchingBusiness$ = this.switchingBusinessSubject.asObservable();

  get currentBusiness(): BusinessProfile | null {
    return this.currentBusinessSubject.value;
  }

  get currentBusinessId(): string | null {
    return this.currentBusiness?.id || this.getPreferredBusinessId();
  }

  refreshBusinesses(): Observable<BusinessProfile[]> {
    return this.api.listBusinesses().pipe(
      tap((businesses) => {
        this.businessesSubject.next(businesses);
        this.syncCurrentBusiness(businesses);
      })
    );
  }

  ensureBusinessReady(_defaultBusinessName: string): Observable<BusinessProfile | null> {
    return this.refreshBusinesses().pipe(
      switchMap((businesses) => {
        if (businesses.length > 0) {
          return of(this.currentBusinessSubject.value || businesses[0]);
        }

        this.setCurrentBusiness(null);
        return of(null);
      }),
    );
  }

  setCurrentBusiness(business: BusinessProfile | null): void {
    this.currentBusinessSubject.next(business);
    const storageKey = this.storageKey();
    if (business?.id) {
      localStorage.setItem(storageKey, business.id);
    } else {
      localStorage.removeItem(storageKey);
    }
  }

  selectBusinessById(businessId: string): void {
    const selected = this.businessesSubject.value.find((item) => item.id === businessId) || null;
    this.setCurrentBusiness(selected);
  }

  beginBusinessSwitch(): void {
    this.switchingBusinessSubject.next(true);
  }

  completeBusinessSwitch(): void {
    this.switchingBusinessSubject.next(false);
  }

  private syncCurrentBusiness(businesses: BusinessProfile[]): void {
    const preferredId = this.getPreferredBusinessId();
    const selected = businesses.find((item) => item.id === preferredId) || businesses[0] || null;
    this.setCurrentBusiness(selected);
  }

  private getPreferredBusinessId(): string | null {
    return this.getBusinessIdFromUrl() || localStorage.getItem(this.storageKey());
  }

  private getBusinessIdFromUrl(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('book') || params.get('shop');
    return bookId?.trim() || null;
  }

  private storageKey(): string {
    const userRaw = localStorage.getItem('user');
    if (!userRaw) {
      return `${STORAGE_KEY_PREFIX}.guest`;
    }

    try {
      const user = JSON.parse(userRaw) as { id?: string; sub?: string };
      const userId = user.id || user.sub;
      return userId ? `${STORAGE_KEY_PREFIX}.${userId}` : `${STORAGE_KEY_PREFIX}.guest`;
    } catch {
      return `${STORAGE_KEY_PREFIX}.guest`;
    }
  }
}
