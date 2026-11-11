import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { playTokenResponseSchema, publicGameSchema, type PublicGame } from '@gamingalo/contracts';
import { firstValueFrom } from 'rxjs';
import { SessionStore } from '../../shared/session/session.store';

const BRIDGE_REQUESTS = new Set(['gamingalo:ready', 'gamingalo:token-request']);

/**
 * Plays a game from its own origin, in a sandboxed frame. The game asks for a play token over
 * `postMessage`. Requests are answered only for that frame and origin, and the token is sent to
 * the game's origin only.
 */
@Component({
  selector: 'app-play-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (game(); as game) {
      <h1 class="text-2xl font-bold">{{ game.title }}</h1>
      @if (!session.signedIn()) {
        <p class="mt-2">
          The game can't see who you are until you <a routerLink="/sign-in" class="underline">sign in or play as a guest</a>.
        </p>
      }
      <iframe
        #frame
        class="mt-4 aspect-video w-full rounded border border-surface-200 bg-black"
        [src]="frameUrl()"
        [title]="'Game: ' + game.title"
        sandbox="allow-scripts allow-same-origin allow-pointer-lock"
        allow="fullscreen; gamepad; autoplay"
        referrerpolicy="no-referrer"
      ></iframe>
    } @else if (failed()) {
      <h1 class="text-2xl font-bold">Game not found</h1>
      <p class="mt-2">This game doesn't exist or isn't live. <a routerLink="/" class="underline">See all games</a></p>
    } @else {
      <p role="status">Loading the game…</p>
    }
  `,
})
export class PlayPage implements OnInit {
  readonly gameId = input.required<string>();
  protected readonly session = inject(SessionStore);
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  protected readonly game = signal<PublicGame | null>(null);
  protected readonly frameUrl = signal<SafeResourceUrl | null>(null);
  protected readonly failed = signal(false);
  private gameOrigin = '';

  async ngOnInit(): Promise<void> {
    const listener = (event: MessageEvent) => void this.answer(event);
    window.addEventListener('message', listener);
    this.destroyRef.onDestroy(() => window.removeEventListener('message', listener));

    try {
      const game = publicGameSchema.parse(
        await firstValueFrom(this.http.get(`/api/v1/games/${encodeURIComponent(this.gameId())}`)),
      );
      const url = new URL(game.url);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Unexpected game address');
      this.gameOrigin = url.origin;
      // The address comes from the platform's own API, and was checked above.
      this.frameUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url.href));
      this.game.set(game);
    } catch {
      this.failed.set(true);
    }
  }

  private async answer(event: MessageEvent): Promise<void> {
    const target = this.frame()?.nativeElement.contentWindow;
    if (!target || event.source !== target || event.origin !== this.gameOrigin) return;
    const type = typeof event.data === 'object' && event.data !== null ? (event.data as { type?: unknown }).type : undefined;
    if (typeof type !== 'string' || !BRIDGE_REQUESTS.has(type) || !this.session.signedIn()) return;
    try {
      const token = playTokenResponseSchema.parse(
        await firstValueFrom(this.http.post(`/api/v1/games/${encodeURIComponent(this.gameId())}/play-token`, {})),
      );
      target.postMessage({ type: 'gamingalo:play-token', ...token }, this.gameOrigin);
    } catch {
      // The game reports that no player is available.
    }
  }
}
