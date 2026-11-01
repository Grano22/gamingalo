import { describe, expect, it, vi } from 'vitest';
import { createMockSdk } from '../testing';
import { createMemoryStore, createSettings, getBrowserStore, resolveGraphics } from './settings';

const options = (store = createMemoryStore()) => ({
  gameId: 'x',
  store,
  readTier: async () => 'high' as const,
  onGraphicsChange: () => {},
});

describe('graphics', () => {
  it.each([
    ['auto', 'low', 'low'],
    ['auto', 'high', 'high'],
    ['auto', 'unknown', 'medium'],
    ['low', 'high', 'low'],
    ['high', 'low', 'high'],
  ] as const)('preset %s on tier %s gives %s', (preset, tier, quality) => {
    expect(resolveGraphics(preset, tier)).toMatchObject({ preset, quality });
  });

  it('saves the preset and notifies with resolved values', async () => {
    const store = createMemoryStore();
    const onGraphicsChange = vi.fn();
    const settings = createSettings({ ...options(store), onGraphicsChange });

    const result = await settings.setGraphicsPreset('low');

    expect(result.quality).toBe('low');
    expect(result.targetFps).toBe(30);
    expect(onGraphicsChange).toHaveBeenCalledWith(result);
    expect(createSettings(options(store)).getGraphicsPreset()).toBe('low');
  });

  it('rejects an unknown preset', async () => {
    await expect(createSettings(options()).setGraphicsPreset('ultra' as never)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('treats corrupted data or the wrong shape as the default', () => {
    for (const stored of ['{not json', JSON.stringify({ graphicsPreset: 'ultra' })]) {
      const store = createMemoryStore();
      store.setItem('gamingalo:x:settings', stored);
      expect(createSettings(options(store)).getGraphicsPreset()).toBe('auto');
    }
  });

  it('keeps the preset in memory when a write fails, and reports it', async () => {
    const settings = createSettings({
      ...options(),
      store: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('full', 'QuotaExceededError');
        },
      },
    });
    await settings.setGraphicsPreset('low');
    expect(settings.getGraphicsPreset()).toBe('low');
    expect(settings.persistent).toBe(false);
  });

  it('getBrowserStore returns undefined when access is missing', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getBrowserStore()).toBeUndefined();
    vi.unstubAllGlobals();
  });
});

describe('sdk.settings', () => {
  it('uses the environment tier and emits graphics', async () => {
    const sdk = await createMockSdk({ environment: { tier: 'low' } });
    const handler = vi.fn();
    sdk.on('graphics', handler);

    expect((await sdk.settings.getGraphics()).quality).toBe('low');
    await sdk.settings.setGraphicsPreset('high');

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ quality: 'high' }));
  });

  it('holds developer-level controls only', async () => {
    const sdk = await createMockSdk();
    expect(Object.keys(sdk.settings).sort()).toEqual(['getGraphics', 'getGraphicsPreset', 'persistent', 'setGraphicsPreset']);
  });

  it('throws after shutdown', async () => {
    const sdk = await createMockSdk();
    const settings = sdk.settings;
    await sdk.shutdown();
    expect(() => settings.getGraphicsPreset()).toThrow();
    expect(() => sdk.settings).toThrow();
  });
});
