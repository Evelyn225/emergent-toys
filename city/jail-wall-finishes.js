// World-fixed mortar fades with both projected axes instead of a glyph field.
// The bunk's scratched tally marks remain an intentional part of the scene.
function jailWallFinish(i,u,uStep,z,d,mx,my,L) {
  const footprint=Math.max(Math.abs(uStep),d/projY),row=Math.floor(z/.2);
  const joint=Math.max(coveGroove(u+(row&1)*.2,.4,.014,footprint),coveGroove(z,.2,.014,footprint));
  BG[i]=C(GRAY,2.7+L*.12-Math.min(1,8*joint));
  let ch=' ';if(my===0&&mx>=8&&mx<=13&&z>1&&z<1.4&&Math.abs(u)>8.6&&Math.abs(u)<10.4)ch=fract(Math.abs(u)*9)<.35?'|':z>1.3&&fract(Math.abs(u)*1.8)<.5?'/':' ';
  set(i,ch,ch===' '?0:C(WHITE,L*.8));return true;
}
const JAIL_WALL_PROPS=ROOM_DEFS.jail.props;
ROOM_DEFS.jail.props=r=>{
  const props=JAIL_WALL_PROPS(r);
  // Fit to the real sill/upright/band extents, not the full-height collision
  // slab: the latter leaves artificial gaps beside the round end rods.
  const blockers=props.flatMap(p=>p.jailBars?p.jailBars.parts.map(q=>({box:{...q.box,x:p.x+q.box.x,y:p.y+q.box.y}})):p);
  const layout={...r,def:{...r.def,tier:1},props:[...blockers,{box:boxAt(20.945,7.5,0,1,.76,.055,0,2.32)}]};
  const base=homeWallMoulding(layout,[[0,.10,.025]],false),ceiling=homeWallMoulding(layout,[[2.94,3,.025]],true);
  for(const o of base){o.jailSkirting=o.homeSkirting;delete o.homeSkirting;}
  for(const o of ceiling){o.jailCeilingTrim=o.homeCornice;delete o.homeCornice;}
  return [...props,...base,...ceiling];
};
ROOM_DEFS.jail.wall=jailWallFinish;
