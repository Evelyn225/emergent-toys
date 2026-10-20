// Reused canvas surfaces work with both presenters. No pixel readbacks and no work while sober.
let drugVisionCanvas=null, drugVisionTrail=null, drugVisionTrailReady=false;
function drawDrugVision() {
  const amount=clamp(Number(settings.tripVisuals) || 0,0,1);
  const weed=drugVisualStrength('weed')*amount, neon=drugVisualStrength('neon')*amount;
  if (freecam || (!weed && !neon)) {drugVisionTrailReady=false;return;}
  drugVisionCanvas ||= document.createElement('canvas');
  drugVisionTrail ||= document.createElement('canvas');
  const source=drugVisionCanvas, trail=drugVisionTrail, w=cv.width,h=cv.height;
  if (source.width!==w || source.height!==h) {
    source.width=trail.width=w;source.height=trail.height=h;drugVisionTrailReady=false;
  }
  const ctx=source.getContext('2d'), memory=trail.getContext('2d');
  ctx.save();
  const hue=neon*(Math.sin(T*.32)*150+Math.sin(T*.11)*55)+weed*12;
  ctx.filter=`hue-rotate(${hue}deg) saturate(${1+neon*1.4+weed*.35})`;
  ctx.drawImage(frameCanvas(),0,0);ctx.restore();
  g.save();g.fillStyle='#000';g.fillRect(0,0,w,h);
  const breathe=1+weed*(.018+.012*Math.sin(T*.8))+neon*.012;
  g.translate(w/2,h/2);g.scale(breathe,breathe);g.translate(-w/2,-h/2);
  // Smooth horizontal ribbons bend independently; overscan keeps their edges out of view.
  const strip=12, pad=26*(weed+neon);
  for (let y=0;y<h;y+=strip) {
    const sh=Math.min(strip,h-y), v=y/h;
    const shift=weed*Math.sin(v*5+T*.8)*8+neon*Math.sin(v*13-T*1.5)*17;
    const stretch=neon*Math.sin(v*8+T*.9)*.035;
    g.drawImage(source,0,y,w,sh,shift-pad-w*stretch/2,y,w+pad*2+w*stretch,sh);
  }
  if (neon && drugVisionTrailReady) {
    g.globalCompositeOperation='screen';g.globalAlpha=.3*neon;
    g.drawImage(trail,Math.sin(T*.9)*9,Math.cos(T*.7)*4,w,h);
    g.globalAlpha=.16*neon;g.drawImage(source,-8*neon,0,w,h);
  }
  g.restore();
  if (weed) {
    g.save();const glow=g.createRadialGradient(w*.5,h*.5,h*.1,w*.5,h*.5,w*.65);
    glow.addColorStop(0,'rgba(152,190,68,0)');glow.addColorStop(1,`rgba(116,153,35,${weed*.18})`);
    g.fillStyle=glow;g.fillRect(0,0,w,h);g.restore();
  }
  if (neon) {
    // A decaying history, rather than an extra copy of this frame, leaves moving objects with trails.
    if (!drugVisionTrailReady) memory.clearRect(0,0,w,h);
    memory.globalAlpha=drugVisionTrailReady ? .24 : 1;
    memory.drawImage(source,0,0);memory.globalAlpha=1;drugVisionTrailReady=true;
  } else drugVisionTrailReady=false;
}
