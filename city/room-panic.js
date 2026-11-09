// Interior witnesses use the room's actual walls and prop collision. A shared
// exit flow field avoids recalculating a full search for every frightened guest.
const ROOM_PANICS=new Set(),ROOM_ESCAPE_STEP=.25;
const roomWitness=p=>p.fig&&!p.fig.build&&!p.still&&!p.cutout&&!p.dead&&!p.hidden;
function roomWitnessSeats(p){
 if(!p||typeof p.pose!=='string'||!p.pose.startsWith('sit'))return [];
 return room.props.filter(prop=>prop.bench&&Math.hypot(prop.x-p.x,prop.y-p.y)<.8||prop.box&&prop.box.z1<1.25&&inBox(prop.box,p.x,p.y,.05));
}
function roomWitnessGeometry(p,fn,openDoors=false){
 const changed=[],seats=p?.roomFlee?.seats||roomWitnessSeats(p);
 for(const prop of room.props){
  if(seats.includes(prop)||openDoors&&prop.bathroomDoor){changed.push([prop,prop.walk,prop.bench]);prop.walk=true;prop.bench=false;}
 }
 try{return fn();}finally{for(const [p,walk,bench]of changed){p.walk=walk;p.bench=bench;}}
}
function roomWitnessLine(x,y,tx,ty){
 const n=Math.max(1,Math.ceil(Math.hypot(tx-x,ty-y)/.08));
 for(let j=1;j<=n;j++)if(!roomOpen(x+(tx-x)*j/n,y+(ty-y)*j/n))return false;
 return true;
}
function roomEscapeField(){
 const step=ROOM_ESCAPE_STEP,w=Math.ceil(room.W/step)+1,h=Math.ceil(room.H/step)+1,n=w*h,next=new Int32Array(n).fill(-1),distance=new Int32Array(n),open=new Int8Array(n).fill(-1),queue=[];
 const clear=id=>{if(open[id]<0)open[id]=roomOpen(id%w*step,Math.floor(id/w)*step)?1:0;return open[id];};
 // Only actual doorway approaches are roots: an unreachable room is not an exit.
 const doors=[];for(let y=0;y<room.H;y++)for(let x=0;x<room.W;x++)if(room.grid[y][x]==='D')doors.push([x,y]);
 if(!doors.length)for(let y=0;y<room.H;y++)for(let x=0;x<room.W;x++)if(room.grid[y][x]==='E')doors.push([x,y]);
 for(const [x,y]of doors)for(const [dx,dy]of [[0,1],[0,-1],[1,0],[-1,0]]){
  const xx=x+dx+.5,yy=y+dy+.5;if(!roomOpen(xx,yy))continue;
  const id=Math.round(yy/step)*w+Math.round(xx/step);if(id<0||id>=n||!clear(id)||next[id]>=0)continue;next[id]=id;queue.push(id);
 }
 for(let j=0;j<queue.length;j++){
  const id=queue[j],x=id%w,y=Math.floor(id/w);
  for(const [dx,dy]of [[0,1],[0,-1],[1,0],[-1,0]]){
   const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;
   const key=yy*w+xx;if(next[key]>=0||!clear(key))continue;
   next[key]=id;distance[key]=distance[id]+1;queue.push(key);
  }
 }
 return {step,w,next,distance};
}
function roomWitnessPath(p,field){
 const {step,w,next,distance}=field;let best=-1,cost=Infinity;
 for(let id=0;id<next.length;id++){
  if(next[id]<0)continue;
  const x=id%w*step,y=Math.floor(id/w)*step,d=Math.hypot(x-p.x,y-p.y);
  if(d>1.8||d+distance[id]*step>=cost||!roomWitnessLine(p.x,p.y,x,y))continue;
  best=id;cost=d+distance[id]*step;
 }
 if(best<0)return [];
 const path=[];for(let id=best;;id=next[id]){path.push([id%w*step,Math.floor(id/w)*step]);if(next[id]===id)break;}return path;
}
function panicInRoom(kind='gunfire',report=true){
 if(mode!=='room'||!room)return 0;
 const witnesses=room.props.filter(roomWitness);if(!witnesses.length)return 0;
 const r=room;r.evacuating=true;
 if(report){
  const level=kind==='murder'?2:1,at=r.ret||r.lobby?.ret||r.below?.ret||crimePos();
  if(level>(r.panicReportLevel||0)){
   if(r.panicReport&&reports.includes(r.panicReport)){r.panicReport.kind=kind;}
   else{r.panicReport={t:T+reportDelay(),x:at[0],y:at[1],kind};reports.push(r.panicReport);}
   r.panicReportLevel=level;
  }
 }
 for(const prop of r.bathroomDoors||[])prop.bathroomDoor.target=1;
 const fresh=witnesses.filter(p=>!p.roomFlee);
 const field=fresh.length?roomWitnessGeometry(null,roomEscapeField,true):null;
 for(const p of fresh){
  const path=roomWitnessGeometry(p,()=>roomWitnessPath(p,field),true);
  p.roomFlee={path,started:T,seats:roomWitnessSeats(p)};p.ph||=0;delete p.tick;delete p.dir;
 }
 ROOM_PANICS.add(r);return witnesses.length;
}
function roomWitnessOutside(p,r){
 const ret=r.ret||r.lobby?.ret||r.below?.ret;if(!ret)return;
 const yaw=(ret[2]||0)+Math.PI,fx=Math.cos(yaw),fy=Math.sin(yaw);
 let at=null;
 for(const [along,side]of [[.08,0],[.12,.06],[.12,-.06],[0,0]]){
  const x=worldCoord(ret[0]+fx*along-fy*side),y=worldCoord(ret[1]+fy*along+fx*side);
  if(!map[idx(x,y)]&&!isWater(x,y)&&!solidAt(x,y,.025)){at=[x,y];break;}
 }
 if(at){
  const template=people[0],look={...p.fig,si:seasonIdx()},[x,y]=at;
  people.push({x,y,home:nearestDoor(x,y,USES.home)||template.home,work:template.work,role:'errands',social:false,jit:0,act:'wander',goal:null,legs:0,path:[],last:[fx,fy],wait:0,hidden:false,sp:.14,ph:p.ph,shirt:look.col.top[0],pants:look.col.bot[0],look,
   flee:{x:fx,y:fy,t:PANIC_T[1],scream:true}});
 }
}
function stepRoomPanic(dt){
 const active=room,activeMode=mode;
 try{for(const r of ROOM_PANICS){
  room=r;mode='room';
  if(r!==active&&typeof stepBathroomDoors==='function')stepBathroomDoors(dt);
  let remaining=0;
  for(const p of r.props){
   if(!p.roomFlee||p.dead||p.hidden)continue;remaining++;
   const escape=p.roomFlee,path=escape.path;
   if(!path.length)continue; // no walkable way out: cower rather than cross a wall
   roomWitnessGeometry(p,()=>{
    let budget=3.4*dt;
    while(budget>0&&path.length){
     const [x,y]=path[0],dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy),step=Math.min(d,budget,.07);
     if(d<.005){path.shift();continue;}
     const nx=p.x+dx/d*step,ny=p.y+dy/d*step;
     if(!roomOpen(nx,ny))break;
     p.x=nx;p.y=ny;p.face=[dx/d,dy/d];p.dir=Math.atan2(dy,dx);p.ph+=step*2;budget-=step;
     if(step>=d-1e-6)path.shift();
    }
   });
   if(!path.length){p.hidden=true;roomWitnessOutside(p,r);}
  }
  if(!remaining||T-(r.panicStarted??=T)>90)ROOM_PANICS.delete(r);
 }}finally{room=active;mode=activeMode;}
}
