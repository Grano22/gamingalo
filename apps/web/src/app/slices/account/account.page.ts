import { ChangeDetectionStrategy, Component, inject, signal, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { displayNameSchema } from '@gamingalo/contracts';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { errorMessage } from '../../shared/api-error';
import { AccountApi } from '../../shared/session/account.api';
import { SessionStore } from '../../shared/session/session.store';

@Component({
  selector: 'app-account-page',
  imports: [FormsModule, ButtonModule, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (session.account(); as account) {
      <h1 class="text-3xl font-bold">Your account</h1>
      <p class="mt-1">{{ account.kind === 'guest' ? 'Guest account' : 'Passkey account' }}</p>

      <section aria-labelledby="profile-heading" class="mt-6 max-w-md">
        <h2 id="profile-heading" class="text-xl font-semibold">Profile</h2>
        <form (ngSubmit)="rename()" class="mt-2 flex flex-wrap items-end gap-2">
          <div class="flex flex-col">
            <label for="display-name">Display name</label>
            <input
              pInputText
              id="display-name"
              name="displayName"
              maxlength="32"
              [(ngModel)]="displayName"
              [attr.aria-invalid]="nameError() ? 'true' : null"
              [attr.aria-describedby]="nameError() ? 'name-error' : null"
            />
          </div>
          <p-button type="submit" label="Save name" [disabled]="busy()" />
        </form>
        @if (nameError(); as message) {
          <p id="name-error" class="mt-1 text-red-800">{{ message }}</p>
        }
      </section>

      <section aria-labelledby="passkey-heading" class="mt-8 max-w-md">
        <h2 id="passkey-heading" class="text-xl font-semibold">Passkeys</h2>
        @if (account.ageBand === 'under13') {
          <p class="mt-1">A parent or guardian needs to agree before you can add a passkey.</p>
        } @else {
          <p class="mt-1">
            @if (account.passkeys === 0) {
              Add a passkey to keep this account and sign in on other devices.
            } @else {
              You have {{ account.passkeys }} {{ account.passkeys === 1 ? 'passkey' : 'passkeys' }}.
            }
          </p>
          <p-button class="mt-2 block" label="Add a passkey" [disabled]="busy()" (onClick)="addPasskey()" />
        }
      </section>

      <section aria-labelledby="privacy-heading" class="mt-8 max-w-md">
        <h2 id="privacy-heading" class="text-xl font-semibold">Privacy</h2>
        <div class="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="analytics"
            [checked]="analytics()"
            [disabled]="busy() || account.ageBand === 'under13'"
            (change)="setAnalytics($any($event.target).checked)"
            [attr.aria-describedby]="account.ageBand === 'under13' ? 'analytics-note' : null"
          />
          <label for="analytics">Share anonymous usage analytics</label>
        </div>
        @if (account.ageBand === 'under13') {
          <p id="analytics-note" class="mt-1">A parent or guardian needs to agree before this can be turned on.</p>
        }
        <p-button class="mt-4 block" label="Download your data" severity="secondary" (onClick)="download()" />
      </section>

      <section aria-labelledby="session-heading" class="mt-8 max-w-md">
        <h2 id="session-heading" class="text-xl font-semibold">Sign out</h2>
        <p-button class="mt-2 block" label="Sign out" severity="secondary" [disabled]="busy()" (onClick)="signOut()" />
      </section>

      <section aria-labelledby="delete-heading" class="mt-8 max-w-md">
        <h2 id="delete-heading" class="text-xl font-semibold">Delete account</h2>
        <p class="mt-1">This removes your account and everything linked to it straight away. It can’t be undone.</p>
        <form (ngSubmit)="deleteAccount()" class="mt-2 flex flex-wrap items-end gap-2">
          <div class="flex flex-col">
            <label for="delete-confirm">Type DELETE to confirm</label>
            <input pInputText id="delete-confirm" name="confirm" autocomplete="off" [(ngModel)]="confirmText" />
          </div>
          <p-button type="submit" label="Delete account" severity="danger" [disabled]="confirmText() !== 'DELETE' || busy()" />
        </form>
      </section>

      <p role="status" class="mt-6">{{ status() }}</p>
      @if (error(); as message) {
        <p role="alert" class="mt-2 font-medium text-red-800">{{ message }}</p>
      }
    }
  `,
})
export class AccountPage implements OnInit {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(AccountApi);
  private readonly router = inject(Router);

  protected readonly displayName = signal(this.session.account()?.displayName ?? '');
  protected readonly analytics = signal(false);
  protected readonly confirmText = signal('');
  protected readonly busy = signal(false);
  protected readonly status = signal('');
  protected readonly error = signal('');
  protected readonly nameError = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.analytics.set((await this.api.consents()).analytics);
    } catch (error) {
      this.error.set(errorMessage(error, 'Your privacy settings couldn’t be loaded.'));
    }
  }

  protected async rename(): Promise<void> {
    const parsed = displayNameSchema.safeParse(this.displayName());
    if (!parsed.success) {
      this.nameError.set('Use 1 to 32 visible characters.');
      return;
    }
    this.nameError.set('');
    await this.run(async () => {
      this.session.signedInAs(await this.api.rename(parsed.data));
      this.displayName.set(parsed.data);
      this.status.set('Name saved.');
    });
  }

  protected async addPasskey(): Promise<void> {
    await this.run(async () => {
      this.session.signedInAs(await this.api.addPasskey());
      this.status.set('Passkey added.');
    }, 'The passkey wasn’t added. Try again.');
  }

  protected async setAnalytics(enabled: boolean): Promise<void> {
    await this.run(async () => {
      this.analytics.set((await this.api.saveConsents({ analytics: enabled })).analytics);
      this.status.set('Privacy settings saved.');
    });
  }

  protected async download(): Promise<void> {
    await this.run(async () => {
      const url = URL.createObjectURL(await this.api.exportData());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'gamingalo-data.json';
      link.click();
      URL.revokeObjectURL(url);
      this.status.set('Your data is downloading.');
    });
  }

  protected async signOut(): Promise<void> {
    await this.run(async () => {
      await this.api.signOut();
      this.session.signedOut();
      await this.router.navigate(['/sign-in']);
    });
  }

  protected async deleteAccount(): Promise<void> {
    await this.run(async () => {
      await this.api.deleteAccount();
      this.session.signedOut();
      await this.router.navigate(['/sign-in']);
    });
  }

  private async run(action: () => Promise<void>, fallback?: string): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.status.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(errorMessage(error, fallback));
    } finally {
      this.busy.set(false);
    }
  }
}
