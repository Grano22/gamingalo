import { GamingaloError } from '@gamingalo/errors';
import { createObject, freeze } from './primordials';

export type RealmFrame = 'top' | 'embedded' | 'any';

export interface RealmOptions {
  /** Origins allowed to run this game, matched exactly. A sandboxed iframe's origin is `null`. */
  origins?: readonly string[];
  /** Whether the game must be the top page or inside a frame. Defaults to `any`. */
  frame?: RealmFrame;
  /** The canvas this SDK is bound to. It must belong to this realm. */
  canvas?: HTMLCanvasElement;
}

export interface RealmInfo {
  readonly origin: string | 'unknown';
  readonly embedded: boolean;
  readonly canvas: HTMLCanvasElement | undefined;
}

// Captured at load, and comes from this realm, so a canvas from another iframe fails `instanceof`.
const CanvasElement = typeof HTMLCanvasElement === 'undefined' ? undefined : HTMLCanvasElement;

function isEmbedded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function deny(message: string): never {
  throw new GamingaloError('REALM_NOT_ALLOWED', message);
}

/** Checks the current realm against the options. Rejected realms don't reveal anything to the caller. */
export function resolveRealm(options: RealmOptions | undefined): RealmInfo {
  const origin = typeof location === 'undefined' ? 'unknown' : location.origin;
  const embedded = isEmbedded();
  // A plain `{}` here would let a polluted prototype supply these options.
  const { origins, frame, canvas } = options ?? (createObject(null) as RealmOptions);

  if (origins !== undefined) {
    let allowed = false;
    for (let index = 0; index < origins.length; index++) {
      if (origins[index] === origin) allowed = true;
    }
    if (!allowed) deny(`This game can't run on origin ${origin}.`);
  }
  if (frame === 'top' && embedded) deny('This game must run as the top page.');
  if (frame === 'embedded' && !embedded) deny('This game must run inside a frame.');

  if (canvas !== undefined) {
    const inThisRealm =
      CanvasElement !== undefined && canvas instanceof CanvasElement && canvas.ownerDocument === document;
    if (!inThisRealm) deny('The canvas must be a canvas element from the same realm as the SDK.');
  }

  return freeze({ origin, embedded, canvas });
}
