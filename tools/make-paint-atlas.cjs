'use strict';
// Cuts the sticker atlas out of tools/assets/kidpixstamps.png.
//
// Run BY HAND, never by `npm run build`, exactly like
// tools/make-minesweeper-atlas.cjs. It exists so the crop is reproducible and
// documented rather than being a binary somebody made in an image editor once.
// The build needs no browser and a contributor never has to run this.
//
//   node tools/make-paint-atlas.cjs
//
// ── WHY THIS FILE IS NOW SHORT ───────────────────────────────────
// The first source was kidpixicons.jpg: a 591x338 RESIZED SCREENSHOT of the
// sticker sheet, with a fractional 39.4 x 42.25px pitch, white paper instead of
// transparency, and JPEG ringing around every line. Cutting that up honestly
// took anchor-and-refine rule detection per axis, a white key, a per-sticker
// median-cut quantiser and a 3x3 median filter on alpha - and the stickers
// still came out visibly crusty, because none of that invents detail the JPEG
// had already destroyed.
//
// The source is now a clean 1:1 PNG whose paper is genuinely transparent, so
// every one of those stages is gone. Nothing here resamples, requantises or
// filters: each sticker is copied PIXEL FOR PIXEL. That is the entire reason
// the output stopped looking crusty, and it is why this file should stay dumb.
// If a future sheet needs cleanup, clean the SHEET.
//
// ── THE SOURCE ───────────────────────────────────────────────────
// 540x350 RGBA. The 448x256 sheet sits inside a grey mount with a drop shadow,
// which is not ours and is never read. Inside the sheet:
//
//   - Alpha is strictly BINARY. Measured over every non-rule pixel of the
//     sheet: 78804 fully transparent, 28828 fully opaque, and not one pixel in
//     between. So "is this ink?" is a real question with a real answer, and a
//     straight copy carries no fringe.
//   - Cells are exactly 32x32 on a 32px pitch, separated by 1px black rules.
//     The rules are DETECTED below rather than assumed - a differently cropped
//     export of the same sheet still gets measured correctly - but unlike the
//     JPEG's, they are unambiguous: a rule is a full-height run of opaque
//     pixels and nothing else in the sheet is.
//   - 14 columns x 8 rows = 112 stickers, the same count and the same reading
//     order (left to right, then top to bottom) the app already indexes by.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'tools/assets/kidpixstamps.png');
const OUT = path.join(ROOT, 'os/sprites/paint-stickers.png');

const COLS = 14;
const ROWS = 8;
const CELL = 32;          // output cell size, matching the OS icon grid
// Ink for the purposes of finding a sticker's bounding box. Alpha is binary in
// this source so the exact cutoff is arbitrary; it exists so the tool still
// behaves sanely if someone later feeds it a sheet with soft edges.
const INK_ALPHA = 16;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const dataUrl = 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64');

  const result = await page.evaluate(async ({ dataUrl, COLS, ROWS, CELL, INK_ALPHA }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });

    const src = document.createElement('canvas');
    src.width = img.width; src.height = img.height;
    const sg = src.getContext('2d', { willReadFrequently: true });
    sg.imageSmoothingEnabled = false;
    sg.drawImage(img, 0, 0);
    const sd = sg.getImageData(0, 0, img.width, img.height).data;
    const W = img.width, H = img.height;
    const alphaAt = (x, y) => sd[(y * W + x) * 4 + 3];

    // ── find the sheet ───────────────────────────────────────────
    // The transparent paper only exists inside the sheet: the mount around it
    // is opaque grey. So the bounding box of transparency IS the sheet, give or
    // take its own outermost rules, which are opaque and therefore excluded.
    let px0 = W, py0 = H, px1 = -1, py1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (alphaAt(x, y) >= INK_ALPHA) continue;
        if (x < px0) px0 = x; if (x > px1) px1 = x;
        if (y < py0) py0 = y; if (y > py1) py1 = y;
      }
    }
    if (px1 < px0 || py1 < py0) throw new Error('no transparent paper found - is this the right sheet?');

    // ── find the rules ───────────────────────────────────────────
    // A rule is a column (or row) that is opaque for the FULL height (width) of
    // the paper. Artwork cannot fake that: a sticker is 30 pixels tall inside a
    // 255-pixel column and there are gaps between the rows.
    function fullLines(nOuter, nInner, opaque) {
      const out = [];
      for (let i = 0; i < nOuter; i++) {
        let n = 0;
        for (let j = 0; j < nInner; j++) if (opaque(i, j)) n++;
        if (n === nInner) out.push(i);
      }
      return out;
    }
    const vRules = fullLines(W, py1 - py0 + 1, (x, j) => alphaAt(x, py0 + j) >= INK_ALPHA);
    const hRules = fullLines(H, px1 - px0 + 1, (y, j) => alphaAt(px0 + j, y) >= INK_ALPHA);

    // The mount is opaque too, so the scan above also returns every column left
    // of the sheet and every one right of it. Keep the run that is on the grid:
    // starting from the first rule at or after the paper's left edge minus one,
    // take rules while each is exactly one pitch on from the last.
    function gridRun(lines, lo, hi, want) {
      const inside = lines.filter(v => v >= lo - 1 && v <= hi + 1);
      if (inside.length < 2) throw new Error('found ' + inside.length + ' rules between ' + lo + ' and ' + hi);
      const pitch = inside[1] - inside[0];
      const run = [inside[0]];
      for (let i = 1; i < inside.length; i++) {
        if (inside[i] - run[run.length - 1] === pitch) run.push(inside[i]);
      }
      if (run.length !== want + 1) {
        throw new Error('expected ' + (want + 1) + ' rules at a ' + pitch + 'px pitch, found ' + run.length
                      + ' (' + run.join(',') + ')');
      }
      return { rules: run, pitch };
    }
    const v = gridRun(vRules, px0, px1, COLS);
    const h = gridRun(hRules, py0, py1, ROWS);

    // ── cut ──────────────────────────────────────────────────────
    const out = document.createElement('canvas');
    out.width = COLS * CELL; out.height = ROWS * CELL;
    const og = out.getContext('2d', { willReadFrequently: true });
    og.imageSmoothingEnabled = false;
    const od = og.getImageData(0, 0, out.width, out.height);
    const op = od.data;

    const report = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        // Interior only: the rule itself belongs to neither cell.
        const x0 = v.rules[col] + 1, x1 = v.rules[col + 1] - 1;
        const y0 = h.rules[row] + 1, y1 = h.rules[row + 1] - 1;

        // Measure the ink, so the sticker can be centred in its output cell.
        // The stamps are not centred in the source - a palm tree sits high and
        // left of its own square - and a stamp tool draws centred on the
        // cursor, so where the art sits in the sheet is not where it should sit
        // in the atlas.
        let bx0 = x1 + 1, by0 = y1 + 1, bx1 = x0 - 1, by1 = y0 - 1;
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            if (alphaAt(x, y) < INK_ALPHA) continue;
            if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
            if (y < by0) by0 = y; if (y > by1) by1 = y;
          }
        }
        if (bx1 < bx0 || by1 < by0) { report.push('cell ' + col + ',' + row + ' is empty'); continue; }

        const iw = bx1 - bx0 + 1, ih = by1 - by0 + 1;
        if (iw > CELL || ih > CELL) {
          // Not croppable without losing art, and scaling is the one thing this
          // tool refuses to do. Say so rather than quietly shaving a sticker.
          report.push('cell ' + col + ',' + row + ' ink is ' + iw + 'x' + ih + ', larger than the ' + CELL + 'px cell');
        }
        const dx = col * CELL + Math.floor((CELL - iw) / 2);
        const dy = row * CELL + Math.floor((CELL - ih) / 2);

        // A manual copy rather than drawImage. drawImage would go through the
        // compositor - premultiplied alpha, and a source rect that lands off
        // the canvas silently clamps - and the whole point of this rewrite is
        // that a source pixel and its output pixel are byte-identical.
        for (let y = 0; y < ih; y++) {
          for (let x = 0; x < iw; x++) {
            const s = ((by0 + y) * W + (bx0 + x)) * 4;
            const t = ((dy + y) * out.width + (dx + x)) * 4;
            op[t] = sd[s]; op[t + 1] = sd[s + 1]; op[t + 2] = sd[s + 2]; op[t + 3] = sd[s + 3];
          }
        }
      }
    }
    og.putImageData(od, 0, 0);

    return { png: out.toDataURL('image/png').split(',')[1], report,
             sheet: [px0, py0, px1, py1], vPitch: v.pitch, hPitch: h.pitch,
             vRules: v.rules, hRules: h.rules };
  }, { dataUrl, COLS, ROWS, CELL, INK_ALPHA });

  await browser.close();

  // ATLAS_DEBUG=1 prints the detected grid. Worth keeping: when a sticker comes
  // out sliced, the first question is always whether the rules or the crop is
  // at fault, and these numbers answer it in one run.
  if (process.env.ATLAS_DEBUG) {
    console.error('sheet   ' + result.sheet.join(','));
    console.error('vRules  ' + result.vRules.join(',') + '  pitch ' + result.vPitch);
    console.error('hRules  ' + result.hRules.join(',') + '  pitch ' + result.hPitch);
  }

  // A cell that came out empty or oversized is a detection failure wearing a
  // sticker's clothes, and it ships silently: the atlas is still the right size
  // and 111 of the 112 still look fine. Fail the run instead.
  if (result.report.length) {
    result.report.forEach(line => console.error('  ' + line));
    throw new Error(result.report.length + ' cell(s) did not cut cleanly');
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(result.png, 'base64'));
  console.log('wrote ' + path.relative(ROOT, OUT) + ': ' + (COLS * CELL) + 'x' + (ROWS * CELL)
            + ', ' + (COLS * ROWS) + ' stickers, copied 1:1');
}

main().catch(err => { console.error(err); process.exit(1); });
