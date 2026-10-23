'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');

// counts of each role in a sprite, by name
const COUNT=`(spr=>{const n={};for(const k of spr)if(k){const name=Object.keys(FR).find(r=>FR[r]===k);n[name]=(n[name]||0)+1;}return n;})`;

test('close-up afro hair has no holes beside the face from front and oblique views',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const body=figBody(figLook({hair:'afro'}),'stand'),head=body.parts[body.face[0]],out=[];
    for(const S of [1,2,4])for(const view of [0,1,15]) {
      const spr=figRaster(body,view,S),W=FIG_W*S;let holes=0,eyes=0;
      for(let r=Math.ceil((FIG_H-head.c[2]-3)*S);r<(FIG_H-head.c[2]+1)*S;r++) {
        const row=Array.from(spr.slice(r*W,(r+1)*W)),lo=row.findIndex(Boolean),hi=row.findLastIndex(Boolean);
        if(lo>=0)for(let c=lo;c<=hi;c++)if(!row[c])holes++;
      }
      for(const k of spr)if(k===FR.EYE)eyes++;
      out.push({S,view,holes,eyes});
    }
    return out;
  })())`));
  for(const q of r){assert.equal(q.holes,0,JSON.stringify(q));assert.ok(q.eyes>0,JSON.stringify(q));}
});

test('a face has two eyes a pixel each, and from behind there is none: hair over the head and back pockets instead',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const count=${COUNT},out=[];
    for(const hair of Object.keys(figHair))for(const bot of ['pants','shorts','skirt']) {
      const look=figLook({hair,top:'tee',bot});
      out.push({hair,bot,front:count(figSprite(look,0,'stand')),back:count(figSprite(look,8,'stand')),side:count(figSprite(look,4,'stand'))});
    }
    return out;
  })())`));
  for(const v of r) {
    assert.equal(v.front.EYE,2,JSON.stringify(v));
    assert.equal(v.side.EYE,1,JSON.stringify(v));
    assert.equal(v.back.EYE,undefined,JSON.stringify(v));
    if(v.hair!=='bald')assert.ok(v.back.HAIR>(v.front.HAIR||0),JSON.stringify(v));
    assert.equal(v.back.POCKET,v.bot==='skirt'?undefined:2,JSON.stringify(v));
    assert.equal(v.front.POCKET,undefined,JSON.stringify(v));
  }
});

test('police and guards read as uniforms: cap badge and chest badge on the front, not the back; the cop carries a holster',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const count=${COUNT};
    return {cop:[0,8].map(v=>count(figSprite(figCopLook(1),v,'stand'))),guard:[0,8].map(v=>count(figSprite(figGuardLook(1),v,'stand'))),
            civ:count(figSprite(figStreetLook(5,BLUE,BLUE,1),0,'stand'))};
  })())`));
  for(const who of ['cop','guard']) {
    const [front,back]=r[who];
    assert.equal(front.CAPBADGE,1,who);assert.equal(front.BADGE,1,who);assert.ok(front.HAT>10,who);
    assert.equal(back.CAPBADGE,undefined,who);assert.equal(back.BADGE,undefined,who);
  }
  assert.ok(r.cop[1].BELT>r.cop[0].BELT,'the holster shows from behind');
  assert.equal(r.civ.BADGE,undefined);assert.equal(r.civ.CAPBADGE,undefined);
});

test("which side of someone you see agrees with the pickpocket rule: their back exactly when you're behind them",()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const bad=[];
    for(let k=0;k<64;k++)for(let j=0;j<64;j++) {
      const fa=k/64*Math.PI*2,ca=j/64*Math.PI*2+0.013,fx=Math.cos(fa),fy=Math.sin(fa),rx=Math.cos(ca),ry=Math.sin(ca); // (rx, ry): them from you
      const behind=fx*-rx+fy*-ry<0,v=figView(rx,ry,fx,fy),backView=v>FIG_VIEWS/4&&v<FIG_VIEWS*3/4;
      if(Math.abs(fx*-rx+fy*-ry)>0.2&&behind!==backView)bad.push([k,j,v]);
    }
    return {bad,still:figView(0.3,0.1,0,0),front:figView(0,0.3,0,-1),back:figView(0,0.3,0,1)};
  })())`));
  assert.deepEqual(r.bad,[]);
  assert.equal(r.still,0,'someone without a heading faces you');
  assert.equal(r.front,0);assert.equal(r.back,8);
});

test('detail pixels drop out once a pixel is smaller than a cell, and a mostly empty cell stays see-through',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const spr=figSprite(figLook({}),0,'stand'),eye=spr.indexOf(FR.EYE),c=eye%FIG_W,row=Math.floor(eye/FIG_W),pz=FIG_H-row-0.5;
    return {near:figSample(spr,c+0.5,pz,0.9,0.9),mid:figSample(spr,c+0.5,pz,1.2,1.2),air:figSample(spr,0.5,FIG_H-0.5,3,3),
            body:figSample(spr,FIG_W/2,10,3,3)};
  })())`));
  assert.equal(r.near,ev('FR.EYE'));assert.equal(r.mid,ev('FR.SKIN'));
  assert.equal(r.air,0);assert.notEqual(r.body,0);
});

test('every pose builds on a sprite the body fits inside, standing feet on the floor',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const look=figDancerLook(1,MAG),out={};
    for(const key of ['stand','fold','ease','wave','sing','reach','grass','sit7','sitfold9','walk0','walk3','run5','dance0','dance1','dance2','dance3']) {
      const rows=[],cols=[];
      for(const v of [0,4,8,12]){const s=figSprite(look,v,key);s.forEach((k,i)=>{if(k){rows.push(Math.floor(i/FIG_W));cols.push(i%FIG_W);}});}
      out[key]={top:Math.min(...rows),bottom:Math.max(...rows),left:Math.min(...cols),right:Math.max(...cols)};
    }
    return out;
  })())`));
  for(const [key,b] of Object.entries(r)) {
    assert.ok(b.top>0,`${key} clipped at the top: ${JSON.stringify(b)}`);
    if(key!=='dance1')assert.equal(b.bottom,ev('FIG_H')-1,`${key} stands on the floor`);
    assert.ok(b.left>0&&b.right<ev('FIG_W')-1,`${key} clipped at a side: ${JSON.stringify(b)}`);
  }
  assert.ok(r.dance1.bottom<ev('FIG_H')-2,'the spin is off the floor');
});

test('up close a face is cast finer: an eye each, brows, a mouth; far off, as before',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const count=${COUNT},look=figLook({hair:'short',top:'tee',bot:'pants'});
    return {near:count(figSprite(look,0,'stand',4)),far:count(figSprite(look,0,'stand')),back:count(figSprite(look,8,'stand',4)),S:figSprite(look,0,'stand',4).S,len:figSprite(look,0,'stand',4).length};
  })())`));
  assert.equal(r.S,4); assert.equal(r.len,ev('FIG_W*FIG_H*16'));
  assert.equal(r.near.EYE,2,'an eye each'); assert.ok(r.near.MOUTH>0,'a mouth');
  assert.equal(r.far.MOUTH,undefined,'far off, no room for it'); assert.equal(r.far.EYE,2);
  assert.equal(r.back.MOUTH,undefined,'and none of it from behind');
});

test('the police shooting back stand with both arms out on a pistol; somebody shot lies flat and stays there',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const count=${COUNT},cop=figCopLook(3),side=count(figSprite(cop,4,'aim')),bounds=key=>{const rows=[];figSprite(cop,4,key).forEach((k,i)=>{if(k)rows.push(Math.floor(i/FIG_W));});return [Math.min(...rows),Math.max(...rows)];};
    return {side,stand:count(figSprite(cop,4,'stand')),aim:bounds('aim'),dead:bounds('dead'),pose:downPose({t:5,dur:Infinity})};
  })())`));
  assert.ok(r.side.MIC>0,'the pistol shows from the side'); assert.equal(r.stand.MIC,undefined,'and only while aiming');
  assert.equal(r.aim[1],ev('FIG_H')-1,'feet on the floor');
  assert.equal(r.pose,'dead');
  assert.ok(r.dead[1]-r.dead[0]<8,`flat on the ground: rows ${r.dead}`);
});

test('dead figures have a complete horizontal silhouette in every view and sit above the floor',()=>{
 const {ev}=loadCity();
 const result=JSON.parse(ev(`JSON.stringify((()=>{
  const b=figBody(figLook({top:'tee',bot:'pants'}),'dead'),support=(p,v)=>p.k===2?p.r:p.k===1?p.ax.reduce((n,ax,k)=>n+Math.abs(fDot(ax,v))*p.h[k],0):Math.hypot(...p.ax.map((ax,k)=>fDot(ax,v)*p.r[k]));
  const extent=v=>{let lo=Infinity,hi=-Infinity;for(const p of b.parts){const a=fDot(p.k===2?p.a:p.c,v),c=fDot(p.k===2?p.b:p.c,v),r=support(p,v);lo=Math.min(lo,a-r,c-r);hi=Math.max(hi,a+r,c+r);}return [lo,hi];};
  return {z:extent([0,0,1]),sides:Array.from({length:FIG_VIEWS},(_,k)=>extent([Math.sin(k*TAU/FIG_VIEWS),Math.cos(k*TAU/FIG_VIEWS),0]))};
 })())`));
 assert.ok(result.z[0]>=0 && result.z[1]<10,JSON.stringify(result));
 assert.ok(result.sides.every(([lo,hi])=>lo> -14.5&&hi<14.5),'the lying figure fits the sprite without cropping its head or feet');
 assert.ok(result.sides[0][1]-result.sides[0][0]>24,'the full standing height is laid along the ground');
});
