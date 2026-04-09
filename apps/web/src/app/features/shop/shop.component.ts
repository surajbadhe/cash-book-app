import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BusinessProfile } from '../../core/models/cashflow-api.models';
import { BusinessContextService } from '../../core/services/business-context.service';
import { CashflowApiService } from '../../core/services/cashflow-api.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './shop.component.html',
  styleUrls: ['./shop.component.scss'],
})
export class ShopComponent implements OnInit, OnDestroy {
  private readonly businessContext = inject(BusinessContextService);
  private readonly cashflowApiService = inject(CashflowApiService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private subs = new Subscription();

  businesses: BusinessProfile[] = [];
  currentBusiness: BusinessProfile | null = null;
  isCreating = false;
  saving = false;

  shopForm = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    phone: this.fb.nonNullable.control(''),
    address: this.fb.nonNullable.control(''),
  });

  ngOnInit(): void {
    this.subs.add(this.businessContext.businesses$.subscribe((bs) => (this.businesses = bs)));
    this.subs.add(
      this.businessContext.currentBusiness$.subscribe((b) => {
        this.currentBusiness = b;
        this.isCreating = false;
        this.shopForm.reset({
          name: b?.name || '',
          phone: b?.phone || '',
          address: b?.address || '',
        });
      }),
    );
    this.subs.add(this.businessContext.refreshBusinesses().subscribe({ error: () => void 0 }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  switchShop(id: string): void {
    this.businessContext.selectBusinessById(id);
    this.isCreating = false;
  }

  startCreating(): void {
    this.isCreating = true;
    this.shopForm.reset({ name: '', phone: '', address: '' });
  }

  cancelCreating(): void {
    this.isCreating = false;
    this.shopForm.reset({
      name: this.currentBusiness?.name || '',
      phone: this.currentBusiness?.phone || '',
      address: this.currentBusiness?.address || '',
    });
  }

  saveShop(): void {
    if (this.shopForm.invalid) {
      this.shopForm.markAllAsTouched();
      return;
    }

    const v = this.shopForm.getRawValue();
    const payload = {
      name: v.name.trim(),
      phone: v.phone.trim() || undefined,
      address: v.address.trim() || undefined,
    };

    const isNew = this.isCreating || !this.currentBusiness?.id;
    this.saving = true;

    const request$ = isNew
      ? this.cashflowApiService.createBusiness({ ...payload, type: 'restaurant', currency: 'INR', timezone: 'Asia/Kolkata' })
      : this.cashflowApiService.updateBusiness(this.currentBusiness!.id!, payload);

    this.subs.add(
      request$.subscribe({
        next: (business) => {
          this.businessContext.refreshBusinesses().subscribe({
            next: () => {
              this.businessContext.selectBusinessById(business.id || '');
              this.isCreating = false;
              this.saving = false;
              this.toastService.success(isNew ? 'Shop created successfully.' : 'Shop updated successfully.');
            },
            error: () => {
              this.saving = false;
              this.toastService.error('Shop saved but the list could not be refreshed.');
            },
          });
        },
        error: (err) => {
          this.saving = false;
          this.toastService.error(err?.error?.message || 'Unable to save shop.');
        },
      }),
    );
  }
}
