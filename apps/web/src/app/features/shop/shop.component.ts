import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BusinessProfile } from '../../core/models/cashflow-api.models';
import { BusinessContextService } from '../../core/services/business-context.service';
import { CashflowApiService } from '../../core/services/cashflow-api.service';
import { ToastService } from '../../core/services/toast.service';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
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
  isModalOpen = false;
  isCreating = false;
  saving = false;
  editingShop: BusinessProfile | null = null;

  // Delete confirmation state
  isDeleteConfirm1Open = false;
  isDeleteConfirm2Open = false;
  deletingShop: BusinessProfile | null = null;
  deleting = false;

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
      }),
    );
    this.subs.add(this.businessContext.refreshBusinesses().subscribe({ error: () => void 0 }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  openCreateModal(): void {
    this.isCreating = true;
    this.editingShop = null;
    this.shopForm.reset({ name: '', phone: '', address: '' });
    this.isModalOpen = true;
  }

  openEditModal(shop: BusinessProfile): void {
    this.isCreating = false;
    this.editingShop = shop;
    this.shopForm.reset({
      name: shop.name || '',
      phone: shop.phone || '',
      address: shop.address || '',
    });
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.isCreating = false;
    this.editingShop = null;
  }

  openDeleteConfirm(shop: BusinessProfile): void {
    this.deletingShop = shop;
    this.isDeleteConfirm1Open = true;
  }

  confirmDeleteStep2(): void {
    this.isDeleteConfirm1Open = false;
    this.isDeleteConfirm2Open = true;
  }

  cancelDelete(): void {
    this.isDeleteConfirm1Open = false;
    this.isDeleteConfirm2Open = false;
    this.deletingShop = null;
  }

  confirmDeleteFinal(): void {
    if (!this.deletingShop?.id) return;
    this.deleting = true;
    this.subs.add(
      this.cashflowApiService.deleteBusiness(this.deletingShop.id).subscribe({
        next: () => {
          this.businessContext.refreshBusinesses().subscribe();
          this.cancelDelete();
          this.deleting = false;
          this.toastService.success('Shop and all its data deleted successfully');
        },
        error: (err) => {
          this.deleting = false;
          this.toastService.error(err?.error?.message || 'Failed to delete shop');
        },
      }),
    );
  }

  switchShop(id: string): void {
    this.businessContext.selectBusinessById(id);
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

    const isNew = this.isCreating;
    this.saving = true;

    const request$ = isNew
      ? this.cashflowApiService.createBusiness({ ...payload, type: 'restaurant', currency: 'INR', timezone: 'Asia/Kolkata' })
      : this.cashflowApiService.updateBusiness(this.editingShop!.id!, payload);

    this.subs.add(
      request$.subscribe({
        next: (business) => {
          this.businessContext.refreshBusinesses().subscribe({
            next: () => {
              if (isNew) {
                this.businessContext.selectBusinessById(business.id || '');
              }
              this.closeModal();
              this.toastService.success(`Shop ${isNew ? 'created' : 'updated'} successfully`);
            },
            error: () => {
              this.saving = false;
              this.toastService.error('Failed to refresh shops');
            },
          });
        },
        error: (err) => {
          this.saving = false;
          this.toastService.error(err?.error?.message || 'Failed to save shop');
        },
      }),
    );
  }
}
