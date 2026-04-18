import { Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd, Router } from '@angular/router';
import { AsyncPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AppInstallService } from '../../../core/services/app-install.service';
import { BusinessContextService } from '../../../core/services/business-context.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe, TitleCasePipe, FormsModule],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  installService = inject(AppInstallService);
  private businessContext = inject(BusinessContextService);
  private toastService = inject(ToastService);
  private subs = new Subscription();
  user$ = this.authService.currentUser$;
  businesses$ = this.businessContext.businesses$;
  currentBusiness$ = this.businessContext.currentBusiness$;
  switchingBusiness$ = this.businessContext.switchingBusiness$;
  toast$ = this.toastService.toast$;
  sidebarOpen = signal(false);
  selectedBusinessId = this.businessContext.currentBusinessId || '';

  constructor() {
    this.subs.add(
      this.businessContext.refreshBusinesses().subscribe({
        next: () => this.applyBookFromUrl(),
        error: () => void 0,
      })
    );

    this.subs.add(
      this.businessContext.currentBusiness$.subscribe((business) => {
        this.selectedBusinessId = business?.id || this.businessContext.currentBusinessId || '';
        if (!business?.id) {
          return;
        }
        this.ensureBookParam(business.id);
      })
    );

    this.subs.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => this.applyBookFromUrl())
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
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
    if (!businessId || businessId === this.businessContext.currentBusiness?.id) {
      this.closeSidebar();
      return;
    }

    if (this.shouldShowBusinessLoader()) {
      this.businessContext.beginBusinessSwitch();
    }
    this.selectedBusinessId = businessId;
    this.businessContext.selectBusinessById(businessId);
    this.ensureBookParam(businessId);
    this.closeSidebar();
  }

  getInitial(email: string): string {
    return email ? email[0].toUpperCase() : '?';
  }

  installApp(): void {
    this.installService.openInstall();
    this.closeSidebar();
  }

  private applyBookFromUrl(): void {
    const tree = this.router.parseUrl(this.router.url);
    const bookId = typeof tree.queryParams['book'] === 'string'
      ? tree.queryParams['book']
      : (typeof tree.queryParams['shop'] === 'string' ? tree.queryParams['shop'] : '');

    if (!bookId) {
      const currentId = this.businessContext.currentBusiness?.id;
      if (currentId) {
        this.selectedBusinessId = currentId;
        this.ensureBookParam(currentId);
      }
      return;
    }

    if (bookId === this.businessContext.currentBusiness?.id) {
      this.selectedBusinessId = bookId;
      return;
    }

    this.selectedBusinessId = bookId;
    this.businessContext.selectBusinessById(bookId);

    const resolvedId = this.businessContext.currentBusiness?.id;
    if (resolvedId && resolvedId !== bookId) {
      this.selectedBusinessId = resolvedId;
      this.ensureBookParam(resolvedId);
    }
  }

  private ensureBookParam(businessId: string): void {
    const tree = this.router.parseUrl(this.router.url);
    if (tree.queryParams['book'] === businessId && !tree.queryParams['shop']) {
      return;
    }

    tree.queryParams = {
      ...tree.queryParams,
      book: businessId,
    };
    delete tree.queryParams['shop'];

    this.router.navigateByUrl(tree, { replaceUrl: true });
  }

  private shouldShowBusinessLoader(): boolean {
    const currentPath = this.router.parseUrl(this.router.url).root.children['primary']?.segments.map((segment) => segment.path).join('/') || '';
    return ['dashboard', 'transactions', 'reports', 'team'].includes(currentPath);
  }
}
