import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  accountResponseSchema,
  consentsSchema,
  passkeyOptionsResponseSchema,
  type AccountResponse,
  type AgeBand,
  type Consents,
} from '@gamingalo/contracts';
import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { firstValueFrom } from 'rxjs';

/** Every response is checked against the shared contracts, so an unexpected response fails. */
@Injectable({ providedIn: 'root' })
export class AccountApi {
  private readonly http = inject(HttpClient);

  async me(): Promise<AccountResponse> {
    return accountResponseSchema.parse(await firstValueFrom(this.http.get('/api/v1/me')));
  }

  async createGuest(ageBand: AgeBand): Promise<AccountResponse> {
    return accountResponseSchema.parse(await firstValueFrom(this.http.post('/api/v1/accounts/guest', { ageBand })));
  }

  async rename(displayName: string): Promise<AccountResponse> {
    return accountResponseSchema.parse(await firstValueFrom(this.http.patch('/api/v1/me', { displayName })));
  }

  async consents(): Promise<Consents> {
    return consentsSchema.parse(await firstValueFrom(this.http.get('/api/v1/me/consents')));
  }

  async saveConsents(consents: Consents): Promise<Consents> {
    return consentsSchema.parse(await firstValueFrom(this.http.put('/api/v1/me/consents', consents)));
  }

  async exportData(): Promise<Blob> {
    return firstValueFrom(this.http.get('/api/v1/me/export', { responseType: 'blob' }));
  }

  async deleteAccount(): Promise<void> {
    await firstValueFrom(this.http.delete('/api/v1/me', { body: { confirm: 'DELETE' } }));
  }

  async signOut(): Promise<void> {
    await firstValueFrom(this.http.delete('/api/v1/sessions/current'));
  }

  async addPasskey(): Promise<AccountResponse> {
    const { challengeId, options } = passkeyOptionsResponseSchema.parse(
      await firstValueFrom(this.http.post('/api/v1/passkeys/registration/options', {})),
    );
    const credential = await startRegistration({
      optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
    });
    return accountResponseSchema.parse(
      await firstValueFrom(this.http.post('/api/v1/passkeys/registration/verify', { challengeId, credential })),
    );
  }

  async signInWithPasskey(): Promise<AccountResponse> {
    const { challengeId, options } = passkeyOptionsResponseSchema.parse(
      await firstValueFrom(this.http.post('/api/v1/passkeys/login/options', {})),
    );
    const credential = await startAuthentication({
      optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
    });
    return accountResponseSchema.parse(
      await firstValueFrom(this.http.post('/api/v1/passkeys/login/verify', { challengeId, credential })),
    );
  }
}
