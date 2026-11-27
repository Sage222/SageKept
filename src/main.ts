import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import { installSnackbar } from './app/utils/snackbar';

installSnackbar();

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule, { applicationProviders: [provideZoneChangeDetection()], })
  .catch(err => console.error(err));

function canRegisterPushServiceWorker(): boolean {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    if (window.self !== window.top) return false;
  } catch {
    return false;
  }
  const host = window.location?.hostname || '';
  if (host.endsWith('.run.app')) return false;
  return true;
}

if (canRegisterPushServiceWorker()) {
  window.addEventListener('load', async () => {
    try {
      const check = await fetch('/kept-push-sw.js', { cache: 'no-store', redirect: 'manual', credentials: 'same-origin' });
      if (!check.ok || check.redirected || check.type === 'opaqueredirect') return;
      const registration = await navigator.serviceWorker.register('/kept-push-sw.js');
      await registration.update();
    } catch {
      // Service workers are optional and may be disallowed behind reverse-proxy redirects.
    }
  });
}

// iOS Safari ignores `user-scalable=no` in the viewport meta for accessibility
// reasons, so we intercept the iOS-specific gesture events that drive pinch
// and two-finger rotate. Cancelling them blocks page-level zoom without
// affecting regular taps, single-finger scrolling, or pointer-events-based
// gestures (e.g. the drawing canvas's two-finger pan/zoom, which reads from
// PointerEvent and is unaffected).
['gesturestart', 'gesturechange', 'gestureend'].forEach(name => {
  document.addEventListener(name, (event) => {
    event.preventDefault();
  }, { passive: false });
});
