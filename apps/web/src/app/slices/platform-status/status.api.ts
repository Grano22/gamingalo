import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { metaResponseSchema, readyResponseSchema, type MetaResponse } from '@gamingalo/contracts';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class StatusApi {
  private readonly http = inject(HttpClient);

  /** Rejects if the services are unreachable, not ready, or return an unexpected response. */
  async read(): Promise<MetaResponse> {
    readyResponseSchema.parse(await firstValueFrom(this.http.get('/api/ready')));
    return metaResponseSchema.parse(await firstValueFrom(this.http.get('/api/v1/meta')));
  }
}
