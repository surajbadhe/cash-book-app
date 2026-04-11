import { ApplicationRef, Injectable, inject } from '@angular/core';
import { SwUpdate, VersionEvent, VersionReadyEvent } from '@angular/service-worker';
import { concat, filter, first, interval } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AppUpdateService {
  private readonly appRef = inject(ApplicationRef);
  private readonly swUpdate = inject(SwUpdate);
  private started = false;

  start(): void {
    if (this.started || !this.swUpdate.isEnabled) {
      return;
    }

    this.started = true;

    this.swUpdate.versionUpdates
      .pipe(filter((event: VersionEvent): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => {
        window.location.reload();
      });

    const appIsStable$ = this.appRef.isStable.pipe(
      first((isStable) => isStable)
    );

    concat(appIsStable$, interval(6 * 60 * 1000)).subscribe(() => {
      this.swUpdate.checkForUpdate().catch((error) => {
        console.warn('App update check failed', error);
      });
    });
  }
}
