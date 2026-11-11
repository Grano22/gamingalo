import type { Routes } from '@angular/router';
import { requireAccount } from './shared/session/require-account.guard';

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
  {
    path: 'play/:gameId',
    title: 'Play | Gamingalo',
    loadComponent: () => import('./slices/play/play.page').then((module) => module.PlayPage),
  },
  {
    path: 'creator',
    title: 'Creator | Gamingalo',
    canActivate: [requireAccount],
    loadComponent: () => import('./slices/creator/creator.page').then((module) => module.CreatorPage),
  },
  {
    path: 'sign-in',
    title: 'Sign in | Gamingalo',
    loadComponent: () => import('./slices/sign-in/sign-in.page').then((module) => module.SignInPage),
  },
  {
    path: 'account',
    title: 'Your account | Gamingalo',
    canActivate: [requireAccount],
    loadComponent: () => import('./slices/account/account.page').then((module) => module.AccountPage),
  },
  { path: '**', redirectTo: '' },
];
