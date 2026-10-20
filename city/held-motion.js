// Small gestures when an item is used. The picture and its hand move together; the world and aim stay put.
const HELD_SQUEEZE = new Set(['duck', 'sharkplush', 'plushcat', 'plushbear', 'petcat', 'petdog']);
const HELD_FLIP = new Set(['luckycoin', 'oldcoin', 'goldring', 'pearl', 'wishcoins']);
const HELD_PAGES = new Set(['book', 'newspaper', 'postcard', 'vinyl', 'vhs', 'hotelmasterpiece', 'hotelharbour', 'hotelstilllife']);
function heldUsePhase(it) {
  if (!heldUse || heldUse.item !== it) return -1;
  const phase = (T - heldUse.t) / heldUse.duration;
  return phase >= 0 && phase < 1 ? phase : -1;
}
function heldGesture(it, u) {
  const phase = heldUsePhase(it), pose = { x: 0, y: 0, angle: 0, sx: 1, sy: 1 };
  if (phase < 0) return pose;
  const pulse = Math.sin(phase * Math.PI), id = it.id, kind = ITEMS[id].kind;
  if (kind === 'drink' || kind === 'food' || id === 'harmonica') {
    pose.x = -u * pulse; pose.y = -u * (kind === 'drink' ? 2.2 : 1.2) * pulse;
    pose.angle = (kind === 'drink' ? -.2 : -.07) * pulse;
  } else if (HELD_SQUEEZE.has(id)) {
    pose.sx = 1 + pulse * .09; pose.sy = 1 - pulse * .13; pose.y = -u * pulse * .4;
  } else if (HELD_FLIP.has(id)) {
    // The hand stays full width; only the object turns edge-on (drawHeldDense).
    pose.y = -u * pulse * 1.2;
  } else if (id === 'snowglobe' || id === 'cityglobe' || kind === 'keys') {
    pose.angle = Math.sin(phase * Math.PI * 6) * pulse * .13;
    pose.y = -u * pulse * .6;
  } else if (HELD_PAGES.has(id)) {
    pose.angle = Math.sin(phase * Math.PI * 2) * .1; pose.y = -u * pulse * .7;
  } else {
    pose.angle = Math.sin(phase * Math.PI * 2) * .07; pose.y = -u * pulse * .65;
  }
  return pose;
}

let heldPictureCache = null;
function heldPageTurn(it, picture) {
  const phase = heldUsePhase(it);
  if (phase < 0 || !['book', 'newspaper'].includes(it.id)) return picture;
  const span = Math.floor(Math.sin(phase * Math.PI) * (picture.width - 6));
  if (span < 2) return picture;
  const left = 3, right = left + span, rows = picture.art.map(line => [...line]);
  for (let r = 2; r < picture.height - 2; r++) for (let c = left; c < right; c++) {
    let ch = r % 3 === 0 ? '=' : '.';
    if (c === right - 1) ch = '/';
    rows[r][c] = ch;
  }
  return { ...picture, art: rows.map(row => row.join('')), col: (ch, r, c) =>
    r >= 2 && r < picture.height - 2 && c >= left && c < right ? C(ch === '/' ? WHITE : WARM, 13) : picture.col(ch, r, c) };
}
function heldPicture(it) {
  // Cell animation runs at 15 fps; the hand's movement remains smooth. Only the current picture is retained.
  const key = [it.id, it.uses, it.q, it.of, it.kg, Math.floor(T * 15), weather, night > .3,
    fx.boombox, Math.floor(fx.spark * 2), fx.vape > 0, hurrying(), Math.floor(heldUsePhase(it) * 15),
    Math.floor(a * 30), Math.floor(tod * 60)].join('|');
  if (heldPictureCache?.key === key) return heldPictureCache.picture;
  const [rawArt, col] = (DENSE[it.id] || droppedArt)(it, usesLeft(it)), art = rawArt.slice();
  // Empty padding is not part of the grip. Keep the last visible row tucked into the fingers.
  while (art.length > 1 && !art[art.length - 1].trim()) art.pop();
  const width = Math.max(...art.map(line => line.length)), middle = Math.floor(width / 2);
  let gripRow = art.length - 1;
  // A claw, tail or hanging corner can extend below the part actually resting in your fist.
  while (gripRow > 0 && !art[gripRow].slice(Math.max(0, middle - 2), middle + 3).trim()) gripRow--;
  if (!art[gripRow].slice(Math.max(0, middle - 2), middle + 3).trim()) gripRow = art.length - 1;
  const picture = heldPageTurn(it, { art, col, width, height: art.length, gripRows: gripRow + 1 });
  heldPictureCache = { key, picture };
  return picture;
}
function heldPictureTop(picture, s, hsz) {
  const cached = picture.gripLayout;
  if (cached?.s === s && cached.hsz === hsz) return cached.top;
  g.font = hsz + 'px monospace';
  const handEdge = -g.measureText('_').actualBoundingBoxAscent;
  g.font = s + 'px monospace';
  const middle = Math.floor(picture.width / 2), metrics = new Map();
  let bottom = -Infinity, strokeHeight = s;
  // Align the actual ink to the fingers. Many characters end well above the bottom of their cell.
  for (let r = Math.max(0, picture.gripRows - 2); r < picture.gripRows; r++) {
    for (let c = Math.max(0, middle - 2); c < Math.min(picture.width, middle + 3); c++) {
      const ch = picture.art[r][c];
      if (!ch || ch === ' ') continue;
      if (!metrics.has(ch)) metrics.set(ch, g.measureText(ch));
      const ink = metrics.get(ch), edge = r * s + ink.actualBoundingBoxDescent;
      if (edge > bottom) {
        bottom = edge;
        strokeHeight = ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent;
      }
    }
  }
  if (!Number.isFinite(bottom)) bottom = picture.gripRows * s;
  // Leave the item's last stroke visible above the hand's dark outline, including one-pixel bases such as '_'.
  const clearance = Math.max(strokeHeight < s * .3 ? 2 : 1.5, hsz * .07);
  const top = handEdge - clearance - bottom;
  picture.gripLayout = { s, hsz, top };
  return top;
}
function heldFrame(it, picture = null) {
  const base = Math.max(10, Math.min(Math.max(14, cv.height / 36), cv.width / 32));
  let s = Math.round(base * .72);
  if (picture) s = Math.max(7, Math.min(s, Math.floor(cv.width * .64 / (picture.width * D_ASPECT)),
    Math.floor(cv.height * .46 / picture.height)));
  const u = picture ? s / .72 : base, hsz = Math.round(u * 1.15), pose = heldGesture(it, u);
  const moving = K.KeyW || K.KeyS || K.KeyA || K.KeyD;
  const bob = moving ? Math.sin(T * (fx.skating ? 4 : 9)) * u * .35 : Math.sin(T * 1.5) * u * .08;
  const lift = it.id === 'yoyo' ? .55 + .45 * smooth(clamp(yoyo.len / .18, 0, 1)) : 0;
  let cx = cv.width * (.84 - lift * .14) + pose.x, hy = cv.height - 5.6 * hsz + bob - lift * cv.height * .34 + pose.y;
  if (picture) {
    g.font = s + 'px monospace';
    const width = picture.width * g.measureText('M').width;
    const top = heldPictureTop(picture, s, hsz), bottom = top + picture.height * s;
    const ca = Math.cos(pose.angle), sa = Math.sin(pose.angle);
    const corners = [-width / 2, width / 2].flatMap(x => [top, bottom].map(y => ({
      x: x * pose.sx * ca - y * pose.sy * sa, y: x * pose.sx * sa + y * pose.sy * ca
    })));
    const minX = Math.min(...corners.map(p => p.x)), maxX = Math.max(...corners.map(p => p.x));
    cx = clamp(cx, 12 - minX, cv.width - 12 - maxX);
    hy = Math.max(hy, 12 - Math.min(...corners.map(p => p.y)));
  }
  return { u, s, hsz, cx: it.id === 'yoyo' ? cx : Math.round(cx), hy: it.id === 'yoyo' ? hy : Math.round(hy), grip: 1.1 * hsz, ...pose };
}
