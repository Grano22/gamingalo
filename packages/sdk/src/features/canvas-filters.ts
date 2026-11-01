import { SafeMap } from '../primordials';

/** Lets several features add CSS filters to one canvas, without overwriting each other or the game's own. */
export interface CanvasFilterLayers {
  readonly hasCanvas: boolean;
  /** An empty value removes the layer. */
  set(layer: string, value: string): void;
  /** The combined filter, including the canvas's original filter. */
  composed(): string;
  /** Restores the original filter. Later calls to `set` do nothing. */
  dispose(): void;
}

export function createCanvasFilterLayers(canvas: HTMLCanvasElement | undefined): CanvasFilterLayers {
  const original = canvas?.style.filter ?? '';
  const layers = new SafeMap<string, string>();
  let disposed = false;

  const composed = () => {
    let result = original;
    layers.forEach((value) => {
      result = result ? `${result} ${value}` : value;
    });
    return result;
  };

  return {
    hasCanvas: !!canvas,
    set(layer, value) {
      if (disposed) return;
      if (value) layers.set(layer, value);
      else layers.delete(layer);
      if (canvas) canvas.style.filter = composed();
    },
    composed,
    dispose() {
      disposed = true;
      layers.clear();
      if (canvas) canvas.style.filter = original;
    },
  };
}
