// The record shop, built: LP bins down the middle, two rows of sleeves
// standing in a sunk trough with divider cards between the sections; sleeves
// face-out on ledges across the back wall; the counter, its till and the
// listening station's cabinet. (CDs and tapes are a wall-shelf run.)
const RECORD_BIN={rim:.62,lip:.14,wall:.018,sleeve:.31,pitch:.012,run:.42};
// A bin along y: a timber cabinet with a trough let into its top, the LPs
// stood in it in runs (a run is one solid: every sleeve its own colour across
// the top and ends), a divider card between each run.
function RECORD_BIN_UNIT(x,y,hl,seed) {
  const B=RECORD_BIN,hw=.42,c=0,s=1,inner=hw-B.wall,rows=[-1,1].map(e=>e*inner/2),runs=[],cards=[];
  const len=hl*2-2*B.wall-.02,n=Math.max(1,Math.floor(len/(B.run+.006)));
  const runLen=len/n-.006;
  for(let k=0;k<n;k++){const u=-len/2+(len/n)*(k+.5);
    for(const v of rows)runs.push({u,v,len:runLen,seed:seed*31+k*7+(v>0)});
    if(k)cards.push({u:-len/2+(len/n)*k,letter:'ABCDEFGHJKLMNPRSTW'[(seed*5+k*3)%18]});}
  const flat=shade=>gondolaFlat(c,s,shade);
  const wood=flat((i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,seed));
  const sleeves=r=>flat((i,t,L)=>{ // the edges of the sleeves, one after another along the run
    const j=Math.floor((HIT.u+r.len/2)/B.pitch),col=RECORD_COLS[Math.floor(hash(j,r.seed,72)*RECORD_COLS.length)];
    const edge=coveGroove(HIT.u+r.len/2,B.pitch,.0015,t/projX)*coveDetail(t,.15);
    BG[i]=C(col,1.8+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)-edge*1.2);set(i,' ',0);return true;});
  const card=q=>flat((i,t,L)=>{BG[i]=C(WHITE,3.6+L*.2);
    if((HIT.face===1||HIT.face===2)&&wallText(i,HIT.face===1?-HIT.v:HIT.v,t/projX,HIT.w,t,q.letter,0,B.rim+B.sleeve+.03,.025,.04,C(GRAY,1),BG[i]))return true;
    set(i,' ',0);return true;});
  const runShades=runs.map(sleeves),cardShades=cards.map(card);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const part=(u,v,a,b,z0,z1,shade)=>drawBox(boxAt(vx-s*v+c*u,vy+c*v+s*u,c,s,a,b,z0,z1),shade);
    runs.forEach((r,n)=>part(r.u,r.v,r.len/2,inner/2-.012,B.rim,B.rim+B.sleeve,runShades[n]));
    cards.forEach((q,n)=>part(q.u,0,.002,inner-.01,B.rim,B.rim+B.sleeve+.06,cardShades[n]));
    for(const e of [-1,1]){part(0,e*(hw-B.wall/2),hl,B.wall/2,B.rim,B.rim+B.lip,wood);part(e*(hl-B.wall/2),0,B.wall/2,inner,B.rim,B.rim+B.lip,wood);} // the trough's sides
    coveRound(vx,vy,c,s,hl,hw,.08,B.rim,.012,(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,seed)); // the cabinet
    coveRound(vx,vy,c,s,hl-.04,hw-.05,0,.1,.008,(i,t,L)=>{BG[i]=C(GRAY,.7+L*.05);set(i,' ',0);return true;}); // its plinth
  }),box:boxAt(x,y,c,s,hl,hw,0,B.rim+B.sleeve+.06),radius:Math.hypot(hl,hw),recordBin:{runs,cards,hl,hw,inner}};
}
// Sleeves face-out on narrow ledges across the back wall (its face at y=1).
function RECORD_FACEOUT_WALL(x0,x1,rows=[.4,1.12,1.84]) {
  const B=RECORD_BIN,pitch=.36,ledge=.06,lip=.02,sleeves=[];
  rows.forEach((z,row)=>{for(let u=x0+.03;u+B.sleeve<=x1-.02;u+=pitch)sleeves.push({x:u+B.sleeve/2,z:z+.025,row,h:hash(Math.floor(u/pitch),row,73)});});
  const design=q=>(i,t,L)=>{ // its colour, and a disc, stripes or a block letter on it
    const col=RECORD_COLS[Math.floor(q.h*RECORD_COLS.length)];BG[i]=C(col,2.4+L*.2);
    if(HIT.face!==3){set(i,' ',0);return true;}
    const cx=(HIT.u)/B.sleeve,cz=(HIT.w-q.z)/B.sleeve-.5,ring=Math.hypot(cx,cz);
    if(q.h<.4){if(ring<.3&&ring>.12)BG[i]=C(GRAY,1+L*.1);}
    else if(q.h<.7){if(fract(cz*5)<.3)BG[i]=C(WHITE,4.2+L*.2);}
    else if(wallText(i,HIT.u,t/projX,HIT.w,t,'ABCDEFGHJKLMNPRSTW'[Math.floor(q.h*17)],0,q.z+B.sleeve/2,.12,.16,C(WHITE,4.2+L*.2),BG[i]))return true;
    set(i,' ',0);return true;};
  const shades=sleeves.map(design),wood=(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,0,HIT.face===3?1:0,HIT.face===5?1:0,73);
  const cx=(x0+x1)/2,cy=1+ledge/2,len=x1-x0;
  return {...ROOM_MODEL(cx,cy,(vx,vy)=>{ // (vx,vy: the model's place relative to the eye)
    sleeves.forEach((q,n)=>drawBox(boxAt(vx+q.x-cx,vy+1.008-cy,1,0,B.sleeve/2,.002,q.z,q.z+B.sleeve),shades[n])); // stood on the ledge against the wall
    for(const z of rows){drawBox(boxAt(vx,vy,1,0,len/2,ledge/2,z,z+.025),wood);drawBox(boxAt(vx,vy+ledge/2-.006,1,0,len/2,.006,z+.025,z+.025+lip),wood);} // ledge and lip
  }),box:boxAt(cx,cy,1,0,len/2,ledge/2,rows[0],rows.at(-1)+.025+B.sleeve),radius:len/2+.1,faceOut:{sleeves,rows,ledge,lip}};
}
