// ================================================================================================
// Oval border to rectangle: a panel with a band of border pieces between two ovals becomes a rectangular
// panel. The picture inside the inner oval is kept; every line that ran into the inner oval is carried on,
// curving gently, to meet the new inner rectangle square on; the band becomes a rectangular band the same
// width, with mitred corners and as many pieces as the oval band had. Done on the line picture, before the
// tracing, so the new lines are traced like any others.
// ================================================================================================
function ovalToRect(m){
  const lw=Math.max(2,inkWidth(m)),r=lw/2;
  // (the lines' middles, short spurs off them trimmed)
  const sk=m.slice();thin(sk,W,H);
  const nb=i=>{let c=0;const y=(i/W)|0,x=i-y*W;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<W&&Y<H&&sk[Y*W+X])c++;}return c;};
  for(let it=0;it<Math.round(3*lw);it++){const kill=[];for(let i=0;i<W*H;i++)if(sk[i]&&nb(i)<=1)kill.push(i);if(!kill.length)break;for(const i of kill)sk[i]=0;}
  // (the centre: the middle of all the ink)
  let x0=W,y0=H,x1=-1,y1=-1;for(let i=0;i<W*H;i++)if(sk[i]){const y=(i/W)|0,x=i-y*W;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  if(x1<0)return{ok:false,why:'no lines'};const cx=(x0+x1)/2,cy=(y0+y1)/2,Rmax=Math.hypot(x1-x0,y1-y0);
  // (along rays out from the centre: where each crosses a line. The last crossing is the outer oval)
  const rays=[];for(let k=0;k<720;k++){const t=2*Math.PI*k/720,ct=Math.cos(t),st=Math.sin(t),hits=[];let run=null;
    for(let s=0;s<Rmax;s+=0.5){const x=Math.round(cx+s*ct),y=Math.round(cy+s*st);if(x<0||y<0||x>=W||y>=H)break;const on=sk[y*W+x]||(x+1<W&&sk[y*W+x+1])||(y+1<H&&sk[(y+1)*W+x]);
      if(on){if(run&&s-run[1]<=1.5)run[1]=s;else{run=[s,s];hits.push(run);}}}
    rays.push({t,ct,st,hits:hits.map(h=>(h[0]+h[1])/2)});}
  const outerPts=[];for(const R of rays)if(R.hits.length){const s=R.hits[R.hits.length-1];outerPts.push([cx+s*R.ct,cy+s*R.st]);}
  let EO=fitEllipse(outerPts);if(!EO)return{ok:false,why:'no outer oval'};
  for(let pass=0;pass<2;pass++){const P=outerPts.filter(p=>ellDist(EO,p)<2*lw);if(P.length<40)break;const e=fitEllipse(P);if(!e)break;EO=e;}
  const cover=ellCover(EO,outerPts.filter(p=>ellDist(EO,p)<2*lw));
  // (the inner oval: on each ray, the last crossing well inside the outer oval)
  const radOf=(e,t)=>{const a=e.a,b=e.b,c=Math.cos(t-e.th),s=Math.sin(t-e.th);return a*b/Math.hypot(b*c,a*s);};
  const innerPts=[];for(const R of rays){const ro=radOf(EO,R.t);for(let j=R.hits.length-1;j>=0;j--){if(ro-R.hits[j]>6*lw){innerPts.push([cx+R.hits[j]*R.ct,cy+R.hits[j]*R.st]);break;}}}
  let EI=fitEllipse(innerPts);if(!EI)return{ok:false,why:'no inner oval'};
  for(let pass=0;pass<3;pass++){const P=innerPts.filter(p=>ellDist(EI,p)<Math.max(2*lw,3));if(P.length<40)break;const e=fitEllipse(P);if(!e)break;EI=e;}
  const coverI=ellCover(EI,innerPts.filter(p=>ellDist(EI,p)<2*lw));
  const ar=e=>Math.max(e.a,e.b)/Math.min(e.a,e.b);
  if(cover<300||coverI<300||ar(EO)>3||ar(EI)>3||Math.min(EI.a,EI.b)<0.4*Math.min(EO.a,EO.b))return{ok:false,why:'no oval border found'};
  // (the rectangles: the outer one is the outer oval's box; the inner one is set in by the band's width)
  const half=e=>[Math.hypot(e.a*Math.cos(e.th),e.b*Math.sin(e.th)),Math.hypot(e.a*Math.sin(e.th),e.b*Math.cos(e.th))];
  const [hxO,hyO]=half(EO),[hxI,hyI]=half(EI),band=((hxO-hxI)+(hyO-hyI))/2,ocx=EO.c[0],ocy=EO.c[1];
  const R0=[ocx-hxO,ocy-hyO,ocx+hxO,ocy+hyO],R1=[R0[0]+band,R0[1]+band,R0[2]-band,R0[3]-band];
  // (how many border pieces: the lines crossing the band halfway between the ovals)
  const mid={type:'ellipse',c:[(EO.c[0]+EI.c[0])/2,(EO.c[1]+EI.c[1])/2],a:(EO.a+EI.a)/2,b:(EO.b+EI.b)/2,th:EO.th};
  let cross=0;{let prev=0,first=-1;const n=2000;for(let k=0;k<=n;k++){const q=ellPoint(mid,2*Math.PI*k/n),x=Math.round(q[0]),y=Math.round(q[1]);let on=0;
      for(let d=-1;d<=1&&!on;d++)for(let e=-1;e<=1&&!on;e++){const X=x+d,Y=y+e;if(X>=0&&Y>=0&&X<W&&Y<H&&m[Y*W+X])on=1;}
      if(on&&!prev)cross++;prev=on;}}
  const pieces=Math.max(4,cross),extra=Math.max(0,pieces-4),Wr=R1[2]-R1[0],Hr=R1[3]-R1[1];
  const per=Math.round(extra*Wr/(2*(Wr+Hr))),across=per+1,down=Math.max(1,Math.round((extra-2*per)/2)+1);
  // (the picture inside the inner oval, kept; its loose ends at the inner oval carried on to the inner rectangle)
  const sideI=p=>ellSide(EI,p),cut=Math.max(1.5*lw,0.012*Math.min(EI.a,EI.b));
  const scene=new Uint8Array(W*H);for(let i=0;i<W*H;i++)if(sk[i]){const y=(i/W)|0,x=i-y*W;if(sideI([x,y])<-cut)scene[i]=1;}
  const out=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++)if(scene[i]){const y=(i/W)|0,x=i-y*W;drawSeg(out,x,y,x,y,r);}
  const sn=i=>{const y=(i/W)|0,x=i-y*W,o=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<W&&Y<H&&scene[Y*W+X])o.push(Y*W+X);}return o;};
  let carried=0;const walk=Math.round(8*lw);const meets=[[],[],[],[]];   // (where lines meet the inner rectangle: top, bottom, left, right)
  // (a line's end: one neighbour, or two that touch each other, as at the stair-stepped tip of a thinned line)
  const isEnd=i=>{const o=sn(i);if(!o.length||o.length>2)return false;if(o.length===1)return true;const a=o[0],b=o[1];return Math.abs((a%W)-(b%W))<=1&&Math.abs(((a/W)|0)-((b/W)|0))<=1;};
  const used=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++){if(!scene[i]||used[i])continue;if(!isEnd(i))continue;const y=(i/W)|0,x=i-y*W;if(sideI([x,y])<-0.12*Math.min(EI.a,EI.b))continue;
    // (back along the line from its end: the pixel furthest along it, a few line widths in, gives its direction;
    // found by spreading out from the end, as a thinned line can be two pixels wide in places)
    const dep=new Map([[i,0]]);let fr=[i],far=i,d=0;while(fr.length&&d<walk){d++;const nf=[];for(const c of fr)for(const j of sn(c))if(!dep.has(j)){dep.set(j,d);nf.push(j);}if(nf.length)far=nf[0];fr=nf;}
    for(const[j,dj]of dep)if(dj<=2*lw)used[j]=1;if(dep.get(far)<Math.max(6,2*lw))continue;const pe=[x,y],pq=[far%W,(far/W)|0];let v=[pe[0]-pq[0],pe[1]-pq[1]];const vl=Math.hypot(v[0],v[1])||1;v=[v[0]/vl,v[1]/vl];
    // (which side of the inner rectangle it heads for, and how far)
    let best=null;for(const[k,lo,hi]of[[0,R1[0],R1[2]],[1,R1[1],R1[3]]]){if(Math.abs(v[k])<1e-6)continue;for(const[bnd,sg]of[[lo,-1],[hi,1]]){const t=(bnd-pe[k])/v[k];if(t>0&&(!best||t<best.t))best={t,k,bnd,sg};}}
    if(!best)continue;const{k,bnd,sg}=best,dist=Math.abs(bnd-pe[k]),o=1-k;
    const T=[0,0];T[k]=bnd;T[o]=pe[o]+v[o]/Math.abs(v[k])*dist*0.45;const lo=o===0?R1[0]:R1[1],hi=o===0?R1[2]:R1[3];T[o]=Math.min(hi-0.35*band,Math.max(lo+0.35*band,T[o]));
    const C1=[pe[0]+v[0]*dist*0.4,pe[1]+v[1]*dist*0.4],nrm=[0,0];nrm[k]=sg;const C2=[T[0]-nrm[0]*dist*0.35,T[1]-nrm[1]*dist*0.35];
    let pr=pe;for(let s=1;s<=40;s++){const t=s/40,a=(1-t)**3,b=3*(1-t)**2*t,c=3*(1-t)*t*t,d=t**3;const q=[a*pe[0]+b*C1[0]+c*C2[0]+d*T[0],a*pe[1]+b*C1[1]+c*C2[1]+d*T[1]];drawSeg(out,pr[0],pr[1],q[0],q[1],r);pr=q;}
    meets[k===1?(sg<0?0:1):(sg<0?2:3)].push(T[o]);carried++;}
  // (the band: two rectangles, mitred corners, the pieces between)
  const segs=[],seg=(a,b)=>{drawSeg(out,a[0],a[1],b[0],b[1],r);segs.push([a.slice(),b.slice()]);};
  for(const R of[R0,R1]){seg([R[0],R[1]],[R[2],R[1]]);seg([R[2],R[1]],[R[2],R[3]]);seg([R[2],R[3]],[R[0],R[3]]);seg([R[0],R[3]],[R[0],R[1]]);}
  seg([R1[0],R1[1]],[R0[0],R0[1]]);seg([R1[2],R1[1]],[R0[2],R0[1]]);seg([R1[2],R1[3]],[R0[2],R0[3]]);seg([R1[0],R1[3]],[R0[0],R0[3]]);
  // (a divider close to where a line meets the inner rectangle from inside is moved onto it, so the line runs
  // straight on through the border, as the line under a balloon's basket did through the oval band)
  const at=(lo,hi,j,n,list)=>{const x=lo+j/n*(hi-lo),sp=(hi-lo)/n;let best=x,bd=0.3*sp;for(const q of list){const d=Math.abs(q-x);if(d<bd){bd=d;best=q;}}return best;};
  for(let j=1;j<across;j++){const xt=at(R1[0],R1[2],j,across,meets[0]),xb=at(R1[0],R1[2],j,across,meets[1]);seg([xt,R0[1]],[xt,R1[1]]);seg([xb,R1[3]],[xb,R0[3]]);}
  for(let j=1;j<down;j++){const yl=at(R1[1],R1[3],j,down,meets[2]),yr=at(R1[1],R1[3],j,down,meets[3]);seg([R0[0],yl],[R1[0],yl]);seg([R1[2],yr],[R0[2],yr]);}
  m.set(out);
  return{ok:true,carried,across,down,pieces:2*across+2*down,geo:{R0,R1,lw,segs}};}

// The new rectangular band is drawn exactly as made, not as traced: in Level lines the tracing can bend the long
// straight sides where many lines meet them. Every traced line wholly in the band or on its edges is replaced by
// the exact rectangles, mitres and dividers, and each picture line reaching the inner rectangle is run straight on
// to meet it exactly. (Points here are [y,x], as the tracing has them; the band was made in x,y.)
function rectFrame(strokes,geo,rotDeg){const{R0,R1,lw,segs}=geo;
  let tf=p=>p;if(Math.abs(rotDeg||0)>0.01){const a=-rotDeg*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),cy=H/2,cx=W/2;tf=p=>{const y=p[0]-cy,x=p[1]-cx;return[cy+x*sa+y*ca,cx+x*ca-y*sa];};}
  // (inside test and edges in the tracing's own frame: the four inner corners, turned as the tracing was)
  const C=[[R1[1],R1[0]],[R1[1],R1[2]],[R1[3],R1[2]],[R1[3],R1[0]]].map(tf);
  const edges=[[C[0],C[1]],[C[1],C[2]],[C[2],C[3]],[C[3],C[0]]];
  const sideOf=(a,b,p)=>(b[1]-a[1])*(p[0]-a[0])-(b[0]-a[0])*(p[1]-a[1]);
  const sg=Math.sign(sideOf(C[0],C[1],C[2]))||1;
  const depth=p=>{let d=Infinity;for(const[a,b]of edges){const L=Math.hypot(b[0]-a[0],b[1]-a[1])||1;d=Math.min(d,sg*sideOf(a,b,p)/L);}return d;};   // (how far inside the inner rectangle)
  const inset=1.5*lw;
  // (straight on from p along v to the inner rectangle's edge)
  const toEdge=(p,v)=>{let best=null;for(const[a,b]of edges){const e=[b[0]-a[0],b[1]-a[1]],det=v[0]*(-e[1])+e[0]*v[1];if(Math.abs(det)<1e-9)continue;
      const rx=a[0]-p[0],ry=a[1]-p[1],t=(rx*(-e[1])+e[0]*ry)/det,s=(v[0]*ry-v[1]*rx)/det;if(t>=-1&&s>=-0.01&&s<=1.01&&(best===null||t<best))best=t;}
    return best===null?null:[p[0]+best*v[0],p[1]+best*v[1]];};
  const dirBack=(S,i,step)=>{let j=i,L=0;while(j+step>=0&&j+step<S.length&&L<2.5*lw){L+=Math.hypot(S[j+step][0]-S[j][0],S[j+step][1]-S[j][1]);j+=step;}
    const v=[S[i][0]-S[j][0],S[i][1]-S[j][1]],n=Math.hypot(v[0],v[1]);return n>1e-6?[v[0]/n,v[1]/n]:null;};
  const out=[];
  for(const S of strokes){let i=0;const n=S.length;
    while(i<n){while(i<n&&depth(S[i])<=inset)i++;if(i>=n)break;let j=i;while(j+1<n&&depth(S[j+1])>inset)j++;
      let R=S.slice(i,j+1);
      // (an end that ran out into the band, or stops just short of the inner rectangle, is run on to meet it)
      for(const atStart of[true,false]){const endI=atStart?0:R.length-1,p=R[endI],cut=atStart?i>0:j<n-1;
        if(!cut&&depth(p)>3*lw)continue;if(R.length<2)break;const v=dirBack(R,endI,atStart?1:-1);if(!v)continue;const q=toEdge(p,v);
        if(q&&Math.hypot(q[0]-p[0],q[1]-p[1])<=6*lw){if(atStart)R=[q,...R];else R=[...R,q];}}
      let L=0;for(let k=1;k<R.length;k++)L+=Math.hypot(R[k][0]-R[k-1][0],R[k][1]-R[k-1][1]);
      if(R.length>=2&&L>lw)out.push(R);i=j+1;}}
  // (the band, exact: points every couple of pixels)
  for(const[a,b]of segs){const A=tf([a[1],a[0]]),B=tf([b[1],b[0]]),L=Math.hypot(B[0]-A[0],B[1]-A[1]),k=Math.max(1,Math.ceil(L/2)),P=[];
    for(let t=0;t<=k;t++)P.push([A[0]+(B[0]-A[0])*t/k,A[1]+(B[1]-A[1])*t/k]);out.push(P);}
  return out;}
