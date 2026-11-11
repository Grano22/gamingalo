import Link from 'next/link';
import { Badge, Tile, TileGrid, TileLogo } from '@/components/ds';

export default function HomePage() {
  return (
    <main className="gg-grid-backdrop flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-5xl px-6 py-16 md:py-24">
        <TileLogo size={56} title="Gamingalo" />
        <h1 className="gg-display mt-6 max-w-3xl text-4xl font-bold md:text-6xl">
          Build web games. Publish them with one command.
        </h1>
        <p className="text-fd-muted-foreground mt-4 max-w-2xl text-lg">
          The Gamingalo SDK gives a game saves, preferences, localization, accessibility and the signed-in player, with no
          backend to run. The CLI signs and publishes it, and the platform plays it on its own isolated origin.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/docs/getting-started"
            className="bg-fd-primary text-fd-primary-foreground rounded-md px-5 py-2.5 font-semibold"
          >
            Get started
          </Link>
          <Link href="/docs/sdk" className="border-fd-border rounded-md border px-5 py-2.5 font-semibold">
            SDK reference
          </Link>
        </div>
        <pre className="border-fd-border bg-fd-card mt-10 max-w-xl overflow-x-auto rounded-md border p-4 text-sm">
          <code>{`npx @gamingalo/cli create my-game
cd my-game && npm install && npm run dev`}</code>
        </pre>
      </section>

      <section aria-labelledby="pieces" className="mx-auto w-full max-w-5xl px-6 pb-20">
        <h2 id="pieces" className="gg-display text-2xl font-bold">
          The pieces
        </h2>
        <TileGrid>
          <Tile title="SDK" lit href="/docs/sdk">
            A frozen, tamper-resistant library: saves with migrations, preferences, localization, accessibility and more.{' '}
            <Badge tone="beta" />
          </Tile>
          <Tile title="CLI" href="/docs/cli">
            Create a game from the skeleton, then validate, sign and publish it. Also a standalone binary.
          </Tile>
          <Tile title="Plugins" href="/docs/plugins">
            Install a package, and it extends the SDK. Options go in gamingalo.json.
          </Tile>
          <Tile title="Game skeleton" href="/docs/getting-started">
            A starter game, ready for Claude Code, Codex, OpenCode and pi.
          </Tile>
          <Tile title="Versioning" href="/docs/versioning">
            Every format is versioned, with step-by-step migrations.
          </Tile>
          <Tile title="Design system" href="/docs/design-system">
            Lit Grid: the tokens and components behind these docs.
          </Tile>
        </TileGrid>
      </section>
    </main>
  );
}
