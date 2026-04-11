import { Injectable, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Injectable({
  providedIn: 'root',
})
export class AppInstallService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private readonly dismissStorageKey = 'cashflow-install-dismissed';

  readonly showInstallEntry = signal(false);
  readonly showInstallCta = signal(false);
  readonly showIosGuide = signal(false);
  readonly showInstallHelp = signal(false);

  start(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.isStandaloneMode()) {
      this.showInstallEntry.set(false);
      this.showInstallCta.set(false);
      this.showIosGuide.set(false);
      this.showInstallHelp.set(false);
      return;
    }

    this.showInstallEntry.set(true);

    if (this.isIosDevice() && this.isSafariBrowser() && !this.isDismissed()) {
      this.showIosGuide.set(true);
    }

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      if (!this.isDismissed()) {
        this.showInstallCta.set(true);
        this.showIosGuide.set(false);
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.showInstallEntry.set(false);
      this.showInstallCta.set(false);
      this.showIosGuide.set(false);
      this.showInstallHelp.set(false);
      localStorage.removeItem(this.dismissStorageKey);
    });
  }

  async openInstall(): Promise<void> {
    if (this.isStandaloneMode()) {
      return;
    }

    if (this.deferredPrompt) {
      this.showInstallHelp.set(false);
      await this.promptInstall();
      return;
    }

    this.showInstallHelp.set(true);
    this.showIosGuide.set(this.isIosDevice() && this.isSafariBrowser());
  }

  async promptInstall(): Promise<void> {
    if (!this.deferredPrompt) {
      return;
    }

    await this.deferredPrompt.prompt();
    const choice = await this.deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      this.showInstallCta.set(false);
    }

    this.deferredPrompt = null;
  }

  dismissPrompt(): void {
    localStorage.setItem(this.dismissStorageKey, Date.now().toString());
    this.showInstallCta.set(false);
    this.showIosGuide.set(false);
  }

  closeInstallHelp(): void {
    this.showInstallHelp.set(false);
  }

  getInstallHelpText(): string {
    if (this.isIosDevice()) {
      return 'Open in Safari, tap Share, then choose Add to Home Screen.';
    }

    return 'Open browser menu and choose Install app / Install Cash Flow / Add to desktop.';
  }

  private isStandaloneMode(): boolean {
    const nav = navigator as Navigator & { standalone?: boolean };
    return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
  }

  private isIosDevice(): boolean {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  private isSafariBrowser(): boolean {
    const userAgent = navigator.userAgent;
    return /safari/i.test(userAgent) && !/chrome|android|crios|fxios/i.test(userAgent);
  }

  private isDismissed(): boolean {
    const value = localStorage.getItem(this.dismissStorageKey);
    if (!value) {
      return false;
    }

    const dismissedAt = Number(value);
    if (!Number.isFinite(dismissedAt)) {
      return false;
    }

    const threeDays = 3 * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedAt < threeDays;
  }
}
