import { inject } from '@angular/core';
import type { MetaResponse } from '@gamingalo/contracts';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { StatusApi } from './status.api';

interface StatusState {
  status: 'loading' | 'available' | 'unavailable';
  meta: MetaResponse | null;
}

export const StatusStore = signalStore(
  withState<StatusState>({ status: 'loading', meta: null }),
  withMethods((store, api = inject(StatusApi)) => ({
    async refresh(): Promise<void> {
      patchState(store, { status: 'loading' });
      try {
        patchState(store, { status: 'available', meta: await api.read() });
      } catch {
        patchState(store, { status: 'unavailable', meta: null });
      }
    },
  })),
);
