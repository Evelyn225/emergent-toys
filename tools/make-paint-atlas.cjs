'use strict';
// Cuts the sticker atlas out of tools/assets/kidpixicons.jpg.
//
// Run BY HAND, never by `npm run build`, exactly like
// tools/make-minesweeper-atlas.cjs. It exists so the crop is reproducible and
// documented rather than being a binary somebody made in an image editor once.
// The build needs no browser and a contributor never has to run this.
//
//   node tools/make-paint-atlas.cjs
//
// The source is a 591x338 JPEG - a RESIZED SCREENSHOT of the original sticker
// sheet, which matters more than it sounds. The grid pitch works out to
// 39.4 x 42.25px, not an integer, so a tool that assumes a fixed pitch drifts
// and slices stickers in half by the right-hand columns. The rules are
// therefore DETECTED, the same method the minesweeper atlas used against its
// guide rectangles.
//
// Column 15 is the page-number arrow strip, not stickers, so it is dropped:
// 14 columns x 8 rows = 112 stickers.
//
// The source is lossy and no cleanup invents detail that JPEG destroyed. Some
// stickers WILL look softer than the OS's hand-made icons. That is accepted;
// what this file buys is that pointing it at a cleaner sheet later is a re-run
// rather than an app change.
//
// DETECTION NOTE, read before touching rules(): the two axes are physically
// different sheets glued together, and one threshold cannot see both.
//   - Columns are separated by an actual drawn border (a dark line spanning
//     the full image height). A darkness threshold finds it - but only up to
//     a point: measured against this exact source, the faintest genuine
//     column line is *lighter* than 17 unrelated pixels inside the artwork
//     (checked by hand against tools/assets/kidpixicons.jpg's own luminance
//     profile). No single global cutoff separates the 14 real lines from
//     that noise; every threshold that is loose enough to catch the weakest
//     real line also catches several fakes, which silently shifts every
//     column after the first fake by one slot.
//   - Rows have NO drawn border at all - open the file and look at the gap
//     between the whale row and the ladybug row: blank paper, no rule.  What
//     repeats every ~42.25px instead is a band of near-white paper between
//     one row's artwork and the next.
// findRules() below still measures the real image rather than assuming a
// pitch: it uses the sheet's own known cell count (15 columns incl. the
// arrow strip, 8 rows - a structural fact about this layout, not a pixel
// offset) only to say *roughly where* each boundary should be, then reads
// off whichever real pixel is actually darkest (columns) or brightest (rows)
// within a window around that guess. A differently-sized rescan of the same
// sheet still gets measured correctly, because the number that ends up in
// the output is always a measured extremum, never the guess itself.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'tools/assets/kidpixicons.jpg');
const OUT = path.join(ROOT, 'os/sprites/paint-stickers.png');

const COLS = 14;          // usable sticker columns; the 15th is the page strip
const ROWS = 8;
const CELL = 32;          // output cell size, matching the OS icon grid
const MAX_COLORS = 16;    // per sticker, via median cut
const WHITE_KEY = 232;    // >= this on all three channels becomes transparent

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const dataUrl = 'data:image/jpeg;base64,' + fs.readFileSync(SRC).toString('base64');

  const pngBase64 = await page.evaluate(async ({ dataUrl, COLS, ROWS, CELL, MAX_COLORS, WHITE_KEY }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });

    const src = document.createElement('canvas');
    src.width = img.width; src.height = img.height;
    const sg = src.getContext('2d', { willReadFrequently: true });
    sg.drawImage(img, 0, 0);
    const data = sg.getImageData(0, 0, img.width, img.height).data;

    const lum = (x, y) => {
      const i = (y * img.width + x) * 4;
      return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    };

    // ── detect the grid rules ────────────────────────────────────
    // Per-column (or per-row) average luminance. A drawn border spans the
    // full opposite dimension, so averaging across it is what makes a real
    // rule stand out from one column of mixed artwork pixels.
    function scoreAxis(extent, across, sample) {
      const score = [];
      for (let a = 0; a < extent; a++) {
        let sum = 0;
        for (let b = 0; b < across; b++) sum += sample(a, b);
        score.push(sum / across);
      }
      return score;
    }

    // Finds `boundaries + 1` rule positions (k = 0..boundaries) along one
    // axis. `sheetCells` is the sheet's own known total cell count along
    // this axis (15 columns including the arrow strip, 8 rows) - it only
    // seeds a search window per boundary; the position that is actually
    // recorded is whichever real pixel is darkest ('dark') or brightest
    // ('light') inside that window, so the fractional true pitch is measured
    // fresh every time rather than assumed. See the DETECTION NOTE above the
    // constants for why the two axes need opposite polarities.
    //
    // k = 0 on the 'dark' axis is special-cased to the image's own edge
    // (position 0): the sheet has no drawn border around its outer
    // perimeter, only between cells, so there is no line to search for
    // there - the sheet's own edge IS column 0's left edge.
    function findRules(score, sheetCells, boundaries, dir) {
      const extent = score.length;
      const pitch = extent / sheetCells;
      const win = Math.max(4, Math.round(pitch * 0.4));
      const out = [];
      for (let k = 0; k <= boundaries; k++) {
        if (dir === 'dark' && k === 0) { out.push(0); continue; }
        const anchor = k * pitch;
        const lo = Math.max(0, Math.round(anchor - win));
        const hi = Math.min(extent - 1, Math.round(anchor + win));
        let bestV = dir === 'dark' ? Infinity : -Infinity;
        for (let i = lo; i <= hi; i++) {
          if (dir === 'dark' ? score[i] < bestV : score[i] > bestV) bestV = score[i];
        }
        // Average the positions of every pixel tied for the extremum in this
        // window, the same "centre of the run" idea as a thin border spread
        // over a couple of pixels by resampling.
        let sum = 0, n = 0;
        for (let i = lo; i <= hi; i++) if (score[i] === bestV) { sum += i; n++; }
        out.push(Math.round(sum / n));
      }
      return out;
    }

    const vScore = scoreAxis(img.width, img.height, (x, y) => lum(x, y));
    const hScore = scoreAxis(img.height, img.width, (y, x) => lum(x, y));
    const vRules = findRules(vScore, 15, COLS, 'dark');
    const hRules = findRules(hScore, ROWS, ROWS, 'light');

    // ── median cut ───────────────────────────────────────────────
    // Per sticker, not one palette across the sheet: these are 112 unrelated
    // drawings, and a shared 16-colour palette would have to serve every hue at
    // once and would flatten all of them.
    function medianCut(pixels, depth) {
      if (!pixels.length) return [];
      if (depth === 0 || pixels.length === 1) {
        const avg = [0, 0, 0];
        pixels.forEach(p => { avg[0] += p[0]; avg[1] += p[1]; avg[2] += p[2]; });
        return [[Math.round(avg[0] / pixels.length), Math.round(avg[1] / pixels.length), Math.round(avg[2] / pixels.length)]];
      }
      let best = 0, bestRange = -1;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255, hi = 0;
        pixels.forEach(p => { if (p[ch] < lo) lo = p[ch]; if (p[ch] > hi) hi = p[ch]; });
        if (hi - lo > bestRange) { bestRange = hi - lo; best = ch; }
      }
      pixels.sort((a, b) => a[best] - b[best]);
      const mid = pixels.length >> 1;
      return medianCut(pixels.slice(0, mid), depth - 1).concat(medianCut(pixels.slice(mid), depth - 1));
    }

    const out = document.createElement('canvas');
    out.width = COLS * CELL; out.height = ROWS * CELL;
    const og = out.getContext('2d', { willReadFrequently: true });
    og.imageSmoothingEnabled = true;
    og.imageSmoothingQuality = 'high';

    const report = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        // Cell bounds from the detected rules, inset by 2px so the border
        // itself never lands in the sticker.
        const x0 = vRules[col] + 2, x1 = vRules[col + 1] - 2;
        const y0 = hRules[row] + 2, y1 = hRules[row + 1] - 2;
        const w = x1 - x0, h = y1 - y0;
        if (w <= 0 || h <= 0) { report.push('cell ' + col + ',' + row + ' collapsed'); continue; }

        // Downscale to the output cell. The downscale is doing real work: an
        // area average is itself a ringing suppressor.
        const tmp = document.createElement('canvas');
        tmp.width = CELL; tmp.height = CELL;
        const tg = tmp.getContext('2d', { willReadFrequently: true });
        tg.imageSmoothingEnabled = true;
        tg.imageSmoothingQuality = 'high';
        tg.drawImage(src, x0, y0, w, h, 0, 0, CELL, CELL);

        const id = tg.getImageData(0, 0, CELL, CELL);
        const px = id.data;

        // Key the paper white out before quantising, or white becomes one of
        // the sixteen colours and every sticker wastes a slot on background.
        const opaque = [];
        for (let i = 0; i < px.length; i += 4) {
          if (px[i] >= WHITE_KEY && px[i + 1] >= WHITE_KEY && px[i + 2] >= WHITE_KEY) px[i + 3] = 0;
          else opaque.push([px[i], px[i + 1], px[i + 2]]);
        }

        const palette = medianCut(opaque.slice(), Math.log2(MAX_COLORS));
        if (palette.length) {
          for (let i = 0; i < px.length; i += 4) {
            if (px[i + 3] === 0) continue;
            let bi = 0, bd = Infinity;
            palette.forEach((c, n) => {
              const d = (px[i] - c[0]) ** 2 + (px[i + 1] - c[1]) ** 2 + (px[i + 2] - c[2]) ** 2;
              if (d < bd) { bd = d; bi = n; }
            });
            px[i] = palette[bi][0]; px[i + 1] = palette[bi][1]; px[i + 2] = palette[bi][2];
            px[i + 3] = 255;
          }
        }

        // 3x3 median on alpha only, to knock out the isolated specks JPEG
        // ringing leaves floating in the transparent margin.
        const alpha = new Uint8ClampedArray(CELL * CELL);
        for (let i = 0, n = 0; i < px.length; i += 4, n++) alpha[n] = px[i + 3];
        for (let y = 1; y < CELL - 1; y++) {
          for (let x = 1; x < CELL - 1; x++) {
            const win = [];
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) win.push(alpha[(y + dy) * CELL + (x + dx)]);
            win.sort((a, b) => a - b);
            px[(y * CELL + x) * 4 + 3] = win[4];
          }
        }

        tg.putImageData(id, 0, 0);
        og.drawImage(tmp, col * CELL, row * CELL);
      }
    }

    return { png: out.toDataURL('image/png').split(',')[1], report, vRules, hRules,
             srcWidth: img.width, srcHeight: img.height };
  }, { dataUrl, COLS, ROWS, CELL, MAX_COLORS, WHITE_KEY });

  await browser.close();

  // findRules() always returns COLS+1 / ROWS+1 positions by construction (it
  // loops k = 0..boundaries), so a bare length check would never fail - it
  // would happily accept a window that locked onto the wrong pixel. The
  // guard that actually matters is on the POSITIONS: they must be strictly
  // increasing, and each gap must be close to the sheet's own expected pitch
  // (image extent / its own known cell count). A window that grabbed noise
  // instead of a real rule shows up here as a gap far from its neighbours',
  // not as a missing count - which is exactly the "half a frog" failure mode
  // this guard exists to catch before it ships silently.
  function checkRules(rules, label, extent, sheetCells) {
    const pitch = extent / sheetCells;
    if (rules.length < 2) throw new Error(label + ': need at least 2 rules, found ' + rules.length);
    for (let i = 1; i < rules.length; i++) {
      const gap = rules[i] - rules[i - 1];
      if (gap <= 0) {
        throw new Error(label + ' rules are not strictly increasing at index ' + i
          + ': ' + rules[i - 1] + ' -> ' + rules[i]);
      }
      if (Math.abs(gap - pitch) > pitch * 0.5) {
        throw new Error(label + ' rule gap at index ' + i + ' (' + gap.toFixed(1)
          + 'px) is too far from the expected pitch (' + pitch.toFixed(1)
          + 'px) - detection likely locked onto artwork instead of a grid line');
      }
    }
  }
  checkRules(pngBase64.vRules, 'vertical', pngBase64.srcWidth, 15);
  checkRules(pngBase64.hRules, 'horizontal', pngBase64.srcHeight, ROWS);

  pngBase64.report.forEach(line => console.warn('  warn: ' + line));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(pngBase64.png, 'base64'));
  console.log('wrote ' + path.relative(ROOT, OUT) + ': ' + (COLS * CELL) + 'x' + (ROWS * CELL)
            + ', ' + (COLS * ROWS) + ' stickers');
}

main().catch(err => { console.error(err); process.exit(1); });
