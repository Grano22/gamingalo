import type { ReactNode } from 'react';

export { TileLogo } from './tile-logo';

export type Tone = 'stable' | 'beta' | 'planned' | 'breaking';

const TONE_LABEL: Record<Tone, string> = { stable: 'Stable', beta: 'Beta', planned: 'Planned', breaking: 'Breaking' };

/** The status of a feature or change. Color is never the only signal: the label always shows. */
export function Badge({ tone, children }: { tone: Tone; children?: ReactNode }) {
  return (
    <span className="gg-badge" data-tone={tone}>
      {children ?? TONE_LABEL[tone]}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="gg-kbd">{children}</kbd>;
}

/** A card on the board. `lit` marks the one thing to look at first. */
export function Tile({ title, children, lit = false, href }: { title: string; children: ReactNode; lit?: boolean; href?: string }) {
  const content = (
    <>
      <h3 className="gg-display mb-1 text-lg font-semibold">{title}</h3>
      <div className="text-fd-muted-foreground text-sm">{children}</div>
    </>
  );
  return (
    <div className="gg-tile" data-lit={lit}>
      {href ? (
        <a href={href} className="block no-underline after:absolute after:inset-0 after:content-['']">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="not-prose my-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/** Shows a design token: its swatch, name and value. */
export function Swatch({ name, value, note }: { name: string; value: string; note?: string }) {
  return (
    <div className="gg-tile flex items-center gap-3" style={{ padding: 12 }}>
      <span
        aria-hidden="true"
        className="inline-block h-10 w-10 shrink-0 rounded-md border border-fd-border"
        style={{ background: `var(${name})` }}
      />
      <span className="min-w-0">
        <code className="block text-sm">{name}</code>
        <span className="text-fd-muted-foreground text-xs">
          {value}
          {note ? ` · ${note}` : ''}
        </span>
      </span>
    </div>
  );
}
