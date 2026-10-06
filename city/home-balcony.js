// French doors connect the room's metre coordinates to a balcony in the actual city, on its east facade.
// Outdoors uses roof mode: the normal world renderer, weather, actors, sound and falling physics all apply.
const homeBalconyActive = () => mode === 'roof' && room?.kind === 'bellehome' && !!room.balconyWorld;
function enterHomeBalcony() {
  const home = homeRecord(), b = homeBalconyBounds(home);
  if (!b) return false;
  room.balconyWorld = b;
  px = b.x0 + (px - 19) / 10; py = b.y + (py - 10) / 10;
  mode = 'roof'; roofH = b.z; roofLot = new Set();
  body.mx = (body.mx || 0) / 10; body.my = (body.my || 0) / 10;
  notePoliceRoofEntry(px,py,room.ret);
  return true;
}
const atHomeBalconyDoor = () => homeBalconyActive() && px < room.balconyWorld.x0 + .2 && Math.abs(py - room.balconyWorld.doorY) < .17;
function leaveHomeBalcony() {
  if (!homeBalconyActive()) return false;
  const b = room.balconyWorld;
  px = 18.7; py = clamp(10 + (py - b.y) * 10,11.3,13.7);
  mode = 'room'; roofH = 0; roofLot = null;
  body.mx = (body.mx || 0) * 10; body.my = (body.my || 0) * 10;
  return true;
}
function stepHomeBalcony(moveX = 0) {
  if (mode === 'room' && room.kind === 'bellehome' && homeRecord() && px >= 19.6 && py >= 3 && py < 17) enterHomeBalcony();
  else if (moveX < 0 && atHomeBalconyDoor() && px < room.balconyWorld.x0 + .08) leaveHomeBalcony();
}
function homeBalconyFree(x, y) {
  const b = room.balconyWorld;
  if (x < b.x0 + .015) return false;
  if (body.z < 1.1 && (x > b.x1 - .035 || y < b.y0 + .035 || y > b.y1 - .035)) return false;
  const rx = 19 + (x - b.x0) * 10, ry = 10 + (y - b.y) * 10;
  if (room.props.some(o => o.box && !o.walk && o.box.x >= 20 && o.box.z0 < 1.2 && inBox(o.box,rx,ry,.2))) return false;
  return roofHeightAt(x,y) <= roofH + ROOF_STEP + body.z / 10;
}
function homeBalconyDoorFacade(i, z, side, mx, my, wc, L, sh) {
  const home = homeAt(sh), b = homeBalconyBounds(home);
  if (!b || side || mx + 1 !== b.x0 || rel(px - mx) < 0 || Math.abs(rel(wc - b.doorY)) > .17 || z < b.z || z > b.z + .29) return false;
  const du = rel(wc - b.doorY), rz = z - b.z;
  const centerPost = Math.abs(du) < .008;
  const frame = Math.abs(du) > .145 || centerPost || rz < .012 || rz > .27 || Math.abs(rz - .11) < .008;
  BG[i] = C(frame ? STONE : CYAN,frame ? 2 + L * .3 : 1.5 + day * 2);
  let ch = ':';
  if (frame) ch = centerPost ? '|' : '=';
  set(i,ch,C(frame ? WHITE : WARM,L * .8));
  return true;
}
const homeBalconyModels = new WeakMap();
function drawHomeBalconies() {
  for (const home of owned.homes) {
    const b = homeBalconyBounds(home);
    if (!b || Math.hypot(rel(b.x0 - px),rel(b.y - py)) > vis + 3) continue;
    const vx = rel(b.x0 + .3 - px), vy = rel(b.y - py);
    const far = dx * vx + dy * vy + Math.abs(dx) * .31 + Math.abs(dy) * .71;
    const edge = Math.abs(-dy * vx + dx * vy) - Math.abs(dy) * .31 - Math.abs(dx) * .71;
    if (far < .02 || edge > far * tf) continue;
    let model = homeBalconyModels.get(home);
    if (!model) {
      model = makeRoom('bellehome',{ cell: [home.cell % N,Math.floor(home.cell / N)] }).props.filter(o => {
        const p = o.box || o;
        return p.x >= 20 && p.y >= 3 && p.y < 17;
      });
      homeBalconyModels.set(home,model);
    }
    const masonry = (i,t,L) => {
      BG[i] = C(STONE,2 + L * .3); set(i,'=',C(WHITE,L));
      if (HIT.face === 5) paintSettledSnow(i,b.x0 + .3 + HIT.u,b.y + HIT.v,L);
      return true;
    };
    drawBox(boxAt(rel(b.x0 + .3 - px),rel(b.y - py),1,0,.3,.7,b.z - .025,b.z),masonry);
    const rail = (i,t,L) => {
      const along = HIT.face <= 2 ? HIT.v : HIT.u;
      if (HIT.w > b.z + .095 || HIT.w < b.z + .012 || Math.abs(fract(along * 27) - .5) < .13) {
        BG[i] = C(GRAY,1); set(i,HIT.w > b.z + .095 ? '=' : '|',C(GRAY,L)); return true;
      }
      return false;
    };
    drawBox(boxAt(rel(b.x1 - px),rel(b.y - py),1,0,.01,.7,b.z,b.z + .11),rail);
    for (const y of [b.y0,b.y1]) drawBox(boxAt(rel(b.x0 + .3 - px),rel(y - py),1,0,.3,.01,b.z,b.z + .11),rail);
    for (const o of model) {
      const p = o.box || o, x = b.x0 + (p.x - 19) / 10, y = b.y + (p.y - 10) / 10;
      if (o.box) {
        const q = o.box;
        drawBox(boxAt(rel(x - px),rel(y - py),q.c,q.s,q.hl / 10,q.hw / 10,b.z + q.z0 / 10,b.z + q.z1 / 10),(i,t,L) => {
          HIT.u *= 10; HIT.v *= 10; HIT.w = (HIT.w - b.z) * 10;
          return o.shade(i,t * 10,L);
        });
      } else if (o.art) drawArt(rel(x - px),rel(y - py),b.z + (o.z || 0) / 10,o.w / 10,o.h / 10,typeof o.art === 'function' ? o.art() : o.art,o.col);
    }
  }
}
