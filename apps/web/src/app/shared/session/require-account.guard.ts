import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SessionStore } from './session.store';

export const requireAccount: CanActivateFn = async () => {
  const session = inject(SessionStore);
  if (session.status() === 'unknown') await session.load();
  return session.signedIn() ? true : inject(Router).createUrlTree(['/sign-in']);
};
