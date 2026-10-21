'use strict';
function flyFernRoundTrip(){
paused=false;tod=12;env(0);const c=aircraft.find(c=>c.type==='prop');Object.assign(c,{x:RUNWAY.x0+2,y:RUNWAY.y,z:0,yaw:0,pitch:0,roll:0,v:0,vz:0,ground:true,throttle:0,owned:true});
const events=[],legs=[];let seconds=0;
function step(inp){events.push(...flyStep(c,inp,.05));seconds+=.05;T+=.05;return !c.wrecked&&!c.ditched;}
function flight(target,height,landing=false){for(let n=0;n<12000;n++){
 const dist=near(c.x,c.y,target.x,target.y),angle=mod(Math.atan2(target.y-c.y,target.x-c.x)-c.yaw+Math.PI,TAU)-Math.PI;
 if(landing&&c.ground){for(let k=0;k<200&&Math.abs(c.v)>.02;k++)if(!step({throttle:-1,pitch:0,turn:0,lift:0}))break;return {landed:true,x:c.x,y:c.y,z:c.z,v:c.v,seconds};}
 if(!landing&&dist<2)return {reached:true,x:c.x,y:c.y,z:c.z,seconds};
 const desiredPitch=c.ground?(c.v>2.4?.22:0):clamp((height-c.z)*.11,-.08,.12);
 const pitch=c.ground?(c.v>2.4?.7:0):clamp((desiredPitch-c.pitch)*5+c.pitch*.4/.7,-1,1);
 const targetThrottle=landing?(dist>50?.56:.39):.65;
 if(!step({throttle:Math.sign(targetThrottle-c.throttle)*.2,pitch,turn:clamp(angle*2.5-c.roll*1.8,-1,1),lift:0}))return {error:'crash',x:c.x,y:c.y,z:c.z,dist,events};
 }return {error:'timeout',x:c.x,y:c.y,z:c.z};}
legs.push(flight({x:250,y:RUNWAY.y},5));legs.push(flight({x:480,y:220},5));legs.push(flight({x:530,y:220},1.8));legs.push(flight({x:610,y:220},0,true));
legs.push(flight({x:665,y:220},5));legs.push(flight({x:260,y:69},5));legs.push(flight({x:220,y:69},2.3));legs.push(flight({x:150,y:69},0,true));
return {legs,events:events.filter((x,i,a)=>a.indexOf(x)===i),craft:{x:c.x,y:c.y,z:c.z,v:c.v,ground:c.ground,dmg:c.dmg,ditched:c.ditched,wrecked:c.wrecked},seconds};
}
module.exports={flyFernRoundTrip};

function sailFernRoundTrip({cruise=true}={}){
paused=false;tod=12;env(0);boats.length=0;
const b=fleet.find(b=>b.kind==='speedboat'&&b.deal==='rent');fleet.splice(0,fleet.length,b);b.hired=true;boardBoat(b);const berth={x:b.x,y:b.y};const exit=sail([{x:231.7,y:350.62},{x:231.7,y:357.5}]);const start={x:b.x,y:b.y};
const island=WILD_ISLANDS[0],goal={x:island.dock[0]+1,y:island.dock[1]-.4};
const pass=(x,y)=>[[0,0],[.4,0],[-.4,0],[0,.4],[0,-.4]].every(([ox,oy])=>navigable(x+.5+ox,y+.5+oy));
let route=findMapRoute(start,goal,MAP_WORLD,pass);if(!route)return {error:'no route',start,goal};route[route.length-1]=goal;
function clear(a,b){const len=near(a.x,a.y,b.x,b.y);for(let d=0;d<=len;d+=.25)if(![[0,0],[.4,0],[-.4,0],[0,.4],[0,-.4]].every(([ox,oy])=>navigable(a.x+(b.x-a.x)*d/len+ox,a.y+(b.y-a.y)*d/len+oy)))return false;return true;}
function sail(points){let seconds=0,stuck=0,peak=0;for(const target of points){for(let n=0;n<16000&&near(b.x,b.y,target.x,target.y)>.25;n++){
const dist=near(b.x,b.y,target.x,target.y),angle=mod(Math.atan2(target.y-b.y,target.x-b.x)-a+Math.PI,TAU)-Math.PI;
const k=BOAT_KINDS.speedboat,top=cruise?(k.cruise||k.top):k.top;
const speed=Math.abs(angle)>.3?.25:Math.min(top,Math.sqrt(dist)*1.05);
K.KeyD=angle>.025;K.KeyA=angle<-.025;K.KeyW=b.v<speed-.015;K.KeyS=b.v>speed+.02;K.ShiftLeft=cruise&&speed>k.top;
const x=b.x,y=b.y;stepSea(.05);T+=.05;seconds+=.05;peak=Math.max(peak,b.v);if(near(x,y,b.x,b.y)<1e-5)stuck++;if(stuck>500)return {error:'stuck',at:[b.x,b.y],target,angle};
} }K.KeyD=K.KeyA=K.KeyW=K.KeyS=K.ShiftLeft=false;
// Brake using the controls rather than setting velocity to zero at the landing.
while(b.v>.02){K.KeyS=true;stepSea(.05);T+=.05;seconds+=.05;}K.KeyS=false;
return {seconds,peak,at:[b.x,b.y]};}
const points=[];let at=start;for(let n=0;n<route.length;){let j=n;while(j+1<route.length&&clear(at,route[j+1]))j++;points.push(route[j]);at=route[j];n=j+1;}
const out=sail(points);const landing=landingSpot(b);leaveBoat();const disembarked=mode==='walk',nearby=nearBoat()===b;const dockWalk=[];if(disembarked){for(let n=0;n<1000&&px<island.landing[0]-.05;n++){move(.04,0);dockWalk.push([px,py]);}}

const ashore=[px,py];
for(let n=0;n<1000&&px>landing[0]+.02;n++)move(-Math.min(.04,px-landing[0]),0);
a=Math.atan2(b.y-py,b.x-px);const reboard=nearBoat()===b;if(reboard)useMarina();
const back=reboard?sail([...points].reverse().concat([{x:231.7,y:357.5},{x:231.7,y:350.62},berth])):{error:'cannot reboard'};
const finalLanding=landingSpot(b);if(mode==='sea')leaveBoat();
return {exit,out,back,disembarked,reboard,ashore,finalLanding,returned:mode==='walk'&&!b.hired};
}
module.exports.sailFernRoundTrip=sailFernRoundTrip;
