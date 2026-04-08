import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/auth.models';
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
  private cashflowService = inject(CashflowService);
  private fb = inject(FormBuilder);
  private subs = new Subscription();

  user: User | null = null;
  lockEnabled = false;
  pinSaved = false;
  pinError = '';

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
    this.cashflowService.upsertLock(this.pinForm.controls.pin.value);
    this.pinForm.reset({ pin: '' });
    this.pinSaved = true;
    setTimeout(() => (this.pinSaved = false), 2000);
  }

  disablePin(): void {
    this.cashflowService.disableLock();
    this.pinError = '';
  }

  logout(): void {
    this.authService.logout().subscribe();
  }
}
