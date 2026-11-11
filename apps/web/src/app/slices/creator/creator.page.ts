import { ChangeDetectionStrategy, Component, inject, signal, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { ApiToken, Channel, GameResponse, VersionResponse } from '@gamingalo/contracts';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { errorMessage } from '../../shared/api-error';
import { SessionStore } from '../../shared/session/session.store';
import { CreatorApi } from './creator.api';

@Component({
  selector: 'app-creator-page',
  imports: [FormsModule, ButtonModule, InputTextModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-bold">Creator</h1>

    @if (session.account()?.kind !== 'registered') {
      <p class="mt-4">
        Creators need an account with a passkey. <a routerLink="/account" class="underline">Add one on your account page</a>.
      </p>
    } @else {
      <section aria-labelledby="tokens-heading" class="mt-6 max-w-2xl">
        <h2 id="tokens-heading" class="text-xl font-semibold">API tokens</h2>
        <p class="mt-1">The CLI and CI use these to publish. Treat a token like a password.</p>
        <form (ngSubmit)="createToken()" class="mt-2 flex flex-wrap items-end gap-2">
          <div class="flex flex-col">
            <label for="token-name">Token name</label>
            <input pInputText id="token-name" name="tokenName" maxlength="60" [(ngModel)]="tokenName" />
          </div>
          <p-button type="submit" label="Create token" [disabled]="!tokenName().trim() || busy()" />
        </form>

        @if (newToken(); as token) {
          <div class="mt-3 rounded border border-surface-300 bg-white p-3">
            <label for="new-token" class="font-medium">Your new token. It won’t be shown again.</label>
            <input pInputText id="new-token" class="mt-1 w-full font-mono" readonly [value]="token" />
            <p class="mt-2">
              Sign in with <code>gamingalo login --token-stdin</code>, or set <code>GAMINGALO_TOKEN</code> in CI.
            </p>
          </div>
        }

        @if (tokens().length > 0) {
          <ul class="mt-3">
            @for (token of tokens(); track token.id) {
              <li class="flex items-center justify-between gap-2 border-b border-surface-200 py-2">
                <span>
                  {{ token.name }}
                  <span class="text-surface-700">· {{ token.lastUsedAt ? 'last used ' + token.lastUsedAt.slice(0, 10) : 'never used' }}</span>
                </span>
                <p-button
                  severity="danger"
                  [label]="'Revoke'"
                  [ariaLabel]="'Revoke ' + token.name"
                  [disabled]="busy()"
                  (onClick)="revoke(token)"
                />
              </li>
            }
          </ul>
        }
      </section>

      <section aria-labelledby="games-heading" class="mt-8 max-w-2xl">
        <h2 id="games-heading" class="text-xl font-semibold">Your games</h2>
        @if (games().length === 0) {
          <p class="mt-1">
            No games yet. In your game's folder, run <code>gamingalo game:create</code>,
            <code>gamingalo game:keys:create</code> and <code>gamingalo game:publish</code>.
          </p>
        }
        @for (game of games(); track game.id) {
          <article class="mt-4 rounded border border-surface-200 bg-white p-4" [attr.aria-labelledby]="'game-' + game.id">
            <h3 [id]="'game-' + game.id" class="text-lg font-semibold">{{ game.title }}</h3>
            <p>
              Production: {{ game.productionVersion ?? 'nothing live' }} · Preview: {{ game.previewVersion ?? 'nothing live' }}
            </p>
            <p class="mt-1">
              <a [href]="game.previewUrl" class="underline" target="_blank" rel="noopener">Open the preview</a>
            </p>
            <table class="mt-3 w-full text-left">
              <caption class="sr-only">Versions of {{ game.title }}</caption>
              <thead>
                <tr><th scope="col">Version</th><th scope="col">Status</th><th scope="col">Live on</th><th scope="col"><span class="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                @for (version of versions()[game.id] ?? []; track version.version) {
                  <tr class="border-t border-surface-200">
                    <td>{{ version.version }}</td>
                    <td>{{ version.status }}</td>
                    <td>{{ version.channels.join(', ') || '–' }}</td>
                    <td class="py-1 text-right">
                      @if (version.status === 'ready' && !version.channels.includes('production')) {
                        <p-button
                          size="small"
                          label="Make live"
                          [ariaLabel]="'Make ' + version.version + ' live in production'"
                          [disabled]="busy()"
                          (onClick)="promote(game, 'production', version.version)"
                        />
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </article>
        }
      </section>
    }

    <p role="status" class="mt-6">{{ status() }}</p>
    @if (error(); as message) {
      <p role="alert" class="mt-2 font-medium text-red-800">{{ message }}</p>
    }
  `,
})
export class CreatorPage implements OnInit {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(CreatorApi);

  protected readonly tokens = signal<ApiToken[]>([]);
  protected readonly games = signal<GameResponse[]>([]);
  protected readonly versions = signal<Record<string, VersionResponse[]>>({});
  protected readonly tokenName = signal('');
  protected readonly newToken = signal('');
  protected readonly busy = signal(false);
  protected readonly status = signal('');
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    if (this.session.account()?.kind !== 'registered') return;
    await this.run(() => this.reload());
  }

  protected async createToken(): Promise<void> {
    await this.run(async () => {
      const created = await this.api.createToken(this.tokenName().trim());
      this.newToken.set(created.token);
      this.tokenName.set('');
      this.tokens.set(await this.api.tokens());
      this.status.set('Token created.');
    });
  }

  protected async revoke(token: ApiToken): Promise<void> {
    await this.run(async () => {
      await this.api.revokeToken(token.id);
      this.tokens.set(await this.api.tokens());
      this.status.set(`Revoked ${token.name}.`);
    });
  }

  protected async promote(game: GameResponse, channel: Channel, version: string): Promise<void> {
    await this.run(async () => {
      await this.api.promote(game.id, channel, version);
      await this.reload();
      this.status.set(`${game.title} ${version} is live in ${channel}.`);
    });
  }

  private async reload(): Promise<void> {
    const [tokens, games] = await Promise.all([this.api.tokens(), this.api.games()]);
    this.tokens.set(tokens);
    this.games.set(games);
    const entries = await Promise.all(games.map(async (game) => [game.id, await this.api.versions(game.id)] as const));
    this.versions.set(Object.fromEntries(entries));
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.status.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
