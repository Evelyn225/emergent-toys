// Shared solid silhouettes for held tools. Coordinates stay in the existing
// grip/animation space, so item controls and the hand mask keep their anchors.
function heldToolSegment(a,b,ra,rb,col){
  const d=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/d,ny=(b.x-a.x)/d;
  g.fillStyle=PAL[col];g.beginPath();g.moveTo(a.x+nx*ra,a.y+ny*ra);g.lineTo(b.x+nx*rb,b.y+ny*rb);g.lineTo(b.x-nx*rb,b.y-ny*rb);g.lineTo(a.x-nx*ra,a.y-ny*ra);g.closePath();g.fill();
}
function heldToolEllipse(x,y,rx,ry,col){g.fillStyle=PAL[col];g.beginPath();g.ellipse(x,y,rx,ry,0,0,TAU);g.fill();}
function heldToolRing(x,y,rx,ry,wall,col){g.fillStyle=PAL[col];g.beginPath();g.ellipse(x,y,rx,ry,0,0,TAU);g.ellipse(x,y,Math.max(.1,rx-wall),Math.max(.1,ry-wall),0,0,TAU,true);g.fill('evenodd');}
const REVOLVER_PROFILES={
  grip:[[37,3],[40,4],[41,7],[46,9],[49,12],[48,14],[43,14],[41,12],[38,9]],
  frame:[[29,2],[36,2],[38,4],[38,7],[40,8],[37,7.5],[34,7],[31,7],[29,6]],
  hammer:[[35.5,2.5],[36.4,.5],[37.6,0],[38.3,.5],[37.3,2.7]],
  crane:[[30.5,6.4],[31.4,7],[27,10.2],[25.7,9.6]]
};
function heldToolPolygon(x,y,points){let inside=false;for(let k=0,j=points.length-1;k<points.length;j=k++){const a=points[k],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
const REVOLVER_PICTURES=new Map();
function revolverPicture(open,rounds,spin=gunView.spin,kick=gun.kick){
  rounds=clamp(rounds,0,CYLINDER);const key=[!!open,rounds,Math.floor(spin*2+.5)&1,kick>.45].join('|');if(REVOLVER_PICTURES.has(key))return REVOLVER_PICTURES.get(key);
  const P=REVOLVER_PROFILES,paint=(base,level)=>[' ',C(base,level)];
  const picture=sculptSurface(50,16,(xx,yy)=>{
    const x=xx/D_ASPECT+25.5,y=yy+8;
    if(open){
      const r=Math.hypot((x-24.5)/3.6,(y-10.5)/2.8);
      if(r<1){
        for(let k=0;k<CYLINDER;k++){const a=-Math.PI/2+k*TAU/CYLINDER,cx=24.5+Math.cos(a)*2.1,cy=10.5+Math.sin(a)*1.6;
          if(Math.hypot((x-cx)/.65,(y-cy)/.52)<1)return paint(k<rounds?YEL:GRAY,k<rounds?14:2);
        }
        return paint(GRAY,r>.83?14:r<.19?7:10);
      }
      if(heldToolPolygon(x,y,P.crane))return paint(GRAY,y<8?13:8);
    }
    if(heldToolPolygon(x,y,P.grip)){
      const screw=Math.hypot(x-39.5,(y-5.5)*1.4)<.5;
      return paint(screw?WHITE:BRICK,screw?14:7+Math.max(0,3-(x-40)*.4)+((Math.floor(x+y*2)&1)?1:0));
    }
    if(x>=1&&x<30&&y>=2&&y<4.7)return paint(GRAY,y<3?14:y<4?10:7);
    if(x<2&&x>=.3&&y>=2.8&&y<4.2)return paint(GRAY,2); // bore
    if(x>=1&&x<3&&y>=1&&y<2)return paint(GRAY,14); // front sight
    if(x>=7&&x<29&&y>=4.7&&y<5.6)return paint(GRAY,y<5?12:6); // ejector rod
    if(heldToolPolygon(x,y,P.hammer)&&kick<=.45)return paint(GRAY,x<37?14:8);
    if(heldToolPolygon(x,y,P.frame)){
      if(x>30&&x<35.3&&y>3&&y<6.8){if(open)return null;const flute=(Math.floor(y+spin*2)&1);return paint(CYAN,flute?11:5);}
      return paint(GRAY,y<3?14:x>36?7:10);
    }
    const guard=Math.hypot((x-35.3)/3.1,(y-8.3)/1.6);
    if(guard<1&&guard>.63)return paint(GRAY,y<8?12:7);
    if(x>35&&x<36&&y>7&&y<8.8)return paint(GRAY,12); // trigger
    return null;
  });
  if(REVOLVER_PICTURES.size>=32)REVOLVER_PICTURES.delete(REVOLVER_PICTURES.keys().next().value);REVOLVER_PICTURES.set(key,picture);return picture;
}
DENSE.revolver=it=>revolverPicture(false,it.uses,0,0);
function heldMuzzleFlash(k){return sculptSurface(7,7,(x,y)=>{const r=Math.hypot(x/.6,y),a=Math.atan2(y,x/.6),edge=2.5+.8*Math.cos(a*4);return r<edge?[' ',C(r<1.2?WHITE:r<2?YEL:ORANGE,r<1.2?15:14)]:null;});}

function heldRodPicture(it){const carbon=it.id==='carbonrod';return sculptSurface(16,38,(x,y)=>{
  for(const gy of [-14,-8,-2]){const ring=Math.hypot((x-1.2)/.8,(y-gy)/.8);if(ring<1&&ring>.45)return [' ',C(GRAY,13)];}
  if(Math.hypot((x-2)/1.6,(y-7)/2)<1)return [' ',C(carbon?BLUE:GREEN,x<2?13:8)];
  if(y>4.8&&y<6.2&&x>0&&x<2.5)return [' ',C(GRAY,11)];
  if(y< -18||y>18)return null;
  const cork=y>10,seat=y>8&&y<=10,width=cork?1:seat?.7:.24+(y+18)*.012;
  if(Math.abs(x)<width)return [' ',C(cork?WARM:GRAY,cork?13:carbon?8:14)];return null;
});}
DENSE.rod=DENSE.carbonrod=heldRodPicture;
