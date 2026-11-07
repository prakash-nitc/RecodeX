import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const r = await build({ entryPoints: ['src/main.tsx'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'none' });
let js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
execSync('npx tailwindcss -i src/index.css -o dist/app.css --minify', { stdio: 'pipe' });
const css = fs.readFileSync('dist/app.css', 'utf8');
const html = `<title>DSA Revision Manager</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;600&family=Manrope:wght@400;500;600;700;800&display=swap">
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('js', (js.length/1024).toFixed(0)+'KB', 'css', (css.length/1024).toFixed(0)+'KB');
