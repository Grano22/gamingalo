import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catalogResponseSchema, type PublicGame } from '@gamingalo/contracts';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-bold">Play and publish web games</h1>
    <section aria-labelledby="catalog-heading" class="mt-6">
      <h2 id="catalog-heading" class="text-xl font-semibold">Games</h2>
      @switch (status()) {
        @case ('loading') {
          <p class="mt-2" role="status">Loading games…</p>
        }
        @case ('failed') {
          <p class="mt-2" role="alert">The games couldn't be loaded. Try again later.</p>
        }
        @default {
          @if (games().length === 0) {
            <p class="mt-2">No games yet.</p>
          } @else {
            <ul class="mt-2 grid gap-3 sm:grid-cols-2">
              @for (game of games(); track game.id) {
                <li class="rounded border border-surface-200 bg-white p-4">
                  <a [routerLink]="['/play', game.id]" class="font-semibold underline">{{ game.title }}</a>
                </li>
              }
            </ul>
          }
        }
      }
    </section>
  `,
})
export class HomePage implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly games = signal<PublicGame[]>([]);
  protected readonly status = signal<'loading' | 'ready' | 'failed'>('loading');

  async ngOnInit(): Promise<void> {
    try {
      this.games.set(catalogResponseSchema.parse(await firstValueFrom(this.http.get('/api/v1/catalog'))).games);
      this.status.set('ready');
    } catch {
      this.status.set('failed');
    }
  }
}
