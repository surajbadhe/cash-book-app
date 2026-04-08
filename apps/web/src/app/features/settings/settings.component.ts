import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/auth.models';
import { BusinessMember, BusinessProfile } from '../../core/models/cashflow-api.models';
import { BusinessContextService } from '../../core/services/business-context.service';
import { CashflowApiService } from '../../core/services/cashflow-api.service';
import { CashflowService } from '../../core/services/cashflow.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private businessContext = inject(BusinessContextService);
  private cashflowApiService = inject(CashflowApiService);
  private cashflowService = inject(CashflowService);
  private fb = inject(FormBuilder);
  private subs = new Subscription();

  user: User | null = null;
  businesses: BusinessProfile[] = [];
  currentBusiness: BusinessProfile | null = null;
  members: BusinessMember[] = [];
  lockEnabled = false;
  pinSaved = false;
  pinError = '';
  shopSaved = false;
  shopError = '';
  memberSaved = false;
  memberError = '';
  loadingMembers = false;

  pinForm = this.fb.nonNullable.group({
    pin: this.fb.nonNullable.control<string>('', [
      Validators.required,
      Validators.pattern(/^[0-9]{4}$/),
    ]),
  });

  shopForm = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    phone: this.fb.nonNullable.control(''),
    address: this.fb.nonNullable.control(''),
  });

  memberForm = this.fb.nonNullable.group({
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    role: this.fb.nonNullable.control<'manager' | 'employee'>('employee'),
  });

  ngOnInit(): void {
    this.subs.add(this.authService.currentUser$.subscribe((u) => (this.user = u)));
    this.subs.add(this.businessContext.businesses$.subscribe((businesses) => (this.businesses = businesses)));
    this.subs.add(
      this.businessContext.currentBusiness$.subscribe((business) => {
        this.currentBusiness = business;
        this.shopForm.reset({
          name: business?.name || '',
          phone: business?.phone || '',
          address: business?.address || '',
        });
        if (business?.id) {
          this.loadMembers(business.id);
        } else {
          this.members = [];
        }
      })
    );
    this.subs.add(
      this.cashflowService.lockSettings$.subscribe((s) => (this.lockEnabled = s.enabled))
    );
    this.subs.add(this.businessContext.refreshBusinesses().subscribe({ error: () => void 0 }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get initials(): string {
    return this.user?.email?.[0]?.toUpperCase() ?? '?';
  }

  savePin(): void {
    if (this.pinForm.invalid) { this.pinForm.markAllAsTouched(); return; }
    this.cashflowService.upsertLock(this.pinForm.controls.pin.value);
    this.pinForm.reset({ pin: '' });
    this.pinSaved = true;
    setTimeout(() => (this.pinSaved = false), 2000);
  }

  saveShop(): void {
    if (this.shopForm.invalid) {
      this.shopForm.markAllAsTouched();
      return;
    }

    const value = this.shopForm.getRawValue();
    const payload = {
      name: value.name.trim(),
      phone: value.phone.trim() || undefined,
      address: value.address.trim() || undefined,
    };

    this.shopError = '';
    const request$ = this.currentBusiness?.id
      ? this.cashflowApiService.updateBusiness(this.currentBusiness.id, payload)
      : this.cashflowApiService.createBusiness({
          ...payload,
          type: 'restaurant',
          currency: 'INR',
          timezone: 'Asia/Kolkata',
        });

    this.subs.add(
      request$.subscribe({
        next: (business) => {
          this.shopSaved = true;
          this.businessContext.refreshBusinesses().subscribe({
            next: () => {
              this.businessContext.selectBusinessById(business.id || '');
            },
            error: () => void 0,
          });
          setTimeout(() => (this.shopSaved = false), 2500);
        },
        error: (err) => {
          this.shopError = err?.error?.message || 'Unable to save shop';
        },
      })
    );
  }

  createNewShop(): void {
    this.currentBusiness = null;
    this.shopError = '';
    this.shopSaved = false;
    this.shopForm.reset({ name: '', phone: '', address: '' });
  }

  addEmployee(): void {
    if (!this.currentBusiness?.id) {
      this.memberError = 'Select a shop first';
      return;
    }
    if (this.memberForm.invalid) {
      this.memberForm.markAllAsTouched();
      return;
    }

    const value = this.memberForm.getRawValue();
    this.memberError = '';
    this.subs.add(
      this.cashflowApiService
        .sendBusinessInvite(this.currentBusiness.id, {
          email: value.email.trim(),
          role: value.role,
        })
        .subscribe({
          next: () => {
            this.memberSaved = true;
            this.memberForm.reset({ email: '', role: 'employee' });
            setTimeout(() => (this.memberSaved = false), 2500);
          },
          error: (err) => {
            this.memberError = err?.error?.message || 'Unable to add employee';
          },
        })
    );
  }

  removeEmployee(member: BusinessMember): void {
    if (!this.currentBusiness?.id) {
      return;
    }

    this.subs.add(
      this.cashflowApiService.removeBusinessMember(this.currentBusiness.id, member.userId).subscribe({
        next: () => {
          this.members = this.members.filter((item) => item.userId !== member.userId);
        },
        error: (err) => {
          this.memberError = err?.error?.message || 'Unable to remove employee';
        },
      })
    );
  }

  switchShop(businessId: string): void {
    this.businessContext.selectBusinessById(businessId);
  }

  disablePin(): void {
    this.cashflowService.disableLock();
    this.pinError = '';
  }

  logout(): void {
    this.authService.logout().subscribe();
  }

  private loadMembers(businessId: string): void {
    this.loadingMembers = true;
    this.subs.add(
      this.cashflowApiService.listBusinessMembers(businessId).subscribe({
        next: (members) => {
          this.members = members.filter((member) => member.isActive);
          this.loadingMembers = false;
        },
        error: () => {
          this.members = [];
          this.loadingMembers = false;
        },
      })
    );
  }
}
