import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/auth.models';
import { CashflowService } from '../../core/services/cashflow.service';
import { ToastService } from '../../core/services/toast.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private cashflowService = inject(CashflowService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  private subs = new Subscription();

  user: User | null = null;
  lockEnabled = false;
  pinError = '';
  savingPin = false;
  disablingPin = false;
  loggingOut = false;

  pinForm = this.fb.nonNullable.group({
    pin: this.fb.nonNullable.control<string>('', [
      Validators.required,
      Validators.pattern(/^[0-9]{4}$/),
    ]),
  });

  ngOnInit(): void {
    this.subs.add(this.authService.currentUser$.subscribe((u) => (this.user = u)));
    this.subs.add(
      this.cashflowService.lockSettings$.subscribe((s) => (this.lockEnabled = s.enabled))
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get initials(): string {
    return this.user?.email?.[0]?.toUpperCase() ?? '?';
  }

  savePin(): void {
    if (this.pinForm.invalid) { this.pinForm.markAllAsTouched(); return; }
    this.savingPin = true;
    this.cashflowService.upsertLock(this.pinForm.controls.pin.value);
    this.pinForm.reset({ pin: '' });
    this.savingPin = false;
    this.toastService.success('PIN saved successfully.');
  }

  disablePin(): void {
    this.disablingPin = true;
    this.cashflowService.disableLock();
    this.disablingPin = false;
    this.pinError = '';
    this.toastService.success('PIN lock disabled.');
  }

  logout(): void {
    this.loggingOut = true;
    this.authService.logout().subscribe({
      complete: () => {
        this.loggingOut = false;
      },
      error: () => {
        this.loggingOut = false;
      },
    });
  }
}
