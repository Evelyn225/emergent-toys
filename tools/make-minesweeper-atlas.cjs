'use strict';
// Cuts MINESWEEPER.exe's two committed assets out of the Winmine sprite
// reference sheet in tools/assets/.
//
// Run by hand, NOT by `npm run build`:
//
//   node tools/make-minesweeper-atlas.cjs
//
// Both outputs are committed, so a contributor never needs to run this and the
// build never needs Chromium. It exists so the crop is reproducible and
// documented rather than being two binaries someone produced in an image editor
// once and could never regenerate.
//
// Chromium (a devDependency already, for the browser suite) rather than a
// hand-rolled PNG decoder: the source is a paletted/RGBA PNG and canvas gives
// correct decoding, cropping and re-encoding for free.
//
// WHY THE SOURCE SHEET IS NOT IN os/icons/: it is a reference document, not an
// icon. It carries six Winmine variants, annotation text and a credits block in
// 58KB, and `test/icon-assets.test.cjs` requires every PNG in os/icons to be
// 32x32 (or declared 16x16 list-row art), which neither it nor the atlas is.
// Shipping it would also put five unused variants and the credits text on the
// wire for every visitor.
//
// WHICH VARIANT: the sheet's "Winmine 31/NT4 and 2000+" band, for everything.
// The band labelled 95/98/ME is a lower-fidelity variant - thin numerals, a
// sparse 8-point-star mine, dotted tile borders - while this one is the chunky,
// round-spiky-mine set people actually recognise as Minesweeper, and it is the
// only band that also carries the faces and the LED digits, so taking all four
// rows from it keeps one consistent source instead of mixing two.
//
// CREDIT: these are rips of Microsoft's Winmine artwork. The sheet's own
// credits block names Black Squirrel as the necessary credit for the
// 31/NT4/2000+ band and Inky for the score-display minus and blank. Both are
// reproduced in the game's Help dialog (apps/minesweeper.js).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'tools/assets/minesweeper_sprites.png');
const ATLAS_OUT = path.join(ROOT, 'os/sprites/minesweeper.png');
const ICON_OUT = path.join(ROOT, 'os/icons/minesweeper.png');

// Every offset below was measured off the sheet rather than eyeballed: the
// bands are delimited by drawn guide rectangles, and each row's cell width and
// pitch were found by scanning for runs of non-backdrop pixels. See the table
// in docs/projects/sleep-os.md.
//
// Note the source pitches exceed the cell sizes - the sheet leaves a 1px gutter
// between cells. The atlas deliberately does NOT: packing each row tight makes
// every CSS background-position a flat multiple of the cell size.
const SRC = {
  // 8 cells: blank, revealed, flag, question, question-pressed, mine,
  //          mine-exploded (red ground), mine-crossed (wrong flag)
  tiles:   { x: 14, y: 195, w: 16, h: 16, pitch: 17, n: 8 },
  // 8 cells: the numerals 1-8, in Winmine's own colours
  numbers: { x: 14, y: 212, w: 16, h: 16, pitch: 17, n: 8 },
  // 5 cells: smile, smile-pressed, surprised, cool (win), dead (loss)
  faces:   { x: 14, y: 170, w: 24, h: 24, pitch: 25, n: 5 },
  // 12 cells: 1-9, 0, minus, blank
  leds:    { x: 14, y: 146, w: 13, h: 23, pitch: 14, n: 12 },
};

// The 32x32 "Winmine WinME" program icon, from the sheet's top-right block.
// Its guide rectangle is rgb(0,192,0) at x 475..508, y 33..66, so the art
// itself starts one pixel inside.
const ICON = { x: 476, y: 34, w: 32, h: 32 };

// Atlas rows, in the order they are stacked. Tiles and numbers share row 0
// because they are the same height and the game addresses both as "a 16px
// cell at column i".
const LAYOUT = [
  { y: 0,  rows: ['tiles', 'numbers'] },
  { y: 16, rows: ['faces'] },
  { y: 40, rows: ['leds'] },
];
const ATLAS_W = 256;   // 16 cells of 16px - the widest row
const ATLAS_H = 63;    // 16 + 24 + 23

function decodeDataUrl(url) {
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

(async () => {
  if (!fs.existsSync(SOURCE)) {
    console.error('missing source sheet: ' + SOURCE);
    process.exit(1);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const b64 = fs.readFileSync(SOURCE).toString('base64');
  await page.setContent('<img id="s" src="data:image/png;base64,' + b64 + '">');
  await page.waitForFunction(() => document.getElementById('s').complete && document.getElementById('s').naturalWidth > 0);

  const { atlas, icon } = await page.evaluate(({ SRC, ICON, LAYOUT, ATLAS_W, ATLAS_H }) => {
    const img = document.getElementById('s');
    function cut(w, h, draw) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      draw(x);
      return c.toDataURL('image/png');
    }
    const atlas = cut(ATLAS_W, ATLAS_H, x => {
      LAYOUT.forEach(band => {
        let dx = 0;
        band.rows.forEach(name => {
          const s = SRC[name];
          for (let i = 0; i < s.n; i++) {
            x.drawImage(img, s.x + i * s.pitch, s.y, s.w, s.h, dx, band.y, s.w, s.h);
            dx += s.w;
          }
        });
      });
    });
    const icon = cut(ICON.w, ICON.h, x => {
      x.drawImage(img, ICON.x, ICON.y, ICON.w, ICON.h, 0, 0, ICON.w, ICON.h);
    });
    return { atlas, icon };
  }, { SRC, ICON, LAYOUT, ATLAS_W, ATLAS_H });

  fs.mkdirSync(path.dirname(ATLAS_OUT), { recursive: true });
  fs.writeFileSync(ATLAS_OUT, decodeDataUrl(atlas));
  fs.writeFileSync(ICON_OUT, decodeDataUrl(icon));
  await browser.close();

  console.log('wrote ' + path.relative(ROOT, ATLAS_OUT) + '  ' + ATLAS_W + 'x' + ATLAS_H
    + '  ' + fs.statSync(ATLAS_OUT).size + ' bytes');
  console.log('wrote ' + path.relative(ROOT, ICON_OUT) + '  ' + ICON.w + 'x' + ICON.h
    + '  ' + fs.statSync(ICON_OUT).size + ' bytes');
})();
