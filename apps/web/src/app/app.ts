import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideActivity, LucideGamepad2 } from '@lucide/angular';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideGamepad2, LucideActivity],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-white focus:p-2"
    >
      Skip to main content
    </a>
    <header class="border-b border-surface-200 bg-white">
      <nav aria-label="Main" class="mx-auto flex max-w-5xl items-center gap-6 p-4">
        <a routerLink="/" class="flex items-center gap-2 text-lg font-semibold">
          <svg lucideGamepad2 aria-hidden="true"></svg>
          Gamingalo
        </a>
        <a
          routerLink="/status"
          routerLinkActive="font-semibold"
          ariaCurrentWhenActive="page"
          class="flex items-center gap-2"
        >
          <svg lucideActivity aria-hidden="true"></svg>
          Status
        </a>
      </nav>
    </header>
    <main id="main" tabindex="-1" class="mx-auto max-w-5xl p-4">
      <router-outlet />
    </main>
  `,
})
export class App {}
