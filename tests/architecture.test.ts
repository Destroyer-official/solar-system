import { it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });

const forbid = (dir: string, patterns: RegExp[]) => {
  for (const file of walk(dir)) {
    const src = readFileSync(file, 'utf8');
    for (const p of patterns) expect(src, `${file} breaks layer rule ${p}`).not.toMatch(p);
  }
};

it('physics/ and frames/ never import three, DOM, or higher layers', () => {
  const bad = [/from ['"]three['"]/, /from ['"]@\/(render|ui|sim)/, /\bdocument\./, /\bwindow\./];
  forbid('src/physics', bad);
  forbid('src/frames', bad);
});

it('render/ never imports physics internals', () => {
  forbid('src/render', [/from ['"]@\/physics\/(integrators|forces)/]);
});
