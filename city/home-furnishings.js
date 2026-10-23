// Bounded, renderer-independent home contents and photograph save data.
const HOME_FURNITURE={
  f_chair:{name:'timber dining chair',price:45,hx:.29,hy:.32,height:1.05,seat:.45},
  f_table:{name:'oak dining table',price:120,hx:.95,hy:.5,height:.8},
  f_sofa:{name:'soft two-seat sofa',price:240,hx:1.2,hy:.46,height:.95,seat:.45},
  f_lamp:{name:'shaded floor lamp',price:65,hx:.24,hy:.24,height:1.75,fixture:'lamp'},
  f_recordplayer:{name:'record player with cabinet and record',price:180,hx:.55,hy:.35,height:1.1,fixture:'record'},
  f_frame:{name:'oak photograph frame',price:25,hx:.4,hy:.035,height:.6,wall:true,fixture:'photo'},
  f_rug:{name:'woven blue rug',price:40,hx:1.3,hy:.9,height:.014,rug:true},
  f_plant:{name:'potted palm',price:35,hx:.25,hy:.25,height:1.6},
  sharkplush:{name:'plush shark',price:15,hx:.24,hy:.48,height:.35,plush:true},
};
for(const [id,d]of Object.entries(HOME_FURNITURE))if(!ITEMS[id])ITEMS[id]={name:d.name+' flatpack',price:d.price,kind:'gear',furniture:true};
ITEMS.camera={name:'compact camera',price:120,kind:'gear'};
STOCK_WORD.IDEA=[...Object.keys(HOME_FURNITURE),'camera','vinyl'];
STOCK_WORD.RECORDS.push('f_recordplayer');STOCK_WORD.PAWN.push('camera');
let homePhotos={next:1,photos:[]};
function restoreHomePhotos(raw) {
  const photos=[];
  for(const p of (Array.isArray(raw?.photos)?raw.photos:[]).slice(0,8)) {
    if(!Number.isInteger(p.id)||p.id<1||p.w!==48||p.h!==28||typeof p.chars!=='string'||Array.from(p.chars).length!==1344||!Array.isArray(p.fg)||!Array.isArray(p.bg)||p.fg.length!==1344||p.bg.length!==1344)continue;
    if(![...p.fg,...p.bg].every(c=>Number.isInteger(c)&&c>=0&&c<=255)||photos.some(q=>q.id===p.id))continue;
    photos.push({id:p.id,w:48,h:28,chars:p.chars,fg:p.fg.slice(),bg:p.bg.slice(),title:String(p.title||'Photograph').slice(0,64)});
  }
  return {next:Math.max(1,Number.isInteger(raw?.next)&&raw.next<1e9?raw.next:1,...photos.map(p=>p.id+1)),photos};
}
function restoreHomeFurnishings(raw,kind) {
  const size=HOME_ROOM_SIZE[kind]||HOME_ROOM_SIZE.home_studio,parts=[];
  for(const p of (Array.isArray(raw?.parts)?raw.parts:[]).slice(0,48)) {
    if(!HOME_FURNITURE[p.id]||!Number.isInteger(p.key)||p.key<1||parts.some(q=>q.key===p.key)||![p.x,p.y,p.a].every(Number.isFinite)||p.x<1||p.x>size[0]-1||p.y<1||p.y>size[1]-1)continue;
    const d=HOME_FURNITURE[p.id];
    parts.push({key:p.key,id:p.id,x:p.x,y:p.y,a:mod(p.a,TAU),z:d.wall?clamp(+p.z||1.6,.4,4):d.plush?clamp(+p.z||0,0,2):0,on:p.on!==false,track:clamp(Math.floor(+p.track||0),0,2),photo:Number.isInteger(p.photo)?p.photo:0});
  }
  return {next:Math.max(1,Number.isInteger(raw?.next)&&raw.next<1e9?raw.next:1,...parts.map(p=>p.key+1)),parts};
}
function homeFurnishings(home){return home.furnishings||(home.furnishings={next:1,parts:[]});}
function furnishingItemState(it){return HOME_FURNITURE[it.id]&&it.furnishing?{furnishing:{on:it.furnishing.on!==false,track:clamp(Math.floor(+it.furnishing.track||0),0,2),photo:Math.max(0,Math.floor(+it.furnishing.photo||0))}}:{};}
function furnishingBox(p) {
  const d=HOME_FURNITURE[p.id],base=d.plush?p.z||0:0;return {x:p.x,y:p.y,c:Math.cos(p.a),s:Math.sin(p.a),hl:d.hx,hw:d.hy,z0:d.wall?p.z-d.height/2:base,z1:d.wall?p.z+d.height/2:base+d.height};
}
function furnishingOverlap(a,b,pad=0) {
  for(const [nx,ny]of [[a.c,a.s],[-a.s,a.c],[b.c,b.s],[-b.s,b.c]]) {
    const ra=a.hl*Math.abs(a.c*nx+a.s*ny)+a.hw*Math.abs(-a.s*nx+a.c*ny),rb=b.hl*Math.abs(b.c*nx+b.s*ny)+b.hw*Math.abs(-b.s*nx+b.c*ny);
    if(Math.abs((b.x-a.x)*nx+(b.y-a.y)*ny)>=ra+rb+pad-1e-5)return false;
  }
  return true;
}
function furnishingFit(p,grid,obstacles) {
  const d=HOME_FURNITURE[p.id],b=furnishingBox(p),W=grid[0].length,H=grid.length;
  const hx=Math.abs(b.c)*b.hl+Math.abs(b.s)*b.hw,hy=Math.abs(b.s)*b.hl+Math.abs(b.c)*b.hw;
  for(let y=Math.floor(b.y-hy);y<=Math.floor(b.y+hy);y++)for(let x=Math.floor(b.x-hx);x<=Math.floor(b.x+hx);x++) {
    const cell=grid[y]?.[x];if(cell==='.'||!furnishingOverlap(b,{x:x+.5,y:y+.5,c:1,s:0,hl:.5,hw:.5}))continue;
    return cell==='D'?'Keep the doorway clear.':'The furniture crosses a wall.';
  }
  if(p.x-hx<1-1e-5||p.x+hx>W-1+1e-5||p.y-hy<1-1e-5||p.y+hy>H-1+1e-5)return 'Keep the furniture inside the room.';
  if(!d.rug)for(const o of obstacles)if(o.box&&!o.walk&&!(p.key!=null&&o.furnishingKey===p.key)&&b.z0<o.box.z1-.01&&b.z1>o.box.z0+.01&&furnishingOverlap(b,o.box,.025))return 'Leave the other furniture clear.';
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(grid[y][x]==='D'&&!d.rug&&furnishingOverlap(b,{x:x+.5,y:y+.5,c:1,s:0,hl:1,hw:1}))return 'Leave room to reach the door.';
  return '';
}
