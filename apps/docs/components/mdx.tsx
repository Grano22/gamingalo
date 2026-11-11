import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { Badge, Kbd, Swatch, Tile, TileGrid, TileLogo } from './ds';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Badge,
    Kbd,
    Swatch,
    Tile,
    TileGrid,
    TileLogo,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
