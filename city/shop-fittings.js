// Small shop fittings shared between rooms: a stack of binders or books lying
// flat, and a rug on the floor.
// A stack lying flat at z: each [hl, hw, thickness, colour], bottom first,
// each resting on the one beneath, the spines along u (c, s).
function BOOK_STACK(x,y,z,books,c=1,s=0) {
  const tops=[];let h=z;for(const b of books){tops.push(h);h+=b[2];}
  const cover=col=>(i,t,L)=>{const edge=HIT.face!==5&&HIT.face!==6&&Math.abs(HIT.nz)<.5&&(HIT.face===1||HIT.face===2);
    BG[i]=C(edge?WHITE:col,(edge?3.2:2.2)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const hl=Math.max(...books.map(b=>b[0])),hw=Math.max(...books.map(b=>b[1]));
  return {...ROOM_MODEL(x,y,(vx,vy)=>books.forEach((b,k)=>coveRound(vx,vy,c,s,b[0],b[1],tops[k],tops[k]+b[2],.004,cover(b[3])))),
    box:boxAt(x,y,c,s,hl,hw,z,h),radius:Math.hypot(hl,hw),bookStack:{z,top:h,tops}};
}
// A rug on the floor, a border round it: (u, v) from its centre to shade(e, u, v) by e, the distance in from its edge.
function FLOOR_RUG(x,y,hl,hw,field,border,c=1,s=0) {
  const shade=(i,t,L)=>{const e=Math.min(hl-Math.abs(HIT.u),hw-Math.abs(HIT.v));
    BG[i]=C(e<.12?border:field,e<.12?3:1.6+L*.2);return set(i,e>.12&&fract((HIT.u+HIT.v)*3)<.15?'+':' ',C(border,7)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>drawBox(boxAt(vx,vy,c,s,hl,hw,0,.012),gondolaFlat(c,s,shade))),rug:true};
}
