import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { StatusStore } from './status.store';

@Component({
  selector: 'app-status-page',
  imports: [ButtonModule, TagModule],
  providers: [StatusStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-bold">Service status</h1>
    <div role="status" class="mt-4 flex items-center gap-3">
      <p-tag [value]="label()" [severity]="severity()" />
      @if (store.meta(); as meta) {
        <span>{{ meta.service }} {{ meta.version }}</span>
      }
    </div>
    <p-button class="mt-4 block" label="Check again" [disabled]="store.status() === 'loading'" (onClick)="store.refresh()" />
  `,
})
export class StatusPage implements OnInit {
  protected readonly store = inject(StatusStore);

  protected readonly label = computed(() => {
    const labels = { loading: 'Checking', available: 'Available', unavailable: 'Unavailable' };
    return labels[this.store.status()];
  });

  protected readonly severity = computed(() => {
    const severities = { loading: 'info', available: 'success', unavailable: 'danger' } as const;
    return severities[this.store.status()];
  });

  ngOnInit(): void {
    void this.store.refresh();
  }
}
