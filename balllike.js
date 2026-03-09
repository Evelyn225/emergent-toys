// balllike.js — Line Rider style physics toy

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  render();
});

// State
let lines = [];
let balls = [];
let currentLine = [];
let drawing = false;
let erasing = false;
let animating = false;
let ballHue = 200;

// Physics
const GRAVITY       = 0.45;
const RESTITUTION   = 0.4;
const ROLL_FRICTION = 0.9995;
const AIR_DRAG      = 0.99999;
const BALL_RADIUS   = 11;
const SUBSTEPS      = 8;
const TRAIL_LEN     = 90;
const ERASE_RADIUS  = 18;

// --- Input ---

window.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', e => {
  if (e.button === 0 && e.ctrlKey) {
    erasing = true;
    eraseAt(getPos(e));
    return;
  }
  if (e.button === 0) {
    drawing = true;
    currentLine = [getPos(e)];
  } else if (e.button === 2) {
    spawnBall(getPos(e).x, getPos(e).y);
  }
});

canvas.addEventListener('mousemove', e => {
  const pos = getPos(e);
  if (erasing && e.ctrlKey) {
    eraseAt(pos);
    return;
  }
  if (!drawing) return;
  const last = currentLine[currentLine.length - 1];
  const dx = pos.x - last.x, dy = pos.y - last.y;
  if (dx * dx + dy * dy > 9) {
    currentLine.push(pos);
    render();
  }
});

canvas.addEventListener('mouseup', e => {
  if (erasing) { erasing = false; return; }
  if (e.button === 0 && drawing) {
    drawing = false;
    if (currentLine.length > 1) lines.push([...currentLine]);
    currentLine = [];
    render();
  }
});

// Release erasing if ctrl is let go mid-drag
window.addEventListener('keyup', e => {
  if (e.key === 'Control') erasing = false;
});

// Touch
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  drawing = true;
  currentLine = [getTouchPos(e)];
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!drawing) return;
  const pos = getTouchPos(e);
  const last = currentLine[currentLine.length - 1];
  const dx = pos.x - last.x, dy = pos.y - last.y;
  if (dx * dx + dy * dy > 9) {
    currentLine.push(pos);
    render();
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (drawing && currentLine.length > 1) lines.push([...currentLine]);
  drawing = false;
  currentLine = [];
  render();
}, { passive: false });

function getPos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top)  * (canvas.height / r.height),
  };
}

function getTouchPos(e) {
  const r = canvas.getBoundingClientRect();
  const t = e.touches[0];
  return {
    x: (t.clientX - r.left) * (canvas.width / r.width),
    y: (t.clientY - r.top)  * (canvas.height / r.height),
  };
}

// --- Ball management ---

function spawnBall(x, y) {
  ballHue = (ballHue + 53) % 360;
  balls.push({ x, y, vx: 0, vy: 0, hue: ballHue, trail: [] });
  if (!animating) startLoop();
}

function clearBalls() { balls = []; animating = false; render(); }
function clearLines() { lines = []; currentLine = []; render(); }
function clearAll()   { balls = []; lines = []; currentLine = []; animating = false; render(); }

// --- Eraser: cuts holes in lines by splitting polylines around a circle ---

function eraseAt(pos) {
  const cx = pos.x, cy = pos.y, r = ERASE_RADIUS;
  const newLines = [];
  for (const line of lines) {
    for (const seg of cutLineWithCircle(line, cx, cy, r)) {
      if (seg.length >= 2) newLines.push(seg);
    }
  }
  lines = newLines;
  render();
}

function ptInCircle(p, cx, cy, r) {
  const dx = p.x - cx, dy = p.y - cy;
  return dx * dx + dy * dy < r * r;
}

function segCircleTs(cx, cy, r, p1, p2) {
  // Returns t values in [0,1] where the segment p1->p2 intersects the circle
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const fx = p1.x - cx,   fy = p1.y - cy;
  const a = dx * dx + dy * dy;
  if (a < 0.0001) return [];
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const sq = Math.sqrt(disc);
  return [(-b - sq) / (2 * a), (-b + sq) / (2 * a)].filter(t => t >= 0 && t <= 1);
}

function lerp(p1, p2, t) {
  return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
}

function cutLineWithCircle(points, cx, cy, r) {
  // Splits a polyline into sub-polylines, removing any portion inside the circle
  const results = [];
  let current = [];

  for (let i = 0; i < points.length; i++) {
    const p  = points[i];
    const inside = ptInCircle(p, cx, cy, r);

    if (i === 0) {
      if (!inside) current.push({ ...p });
      continue;
    }

    const prev = points[i - 1];
    const prevInside = ptInCircle(prev, cx, cy, r);
    const ts = segCircleTs(cx, cy, r, prev, p).sort((a, b) => a - b);

    if (!prevInside && !inside) {
      // Both outside — but segment might pass through the circle
      if (ts.length === 2) {
        // Entry then exit: split here
        current.push(lerp(prev, p, ts[0]));
        if (current.length >= 2) results.push(current);
        current = [lerp(prev, p, ts[1]), { ...p }];
      } else {
        current.push({ ...p });
      }
    } else if (!prevInside && inside) {
      // Entering circle: add entry point, close current sub-line
      if (ts.length > 0) current.push(lerp(prev, p, ts[0]));
      if (current.length >= 2) results.push(current);
      current = [];
    } else if (prevInside && !inside) {
      // Exiting circle: start new sub-line from exit point
      if (ts.length > 0) current = [lerp(prev, p, ts[ts.length - 1])];
      current.push({ ...p });
    }
    // prevInside && inside: both inside, do nothing
  }

  if (current.length >= 2) results.push(current);
  return results;
}

// --- Physics ---

function updatePhysics() {
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (b.y > canvas.height + 150) { balls.splice(i, 1); continue; }

    for (let s = 0; s < SUBSTEPS; s++) {
      b.vy += GRAVITY / SUBSTEPS;
      b.vx *= Math.pow(AIR_DRAG, 1 / SUBSTEPS);
      b.vy *= Math.pow(AIR_DRAG, 1 / SUBSTEPS);
      b.x  += b.vx / SUBSTEPS;
      b.y  += b.vy / SUBSTEPS;

      for (const line of lines) {
        for (let j = 0; j < line.length - 1; j++) {
          resolveSegment(b, line[j], line[j + 1]);
        }
      }

      if (b.x - BALL_RADIUS < 0) { b.x = BALL_RADIUS; b.vx = Math.abs(b.vx) * RESTITUTION; }
      if (b.x + BALL_RADIUS > canvas.width) { b.x = canvas.width - BALL_RADIUS; b.vx = -Math.abs(b.vx) * RESTITUTION; }
    }

    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > TRAIL_LEN) b.trail.shift();
  }
}

function resolveSegment(b, p1, p2) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 0.001) return;

  let t = ((b.x - p1.x) * dx + (b.y - p1.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  const cx = p1.x + t * dx, cy = p1.y + t * dy;
  const ox = b.x - cx, oy = b.y - cy;
  const dist = Math.sqrt(ox * ox + oy * oy);

  if (dist < BALL_RADIUS && dist > 0.001) {
    const nx = ox / dist, ny = oy / dist;
    const overlap = BALL_RADIUS - dist;
    b.x += nx * overlap;
    b.y += ny * overlap;

    const vDotN = b.vx * nx + b.vy * ny;
    if (vDotN < 0) {
      const vnx = vDotN * nx, vny = vDotN * ny;
      const vtx = b.vx - vnx, vty = b.vy - vny;
      b.vx = -vnx * RESTITUTION + vtx * ROLL_FRICTION;
      b.vy = -vny * RESTITUTION + vty * ROLL_FRICTION;
    }
  }
}

// --- Rendering ---

function render() {
  ctx.fillStyle = '#0a060a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Trails
  for (const b of balls) {
    if (b.trail.length < 2) continue;
    for (let i = 1; i < b.trail.length; i++) {
      const alpha = (i / b.trail.length) * 0.55;
      const w = BALL_RADIUS * 0.7 * (i / b.trail.length);
      ctx.strokeStyle = `hsla(${b.hue}, 100%, 65%, ${alpha})`;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.trail[i - 1].x, b.trail[i - 1].y);
      ctx.lineTo(b.trail[i].x, b.trail[i].y);
      ctx.stroke();
    }
  }

  // Committed lines
  ctx.save();
  ctx.strokeStyle = '#00eeff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#00eeff';
  ctx.shadowBlur = 7;
  for (const line of lines) {
    if (line.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(line[0].x, line[0].y);
    for (let i = 1; i < line.length; i++) ctx.lineTo(line[i].x, line[i].y);
    ctx.stroke();
  }
  ctx.restore();

  // In-progress line
  if (currentLine.length > 1) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,238,255,0.5)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#00eeff';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(currentLine[0].x, currentLine[0].y);
    for (let i = 1; i < currentLine.length; i++) ctx.lineTo(currentLine[i].x, currentLine[i].y);
    ctx.stroke();
    ctx.restore();
  }

  // Balls
  for (const b of balls) {
    ctx.save();
    const color = `hsl(${b.hue}, 100%, 65%)`;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = `hsla(${b.hue}, 60%, 92%, 0.7)`;
    ctx.beginPath();
    ctx.arc(b.x - BALL_RADIUS * 0.28, b.y - BALL_RADIUS * 0.28, BALL_RADIUS * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// --- Loop ---

function startLoop() {
  animating = true;
  loop();
}

function loop() {
  if (!animating) return;
  updatePhysics();
  render();
  if (balls.length > 0) {
    requestAnimationFrame(loop);
  } else {
    animating = false;
  }
}

render();
