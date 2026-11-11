import type { GamingaloPlugin, PluginContext } from '@gamingalo/sdk';

export type ScreenSetting = 'brightness' | 'contrast' | 'saturation' | 'gamma';

export interface ScreenValues {
  readonly brightness: number;
  readonly contrast: number;
  readonly saturation: number;
  readonly gamma: number;
}

export interface ScreenLimit {
  min: number;
  max: number;
}

export interface ScreenPreferencesOptions {
  /** Narrows what a player can choose. Each range must include 1, which leaves the picture unchanged. */
  limits?: Partial<Record<ScreenSetting, ScreenLimit>>;
}

export interface ScreenPreferences {
  values(): ScreenValues;
  limits(): Readonly<Record<ScreenSetting, Readonly<ScreenLimit>>>;
  /** Throws `INVALID_ARGUMENT` for a value outside the limits. */
  setBrightness(value: number): void;
  setContrast(value: number): void;
  setSaturation(value: number): void;
  setGamma(value: number): void;
  /** Returns every setting to 1. */
  reset(): void;
}

const { freeze, hasOwn } = Object;

const DEFAULT_LIMITS: Readonly<Record<ScreenSetting, Readonly<ScreenLimit>>> = freeze({
  brightness: freeze({ min: 0.5, max: 1.5 }),
  contrast: freeze({ min: 0.5, max: 1.5 }),
  saturation: freeze({ min: 0, max: 2 }),
  gamma: freeze({ min: 0.5, max: 2.5 }),
});

const SETTINGS = freeze(['brightness', 'contrast', 'saturation', 'gamma'] as const);
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function resolveLimits(options: ScreenPreferencesOptions): Record<ScreenSetting, Readonly<ScreenLimit>> {
  const limits = { ...DEFAULT_LIMITS };
  const given = hasOwn(options, 'limits') ? options.limits : undefined;
  if (!given) return limits;
  for (const setting of SETTINGS) {
    const limit = hasOwn(given, setting) ? given[setting] : undefined;
    if (!limit) continue;
    const { min, max } = limit;
    const allowed = DEFAULT_LIMITS[setting];
    if (!(min >= allowed.min && max <= allowed.max && min <= 1 && max >= 1)) {
      throw new RangeError(`The ${setting} limits must include 1 and stay within ${allowed.min} to ${allowed.max}.`);
    }
    limits[setting] = freeze({ min, max });
  }
  return limits;
}

/** An SVG filter, because CSS has no gamma function. Returns its URL, and a function that removes it. */
function createGammaFilter(gameId: string): { url: string; setGamma(value: number): void; remove(): void } {
  const id = `gamingalo-gamma-${gameId}`;
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('data-gamingalo-screen', '');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('style', 'position:absolute;width:0;height:0');
  const filter = document.createElementNS(SVG_NAMESPACE, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  const transfer = document.createElementNS(SVG_NAMESPACE, 'feComponentTransfer');
  const channels = ['feFuncR', 'feFuncG', 'feFuncB'].map((name) => {
    const channel = document.createElementNS(SVG_NAMESPACE, name);
    channel.setAttribute('type', 'gamma');
    transfer.append(channel);
    return channel;
  });
  filter.append(transfer);
  svg.append(filter);
  document.body.append(svg);
  return {
    url: `url(#${id})`,
    setGamma: (value) => channels.forEach((channel) => channel.setAttribute('exponent', String(1 / value))),
    remove: () => svg.remove(),
  };
}

/** Lets players adjust the picture. Add it to `Gamingalo.init({ plugins })`, and bind a canvas with `realm.canvas`. */
export function screenPreferences(options: ScreenPreferencesOptions = {}): GamingaloPlugin<ScreenPreferences> {
  const limits = freeze(resolveLimits(options));

  return freeze({
    name: 'screen-preferences',
    setup(context: PluginContext): ScreenPreferences {
      const { preferences } = context;
      preferences.define({
        brightness: { type: 'number', default: 1, ...limits.brightness },
        contrast: { type: 'number', default: 1, ...limits.contrast },
        saturation: { type: 'number', default: 1, ...limits.saturation },
        gamma: { type: 'number', default: 1, ...limits.gamma },
      });

      const canvas = context.realm.canvas;
      const gamma = canvas ? createGammaFilter(context.gameId) : undefined;
      if (gamma) context.addCleanup(gamma.remove);

      const read = (): ScreenValues =>
        freeze({
          brightness: preferences.get('brightness', 1),
          contrast: preferences.get('contrast', 1),
          saturation: preferences.get('saturation', 1),
          gamma: preferences.get('gamma', 1),
        });

      const apply = () => {
        const values = read();
        const parts: string[] = [];
        if (values.brightness !== 1) parts.push(`brightness(${values.brightness})`);
        if (values.contrast !== 1) parts.push(`contrast(${values.contrast})`);
        if (values.saturation !== 1) parts.push(`saturate(${values.saturation})`);
        if (gamma && values.gamma !== 1) {
          gamma.setGamma(values.gamma);
          parts.push(gamma.url);
        }
        context.setCanvasFilter(parts.join(' '));
      };

      const setter = (setting: ScreenSetting) => (value: number) => {
        preferences.set(setting, value);
        apply();
      };

      apply();

      return {
        values: read,
        limits: () => limits,
        setBrightness: setter('brightness'),
        setContrast: setter('contrast'),
        setSaturation: setter('saturation'),
        setGamma: setter('gamma'),
        reset() {
          preferences.reset();
          apply();
        },
      };
    },
  });
}

/** The factory `@gamingalo/vite-plugin` calls when this package is installed (see `gamingalo` in package.json). */
export const gamingaloPlugin = screenPreferences;
