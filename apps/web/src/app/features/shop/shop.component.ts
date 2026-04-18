import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BusinessAccessRole, BusinessProfile } from '../../core/models/cashflow-api.models';
import { AuthService } from '../../core/services/auth.service';
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

      // Navigate to team page after switching book
      inviteToBook(book: BusinessProfile): void {
        if (book.id) {
          this.switchBook(book.id);
          // Use Angular router for navigation
          setTimeout(() => {
            window.location.assign('/team');
          }, 100);
        }
      }
    userId: string | null = null;
  private readonly authService = inject(AuthService);
  private readonly businessContext = inject(BusinessContextService);
  private readonly cashflowApiService = inject(CashflowApiService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private subs = new Subscription();

  businesses: BusinessProfile[] = [];
  currentBusiness: BusinessProfile | null = null;
  modalMode: 'create' | 'edit' | 'rename' | null = null;
  activeBook: BusinessProfile | null = null;
  saving = false;
  deletingIds = new Set<string>();

  shopForm = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    phone: this.fb.nonNullable.control(''),
    address: this.fb.nonNullable.control(''),
  });

  ngOnInit(): void {
      // Set userId for role checks
      this.userId = this.authService.currentUser?.id || null;
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

  switchBook(id: string): void {
    this.businessContext.selectBusinessById(id);
  }

  openCreateModal(): void {
    this.modalMode = 'create';
    this.activeBook = null;
    this.shopForm.reset({ name: '', phone: '', address: '' });
  }

  openEditModal(book: BusinessProfile): void {
    if (!this.canManageBook(book)) {
      this.toastService.error('Only the owner can edit this book.');
      return;
    }

    this.modalMode = 'edit';
    this.activeBook = book;
    this.shopForm.reset({
      name: book.name || '',
      phone: book.phone || '',
      address: book.address || '',
    });
  }

  openRenameModal(book: BusinessProfile): void {
    if (!this.canManageBook(book)) {
      this.toastService.error('Only the owner can rename this book.');
      return;
    }

    this.modalMode = 'rename';
    this.activeBook = book;
    this.shopForm.reset({
      name: book.name || '',
      phone: '',
      address: '',
    });
  }

  closeModal(): void {
    if (this.saving) {
      return;
    }

    this.modalMode = null;
    this.activeBook = null;
  }

  saveBook(): void {
    if (!this.modalMode) {
      return;
    }

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

    const isNew = this.modalMode === 'create';
    const isRename = this.modalMode === 'rename';
    if (!isNew && !this.activeBook?.id) {
      this.toastService.error('No book selected.');
      return;
    }

    const updatePayload = isRename ? { name: payload.name } : payload;

    this.saving = true;

    const request$ = isNew
      ? this.cashflowApiService.createBusiness({ ...payload, type: 'restaurant', currency: 'INR', timezone: 'Asia/Kolkata' })
      : this.cashflowApiService.updateBusiness(this.activeBook!.id!, updatePayload);

    this.subs.add(
      request$.subscribe({
        next: (business) => {
          this.businessContext.refreshBusinesses().subscribe({
            next: () => {
              this.businessContext.selectBusinessById(business.id || '');
              this.modalMode = null;
              this.activeBook = null;
              this.saving = false;
              this.toastService.success(isNew ? 'Book created successfully.' : isRename ? 'Book renamed successfully.' : 'Book updated successfully.');
            },
            error: () => {
              this.saving = false;
              this.toastService.error('Book saved but the list could not be refreshed.');
            },
          });
        },
        error: (err) => {
          this.saving = false;
          this.toastService.error(err?.error?.message || 'Unable to save book.');
        },
      }),
    );
  }

  deleteBook(book: BusinessProfile): void {
    if (!book.id || this.deletingIds.has(book.id)) {
      return;
    }

    if (!this.canManageBook(book)) {
      this.toastService.error('Only the owner can delete this book.');
      return;
    }

    const confirmed = window.confirm(`Delete book "${book.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    const deletingId = book.id;
    this.deletingIds.add(deletingId);

    this.subs.add(
      this.cashflowApiService.deleteBusiness(deletingId).subscribe({
        next: () => {
          this.businessContext.refreshBusinesses().subscribe({
            next: (businesses) => {
              if (this.currentBusiness?.id === deletingId) {
                const nextBusiness = businesses[0] || null;
                this.businessContext.setCurrentBusiness(nextBusiness);
              }
              this.deletingIds.delete(deletingId);
              this.toastService.success('Book deleted successfully.');
            },
            error: () => {
              this.deletingIds.delete(deletingId);
              this.toastService.error('Book deleted but list refresh failed.');
            },
          });
        },
        error: (err) => {
          this.deletingIds.delete(deletingId);
          this.toastService.error(err?.error?.message || 'Unable to delete book.');
        },
      })
    );
  }

  canManageBook(book: BusinessProfile): boolean {
    const role = this.bookRole(book);
    return role === 'owner' || role === 'admin';
  }

  bookRole(book: BusinessProfile): BusinessAccessRole {
    const currentUserId = this.authService.currentUser?.id;
    if (currentUserId && book.ownerId === currentUserId) {
      return 'owner';
    }

    return book.accessRole || 'viewer';
  }

  roleLabel(role?: BusinessAccessRole): string {
    switch (role) {
      case 'owner':
        return 'Owner';
      case 'admin':
        return 'Admin';
      case 'editor':
        return 'Editor';
      case 'viewer':
        return 'Viewer';
      default:
        return 'Viewer';
    }
  }

  ownerLabel(book: BusinessProfile): string {
    const owner = book.members?.find((member) => member.role === 'owner');
    if (!owner?.email) {
      return 'Unknown';
    }

    return owner.userId === book.ownerId ? owner.email : owner.email;
  }

  isDeleting(bookId?: string): boolean {
    return !!bookId && this.deletingIds.has(bookId);
  }
}
