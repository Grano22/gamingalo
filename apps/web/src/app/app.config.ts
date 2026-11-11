import { provideHttpClient, withFetch } from '@angular/common/http';
import { inject, provideAppInitializer, type ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { SessionStore } from './shared/session/session.store';
import { GamingaloTheme } from './theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
    // Finds out who is signed in before the first page shows. A failure doesn't stop the app.
    provideAppInitializer(() => inject(SessionStore).load()),
    providePrimeNG({ theme: { preset: GamingaloTheme, options: { darkModeSelector: 'none' } } }),
  ],
};
