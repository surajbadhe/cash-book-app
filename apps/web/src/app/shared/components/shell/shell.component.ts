import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe, TitleCasePipe } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { BusinessContextService } from '../../../core/services/business-context.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe, TitleCasePipe],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent {
  private authService = inject(AuthService);
  private businessContext = inject(BusinessContextService);
  user$ = this.authService.currentUser$;
  businesses$ = this.businessContext.businesses$;
  currentBusiness$ = this.businessContext.currentBusiness$;
  sidebarOpen = signal(false);

  constructor() {
    this.businessContext.refreshBusinesses().subscribe({ error: () => void 0 });
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  logout(): void {
    this.authService.logout().subscribe();
  }

  switchBusiness(businessId: string): void {
    this.businessContext.selectBusinessById(businessId);
    window.location.reload();
  }

  getInitial(email: string): string {
    return email ? email[0].toUpperCase() : '?';
  }
}
