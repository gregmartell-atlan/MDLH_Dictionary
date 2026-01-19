import fs from 'fs';
import path from 'path';

const DEFAULT_KEYWORDS = [
  'metadata',
  'type',
  'typedef',
  'asset',
  'glossary',
  'custom-metadata',
  'badge',
  'lineage',
  'search',
  'policy',
  'persona',
  'purpose',
  'incident',
  'data-product',
  'domain',
  'contract',
  'api',
];

const DOCS_CACHE_PATH = path.resolve(process.cwd(), 'lib', 'atlan-docs-cache.json');
const DOCS_INDEX_PATH = path.resolve(process.cwd(), 'lib', 'atlan-docs-index.json');

const MIN_TOKEN_LENGTH = 3;

function stripHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html: string) {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? match[1].trim() : '';
}

function parseSitemap(xml: string): string[] {
  const urls: string[] = [];
  const regex = /<loc>([^<]+)<\/loc>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml))) {
    urls.push(match[1]);
  }
  return urls;
}

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  const regex = /[A-Za-z_][A-Za-z0-9_]{2,}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    const token = match[0];
    if (token.length >= MIN_TOKEN_LENGTH) tokens.add(token);
  }
  return tokens;
}

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

export async function syncAtlanDocs(options?: {
  maxPages?: number;
  keywords?: string[];
}) {
  const keywords = options?.keywords?.length ? options.keywords : DEFAULT_KEYWORDS;
  const maxPages = options?.maxPages ?? 200;

  const sitemapXml = await fetchText('https://developer.atlan.com/sitemap.xml');
  const urls = parseSitemap(sitemapXml)
    .filter((url) => keywords.some((kw) => url.toLowerCase().includes(kw)))
    .slice(0, maxPages);

  const pages: Array<{ url: string; title: string; text: string }> = [];
  const tokenSet = new Set<string>();

  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const title = extractTitle(html) || url.replace('https://developer.atlan.com/', '');
      const text = stripHtml(html);
      pages.push({ url, title, text });
      tokenize(text).forEach((token) => tokenSet.add(token));
    } catch (error) {
      pages.push({ url, title: url, text: '' });
    }
  }

  const now = new Date().toISOString();
  const cachePayload = { generatedAt: now, pages };
  const indexPayload = {
    generatedAt: now,
    pageCount: pages.length,
    keywords,
    tokens: Array.from(tokenSet),
    pages: pages.map((page) => ({ url: page.url, title: page.title })),
  };

  fs.writeFileSync(DOCS_CACHE_PATH, JSON.stringify(cachePayload, null, 2));
  fs.writeFileSync(DOCS_INDEX_PATH, JSON.stringify(indexPayload, null, 2));

  return indexPayload;
}

export function readDocsIndex() {
  if (!fs.existsSync(DOCS_INDEX_PATH)) {
    return null;
  }
  const raw = fs.readFileSync(DOCS_INDEX_PATH, 'utf-8');
  return JSON.parse(raw) as {
    generatedAt: string;
    pageCount: number;
    keywords: string[];
    tokens: string[];
    pages: Array<{ url: string; title: string }>;
  };
}
