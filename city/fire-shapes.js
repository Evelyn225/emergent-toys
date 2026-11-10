// A continuous flame silhouette, sampled by the city's normal depth-tested
// sprite renderer. Broad overlapping roots flare out, then curl into tapered
// tips; coherent motion avoids the old cylinders and per-pixel static.
function cityFlameHeat(u,v,seed,time){
  if(v<0||v>1||Math.abs(u)>1)return 0;
  let heat=0;
  for(let j=0;j<5;j++){
    const phase=seed*.73+j*2.37,speed=2.3+j*.31;
    const height=.67+.16*Math.sin(phase+time*speed)+.13*Math.cos(phase*.8-time*1.7);
    if(v>height)continue;
    const t=v/height,root=(j-2)*.27;
    const curl=Math.sin(phase+time*2.2-t*4)*.16*t*t;
    const center=root*(.75+.55*Math.sin(t*Math.PI))+curl;
    const width=(.27+.12*Math.sin(t*Math.PI))*(1-t)**.66;
    const edge=Math.abs(u-center)/Math.max(.001,width);
    if(edge<1)heat=Math.max(heat,(1-edge*edge)*(1-t*.6));
  }
  return heat;
}
