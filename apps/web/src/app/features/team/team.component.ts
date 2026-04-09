import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BusinessAccessRole, BusinessMember, BusinessProfile } from '../../core/models/cashflow-api.models';
import { BusinessContextService } from '../../core/services/business-context.service';
import { CashflowApiService } from '../../core/services/cashflow-api.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.scss'],
})
export class TeamComponent implements OnInit, OnDestroy {
  private readonly businessContext = inject(BusinessContextService);
  private readonly cashflowApiService = inject(CashflowApiService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private subs = new Subscription();

  currentBusiness: BusinessProfile | null = null;
  members: BusinessMember[] = [];
  loadingMembers = false;
  sendingInvite = false;
  removingMemberIds = new Set<string>();
  updatingRoleIds = new Set<string>();

  memberForm = this.fb.nonNullable.group({
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    role: this.fb.nonNullable.control<'manager' | 'employee'>('employee'),
  });

  ngOnInit(): void {
    this.subs.add(
      this.businessContext.currentBusiness$.subscribe((b) => {
        this.currentBusiness = b;
        if (b?.id) {
          this.loadMembers(b.id);
        } else {
          this.members = [];
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  sendInvite(): void {
    if (!this.currentBusiness?.id) {
      this.toastService.error('Select a shop first.');
      return;
    }
    if (this.memberForm.invalid) {
      this.memberForm.markAllAsTouched();
      return;
    }

    const v = this.memberForm.getRawValue();
    this.sendingInvite = true;

    this.subs.add(
      this.cashflowApiService
        .sendBusinessInvite(this.currentBusiness.id, { email: v.email.trim(), role: v.role })
        .subscribe({
          next: () => {
            this.sendingInvite = false;
            this.memberForm.reset({ email: '', role: 'employee' });
            this.toastService.success('Invite sent successfully.');
          },
          error: (err) => {
            this.sendingInvite = false;
            this.toastService.error(err?.error?.message || 'Unable to send invite.');
          },
        }),
    );
  }

  changeRole(member: BusinessMember, newRole: string): void {
    if (!this.currentBusiness?.id || newRole === member.role) return;
    if (newRole !== 'manager' && newRole !== 'employee') return;

    this.updatingRoleIds.add(member.userId);

    this.subs.add(
      this.cashflowApiService
        .updateBusinessMember(this.currentBusiness.id, member.userId, { role: newRole as 'manager' | 'employee' })
        .subscribe({
          next: (updated) => {
            this.updatingRoleIds.delete(member.userId);
            const idx = this.members.findIndex((m) => m.userId === member.userId);
            if (idx !== -1) this.members[idx] = { ...this.members[idx], role: updated.role };
            this.members = [...this.members];
            this.toastService.success(`${member.email} is now ${updated.role}.`);
          },
          error: (err) => {
            this.updatingRoleIds.delete(member.userId);
            this.toastService.error(err?.error?.message || 'Unable to update role.');
          },
        }),
    );
  }

  removeMember(member: BusinessMember): void {
    if (!this.currentBusiness?.id) return;

    this.removingMemberIds.add(member.userId);

    this.subs.add(
      this.cashflowApiService.removeBusinessMember(this.currentBusiness.id, member.userId).subscribe({
        next: () => {
          this.removingMemberIds.delete(member.userId);
          this.members = this.members.filter((m) => m.userId !== member.userId);
          this.toastService.success('Member removed.');
        },
        error: (err) => {
          this.removingMemberIds.delete(member.userId);
          this.toastService.error(err?.error?.message || 'Unable to remove member.');
        },
      }),
    );
  }

  private loadMembers(businessId: string): void {
    this.loadingMembers = true;
    this.subs.add(
      this.cashflowApiService.listBusinessMembers(businessId).subscribe({
        next: (members) => {
          this.members = members.filter((m) => m.isActive);
          this.loadingMembers = false;
        },
        error: () => {
          this.members = [];
          this.loadingMembers = false;
        },
      }),
    );
  }
}
