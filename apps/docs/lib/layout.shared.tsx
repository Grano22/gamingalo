import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { TileLogo } from '@/components/ds/tile-logo';

export const REPOSITORY = 'https://github.com/Grano22/gamingalo';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="gg-wordmark">
          <TileLogo size={22} />
          Gamingalo
        </span>
      ),
    },
    githubUrl: REPOSITORY,
    links: [
      { text: 'Docs', url: '/docs' },
      { text: 'Design system', url: '/docs/design-system' },
      { text: 'Changelogs', url: '/docs/changelogs' },
    ],
  };
}
