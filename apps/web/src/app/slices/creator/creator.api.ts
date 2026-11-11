import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  apiTokenListSchema,
  createdApiTokenSchema,
  gameResponseSchema,
  versionListResponseSchema,
  type ApiToken,
  type Channel,
  type GameResponse,
  type VersionResponse,
} from '@gamingalo/contracts';
import { firstValueFrom } from 'rxjs';
import * as z from 'zod';

const gameListSchema = z.strictObject({ games: z.array(gameResponseSchema) });

@Injectable({ providedIn: 'root' })
export class CreatorApi {
  private readonly http = inject(HttpClient);

  async tokens(): Promise<ApiToken[]> {
    return apiTokenListSchema.parse(await firstValueFrom(this.http.get('/api/v1/me/tokens'))).tokens;
  }

  async createToken(name: string): Promise<{ token: string } & ApiToken> {
    return createdApiTokenSchema.parse(await firstValueFrom(this.http.post('/api/v1/me/tokens', { name })));
  }

  async revokeToken(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/v1/me/tokens/${encodeURIComponent(id)}`));
  }

  async games(): Promise<GameResponse[]> {
    return gameListSchema.parse(await firstValueFrom(this.http.get('/api/v1/creator/games'))).games;
  }

  async versions(gameId: string): Promise<VersionResponse[]> {
    return versionListResponseSchema.parse(
      await firstValueFrom(this.http.get(`/api/v1/creator/games/${encodeURIComponent(gameId)}/versions`)),
    ).versions;
  }

  async promote(gameId: string, channel: Channel, version: string): Promise<GameResponse> {
    return gameResponseSchema.parse(
      await firstValueFrom(
        this.http.post(`/api/v1/creator/games/${encodeURIComponent(gameId)}/channels/${channel}`, { version }),
      ),
    );
  }
}
