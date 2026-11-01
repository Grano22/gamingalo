import type { Routes } from '@angular/router';

// Each slice is loaded on demand, and owns its own page, state and API calls.
export const routes: Routes = [
  {
    path: '',
    title: 'Gamingalo',
    loadComponent: () => import('./slices/home/home.page').then((module) => module.HomePage),
  },
  {
    path: 'status',
    title: 'Service status | Gamingalo',
    loadComponent: () => import('./slices/platform-status/status.page').then((module) => module.StatusPage),
  },
  { path: '**', redirectTo: '' },
];
