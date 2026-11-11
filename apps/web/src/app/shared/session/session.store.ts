import { inject } from '@angular/core';
import type { AccountResponse } from '@gamingalo/contracts';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { computed } from '@angular/core';
import { errorCode } from '../api-error';
import { AccountApi } from './account.api';

interface SessionState {
  status: 'unknown' | 'anonymous' | 'signed-in';
  account: AccountResponse | null;
}

/** Who is signed in. Shared by the shell and every slice that needs it. */
export const SessionStore = signalStore(
  { providedIn: 'root' },
  withState<SessionState>({ status: 'unknown', account: null }),
  withComputed((store) => ({
    signedIn: computed(() => store.status() === 'signed-in'),
  })),
  withMethods((store, api = inject(AccountApi)) => ({
    /** Treats a missing session as signed out. Other failures leave the state unknown. */
    async load(): Promise<void> {
      try {
        patchState(store, { status: 'signed-in', account: await api.me() });
      } catch (error) {
        if (errorCode(error) === 'UNAUTHENTICATED') patchState(store, { status: 'anonymous', account: null });
        else patchState(store, { status: 'unknown', account: null });
      }
    },
    signedInAs(account: AccountResponse): void {
      patchState(store, { status: 'signed-in', account });
    },
    signedOut(): void {
      patchState(store, { status: 'anonymous', account: null });
    },
  })),
);
