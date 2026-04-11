import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppInstallService } from './core/services/app-install.service';
import { AppUpdateService } from './core/services/app-update.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="app-container">
      <router-outlet />

      @if (installService.showInstallCta()) {
        <div class="install-banner" role="status" aria-live="polite">
          <span>Install Cash Flow app for faster access.</span>
          <div class="install-actions">
            <button type="button" class="btn-install" (click)="installService.promptInstall()">Install</button>
            <button type="button" class="btn-dismiss" (click)="installService.dismissPrompt()">Later</button>
          </div>
        </div>
      }

      @if (installService.showIosGuide()) {
        <div class="install-banner" role="status" aria-live="polite">
          <span>On iPhone/iPad: Tap Share and choose Add to Home Screen.</span>
          <div class="install-actions">
            <button type="button" class="btn-dismiss" (click)="installService.dismissPrompt()">Got it</button>
          </div>
        </div>
      }

      @if (installService.showInstallHelp()) {
        <div class="install-banner" role="status" aria-live="polite">
          <span>{{ installService.getInstallHelpText() }}</span>
          <div class="install-actions">
            <button type="button" class="btn-install" (click)="installService.openInstall()">Install</button>
            <button type="button" class="btn-dismiss" (click)="installService.closeInstallHelp()">Close</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .install-banner {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 1000;
      max-width: min(92vw, 360px);
      background: #0f172a;
      color: #fff;
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.28);
      font-size: 13px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .install-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .btn-install,
    .btn-dismiss {
      border: none;
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-install {
      background: #22c55e;
      color: #052e16;
    }

    .btn-dismiss {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }
  `],
})
export class AppComponent {
  title = 'cash-flow';

  constructor(
    public readonly installService: AppInstallService,
    private readonly appUpdateService: AppUpdateService
  ) {
    this.installService.start();
    this.appUpdateService.start();
  }
}
