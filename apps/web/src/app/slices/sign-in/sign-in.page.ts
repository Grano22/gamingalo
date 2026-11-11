import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { AgeBand } from '@gamingalo/contracts';
import { ButtonModule } from 'primeng/button';
import { errorMessage } from '../../shared/api-error';
import { AccountApi } from '../../shared/session/account.api';
import { SessionStore } from '../../shared/session/session.store';

@Component({
  selector: 'app-sign-in-page',
  imports: [FormsModule, ButtonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-bold">Sign in</h1>

    @if (session.account(); as account) {
      <p class="mt-4">
        You're signed in as {{ account.displayName }}. <a routerLink="/account" class="underline">Go to your account</a>
      </p>
    } @else {
      <section aria-labelledby="guest-heading" class="mt-6 max-w-md">
        <h2 id="guest-heading" class="text-xl font-semibold">Play as a guest</h2>
        <form (ngSubmit)="playAsGuest()" class="mt-3">
          <fieldset>
            <legend class="font-medium">How old are you?</legend>
            @for (option of ageOptions; track option.value) {
              <div class="mt-2 flex items-center gap-2">
                <input
                  type="radio"
                  name="ageBand"
                  [id]="'age-' + option.value"
                  [value]="option.value"
                  [(ngModel)]="ageBand"
                  required
                />
                <label [for]="'age-' + option.value">{{ option.label }}</label>
              </div>
            }
          </fieldset>
          <p-button class="mt-4 block" type="submit" label="Play as a guest" [disabled]="!ageBand() || busy()" />
        </form>
      </section>

      <section aria-labelledby="passkey-heading" class="mt-8 max-w-md">
        <h2 id="passkey-heading" class="text-xl font-semibold">Have a passkey?</h2>
        <p class="mt-1">If you're playing as a guest, signing in switches to your passkey account.</p>
        <p-button class="mt-3 block" label="Sign in with a passkey" [disabled]="busy()" (onClick)="signInWithPasskey()" />
      </section>
    }

    @if (error(); as message) {
      <p role="alert" class="mt-4 font-medium text-red-800">{{ message }}</p>
    }
  `,
})
export class SignInPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(AccountApi);
  private readonly router = inject(Router);

  protected readonly ageOptions: ReadonlyArray<{ value: AgeBand; label: string }> = [
    { value: '16plus', label: '16 or older' },
    { value: '13to15', label: '13 to 15' },
    { value: 'under13', label: 'Under 13' },
  ];
  protected readonly ageBand = signal<AgeBand | ''>('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async playAsGuest(): Promise<void> {
    const ageBand = this.ageBand();
    if (!ageBand) return;
    await this.run(() => this.api.createGuest(ageBand));
  }

  protected async signInWithPasskey(): Promise<void> {
    await this.run(() => this.api.signInWithPasskey(), 'Signing in with a passkey didn’t work. Try again.');
  }

  private async run(action: () => ReturnType<AccountApi['me']>, fallback?: string): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      this.session.signedInAs(await action());
      await this.router.navigate(['/account']);
    } catch (error) {
      this.error.set(errorMessage(error, fallback));
    } finally {
      this.busy.set(false);
    }
  }
}
