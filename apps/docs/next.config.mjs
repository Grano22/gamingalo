import { createMDX } from 'fumadocs-mdx/next';

// GitHub Pages serves the site from /<repository>, so the docs workflow sets DOCS_BASE_PATH.
const basePath = process.env.DOCS_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default createMDX()(config);
