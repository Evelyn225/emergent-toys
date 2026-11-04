// Short physical aftermath, with independent rider and board momentum. The
// rider stays where the tumble ends; push lets you get up after the first beat.
function skateBailStart() {
  const velocity = SKB.v.slice(), speed = Math.hypot(...velocity);
  SK.bailData = { t0: T, velocity: velocity.map(v => v * .6),
    board: [px, py, skateGround(px, py) + body.z / 10 + .012],
    boardV: [velocity[0] * 1.15, velocity[1] * 1.15, Math.max(.1, velocity[2] * .3)],
    yaw: a, roll: 0, spin: 5 + speed * 6, speed };
}
function stepSkateBail(dt) {
  const B = SK.bailData;
  if (B) {
    const x = px, y = py;
    move(B.velocity[0] * dt, B.velocity[1] * dt);
    const damp = Math.exp(-dt * (skateAir() ? .6 : 4));
    B.velocity[0] *= damp; B.velocity[1] *= damp;
    if (Math.hypot(rel(px - x), rel(py - y)) < Math.hypot(B.velocity[0], B.velocity[1]) * dt * .5) B.velocity[0] = B.velocity[1] = 0;
    const nextX = worldCoord(B.board[0] + B.boardV[0] * dt), nextY = worldCoord(B.board[1] + B.boardV[1] * dt);
    const blocked = typeof solidAt === 'function' && (solidAt(nextX, nextY, .008, B.board[2]) || architectureBlocked(nextX, nextY, .008));
    if (blocked) { B.boardV[0] *= -.25; B.boardV[1] *= -.25; }
    else { B.board[0] = nextX; B.board[1] = nextY; }
    B.boardV[2] -= .98 * dt; B.board[2] += B.boardV[2] * dt;
    const ground = skateGround(B.board[0], B.board[1]) + .008;
    if (B.board[2] < ground) {
      B.board[2] = ground; B.boardV[2] = Math.abs(B.boardV[2]) * .25;
      B.boardV[0] *= Math.exp(-dt * 7); B.boardV[1] *= Math.exp(-dt * 7);
    }
    B.roll += B.spin * dt; B.yaw += B.spin * dt * .2; B.spin *= Math.exp(-dt * 2.5);
    SK.bailAt = [px, py, SK.dir, a];
  }
  SK.bail = Math.max(0, SK.bail - dt);
  if (B && T - B.t0 > .25 && (K.KeyW || SK_INPUT.push)) SK.bail = 0;
  SK.v = 0; body.mx = body.my = 0;
  if (!SK.bail) { SK.bailAt = null; SK.bailData = null; a = SK.dir; }
  skateBoardSync();
}
function skateBailDraw() {
  const B = SK.bailData, [x, y, dir, ang] = SK.bailAt, ground = skateGround(x, y);
  if (B) drawSkateBoard(...R(B.board[0], B.board[1]), B.board[2], B.yaw, 0, B.roll);
  const age = B ? T - B.t0 : 0, recovering = SK.bail < .3;
  const pose = recovering ? 'crouch' : age < .3 ? 'down' : 'sprawl';
  drawSkaterFigure(...R(x, y), ground, SB.rider, Math.cos(dir), Math.sin(dir), skaterLook(), pose);
}
