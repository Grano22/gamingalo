import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

// Exported once at build time, and downloaded by the browser, because the site is static.
export const revalidate = false;
export const { staticGET: GET } = createFromSource(source, { language: 'english' });
