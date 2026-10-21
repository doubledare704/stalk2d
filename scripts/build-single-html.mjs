import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const releaseDir = path.join(root, 'release');
const htmlPath = path.join(distDir, 'index.html');
let html = await readFile(htmlPath, 'utf8');

const jsPath = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/i)?.[1];
if (!jsPath) throw new Error(`Could not find the built JavaScript bundle in ${htmlPath}`);
const js = await readFile(path.join(distDir, jsPath.replace(/^\//, '')), 'utf8');
const encodedJs = Buffer.from(js, 'utf8').toString('base64');
html = html.replace(/<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/i,
  `<script type="module">eval(new TextDecoder().decode(Uint8Array.from(atob("${encodedJs}"), c => c.charCodeAt(0))))</script>`);

for (const match of [...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/gi)]) {
  const css = await readFile(path.join(distDir, match[1].replace(/^\//, '')), 'utf8');
  html = html.replace(match[0], `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
}

await mkdir(releaseDir, { recursive: true });
const outputPath = path.join(releaseDir, 'zona-last-signal.html');
await writeFile(outputPath, html);
console.log(`Created ${path.relative(root, outputPath)} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB)`);
