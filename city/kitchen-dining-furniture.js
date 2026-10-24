// Wall ledges carry their tops on actual joined brackets. (fx,fy) points into
// the room; the back edge and mounting plates share the wall's face plane.
function KITCHEN_WALL_LEDGE(x,y,half,depth,height,fx,fy,color=BRICK) {
  const c=-fy,s=fx,wood=furnitureTimber(color),top=kitchenTopProfile(half,depth,height-.06,height,.005),
    plate=kitchenPanelProfile(.035,.0075,height-.40,height-.06,.002);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const at=(u,v)=>[vx+c*u+fx*v,vy+s*u+fy*v];
    drawBox({...boxAt(vx,vy,c,s,half,depth,height-.06,height),...top},color===GRAY?kitchenSteel:wood,homeRayWorktop);
    for(const u of [-half*.65,half*.65]){
      const [mx,my]=at(u,-depth+.0075);
      drawBox({...boxAt(mx,my,c,s,.035,.0075,height-.40,height-.06),...plate},kitchenSteel,homeRayWorktop);
      const [bx,by]=at(u,-depth+.014),[tx,ty]=at(u,depth-.035);
      coveTube(bx,by,height-.072,tx,ty,height-.072,.012,GRAY);
      coveTube(bx,by,height-.36,tx,ty,height-.072,.012,GRAY);
      for(const du of [-.018,.018])for(const z of [height-.32,height-.15]){
        const [xx,yy]=at(u+du,-depth+.018);foodOval(xx,yy,z-.006,.005,.004,.012,kitchenSteel,c,s);
      }
    }
  }),box:boxAt(x,y,c,s,half,depth,height-.40,height),radius:Math.hypot(half,depth),diningLedge:{half,depth,height,fx,fy}};
}
function KITCHEN_TRESTLE_TABLE(x,y,hl=1.4,hw=.45,height=.78) {
  const foot=hl*.64,top=kitchenTopProfile(hl,hw,height-.06,height,.010),wood=furnitureTimber(BRICK);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const u of [-foot,foot]){
      coveRound(vx+u,vy,1,0,.06,hw-.10,0,.045,.012,kitchenIron);
      coveRound(vx+u,vy,1,0,.035,.035,.045,height-.075,.009,kitchenSteel);
      coveRound(vx+u,vy,1,0,.055,hw-.06,height-.085,height-.06,.006,kitchenSteel);
    }
    coveRound(vx,vy,1,0,foot,.024,.32,.36,.008,kitchenSteel);
    drawBox({...boxAt(vx,vy,1,0,hl,hw,height-.06,height),...top},wood,homeRayWorktop);
  }),box:boxAt(x,y,1,0,hl,hw,0,height),radius:Math.hypot(hl,hw),diningTrestle:true};
}
function KITCHEN_LOW_TABLE(x,y) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>drawFurnitureTable(vx,vy,.45,.3,.34)),
    box:boxAt(x,y,1,0,.45,.3,0,.34),radius:.6,diningLowTable:true};
}
