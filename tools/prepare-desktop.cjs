'use strict';
// Stage a small, self-contained copy of Glyphport for Tauri's Windows WebView.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.resolve(root, 'desktop-dist');
if (path.dirname(out) !== root || path.basename(out) !== 'desktop-dist') throw new Error('Unexpected desktop staging path');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const copy = (from, to = from) => {
  const source = path.join(root, from), target = path.join(out, to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
};

const html = fs.readFileSync(path.join(root, 'ascii-city.html'), 'utf8')
  .replace('</head>', '  <script>window.__GLYPHPORT_DESKTOP__ = true;</script>\n</head>');
fs.writeFileSync(path.join(out, 'index.html'), html);
for (const file of ['ascii-city.bundle.js', 'ascii-city.webmanifest', 'w95font.woff', 'w95font.woff2']) copy(file);
for (const file of ['ascii-city-180.png', 'ascii-city-192.png', 'ascii-city-512.png', 'favicon-16x16.png', 'favicon-32x32.png', 'go-home.png']) {
  copy(path.join('images', file));
}
for (const file of fs.readdirSync(path.join(root, 'audio', 'ascii-city'))) {
  if (file.endsWith('.mp3')) copy(path.join('audio', 'ascii-city', file));
}
console.log('staged Glyphport desktop assets in desktop-dist');
