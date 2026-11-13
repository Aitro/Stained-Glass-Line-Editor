// Circles that touch a line: round, not pointed.
// ------------------------------------------------------------------------------------------------
// A round shape (a star's circle) that just touches another line, such as the border, is traced as two arcs (or one
// loop) whose ends land on that line at one point (a pointed tip, like a teardrop), or at two points a little apart. Where the arcs
// on either side really are one circle that touches the line (a circle fitted to them sits against it, its ink touching
// the line's ink), the last stretch on each side is replaced by one smooth curve that carries the roundness on and just
// touches the line, and both arcs end at that touching point. The two sides of a petal meeting a line at a point are not one circle, so they
// keep their point.
function roundTouches(strokes,med){
  const len=Q=>{const L=[0];for(let k=1;k<Q.length;k++)L.push(L[k-1]+Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]));return L;};
  const unit=v=>{const n=Math.hypot(v[0],v[1])||1;return[v[0]/n,v[1]/n];};
  // (the nearest point of any line other than these, with that line's direction there)
  const nearest=(skip,p)=>{let best=null;strokes.forEach((F,t)=>{if(skip.includes(t)||F.length<2)return;for(let k=1;k<F.length;k++){const a=F[k-1],b=F[k],ab=[b[0]-a[0],b[1]-a[1]],l2=ab[0]*ab[0]+ab[1]*ab[1]||1;
      let u=((p[0]-a[0])*ab[0]+(p[1]-a[1])*ab[1])/l2;u=Math.max(0,Math.min(1,u));const q=[a[0]+u*ab[0],a[1]+u*ab[1]],d=Math.hypot(q[0]-p[0],q[1]-p[1]);
      if(!best||d<best.d){const a2=F[Math.max(0,k-6)],b2=F[Math.min(F.length-1,k+5)];best={d,q,s:t,t:unit([b2[0]-a2[0],b2[1]-a2[1]])};}}});return best;};
  // (circle through points, least squares)
  const fitCircle=pts=>{let sx=0,sy=0,sxx=0,syy=0,sxy=0,sxz=0,syz=0,sz=0;const n=pts.length;
    for(const[y,x]of pts){const z=x*x+y*y;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;sxz+=x*z;syz+=y*z;sz+=z;}
    const M=[[sxx,sxy,sx],[sxy,syy,sy],[sx,sy,n]],v=[-sxz,-syz,-sz];
    const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    const D=det(M);if(Math.abs(D)<1e-9)return null;const col=i=>M.map((r,j)=>r.map((c,k)=>k===i?v[j]:c));
    const A=det(col(0))/D,B=det(col(1))/D,C=det(col(2))/D,cx=-A/2,cy=-B/2,r=Math.sqrt(Math.max(0,cx*cx+cy*cy-C));
    let e=0;for(const[y,x]of pts)e=Math.max(e,Math.abs(Math.hypot(x-cx,y-cy)-r));return{c:[cy,cx],r,e};};
  // (every line end, by where it is)
  const ends=[];strokes.forEach((Q,s)=>{if(Q.length<6)return;ends.push({s,end:0,p:Q[0]});ends.push({s,end:1,p:Q[Q.length-1]});});
  const used=new Set();
  for(let x=0;x<ends.length;x++)for(let y=x+1;y<ends.length;y++){const E1=ends[x],E2=ends[y];if(used.has(x)||used.has(y))continue;
    // (the two sides land on the line at one point, or a little apart where the round shape sits along the line for a
    // short way, as a circle resting on a curve does)
    const sep=Math.hypot(E1.p[0]-E2.p[0],E1.p[1]-E2.p[1]);if(sep>6*med)continue;
    let F=nearest([E1.s,E2.s],[(E1.p[0]+E2.p[0])/2,(E1.p[1]+E2.p[1])/2]);
    if(sep>0.6*med){const F1=nearest([E1.s,E2.s],E1.p),F2=nearest([E1.s,E2.s],E2.p);if(!F1||!F2||F1.d>3||F2.d>3||F1.s!==F2.s||!F||F.s!==F1.s)continue;}
    else if(!F||F.d>0.6*med)continue;
    // (each side's last stretch, ordered from the far end toward the touching point)
    const side=E=>{const Q=strokes[E.s],R=E.end===1?Q:Q.slice().reverse(),L=len(R),tot=L[L.length-1];return{R,L,tot};};
    const S1=side(E1),S2=side(E2);
    const d=Math.min(4*med,S1.tot/3,S2.tot/3);if(d<0.5*med)continue;
    const cut=S=>{let k=S.R.length-1;while(k>0&&S.tot-S.L[k]<d)k--;return k;};
    const i1=cut(S1),i2=cut(S2),A=S1.R[i1],B=S2.R[i2];
    const dirTo=(S,i)=>unit([S.R[Math.min(S.R.length-1,i+3)][0]-S.R[Math.max(0,i-3)][0],S.R[Math.min(S.R.length-1,i+3)][1]-S.R[Math.max(0,i-3)][1]]);
    const uA=dirTo(S1,i1),uB=dirTo(S2,i2);
    // (a pointed tip, not already round)
    if(uA[0]*uB[0]+uA[1]*uB[1]<-0.94)continue;
    const P=F.q;let n=[-F.t[1],F.t[0]];
    const hA=(A[0]-P[0])*n[0]+(A[1]-P[1])*n[1],hB=(B[0]-P[0])*n[0]+(B[1]-P[1])*n[1];if(hA*hB<=0)continue;if(hA>0)n=[-n[0],-n[1]];
    // (one circle through both sides, from the cut points out to a few line widths, sitting against the line)
    const pts=[];for(const[S,i]of[[S1,i1],[S2,i2]])for(let k=i;k>=0&&S.L[i]-S.L[k]<=4*med;k--)pts.push(S.R[k]);
    const C=fitCircle(pts);if(!C||C.r<1.5*med||C.r>40*med||C.e>0.35*med)continue;
    const gap=Math.abs((P[0]-C.c[0])*n[0]+(P[1]-C.c[1])*n[1])-C.r;if(gap<-0.6*med||gap>1.5*med)continue;
    // (and it really is a round shape: following both sides away from the line, they stay on that circle for nearly
    // half of it, not just near the tip, as the two sides of a V or a pointed leaf would not)
    const span=(S,i)=>{let tot=0,prev=null;for(let k=i;k>=0;k--){const q=S.R[k];if(Math.abs(Math.hypot(q[0]-C.c[0],q[1]-C.c[1])-C.r)>0.6*med)break;
        const a=Math.atan2(q[1]-C.c[1],q[0]-C.c[0]);if(prev!=null){let da=a-prev;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;tot+=Math.abs(da);}prev=a;}return tot;};
    if(span(S1,i1)+span(S2,i2)<Math.PI*0.85)continue;
    // (the round cap: each side is kept as traced up to the shape's widest point, level with the circle's centre; from
    // there the upper half follows the circle, stretched evenly toward the line just enough for its top to touch it, so
    // the top is half an oval: round all the way over, no point, no bump. The shape's own line sits about a line width
    // below the other line's, since their inks touch, and the stretch takes up that width)
    const dist=q=>-((q[0]-P[0])*n[0]+(q[1]-P[1])*n[1]),cDepth=dist(C.c),lift=cDepth-C.r;
    if(lift<-0.6*med||lift>1.5*med)continue;
    const cutW=S=>{let k=S.R.length-1;while(k>0&&dist(S.R[k])<cDepth)k--;return k;};
    const k1=cutW(S1),k2=cutW(S2);if(k1<3||k2<3)continue;
    const A2=S1.R[k1],B2=S2.R[k2];
    const ang=X=>Math.atan2(X[1]-C.c[1],X[0]-C.c[0]),thT=Math.atan2(n[1],n[0]),wrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
    const dA=wrap(ang(A2)-thT),dB=wrap(ang(B2)-thT);if(Math.sign(dA)===Math.sign(dB)||Math.abs(dA)<1.0||Math.abs(dB)<1.0||Math.abs(dA)>2.1||Math.abs(dB)>2.1)continue;
    // (from a cut point round to the top: the distance from the centre eases from the traced point's own to the
    // circle's over the first third, and the stretch grows with the height above the centre)
    const cap=(dX,X)=>{const out=[],m=Math.max(12,Math.ceil(Math.abs(dX)*C.r/2)),rX=Math.hypot(X[0]-C.c[0],X[1]-C.c[1]);
      for(let i=1;i<=m;i++){const f=1-i/m,a=thT+dX*f,b=Math.min(1,(1-f)*3),e=b*b*(3-2*b),rho=rX+(C.r-rX)*e,up=Math.max(0,Math.cos(a-thT))*rho/C.r;
        out.push([C.c[0]+rho*Math.cos(a)+n[0]*lift*up,C.c[1]+rho*Math.sin(a)+n[1]*lift*up]);}
      return out;};
    const T=[C.c[0]+n[0]*cDepth,C.c[1]+n[1]*cDepth];if(Math.hypot(T[0]-P[0],T[1]-P[1])>2*med)continue;
    const aA=cap(dA,A2),aB=cap(dB,B2);aA[aA.length-1]=T.slice();aB[aB.length-1]=T.slice();
    const i1b=k1,i2b=k2;
    const new1=S1.R.slice(0,i1b+1).concat(aA),new2=S2.R.slice(0,i2b+1).concat(aB);
    if(E1.s===E2.s){
      // (one loop, both of whose ends land here: start and end it at the touching point)
      const Q=strokes[E1.s],j1=Q.length-1-i1b;if(j1>=i2b)continue;
      strokes[E1.s]=[T.slice()].concat(aA.slice(0,-1).reverse(),Q.slice(j1,i2b+1).map(q=>q.slice()),aB);}
    else{strokes[E1.s]=E1.end===1?new1:new1.slice().reverse();strokes[E2.s]=E2.end===1?new2:new2.slice().reverse();}
    used.add(x);used.add(y);}
  return strokes;}
