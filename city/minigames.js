// ---- minigames: the arcade cabinets (snake, breakout, street crosser) and the work shifts (waiting tables,
// stocking shelves), plus what a taxi fare pays. Pure: each game is a small state machine on its own W x H grid,
// stepped with the keys held and pressed this frame; minigame-ui.js draws it into the character grid and plays its
// sounds. The node tests play them too.
//
// make(rnd) -> game: { id, title, W, H, score, over, step(dt, keys) -> events[], draw(put), status() -> string,
//                     reward() -> tickets (arcade) or dollars (shifts) }
// keys: left / right / up / down / act held, and leftP / rightP / upP / downP / actP pressed this frame.
// put(x, y, ch, col, bg?) paints one game cell; text(x, y, s, col) writes a label at a cell, at normal size.
const GAMES = {};

// snake: eat the apples, don't hit the walls or yourself; it speeds up as it grows
GAMES.snake = (rnd = Math.random) => {
  const W = 28, H = 16, g = { id: 'snake', title: 'SNAKE', W, H, score: 0, over: false };
  let body = [[8, 8], [7, 8], [6, 8]], dir = [1, 0], next = [1, 0], food = null, acc = 0;
  const place = () => { do food = [rnd() * W | 0, rnd() * H | 0]; while (body.some(b => b[0] === food[0] && b[1] === food[1])); };
  place();
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    for (const [key, d] of [['leftP', [-1, 0]], ['rightP', [1, 0]], ['upP', [0, -1]], ['downP', [0, 1]]])
      if (k[key] && (d[0] !== -dir[0] || d[1] !== -dir[1])) next = d; // no turning back on yourself
    acc += dt;
    const period = Math.max(0.055, 0.14 - g.score * 0.004);
    while (acc >= period) {
      acc -= period; dir = next;
      const h = [body[0][0] + dir[0], body[0][1] + dir[1]], eats = h[0] === food[0] && h[1] === food[1];
      const hitSelf = body.some((b, i) => (eats || i < body.length - 1) && b[0] === h[0] && b[1] === h[1]);
      if (h[0] < 0 || h[1] < 0 || h[0] >= W || h[1] >= H || hitSelf) { g.over = true; ev.push('die'); break; }
      body.unshift(h);
      if (eats) { g.score++; ev.push('eat'); place(); } else body.pop();
    }
    return ev;
  };
  g.draw = put => {
    put(food[0], food[1], '@', C(RED, 15), C(RED, 4));
    body.forEach((b, i) => put(b[0], b[1], i ? 'o' : 'O', C(GREEN, i ? 12 : 15), C(GREEN, i ? 4 : 7)));
  };
  g.status = () => `APPLES ${g.score}`;
  g.reward = () => g.score * 2;
  g.body = () => body;
  return g;
};

// breakout: knock out the bricks with the ball, keep it off the floor with the paddle; three balls
GAMES.breakout = (rnd = Math.random) => {
  const W = 30, H = 20, PW = 5, g = { id: 'breakout', title: 'BREAKOUT', W, H, score: 0, over: false };
  let paddle = W / 2, ball = null, lives = 3, speed = 13, bricks;
  const fill = () => { bricks = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) bricks.push({ r, c, on: true }); };
  const stick = () => { ball = { x: paddle, y: H - 2, vx: 0, vy: 0, stuck: true }; };
  fill(); stick();
  const brickAt = (x, y) => bricks.find(b => b.on && y >= 2 + b.r && y < 3 + b.r && x >= b.c * 3 && x < b.c * 3 + 3);
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    paddle = clamp(paddle + ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * 24 * dt, PW / 2, W - PW / 2);
    if (ball.stuck) {
      ball.x = paddle;
      if (k.actP || k.upP) { const a_ = -Math.PI / 2 + (rnd() - 0.5) * 0.8; ball.vx = Math.cos(a_) * speed; ball.vy = Math.sin(a_) * speed; ball.stuck = false; ev.push('launch'); }
      return ev;
    }
    const n = Math.ceil(dt * speed * 4); // small steps so it never skips through a brick
    for (let s = 0; s < n; s++) {
      const h = dt / n, px_ = ball.x, py_ = ball.y;
      ball.x += ball.vx * h; ball.y += ball.vy * h;
      if (ball.x < 0 || ball.x >= W) { ball.vx = -ball.vx; ball.x = clamp(ball.x, 0, W - 1e-3); ev.push('wall'); }
      if (ball.y < 0) { ball.vy = Math.abs(ball.vy); ball.y = 0; ev.push('wall'); }
      const b = brickAt(ball.x, ball.y);
      if (b) { // knock it out; bounce off whichever side we came in through
        b.on = false; g.score++; ev.push('brick');
        if (Math.floor(py_) !== Math.floor(ball.y)) ball.vy = -ball.vy; else ball.vx = -ball.vx;
        ball.x = px_; ball.y = py_;
        if (!bricks.some(o => o.on)) { fill(); speed *= 1.12; stick(); ev.push('clear'); return ev; }
      }
      if (ball.vy > 0 && ball.y >= H - 1 && ball.y < H && Math.abs(ball.x - paddle) <= PW / 2 + 0.5) { // off the paddle: where it hits steers it
        const off = clamp((ball.x - paddle) / (PW / 2 + 0.5), -1, 1), a_ = -Math.PI / 2 + off * 1.05;
        ball.vx = Math.cos(a_) * speed; ball.vy = Math.sin(a_) * speed; ball.y = H - 1 - 1e-3; ev.push('paddle');
      }
      if (ball.y >= H + 0.5) { lives--; ev.push('miss'); if (!lives) { g.over = true; ev.push('die'); } else stick(); return ev; }
    }
    return ev;
  };
  g.draw = put => {
    const BCOL = [RED, ORANGE, YEL, GREEN, CYAN];
    for (const b of bricks) if (b.on) for (let k = 0; k < 2; k++) put(b.c * 3 + k, 2 + b.r, '#', C(BCOL[b.r], 15), C(BCOL[b.r], 4)); // and a gap
    for (let x = Math.round(paddle - PW / 2); x < Math.round(paddle + PW / 2); x++) put(x, H - 1, '=', C(WHITE, 15), C(GRAY, 5));
    put(Math.floor(ball.x), Math.floor(ball.y), 'o', C(WHITE, 15));
  };
  g.status = () => `BRICKS ${g.score}   BALLS ${'o'.repeat(lives)}${ball.stuck ? '   SPACE to launch' : ''}`;
  g.reward = () => Math.floor(g.score / 2);
  g.state = () => ({ ball, paddle, lives, bricks });
  return g;
};

// street crosser: get across two carriageways of traffic to the far sidewalk, one hop at a time; faster each crossing
GAMES.crosser = (rnd = Math.random) => {
  const W = 25, H = 13, g = { id: 'crosser', title: 'STREET CROSSER', W, H, score: 0, over: false };
  let you = [12, 12], lives = 3, splat = 0, lanes;
  const make = () => {
    lanes = [];
    for (let y = 1; y < H - 1; y++) { // row 6 is the median, 0 and 12 the sidewalks
      if (y === 6) continue;
      const dir = y < 6 ? -1 : 1, len = 2 + (rnd() * 3 | 0), gap = len + 3 + (rnd() * 5 | 0);
      lanes.push({ y, dir, len, gap, sp: (2 + rnd() * 3) * (1 + g.score * 0.12), off: rnd() * gap, col: [RED, BLUE, TAXI, WHITE, GREEN][rnd() * 5 | 0] });
    }
  };
  make();
  const carOn = (l, x) => mod(x - l.off * l.dir, l.gap) < l.len; // is column x under a car in lane l
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    for (const l of lanes) l.off = mod(l.off + l.sp * dt, l.gap);
    if (splat > 0) { splat -= dt; if (splat <= 0) you = [12, 12]; return ev; }
    const mv = k.leftP ? [-1, 0] : k.rightP ? [1, 0] : k.upP ? [0, -1] : k.downP ? [0, 1] : null;
    if (mv) { you = [clamp(you[0] + mv[0], 0, W - 1), clamp(you[1] + mv[1], 0, H - 1)]; ev.push('hop'); }
    const l = lanes.find(o => o.y === you[1]);
    if (l && carOn(l, you[0])) { lives--; splat = 0.8; ev.push('miss'); if (!lives) { g.over = true; ev.push('die'); } return ev; }
    if (you[1] === 0) { g.score++; ev.push('score'); you = [12, 12]; make(); }
    return ev;
  };
  g.draw = put => {
    for (let x = 0; x < W; x++) { put(x, 0, ',', C(GRAY, 6), C(GRAY, 2)); put(x, 6, ',', C(GRAY, 6), C(GRAY, 2)); put(x, H - 1, ',', C(GRAY, 6), C(GRAY, 2)); }
    for (const l of lanes) for (let x = 0; x < W; x++) {
      if (carOn(l, x)) { const head = l.dir > 0 ? !carOn(l, x + 1) : !carOn(l, x - 1); put(x, l.y, head ? 'o' : '#', C(l.col, 15), C(l.col, 4)); }
      else if (x % 4 === 0 && l.y !== 5 && l.y !== 11) put(x, l.y, '-', C(YEL, 5));
    }
    put(you[0], you[1], splat > 0 ? '*' : '@', splat > 0 ? C(RED, 15) : C(WHITE, 15));
  };
  g.status = () => `CROSSINGS ${g.score}   LIVES ${'@'.repeat(lives)}`;
  g.reward = () => g.score * 3;
  g.lanes = () => lanes; g.you = () => you;
  return g;
};

// pong: you on the left, the machine on the right (a little slow to react, so it can be beaten); first to 7. The
// ball speeds up every rally hit and leaves your paddle at an angle set by where it hit.
GAMES.pong = (rnd = Math.random) => {
  const W = 32, H = 18, PH = 4, WIN = 7, g = { id: 'pong', title: 'PONG', W, H, score: 0, over: false };
  let you = H / 2, cpu = H / 2, them = 0, ball, wait = 1;
  const serve = dir => { const a_ = (rnd() - 0.5) * 0.9; ball = { x: W / 2, y: H / 2, vx: Math.cos(a_) * 11 * dir, vy: Math.sin(a_) * 11 }; wait = 0.8; };
  serve(rnd() < 0.5 ? 1 : -1);
  const bounce = (py, dir) => { // off a paddle at py: faster, and angled by where on the paddle it hit
    const off = clamp((ball.y - py) / (PH / 2 + 0.5), -1, 1), sp = Math.min(26, Math.hypot(ball.vx, ball.vy) * 1.1), a_ = off * 1.0;
    ball.vx = Math.cos(a_) * sp * dir; ball.vy = Math.sin(a_) * sp;
  };
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    you = clamp(you + ((k.down ? 1 : 0) - (k.up ? 1 : 0)) * 16 * dt, PH / 2, H - PH / 2);
    // the machine: chases the ball when it's coming (a little slow, and misjudging it by a wobbling bit), drifts home when not
    const aim = ball.vx > 0 ? ball.y + Math.sin(ball.x * 0.7 + them) * 1.6 : H / 2;
    cpu = clamp(cpu + clamp(aim - cpu, -5.5 * dt, 5.5 * dt), PH / 2, H - PH / 2);
    if (wait > 0) { wait -= dt; return ev; }
    const n = Math.ceil(dt * 40);
    for (let s = 0; s < n; s++) {
      const h = dt / n;
      ball.x += ball.vx * h; ball.y += ball.vy * h;
      if (ball.y < 0 || ball.y > H - 1e-3) { ball.vy = -ball.vy; ball.y = clamp(ball.y, 0, H - 1e-3); ev.push('wall'); }
      if (ball.vx < 0 && ball.x < 1.5 && ball.x > 0.5 && Math.abs(ball.y - you) <= PH / 2 + 0.5) { bounce(you, 1); ball.x = 1.5; ev.push('paddle'); }
      if (ball.vx > 0 && ball.x > W - 1.5 && ball.x < W - 0.5 && Math.abs(ball.y - cpu) <= PH / 2 + 0.5) { bounce(cpu, -1); ball.x = W - 1.5; ev.push('paddle'); }
      if (ball.x < 0 || ball.x > W) {
        if (ball.x > W) { g.score++; ev.push('score'); } else { them++; ev.push('miss'); }
        if (g.score >= WIN || them >= WIN) { g.over = true; ev.push(g.score >= WIN ? 'clear' : 'die'); }
        else serve(ball.x > W ? -1 : 1);
        return ev;
      }
    }
    return ev;
  };
  g.draw = put => {
    for (let y = 0; y < H; y += 2) put(W / 2, y, ':', C(GRAY, 7)); // the net
    for (let y = Math.round(you - PH / 2); y < Math.round(you + PH / 2); y++) put(0, y, '#', C(WHITE, 15), C(GRAY, 5));
    for (let y = Math.round(cpu - PH / 2); y < Math.round(cpu + PH / 2); y++) put(W - 1, y, '#', C(RED, 14), C(RED, 4));
    if (wait <= 0 || fract(wait * 4) < 0.5) put(Math.floor(ball.x), Math.floor(ball.y), 'o', C(WHITE, 15));
  };
  g.status = () => `YOU ${g.score} - ${them} CPU   first to ${WIN}   UP/DOWN move`;
  g.reward = () => g.score * 2 + (g.score >= WIN ? 10 : 0);
  g.state = () => ({ you, cpu, ball, them });
  return g;
};

// waiting tables (a shift at a diner, cafe or noodle bar): customers come down the four counters toward you; slide
// each a plate before they reach the end. A plate with nobody to catch it breaks; a customer who gets to you walks
// out. 75 seconds, or five mistakes. Pays per customer served.
GAMES.serve = (rnd = Math.random) => {
  const W = 34, H = 12, LANES = [1, 4, 7, 10], g = { id: 'serve', title: 'LUNCH RUSH', W, H, score: 0, over: false, shift: true };
  let lane = 0, cust = [], plates = [], misses = 0, t = 0, spawn = 1;
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    if (k.upP) lane = Math.max(0, lane - 1);
    if (k.downP) lane = Math.min(3, lane + 1);
    if (k.actP) { plates.push({ lane, x: 2 }); ev.push('slide'); }
    if ((spawn -= dt) <= 0) { cust.push({ lane: rnd() * 4 | 0, x: W - 1, sp: 1.1 + rnd() * 0.8 + t * 0.02 }); spawn = Math.max(0.7, 2.2 - t * 0.022) * (0.7 + rnd() * 0.6); }
    for (const c of cust) c.x -= c.sp * dt;
    for (const p of plates) {
      p.x += 14 * dt;
      const c = cust.filter(o => o.lane === p.lane && o.x <= p.x + 0.5).sort((a_, b) => a_.x - b.x)[0];
      if (c) { cust.splice(cust.indexOf(c), 1); p.done = true; g.score++; ev.push('serve'); }
      else if (p.x >= W - 1) { p.done = true; misses++; ev.push('break'); }
    }
    plates = plates.filter(p => !p.done);
    for (const c of cust) if (c.x <= 2) { c.gone = true; misses++; ev.push('angry'); }
    cust = cust.filter(c => !c.gone);
    if (misses >= 5 || t >= 75) { g.over = true; ev.push('end'); }
    return ev;
  };
  g.draw = put => {
    LANES.forEach((y, k) => {
      for (let x = 1; x < W; x++) put(x, y + 1, '=', C(BRICK, 9), C(BRICK, 2)); // the counter
      put(0, y, k === lane ? '@' : ' ', C(WHITE, 15)); put(0, y + 1, k === lane ? 'A' : '|', C(k === lane ? WHITE : GRAY, k === lane ? 13 : 5));
    });
    for (const c of cust) put(Math.round(c.x), LANES[c.lane], 'o', C(YEL, 15), C(MAG, 3));
    for (const p of plates) put(Math.round(p.x), LANES[p.lane], '_', C(WHITE, 15), C(GRAY, 4));
  };
  g.status = () => `SERVED ${g.score}   MISTAKES ${misses}/5   ${Math.max(0, 75 - t) | 0}s   UP/DOWN counter, SPACE slide a plate`;
  g.reward = () => Math.max(0, Math.round((4 * Math.min(1, t / 75) + g.score * 1.2 - misses * 0.8) * 100) / 100); // the base pay is for the hours worked
  g.misses = () => misses; g.cust = () => cust; g.lane = () => lane; g.plates = () => plates;
  return g;
};

// tending bar (a shift at a bar): the classic. Four bars, a tap at the end of each, thirsty customers walking up
// them. Hold SPACE to pour, let go when the mug's full (too soon and you keep pouring next time, too long and it
// spills) and it slides down the bar. A customer who catches one is pushed back toward the door while they drink,
// and may slide the empty back: be at that bar to catch it. A mug nobody catches, an empty you miss, a spill, or a
// customer reaching your end: a mistake. Five and you're done; 75 seconds otherwise.
GAMES.tapper = (rnd = Math.random) => {
  const W = 34, H = 12, LANES = [1, 4, 7, 10], g = { id: 'tapper', title: 'LAST ORDERS', W, H, score: 0, over: false, shift: true };
  let lane = 0, cust = [], mugs = [], empties = [], misses = 0, t = 0, spawn = 1, fill = 0, pouring = false;
  const FULL = [0.85, 1.15];
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    if (k.upP && lane > 0) { lane--; fill = 0; pouring = false; } // (a different tap: start a fresh mug)
    if (k.downP && lane < 3) { lane++; fill = 0; pouring = false; }
    if (k.act) {
      pouring = true; fill += dt / 0.9;
      if (fill > 1.35) { fill = 0; pouring = false; misses++; ev.push('wrong'); } // all over the floor
    } else if (pouring) { // let go
      pouring = false;
      if (fill >= FULL[0] && fill <= FULL[1]) { mugs.push({ lane, x: 2 }); fill = 0; ev.push('slide'); }
      else if (fill > FULL[1]) { fill = 0; misses++; ev.push('wrong'); }
    }
    if ((spawn -= dt) <= 0) { cust.push({ lane: rnd() * 4 | 0, x: W - 1, sp: 0.9 + rnd() * 0.6 + t * 0.015, drink: 0 }); spawn = Math.max(0.9, 2.6 - t * 0.022) * (0.7 + rnd() * 0.6); }
    for (const c of cust) {
      if (c.drink > 0) { c.drink -= dt; if (c.drink <= 0 && rnd() < 0.55) empties.push({ lane: c.lane, x: c.x - 1 }); continue; }
      c.x -= c.sp * dt;
    }
    for (const m of mugs) {
      m.x += 12 * dt;
      const c = cust.filter(o => o.lane === m.lane && o.drink <= 0 && o.x <= m.x + 0.5).sort((a_, b) => a_.x - b.x)[0];
      if (c) { m.done = true; g.score++; ev.push('serve'); c.x += 7; c.drink = 1.6; if (c.x >= W - 1) c.gone = true; } // shoved back (out of the door, if far enough)
      else if (m.x >= W - 1) { m.done = true; misses++; ev.push('break'); }
    }
    for (const e of empties) {
      e.x -= 9 * dt;
      if (e.x <= 1.5) { e.done = true; if (e.lane === lane) { ev.push('place'); g.score += 0.5; } else { misses++; ev.push('break'); } }
    }
    mugs = mugs.filter(m => !m.done); empties = empties.filter(e => !e.done);
    for (const c of cust) if (c.x <= 2) { c.gone = true; misses++; ev.push('angry'); }
    cust = cust.filter(c => !c.gone);
    if (misses >= 5 || t >= 75) { g.over = true; ev.push('end'); }
    return ev;
  };
  g.draw = put => {
    LANES.forEach((y, k) => {
      for (let x = 2; x < W; x++) put(x, y + 1, '=', C(BRICK, 9), C(BRICK, 2)); // the bar
      put(1, y, '}', C(GRAY, 12)); put(1, y + 1, '|', C(GRAY, 9)); // the tap
      put(0, y, k === lane ? '@' : ' ', C(WHITE, 15)); put(0, y + 1, k === lane ? 'A' : ' ', C(WHITE, 13));
    });
    // the mug under the tap, filling: froth on top once it's full, red past full
    const y = LANES[lane], lvl = Math.min(3, Math.floor(fill * 3));
    if (fill > 0) put(2, y, fill > FULL[1] ? '%' : lvl >= 3 ? '@' : lvl >= 2 ? 'U' : lvl >= 1 ? 'u' : '_', fill > FULL[1] ? C(RED, 15) : fill >= FULL[0] ? C(WHITE, 15) : C(YEL, 13), C(YEL, 2 + lvl));
    for (const c of cust) put(Math.round(c.x), LANES[c.lane], c.drink > 0 ? 'Q' : 'o', C(YEL, 15), C(MAG, 3));
    for (const m of mugs) put(Math.round(m.x), LANES[m.lane], 'U', C(YEL, 15), C(ORANGE, 3));
    for (const e of empties) put(Math.round(e.x), LANES[e.lane], 'u', C(GRAY, 13), C(GRAY, 3));
  };
  g.status = () => `SERVED ${Math.floor(g.score)}   MISTAKES ${misses}/5   ${Math.max(0, 75 - t) | 0}s   UP/DOWN bar, HOLD SPACE pour, let go to slide`;
  g.reward = () => Math.max(0, Math.round((4 * Math.min(1, t / 75) + g.score * 1.3 - misses * 0.8) * 100) / 100);
  g.state = () => ({ lane, fill, cust, mugs, empties, misses });
  return g;
};

// stocking shelves (a shift at a store): each shelf holds one kind of thing, and what they are depends on the shop
// (STOCK_THEMES, by its sign); shoppers keep taking them. Put each box that comes off the truck in an empty slot on
// its own shelf. 60 seconds. Pays for every box shelved right, less for the ones put in the wrong place.
const STOCK_THEMES = {
  DEFAULT: [['CANS', 'c', RED], ['CEREAL', '#', YEL], ['BOTTLES', 'i', CYAN], ['SOAP', 'o', MAG]],
  VIDEO: [['NEW', '=', RED], ['COMEDY', '=', YEL], ['HORROR', '=', MAG], ['KIDS', '=', CYAN]],
  TOYS: [['YO-YOS', 'o', RED], ['DUCKS', '@', YEL], ['BALLS', 'O', WHITE], ['KITES', '&', CYAN]],
  THRIFT: [['COATS', '#', BRICK], ['SHOES', 'b', GRAY], ['LAMPS', 'T', YEL], ['RECORDS', 'o', MAG]],
  TOBACCO: [['CIGARS', '=', BRICK], ['PAPERS', '#', WHITE], ['LIGHTERS', 'i', RED], ['PIPES', 'J', WARM]],
  RECORDS: [['VINYL', 'o', MAG], ['CDS', '@', CYAN], ['TAPES', '=', YEL], ['POSTERS', '#', RED]],
  BOOKS: [['FICTION', '|', BLUE], ['COMICS', '%', RED], ['COOKBOOKS', '#', YEL], ['MAPS', '=', GREEN]],
  PHARMACY: [['PILLS', 'o', WHITE], ['BANDAGES', '+', RED], ['SHAMPOO', 'i', CYAN], ['VITAMINS', ':', ORANGE]],
  HARDWARE: [['NAILS', ':', GRAY], ['TOOLS', 'T', RED], ['PAINT', 'U', BLUE], ['ROPE', '@', BRICK]],
  LIQUOR: [['WINE', 'i', RED], ['BEER', '#', YEL], ['SPIRITS', 'I', ORANGE], ['MIXERS', 'o', CYAN]],
  PHONES: [['PHONES', '#', GRAY], ['CASES', '[', MAG], ['CHARGERS', '~', WHITE], ['CABLES', '=', CYAN]],
  SPORTS: [['BALLS', 'o', ORANGE], ['SHOES', 'U', WHITE], ['BATS', '/', BRICK], ['JERSEYS', '#', BLUE]],
  SKATE: [['DECKS', '=', RED], ['WHEELS', 'o', YEL], ['TEES', '#', CYAN], ['STICKERS', '*', MAG]],
  GROCERY: [['FRUIT', 'o', RED], ['VEG', '%', GREEN], ['BREAD', '#', WARM], ['MILK', 'i', WHITE]],
  HERBS: [['ROOTS', '%', WARM], ['TEAS', '#', GREEN], ['JARS', 'U', ORANGE], ['DRIED', ':', YEL]],
  JADE: [['BANGLES', 'o', GREEN], ['FIGURES', '&', CYAN], ['BEADS', ':', RED], ['CHARMS', '*', YEL]],
  PAWN: [['WATCHES', 'o', YEL], ['GUITARS', '%', BRICK], ['CAMERAS', '#', GRAY], ['JEWELLERY', '*', CYAN]],
};
STOCK_THEMES.MARKET = STOCK_THEMES.FRUIT = STOCK_THEMES.GROCERY;
const stockKinds = word => STOCK_THEMES[word] || STOCK_THEMES.DEFAULT;
GAMES.stock = (rnd = Math.random, word = '') => {
  const STOCK_KINDS = stockKinds(word);
  const W = 34, H = 13, SLOTS = 10, g = { id: 'stock', title: 'RESTOCK', W, H, score: 0, over: false, shift: true };
  const shelf = STOCK_KINDS.map(() => Array.from({ length: SLOTS }, () => rnd() < 0.6));
  // the next box off the truck: always for a shelf with a gap on it; none (-1) while every shelf is full
  const nextBox = () => { const open = [0, 1, 2, 3].filter(i => shelf[i].includes(false)); return open.length ? open[rnd() * open.length | 0] : -1; };
  let cur = [0, 0], box = nextBox(), wrong = 0, t = 0, take = 0.8;
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    if (k.leftP) cur[1] = Math.max(0, cur[1] - 1);
    if (k.rightP) cur[1] = Math.min(SLOTS - 1, cur[1] + 1);
    if (k.upP) cur[0] = Math.max(0, cur[0] - 1);
    if (k.downP) cur[0] = Math.min(3, cur[0] + 1);
    if (box < 0 || !shelf[box].includes(false)) box = nextBox(); // nothing to shelve, or its shelf filled: a box that fits
    if (k.actP && box >= 0) {
      if (shelf[cur[0]][cur[1]]) ev.push('bump'); // already full
      else if (cur[0] === box) { shelf[cur[0]][cur[1]] = true; g.score++; box = nextBox(); ev.push('place'); }
      else { wrong++; box = nextBox(); ev.push('wrong'); }
    }
    if ((take -= dt) <= 0) { // a shopper takes something
      const full = [];
      shelf.forEach((r, i) => r.forEach((f, j) => f && full.push([i, j])));
      if (full.length) { const [i, j] = full[rnd() * full.length | 0]; shelf[i][j] = false; }
      take = 0.6 + rnd() * 0.9;
    }
    if (box < 0 || !shelf[box].includes(false)) box = nextBox(); // (again, now the shoppers have been)
    if (t >= 60) { g.over = true; ev.push('end'); }
    return ev;
  };
  g.draw = (put, text) => {
    STOCK_KINDS.forEach(([name, ch, col], i) => {
      const y = 1 + i * 3;
      text(1, y, name, C(col, 13));
      for (let j = 0; j < SLOTS; j++) {
        const x = 10 + j * 2, here = cur[0] === i && cur[1] === j;
        put(x, y, shelf[i][j] ? ch : '.', shelf[i][j] ? C(col, 15) : C(GRAY, 6), here ? C(WHITE, 6) : shelf[i][j] ? C(col, 3) : NONE);
        put(x, y + 1, '=', C(GRAY, 8)); put(x + 1, y + 1, '=', C(GRAY, 8));
      }
    });
    if (box < 0) { text(10, H - 1, 'shelves full: waiting for the next box off the truck...', C(GRAY, 10)); return; }
    const [name, ch, col] = STOCK_KINDS[box];
    put(10, H - 1, ch, C(col, 15), C(col, 4)); text(13, H - 1, `the box in your arms: ${name}`, C(col, 15));
  };
  g.status = () => `SHELVED ${g.score}   WRONG ${wrong}   ${Math.max(0, 60 - t) | 0}s   ARROWS move, SPACE shelve the box`;
  g.reward = () => Math.max(0, Math.round((3 * Math.min(1, t / 60) + g.score * 0.7 - wrong * 0.6) * 100) / 100); // the base pay is for the hours worked
  g.shelf = () => shelf; g.box = () => box; g.cur = () => cur; g.wrong = () => wrong;
  return g;
};

// ---- crimes. Each ends with g.success true or false; the caller (crime-ui.js) decides what that means.
// pickpocketing: a marker sweeps across a bar; stop it in the green three times running, the zone shrinking each time
GAMES.pickpocket = (rnd = Math.random) => {
  const W = 30, H = 7, g = { id: 'pickpocket', title: 'PICKPOCKET', W, H, score: 0, over: false, success: false, crime: true };
  let pos = 0, dir = 1, speed = 16, zone = [11, 17];
  const newZone = () => { const w = [6, 4, 3][g.score] || 3, a_ = 2 + rnd() * (W - 4 - w) | 0; zone = [a_, a_ + w]; };
  newZone();
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    pos += dir * speed * dt;
    if (pos < 0 || pos > W - 1) { dir = -dir; pos = clamp(pos, 0, W - 1); }
    if (k.actP) {
      if (pos >= zone[0] && pos <= zone[1] + 1) { g.score++; ev.push('eat'); speed *= 1.25; if (g.score >= 3) { g.over = g.success = true; ev.push('clear'); } else newZone(); }
      else { g.over = true; ev.push('die'); } // they felt that
    }
    return ev;
  };
  g.draw = (put, text) => {
    for (let x = 0; x < W; x++) put(x, 3, x >= zone[0] && x <= zone[1] ? '=' : '-', x >= zone[0] && x <= zone[1] ? C(GREEN, 14) : C(GRAY, 7), x >= zone[0] && x <= zone[1] ? C(GREEN, 3) : NONE);
    put(Math.round(pos), 2, 'v', C(YEL, 15)); put(Math.round(pos), 4, '^', C(YEL, 15));
    text(0, 0, `fingers in the pocket: ${'*'.repeat(g.score)}${'.'.repeat(3 - g.score)}`, C(WHITE, 13));
  };
  g.status = () => 'SPACE when the marker is in the green   miss once and they notice';
  g.reward = () => 0;
  return g;
};
// shoplifting: hold SPACE to slip something into your coat, but only while the clerk's looking away; they glance
// round now and then, with a moment's warning (they start to turn). Caught holding it and they call the cops.
GAMES.shoplift = (rnd = Math.random) => {
  const W = 30, H = 10, g = { id: 'shoplift', title: 'FIVE FINGER DISCOUNT', W, H, score: 0, over: false, success: false, crime: true };
  let state = 'away', left = 0.8 + rnd() * 0.8, grab = 0;
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    if ((left -= dt) <= 0) {
      if (state === 'away') { state = 'turning'; left = 0.6; ev.push('bump'); }
      else if (state === 'turning') { state = 'looking'; left = 1.2 + rnd() * 1.5; }
      else { state = 'away'; left = 1.5 + rnd() * 2.5; }
    }
    if (k.act) {
      if (state === 'looking') { g.over = true; ev.push('die'); return ev; } // seen
      grab += dt / 2.6; // longer than they ever look away: you'll have to let go at least once
      if (grab >= 1) { g.over = g.success = true; ev.push('clear'); }
    }
    return ev;
  };
  g.draw = (put, text) => {
    const face = state === 'looking' ? ['  ____  ', ' (O  O) ', '  \__/  ', '   ||   '] : state === 'turning' ? ['  ____  ', ' (  o o)', '   \_/  ', '   ||   '] : ['  ____  ', ' (     )', '  (___) ', '   ||   '];
    face.forEach((l, r) => text(11, 1 + r, l, state === 'looking' ? C(RED, 15) : state === 'turning' ? C(YEL, 15) : C(WHITE, 12)));
    text(2, 6, state === 'looking' ? 'THE CLERK IS WATCHING YOU' : state === 'turning' ? 'they\'re turning round...' : 'the clerk\'s looking away', state === 'looking' ? C(RED, 15) : C(GRAY, 11));
    for (let x = 0; x < W; x++) put(x, 8, x / W < grab ? '#' : '.', x / W < grab ? C(GREEN, 14) : C(GRAY, 6));
  };
  g.status = () => 'HOLD SPACE to pocket it while they look away   let go when they turn';
  g.reward = () => 0;
  return g;
};
// lockpicking: four pins, each sprung down. Hold UP to push the current one up and SPACE to set it while it's at
// the shear line; push it past the top and the pick slips. Three slips (or the clock) and the lock jams.
GAMES.lockpick = (rnd = Math.random) => {
  const W = 26, H = 14, PINS = 4, g = { id: 'lockpick', title: 'LOCKPICK', W, H, score: 0, over: false, success: false, crime: true };
  const shear = Array.from({ length: PINS }, () => 0.5 + rnd() * 0.3), h = Array(PINS).fill(0);
  let cur = 0, slips = 0, t = 0;
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    h[cur] = k.up ? h[cur] + dt * 0.9 : Math.max(0, h[cur] - dt * 0.6); // pushed up, or springing back
    if (h[cur] > 1) { slips++; h[cur] = 0; ev.push('wrong'); if (slips >= 3) { g.over = true; ev.push('die'); return ev; } }
    if (k.actP) {
      if (Math.abs(h[cur] - shear[cur]) < 0.07) { cur++; g.score++; ev.push('place'); if (cur >= PINS) { g.over = g.success = true; ev.push('clear'); } }
      else { slips++; h[cur] = 0; ev.push('wrong'); if (slips >= 3) { g.over = true; ev.push('die'); } }
    }
    if (t > 40 && !g.over) { g.over = true; ev.push('die'); }
    return ev;
  };
  g.draw = (put, text) => {
    for (let p = 0; p < PINS; p++) {
      const x = 4 + p * 5, top = 2, bot = 11, sy = Math.round(bot - shear[p] * (bot - top)), py = Math.round(bot - (p < cur ? shear[p] : h[p]) * (bot - top));
      for (let y = top; y <= bot; y++) put(x, y, y === sy ? '=' : '|', y === sy ? C(YEL, 13) : C(GRAY, 6));
      put(x, py, p < cur ? '#' : p === cur ? '@' : 'o', p < cur ? C(GREEN, 15) : p === cur ? C(WHITE, 15) : C(GRAY, 10), p === cur ? C(GRAY, 4) : NONE);
    }
    text(0, 13, `slips ${'x'.repeat(slips)}${'.'.repeat(3 - slips)}   ${Math.max(0, 40 - t) | 0}s`, C(slips ? RED : GRAY, 12));
  };
  g.status = () => 'HOLD UP to push the pin, SPACE to set it on the line';
  g.reward = () => 0;
  g.state = () => ({ h, shear, cur, slips });
  return g;
};

// breaking out of jail: sneak from your cell (bottom left) to the door (top right) while a guard walks his rounds
// with a flashlight. Crates block the beam. Step into the light, or bump into him, and he's got you. One cell per
// arrow press (held, it repeats). 45 seconds before the shift changes and they count heads.
GAMES.jailbreak = (rnd = Math.random) => {
  const W = 30, H = 13, g = { id: 'jailbreak', title: 'JAILBREAK', W, H, score: 0, over: false, success: false, crime: true };
  const cell = (x, y) => y * W + x, solid = new Set();
  for (let x = 0; x < W; x++) solid.add(cell(x, 0)).add(cell(x, 10));
  for (let y = 0; y <= 10; y++) solid.add(cell(0, y)).add(cell(W - 1, y));
  const CRATES = [[[7, 4], [8, 4], [7, 5]], [[13, 6], [14, 6], [14, 5]], [[19, 3], [19, 4]], [[22, 7], [23, 7], [23, 6]], [[10, 8], [11, 8]], [[17, 8]], [[25, 4], [25, 5]], [[4, 5], [4, 6]]];
  for (const grp of CRATES) for (const [x, y] of grp) solid.add(cell(x, y));
  const door = [W - 2, 1], you = [2, 9], ROUTE = [[3, 2], [26, 2], [26, 8], [3, 8]];
  let gx = 3, gy = 2, leg = 1, wait = 0, fx_ = 1, fy_ = 0, t = 0, rep = 0;
  const lit = new Set();
  const clear = (x0, y0, x1, y1) => { // nothing solid on the way from (x0, y0) to (x1, y1)
    for (let s = 1; s < 8; s++) { const x = Math.round(x0 + (x1 - x0) * s / 8), y = Math.round(y0 + (y1 - y0) * s / 8); if (solid.has(cell(x, y)) && !(x === x1 && y === y1)) return false; }
    return true;
  };
  const shine = () => { // the cone: six cells ahead, widening
    lit.clear();
    const ox = Math.round(gx), oy = Math.round(gy);
    for (let d = 1; d <= 6; d++) for (let o = -(d >> 1); o <= d >> 1; o++) {
      const x = ox + fx_ * d - fy_ * o, y = oy + fy_ * d + fx_ * o;
      if (x < 0 || y < 0 || x >= W || y > 10 || solid.has(cell(x, y)) || !clear(ox, oy, x, y)) continue;
      lit.add(cell(x, y));
    }
  };
  shine();
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    // you: a cell per press, repeating while held
    const dir = k.leftP || k.left ? [-1, 0] : k.rightP || k.right ? [1, 0] : k.upP || k.up ? [0, -1] : k.downP || k.down ? [0, 1] : null;
    if (k.leftP || k.rightP || k.upP || k.downP) rep = 0;
    if (dir && (rep -= dt) <= 0) {
      rep = 0.16;
      const nx = you[0] + dir[0], ny = you[1] + dir[1];
      if (!solid.has(cell(nx, ny))) { you[0] = nx; you[1] = ny; ev.push('hop'); } else ev.push('bump');
    }
    // the guard: along his round, pausing at each corner to look about
    if (wait > 0) { wait -= dt; if (wait < 0.5) { const n = ROUTE[leg]; fx_ = Math.sign(n[0] - gx); fy_ = Math.sign(n[1] - gy); } }
    else {
      const [tx, ty] = ROUTE[leg], d = Math.hypot(tx - gx, ty - gy), s = Math.min(d, 3.2 * dt);
      fx_ = Math.sign(tx - gx); fy_ = Math.sign(ty - gy);
      gx += fx_ * s; gy += fy_ * s;
      if (d - s < 1e-6) { leg = (leg + 1) % ROUTE.length; wait = 1.1; }
    }
    shine();
    if (you[0] === door[0] && you[1] === door[1]) { g.over = g.success = true; g.score = 1; ev.push('clear'); return ev; }
    if (lit.has(cell(you[0], you[1])) || Math.abs(gx - you[0]) + Math.abs(gy - you[1]) < 1.2 || t > 45) { g.over = true; ev.push('die'); }
    return ev;
  };
  g.draw = (put, text) => {
    for (let y = 0; y <= 10; y++) for (let x = 0; x < W; x++) {
      const i = cell(x, y);
      if (solid.has(i)) { const wall = x === 0 || y === 0 || x === W - 1 || y === 10; put(x, y, wall ? '#' : '=', wall ? C(GRAY, 8) : C(BRICK, 12), wall ? C(GRAY, 2) : C(BRICK, 3)); }
      else if (lit.has(i)) put(x, y, '.', C(YEL, 12), C(YEL, 3));
    }
    put(door[0], door[1], 'D', C(GREEN, 15), C(GREEN, 4));
    put(Math.round(gx), Math.round(gy), 'G', C(BLUE, 15), C(BLUE, 4));
    put(you[0], you[1], '@', C(WHITE, 15), lit.has(cell(you[0], you[1])) ? C(RED, 6) : NONE);
    text(0, 12, `${Math.max(0, 45 - t) | 0}s till the head count`, C(t > 35 ? RED : GRAY, 12));
  };
  g.status = () => 'ARROWS sneak to the door (D). Stay out of the light.';
  g.reward = () => 0;
  g.state = () => ({ you, gx, gy, lit, door, solid, t });
  return g;
};

// ---- the pleasure pier's booths. Like the cabinets: a credit a go, tickets for how you did.
// ring toss: rows of bottles; the ring swings back and forth in front of you, GO throws it straight up the board.
// It lands on a bottle neck only if it's dead on (the far rows count double). Six rings.
GAMES.ringtoss = (rnd = Math.random) => {
  const W = 29, H = 12, ROWS = [2, 4, 6], g = { id: 'ringtoss', title: 'RING TOSS', W, H, score: 0, over: false };
  const necks = [];
  for (const y of ROWS) for (let x = 2 + (y >> 1 & 1) * 2; x < W - 1; x += 4) necks.push({ x, y, ringed: false });
  let rings = 6, aim = 1, dir = 1, speed = 11, fly = null, hits = 0;
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    if (fly) { // up the board, landing on its row
      fly.y -= dt * 22;
      if (fly.y <= fly.to) {
        const n = necks.find(q => q.x === fly.x && q.y === fly.to && !q.ringed);
        if (n) { n.ringed = true; hits++; g.score += n.y === ROWS[0] ? 2 : 1; ev.push('score'); } else ev.push('miss');
        fly = null;
        if (rings === 0) { g.over = true; ev.push('end'); }
      }
      return ev;
    }
    aim += dir * speed * dt;
    if (aim < 1 || aim > W - 2) { dir = -dir; aim = clamp(aim, 1, W - 2); }
    if (k.actP && rings > 0) { rings--; fly = { x: Math.round(aim), y: H - 2, to: ROWS[rnd() * 3 | 0] }; speed *= 1.08; ev.push('launch'); }
    return ev;
  };
  g.draw = (put, text) => {
    for (let x = 0; x < W; x++) put(x, H - 3, '-', C(BRICK, 6)); // the line you throw from
    for (const n of necks) { put(n.x, n.y, n.ringed ? 'O' : 'i', n.ringed ? C(YEL, 15) : C(GREEN, 12)); put(n.x, n.y + 1, 'U', C(GREEN, 8)); }
    if (fly) put(fly.x, Math.round(fly.y), 'o', C(YEL, 15));
    else if (rings) { put(Math.round(aim), H - 2, 'O', C(YEL, 15)); put(Math.round(aim), H - 1, '^', C(WHITE, 10)); }
    text(0, 0, `rings: ${'O'.repeat(rings)}${'.'.repeat(6 - rings)}`, C(WHITE, 13));
  };
  g.status = () => `RINGED ${hits}   POINTS ${g.score}   SPACE throw`;
  g.reward = () => g.score * 4;
  return g;
};
// high striker: the power meter swings up and down; GO brings the mallet down at whatever it's at, and the puck
// flies that high up the tower. Ring the bell (the very top) for the big prize. Three swings.
const STRIKER_MARKS = [[0.95, 'DING!'], [0.8, 'HERCULES'], [0.6, 'STRONGMAN'], [0.4, 'NOT BAD'], [0.2, 'TICKLE'], [0, 'WEAKLING']];
GAMES.strength = (rnd = Math.random) => {
  const W = 26, H = 14, TOP = 1, BOT = H - 2, g = { id: 'strength', title: 'HIGH STRIKER', W, H, score: 0, over: false };
  let swings = 3, power = 0, t = rnd() * 3, puck = null, best = 0, last = '';
  const meter = g.meter = () => 0.5 - 0.5 * Math.cos(t * (3.2 + (3 - swings) * 0.8)); // faster each swing
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    if (puck) {
      puck.h += (puck.up ? 1 : -1) * dt * 2.2;
      if (puck.up && puck.h >= puck.to) {
        puck.up = false; puck.h = puck.to; last = STRIKER_MARKS.find(m => puck.to >= m[0])[1];
        g.score += puck.to >= 0.95 ? 10 : puck.to >= 0.8 ? 5 : puck.to >= 0.6 ? 3 : puck.to >= 0.4 ? 1 : 0;
        ev.push(puck.to >= 0.95 ? 'clear' : 'bump');
      }
      if (!puck.up && puck.h <= 0) { puck = null; if (swings === 0) { g.over = true; ev.push('end'); } }
      return ev;
    }
    power = meter();
    if (k.actP && swings > 0) { swings--; puck = { h: 0, to: power, up: true }; best = Math.max(best, power); ev.push('brick'); }
    return ev;
  };
  g.draw = (put, text) => {
    const row = h => Math.round(BOT - h * (BOT - TOP));
    for (let y = TOP; y <= BOT; y++) put(13, y, '|', C(GRAY, 9)); // the tower
    put(13, TOP, '@', puck && !puck.up && puck.to >= 0.95 ? C(YEL, 15) : C(YEL, 9)); // the bell
    for (const [h, name] of STRIKER_MARKS.slice(1)) text(15, row(h), name, C([RED, ORANGE, YEL, GREEN, CYAN][STRIKER_MARKS.findIndex(m => m[1] === name) - 1], 11));
    put(13, row(puck ? puck.h : 0), '#', C(RED, 15));
    put(12, BOT + 1, '=', C(BRICK, 12)); put(13, BOT + 1, '=', C(BRICK, 12)); put(14, BOT + 1, '=', C(BRICK, 12));
    const m = puck ? 0 : power; // the meter, left
    for (let y = TOP; y <= BOT; y++) { const on = y >= row(m); put(4, y, on ? '#' : ':', on ? C(y < row(0.8) ? RED : y < row(0.5) ? YEL : GREEN, 14) : C(GRAY, 5)); }
    text(0, 0, `swings ${'*'.repeat(swings)}${'.'.repeat(3 - swings)}`, C(WHITE, 13));
    if (last) text(0, BOT + 1, last, C(YEL, 15));
  };
  g.status = () => `POINTS ${g.score}   BEST ${Math.round(best * 100)}%   SPACE swing`;
  g.reward = () => g.score * 2;
  return g;
};
const FAIR_GAMES = ['ringtoss', 'strength'];

// ---- the Shotengai's parlours
// pachinko: hold GO and balls fly up and rain down through a forest of pins; steer where they come in with the
// stick. Most fall away. The pockets pay balls back; the middle one spins the reels, and three of a kind is FEVER.
// A credit buys 40 balls; walk away (E) whenever you like and what's left is swapped for tickets, 8 balls a ticket.
GAMES.pachinko = (rnd = Math.random) => {
  const W = 23, H = 20, g = { id: 'pachinko', title: 'PACHINKO', W, H, score: 40, over: false };
  const pin = (x, y) => y >= 3 && y <= 15 && y % 2 === 1 && (x + (y >> 1)) % 2 === 0 && x > 0 && x < W - 1;
  const POCKETS = { 11: 'start', 5: 'small', 17: 'small' }; // which bottom columns catch a ball
  let aim = 11, fire = 0, balls = [], tick = 0, reel = null, fever = 0, best = '';
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    if (k.left) aim = Math.max(1, aim - dt * 8); if (k.right) aim = Math.min(W - 2, aim + dt * 8);
    fire -= dt;
    if (k.act && fire <= 0 && g.score > 0) { g.score--; fire = 0.22; balls.push({ x: Math.round(aim), y: 1 }); ev.push('launch'); }
    tick += dt;
    while (tick > 0.06) { // every ball falls a row; a pin bumps it one way or the other
      tick -= 0.06;
      for (const b of balls) {
        if (pin(b.x, b.y + 1) && rnd() < 0.7) { b.x = clamp(b.x + (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.3 ? 2 : 1), 1, W - 2); ev.push('bump'); } // (a ball can slip past a pin)
        b.y++;
      }
      for (const b of balls.filter(b => b.y >= H - 2)) {
        const p = POCKETS[b.x];
        if (p === 'small') { g.score += 2; ev.push('eat'); }
        if (p === 'start') { g.score += 3; ev.push('score'); if (!reel) reel = { t: 1.6, r: [0, 1, 2].map(() => 1 + (rnd() * 7 | 0)), hit: rnd() < 0.1 }; }
        b.dead = true;
      }
      balls = balls.filter(b => !b.dead);
    }
    if (reel && (reel.t -= dt) <= 0) {
      if (reel.hit) { reel.r = [7, 7, 7]; g.score += 50; fever = 3; ev.push('clear'); best = 'FEVER! 777'; } else ev.push('miss');
      reel.shown = reel.r; reel = null;
    }
    fever = Math.max(0, fever - dt);
    if (g.score <= 0 && !balls.length && !reel) { g.over = true; ev.push('end'); }
    if (reel) g.lastReel = reel.r.map((v, i) => reel.t > 0.4 + i * 0.4 ? 1 + (rnd() * 9 | 0) : v); // the reels spinning, stopping one by one
    return ev;
  };
  g.draw = (put, text) => {
    for (let y = 0; y < H; y++) { put(0, y, '|', C(GRAY, 9)); put(W - 1, y, '|', C(GRAY, 9)); }
    for (let y = 3; y <= 15; y++) for (let x = 1; x < W - 1; x++) if (pin(x, y)) put(x, y, '.', C(YEL, fever > 0 ? 15 : 10));
    for (let x = 1; x < W - 1; x++) { const p = POCKETS[x]; put(x, H - 1, p ? 'U' : '_', p === 'start' ? C(RED, 15) : p ? C(GREEN, 14) : C(GRAY, 6)); }
    put(Math.round(aim), 0, 'v', C(WHITE, 15));
    for (const b of balls) put(b.x, b.y, 'o', C(WHITE, 15));
    const r = g.lastReel || [7, 7, 7];
    text(8, 17, `[ ${r.join(' ')} ]`, reel ? C(YEL, 15) : fever > 0 ? C(NEON[(Math.floor(fever * 8)) & 3], 15) : C(WHITE, 11));
    if (best && fever > 0) text(7, 2, best, C(MAG, 15));
  };
  g.status = () => `BALLS ${g.score}   HOLD SPACE fire   ARROWS aim   E cash out`;
  g.reward = () => Math.floor(g.score / 8);
  return g;
};
// the crane game: steer the claw over a prize, GO drops it. It grips, maybe, and carries it to the chute; one try a
// credit. What it drops in the chute is yours.
const CRANE_PRIZES = ['plushcat', 'plushbear', 'sharkplush', 'duck', 'plushcat', 'yoyo'];
GAMES.crane = (rnd = Math.random) => {
  const W = 22, H = 14, g = { id: 'crane', title: 'CRANE GAME', W, H, score: 0, over: false, prize: null };
  const pile = Array.from({ length: 6 }, (_, k) => ({ x: 5 + k * 3 + (rnd() * 2 | 0), id: CRANE_PRIZES[rnd() * CRANE_PRIZES.length | 0] }));
  let cx = 3, cy = 1, state = 'aim', held = null, t = 0;
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    if (state === 'aim') {
      if (k.left) cx = Math.max(2, cx - dt * 6); if (k.right) cx = Math.min(W - 2, cx + dt * 6);
      if (k.actP || t > 20) { state = 'down'; ev.push('launch'); }
    } else if (state === 'down') {
      cy += dt * 6;
      if (cy >= H - 3) {
        cy = H - 3; state = 'up';
        const p = pile.find(q => Math.abs(q.x - cx) <= 1);
        if (p && rnd() < 0.5) { held = p; pile.splice(pile.indexOf(p), 1); ev.push('place'); } else ev.push('bump');
      }
    } else if (state === 'up') {
      cy -= dt * 5;
      if (held && cy < 4 && rnd() < dt * 0.25) { pile.push({ ...held, x: Math.round(cx) }); held = null; ev.push('miss'); } // it slips...
      if (cy <= 1) { cy = 1; state = 'home'; }
    } else if (state === 'home') {
      cx -= dt * 6;
      if (cx <= 1) {
        g.over = true;
        if (held) { g.prize = held.id; g.score = 1; ev.push('clear'); } else ev.push('end');
      }
    }
    return ev;
  };
  g.draw = (put, text) => {
    for (let x = 0; x < W; x++) put(x, 0, '=', C(GRAY, 10));
    put(0, H - 2, '\\', C(GRAY, 10)); put(1, H - 2, '_', C(GRAY, 10)); put(1, H - 1, 'v', C(YEL, 13)); // the chute
    const x = Math.round(cx), y = Math.round(cy);
    for (let r = 1; r < y; r++) put(x, r, '|', C(GRAY, 12));
    put(x - 1, y, held ? '[' : '/', C(WHITE, 15)); put(x + 1, y, held ? ']' : '\\', C(WHITE, 15));
    if (held) put(x, y + 1, '@', C(ITEM_COL[CRANE_PRIZES.indexOf(held.id) & 7], 15));
    for (const p of pile) put(p.x, H - 2, '@', C(ITEM_COL[CRANE_PRIZES.indexOf(p.id) & 7], 14));
    for (let x2 = 2; x2 < W; x2++) put(x2, H - 1, '#', C(MAG, 5));
  };
  g.status = () => state === 'aim' ? `ARROWS move the claw   SPACE drop (${Math.max(0, 20 - t) | 0}s)` : state === 'home' && held ? 'Got one... got one...' : '...';
  g.reward = () => 0;
  return g;
};

// which shift each room offers
const SHIFT_FOR = { diner: 'serve', cafe: 'serve', noodle: 'serve', store: 'stock', books: 'stock', bar: 'tapper', karaoke: 'tapper' };
// the cabinets in an arcade, in order, cycle through these; a credit is a dollar
const ARCADE_GAMES = ['snake', 'breakout', 'crosser', 'pong'], CREDIT = 1;

// ---- driving a taxi: what a trip pays. The meter (taxiFare) by distance, and a tip for getting there quickly and
// smoothly; any crash on the way and there's no tip. took = seconds, harsh = seconds of hard braking or swerving.
// route = how far it is by the streets (defaults to dist); the clock is judged on that, not the meter, so a detour
// pays more on the meter but costs you the tip
function taxiPay(dist, took, harsh, crashed, route = dist) {
  const fare = Math.round(taxiFare(dist) * 100) / 100, expected = 6 + route / 1.4;
  const speed = clamp(expected / Math.max(took, 1), 0, 1), smooth = clamp(1 - harsh / 6, 0, 1);
  const tip = crashed ? 0 : Math.round(fare * (0.05 + 0.25 * speed + 0.2 * smooth) * 100) / 100;
  const stars = crashed ? 1 : 1 + Math.round(4 * (speed + smooth) / 2);
  return { fare, tip, stars, speed, smooth };
}
