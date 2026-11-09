// Small walk-in places, authored on the completed map. Routeable entries and
// visible geometry share the same data; no changes to shops or saved addresses.
const QUIET_PLACES=[];
function quietPlaceBlocked(x,y,pad=.03,feet=0){
 for(const s of QUIET_PLACES){
  if(Math.abs(rel(x-s.x))>s.radius+pad||Math.abs(rel(y-s.y))>s.radius+pad)continue;
  for(const p of s.parts){
   if(!p.block||feet>=p.z1-.004||feet+.17<=p.z0)continue;
   const dx=rel(x-p.x),dy=rel(y-p.y);
   if(Math.abs(dx*p.c+dy*p.s)<p.hl+pad&&Math.abs(-dx*p.s+dy*p.c)<p.hw+pad)return true;
  }
 }return false;
}
function quietPlaceGround(x,y){
 let h=0;
 for(const s of QUIET_PLACES)if(s.type!=='roof'&&Math.abs(x-s.x)<=s.halfX&&Math.abs(y-s.y)<=s.halfY)h=Math.max(h,s.base,quietPlaceSurfaceHeight(x,y,s));
 return h;
}
function quietPlaceTargets(){
 const out=[];
 for(const s of QUIET_PLACES){
  if(near(px,py,s.x,s.y)>s.radius+1)continue;
  for(const t of s.targets)if(!t.when||t.when())out.push({...t,site:s,x:s.x+t.u,y:s.y+t.v,z0:s.base+t.z0,z1:s.base+t.z1});
 }return out;
}
function quietPlaceUse(t){
 if(t.action==='pump'){
  t.site.flowUntil=T+18;
  say('The handle resists, then gives. Water rattles up the pipe and spills into the stone trough. Someone has left a brush beside the drain.',5);
 }else say(typeof t.text==='function'?t.text():t.text,7);
}

function quietPlaceOccludes(x,y,z){
 for(const s of QUIET_PLACES){
  if(Math.abs(x-s.x)>s.radius||Math.abs(y-s.y)>s.radius)continue;
  for(const p of s.parts)if(p.block&&z>p.z0&&z<p.z1){
   const dx=x-p.x,dy=y-p.y;
   if(Math.abs(dx*p.c+dy*p.s)<p.hl&&Math.abs(-dx*p.s+dy*p.c)<p.hw)return true;
  }
 }return false;
}
// The remaining roof boards shelter their exact footprint; gaps stay open to
// rain and snow, as do the spaces between pergola laths.
function quietPlaceCover(x,y,z=0){
 for(const s of QUIET_PLACES){
  if(near(x,y,s.x,s.y)>s.radius)continue;
  for(const p of s.parts){
   if(!['roof-board','roof-rafter','pergola-lath'].includes(p.role)||z>=p.z0)continue;
   const dx=x-p.x,dy=y-p.y;
   if(Math.abs(dx*p.c+dy*p.s)<=p.hl&&Math.abs(-dx*p.s+dy*p.c)<=p.hw)return true;
  }
 }return false;
}

function quietPlaceSurfaceHeight(x,y,only=null){
 let h=0;
 for(const s of only?[only]:QUIET_PLACES){
  if(Math.abs(x-s.x)>s.radius||Math.abs(y-s.y)>s.radius)continue;
  for(const p of s.parts){
   if(!p.block)continue;
   const dx=x-p.x,dy=y-p.y;
   if(Math.abs(dx*p.c+dy*p.s)<=p.hl&&Math.abs(-dx*p.s+dy*p.c)<=p.hw)h=Math.max(h,p.z1);
  }
 }return h;
}

function quietGardenerHere(){return tod>=8&&tod<18&&rain<.5&&snow<.2;}
