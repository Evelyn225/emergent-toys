// The joke stays on the sleeves and in the awkward behaviour. No explicit imagery.
const VIDEO_AFTER_HOURS=['Jurassic Pork','Missionary: Impossible','Raiders of the Lost Pants','The Bare Witch Project','The Big Lebooty','Dude, Where Are My Pants?','Shaving Private Ryan','Honey, I Shrunk the Shorts','Romancing the Bone','Saturday Night Beaver','The Full Monty Python','The Lord of the G-Strings'];
VIDEO_AFTER_HOURS.forEach((title,k)=>{
 const id='vhs_afterhours_'+k;ITEMS[id]={name:'Brown-bag VHS: '+title,price:6,kind:'gear'};
 DENSE[id]=()=>sculpt(24,18,(x,y)=>{
  if(Math.abs(x)>6||y>7||y< -7)return null;
  if(y< -5.4)return Math.abs(x)<4?['\u0001',C(GRAY,1.2)]:null;
  const fold=Math.abs(x)>5||Math.abs(x-y*.15-3)<.3||y< -4.7;
  return ['\u0001',C(WARM,fold?4.5:6.5+(x<0?.6:0))];
 });
});
function videoTitleLines(title){
 const lines=[];for(const word of title.toUpperCase().split(' ')){if(!lines.length||lines[lines.length-1].length+word.length+1>14)lines.push(word);else lines[lines.length-1]+=' '+word;}return lines;
}
function videoSleeves(x,y,c,s,count,first){
 const fy=c,fx=-s,half=count*.2,parts=[],cases=[];
 const add=(u,v,hl,hw,z0,z1,shade)=>{const xx=x+c*u+fx*v,yy=y+s*u+fy*v;parts.push(BX(xx,yy,hl,hw,z0,z1,shade,c,s));};
 const wood=(i,t,L)=>{BG[i]=C(BRICK,(1.7+L*.25)*shadeFace(HIT.face));set(i,' ',0);return true;};
 add(0,-.14,half+.04,.025,0,1.95,wood);
 for(const u of [-half-.025,half+.025])add(u,0,.025,.18,0,1.95,wood);
 for(const z of [.04,.7,1.34,1.94])add(0,0,half+.05,.18,z,z+.04,wood);
 for(let row=0;row<2;row++)for(let k=0;k<count;k++){
  const index=first+row*count+k,title=VIDEO_AFTER_HOURS[index],lines=videoTitleLines(title),letterW=.32/(Math.max(...lines.map(l=>l.length))+1),u=(k-(count-1)/2)*.4,z=.74+row*.64,xx=x+c*u+fx*.08,yy=y+s*u+fy*.08;
  const shade=(i,t,L)=>{
   const cover=HIT.face===3,bar=HIT.w>z+.075&&HIT.w<z+.13;
   const label=cover&&HIT.w>z+.17;
   const pixel=hash(Math.floor((HIT.u+.18)/.045),Math.floor((HIT.w-z)/.04),index+71);
   BG[i]=C(cover?(bar?BLACK:label?WHITE:pixel>.55?SKIN:WARM):GRAY,cover?(bar?1:label?8:3+Math.floor(pixel*4)*1.5+L*.15):1+L*.2);set(i,' ',0);
   if(label){
    const k=Math.floor((z+.32-HIT.w)/.05),line=lines[k],vx=xx+fx*.04-px,vy=yy+fy*.04-py;
    const far=Math.max(.05,dx*vx+dy*vy+Math.abs(dx*c+dy*s)*.18);
    // Never scatter sub-cell title fragments. Nearby, every letter fits; farther away, browse with the full prompt.
    const tc=dx*vx+dy*vy,side=-dy*vx+dx*vy,pixels=letterW*projX*Math.abs((dx*s-dy*c)*tc-side*(dx*c+dy*s))/(far*far);
    if(line&&pixels>=1)set(i,worldText(line,HIT.u,HIT.w,t,i,vx,vy,z+.295-k*.05,c,s,letterW,.045),C(BLACK,1));
   }return true;
  };
  const prop={...BX(xx,yy,.18,.04,z,z+.32,shade,c,s),videoSleeve:index};parts.push(prop);cases.push({kind:'video-rental',index,x:xx+fx*.045,y:yy+fy*.045,z0:z,z1:z+.32,radius:.18,reach:1.5,part:prop});
 }
 return {parts,cases};
}
function videoBackroomProps(r){
 const a=videoSleeves(10,1.15,1,0,4,0),b=videoSleeves(10.85,2.65,0,1,2,8);r.videoRentals=[...a.cases,...b.cases];
 const customer={...figProp(9.7,2.8,figLook({shades:true,top:'jacket',bot:'pants',hair:'part',col:{top:[BRICK,4],bot:[GRAY,2],skin:[SKIN,11],hair:[GRAY,1]}}),{face:[1,0],still:true}),videoCustomer:true};
 r.videoCustomer=customer;
 const lamp=ROOM_MODEL(10,2.3,(vx,vy)=>{rod(vx,vy,3,vx,vy,2.53,.004,GRAY,1);coveRound(vx,vy,1,0,.065,.065,2.4,2.54,.06,(i,t,L)=>{BG[i]=C(RED,10);set(i,' ',0);return true;});});
 return [...a.parts,...b.parts,customer,lamp];
}
let videoMusicNodes=[],videoMusicRoom=null;
function stopVideoTapeMusic(){
 if(!videoMusicNodes.length&&!videoMusicRoom)return;
 for(const node of videoMusicNodes)try{node.stop(actx?.currentTime||0);}catch(e){} // already-ended notes need no further work
 videoMusicNodes=[];if(videoMusicRoom)videoMusicRoom.videoMusicAt=-1;videoMusicRoom=null;
}
function videoBackroomTick(){
 const r=mode==='room'?room:null;if(!r){stopVideoTapeMusic();return;}
 if(videoMusicRoom&&(videoMusicRoom!==r||!r.tv||!r.videoTape))stopVideoTapeMusic();
 if(r.kind==='video'){
  const inside=px>=9&&py<4.5,dt=clamp(T-(r.videoTick??T),0,.1);r.videoTick=T;
  if(inside&&!r.videoSeen){r.videoSeen=true;r.videoExitAt=T+.9;say('The customer freezes. "I’m just… looking for the documentaries."',5);}
  if(r.videoSeen&&!inside&&r.videoInside&&!r.videoRemarked){r.videoRemarked=true;say('The clerk gives you a look. "Find what you were looking for?"',4);}
  r.videoInside=inside;
  const p=r.videoCustomer;
  if(p&&!p.dead&&r.videoExitAt!=null&&T>r.videoExitAt){
   const path=[[9.5,3.7],[9.5,5.2],[8.2,6.2],[6,8.4],[5.5,8.85]],target=path[r.videoExitStep||0];
   if(!target)p.dead=true;else{const dx=target[0]-p.x,dy=target[1]-p.y,d=Math.hypot(dx,dy),step=dt*.75;if(d<=step){[p.x,p.y]=target;r.videoExitStep=(r.videoExitStep||0)+1;}else{p.x+=dx/d*step;p.y+=dy/d*step;}p.face=[1,0];}
  }
 }
 if(r.tv&&r.videoTape&&videoPlayableTape({id:r.videoTape})&&actx&&T>(r.videoMusicAt??-1)){
  r.videoMusicAt=T+(r.videoTape==='vhs'?7:3);const notes=r.videoTape==='vhs'?[164.81,196,246.94,220,196,146.83]:[233.08,277.18,349.23,311.13,233.08];
  videoMusicRoom=r;videoMusicNodes=notes.map((f,k)=>tone(actx.currentTime+.02+k*(r.videoTape==='vhs'?.7:.18),f,r.videoTape==='vhs'?1.2:.34,.035,'triangle')).filter(node=>typeof node?.stop==='function');
 }
}
function videoRentalUse(t){
 if(inv.length>=INV_SIZE)return say('Your bag is full. Make room for one more questionable decision.',3);
 if(!pay(6))return say('The rental is $6. Even artistic research has a budget.',3);
 carryItem({id:'vhs_afterhours_'+t.index,uses:0});saveGame();say('The clerk silently slides you a plain brown bag. "Due back Tuesday."',4);
}
function videoTapeUse(it){
 if(mode!=='room'||!homeRecord(room)||homeSpot()!=='tv')return ['A VHS tape. Take it to your TV at home and press Q nearby.',null];
 if(room.videoTape===it.id&&room.tv){room.videoTape=null;return ['You eject the tape. Back to regular television.','click'];}
 room.videoTape=it.id;room.tv=true;room.videoTapeStart=T;room.videoMusicAt=-1;videoBackroomTick();
 return [it.id==='vhs'?'The tape clicks in. Mist, pines, a waterfall… FIR CREEK.':'The tape clicks in. A sax-like honk. The entire picture says [ CENSORED ].','click'];
}
function videoTapeFrame(id,u,v,time){
 if(id!=='vhs'){
  const bar=v>.34&&v<.66,pixel=hash(Math.floor(u*9),Math.floor(v*6),71);
  return {base:bar?GRAY:pixel>.5?SKIN:WARM,level:bar?1:3+Math.floor(pixel*4)*2,ch:' ',ink:WHITE,label:'[ CENSORED ]'};
 }
 // An original slow rural-mystery title sequence: forest, falls and a sawmill.
 const shot=Math.floor(mod(time,24)/8),mist=Math.sin(u*17+time*.12)*.025;let base=CYAN,level=3,ch=' ',ink=ORANGE;
 if(shot===0){if(v>.38+mist){base=GREEN;level=2;}const tree=fract(u*11+time*.006),crown=.3+hash(Math.floor((u+time*.00055)*11),4,1)*.18;if(v>crown&&Math.abs(tree-.5)<Math.max(0,(v-crown)*.42)){base=GREEN;level=1;}if(v>.76){base=GRAY;level=3;}}
 if(shot===1){base=GREEN;level=2;if(Math.abs(u-.53)<.11+.025*Math.sin(v*8)){base=WHITE;level=6+2*Math.sin(v*35-time*1.5);}if(v>.8){base=CYAN;level=4;}}
 if(shot===2){base=CYAN;level=3;if(v>.55){base=BRICK;level=3;}if(u>.12&&u<.75&&v>.35&&v<.65){base=GRAY;level=3;}if(u>.72&&u<.8&&v>.12&&v<.6){base=GRAY;level=2;}if(v>.73){base=BRICK;level=5+Math.floor(fract(u*13)*2);}}
 return {base,level,ch,ink,label:mod(time,8)>2?'FIR CREEK':''};
}
