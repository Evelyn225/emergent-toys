// Doom-style heat transport: hot fuel feeds the bottom, heat rises, drifts and
// diffuses into cold air. A fixed clock keeps motion independent of frame rate.
// No game RNG is consumed; each fire has its own bounded, reproducible field.
const CITY_FIRE_GRID={width:40,height:52,hz:24},cityFireFields=new Map();
function cityFireNoise(x,y,seed){
  let n=(Math.imul(x,374761393)^Math.imul(y,668265263)^seed)|0;
  n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
}
function cityFireRead(field,x,y){
  const {width:w,height:h}=CITY_FIRE_GRID;
  if(x<0||x>w-1||y<0||y>h-1)return 0;
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,b=iy*w+ix;
  const a=field[b],c=ix+1<w?field[b+1]:0,d=iy+1<h?field[b+w]:0,e=ix+1<w&&iy+1<h?field[b+w+1]:0;
  return (a+(c-a)*fx)*(1-fy)+(d+(e-d)*fx)*fy;
}
function stepCityFireField(f,tick){
  const {width:w,height:h,hz}=CITY_FIRE_GRID,from=f.heat,to=f.next,time=tick/hz,s=f.seed;
  const gust=Math.sin(time*.83+s*.001)*.38+Math.sin(time*1.47+s*.003)*.23;
  for(let y=0;y<h;y++){
    const v=y/(h-1),curl=Math.sin(v*8-time*2.1+s*.002)*.5*v+Math.sin(v*15-time*3.2)*.18*v;
    for(let x=0;x<w;x++){
      const u=(x/(w-1)-.5)*2;
      if(y<2){
        const pulse=cityFireNoise(Math.floor(x/3),Math.floor(tick/3),s),fuel=Math.max(0,1-(u/.62)**4);
        to[y*w+x]=fuel*(.65+pulse*.65);continue;
      }
      const spread=u*.35*Math.max(0,1-v*2),sx=x-gust-curl-spread,sy=y-1.9;
      const heat=cityFireRead(from,sx,sy)*.64+(cityFireRead(from,sx-.85,sy)+cityFireRead(from,sx+.85,sy))*.18;
      // Cool coherent pockets of air, rather than making unrelated pixels blink.
      const air=cityFireNoise(Math.floor(x/3),Math.floor((y-tick*1.9)/4),s^7391);
      to[y*w+x]=Math.max(0,heat-.016-air*.025-Math.max(0,v-.5)*.055);
    }
  }
  f.heat=to;f.next=from;f.tick=tick;
  let core=0;for(let x=12;x<28;x++)core+=to[w*3+x];
  f.glow+=(clamp(core/16,.5,1.15)-f.glow)*.12;
}
function cityFlameFrame(seed,time){
  const key=Math.round(seed*65536),tick=Math.floor(time*CITY_FIRE_GRID.hz);let f=cityFireFields.get(key);
  if(!f){
    if(cityFireFields.size>=64)cityFireFields.delete(cityFireFields.keys().next().value);
    const count=CITY_FIRE_GRID.width*CITY_FIRE_GRID.height;
    f={seed:key,heat:new Float32Array(count),next:new Float32Array(count),tick:tick-60,glow:.8};cityFireFields.set(key,f);
  }
  if(tick<f.tick||tick-f.tick>60){f.heat.fill(0);f.next.fill(0);f.tick=tick-60;f.glow=.8;}
  for(let step=f.tick+1;step<=tick;step++)stepCityFireField(f,step);
  return f;
}
function cityFlameSample(frame,u,v){
  if(v<0||v>=1||Math.abs(u)>=1)return 0;
  const heat=cityFireRead(frame.heat,(u*.5+.5)*(CITY_FIRE_GRID.width-1),v*(CITY_FIRE_GRID.height-1));
  // Lose the last trace of heat before the field boundary, avoiding flat tops.
  return heat*Math.min(1,(1-v)/.1);
}
function cityFlameHeat(u,v,seed,time){return cityFlameSample(cityFlameFrame(seed,time),u,v);}
