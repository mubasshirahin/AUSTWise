import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCsp } from './csp.mjs';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const header = (key) => vercel.headers
  ?.flatMap((rule) => rule.headers)
  .find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

describe('Content-Security-Policy', () => {
  it('vercel.json sends the same policy as the Render server', () => {
    // vercel.json can't import csp.mjs; regenerate it from buildCsp() if this fails.
    expect(header('Content-Security-Policy')).toBe(buildCsp());
  });

  it('production policy forbids inline and eval scripts', () => {
    const script = buildCsp().split('; ').find((d) => d.startsWith('script-src '));
    expect(script).not.toMatch(/unsafe-inline|unsafe-eval/);
  });

  // script-src has no 'unsafe-inline', so any inline <script> or on*="" handler
  // in a page we serve would be silently blocked in production.
  const pages = [
    '../index.html',
    ...readdirSync(new URL('../public/prototype/', import.meta.url))
      .filter((f) => f.endsWith('.html'))
      .map((f) => `../public/prototype/${f}`),
  ];
  it.each(pages)('%s has no inline executable scripts', (page) => {
    const html = readFileSync(new URL(page, import.meta.url), 'utf8');
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)]
      .filter(([, attrs]) => !/type=["']application\/ld\+json["']/.test(attrs));
    expect(inline).toHaveLength(0);
    expect(html).not.toMatch(/\son[a-z]+=["']/);
  });
});
