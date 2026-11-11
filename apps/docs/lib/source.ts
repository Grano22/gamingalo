import { loader } from 'fumadocs-core/source';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { defineDocs } from 'fumadocs-mdx/macro';

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    // High-contrast code themes, because the defaults fall below WCAG AA on the Lit Grid surfaces.
    mdxOptions: applyMdxPreset({
      rehypeCodeOptions: { themes: { light: 'github-light-high-contrast', dark: 'github-dark-high-contrast' } },
    }),
  },
});

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
