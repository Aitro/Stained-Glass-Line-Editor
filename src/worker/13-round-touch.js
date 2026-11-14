// Circles that touch a line: round, not pointed.
// ------------------------------------------------------------------------------------------------
// A round shape (a star's circle) that just touches another line, such as the border, is traced as two arcs (or one
// loop) whose ends land on that line at one point (a pointed tip, like a teardrop), or at two points a little apart. Where the arcs
// on either side really are one circle that touches the line (a circle fitted to them sits against it, its ink touching
// the line's ink), the last stretch on each side is replaced by one smooth curve that carries the roundness on and just
// touches the line, and both arcs end at that touching point. The two sides of a petal meeting a line at a point are not one circle, so they
// keep their point.
function roundTouches(strokes,med,dmap,leadHalf){
  // (how wide the lead will be drawn: the round top is lifted only until its lead touches the other line's lead)
  const rL=leadHalf>0?leadHalf:0.3*med;
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
  const used=new Set(),joins=[];
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
    // (a big shape whose sides run on to other joints shows less of itself; both sides well on the circle will do)
    let relaxed=false;{const a1=span(S1,i1),a2=span(S2,i2);if(a1+a2<Math.PI*0.85){if(!(C.r>6*med&&C.e<0.25*med&&Math.min(a1,a2)>0.6&&a1+a2>1.4))continue;relaxed=true;}}
    // (the round cap: each side is kept as traced up to the shape's widest point, level with the circle's centre; from
    // there the upper half follows the circle, stretched evenly toward the line just enough for its top to touch it, so
    // the top is half an oval: round all the way over, no point, no bump. The shape's own line sits about a line width
    // below the other line's, since their inks touch, and the stretch takes up that width)
    const dist=q=>-((q[0]-P[0])*n[0]+(q[1]-P[1])*n[1]),cDepth=dist(C.c),lift=cDepth-C.r;
    if(lift<-0.6*med||lift>1.5*med)continue;
    // (cut at the widest point; a side that ends at a joint below it, on a big circle, is cut a little lower)
    const mx=S=>{let m=-1e9;for(const q of S.R)m=Math.max(m,dist(q));return m;},cD=Math.min(cDepth,mx(S1)-0.6*med,mx(S2)-0.6*med);
    if(cD<cDepth-0.35*C.r)continue;if(cD<cDepth)relaxed=true;
    const cutW=S=>{let k=S.R.length-1;while(k>0&&dist(S.R[k])<cD)k--;return k;};
    const k1=cutW(S1),k2=cutW(S2);if(k1<3||k2<3)continue;
    const A2=S1.R[k1],B2=S2.R[k2];
    const ang=X=>Math.atan2(X[1]-C.c[1],X[0]-C.c[0]),thT=Math.atan2(n[1],n[0]),wrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
    const dA=wrap(ang(A2)-thT),dB=wrap(ang(B2)-thT);if(Math.sign(dA)===Math.sign(dB)||Math.abs(dA)<1.0||Math.abs(dB)<1.0||Math.abs(dA)>2.1||Math.abs(dB)>2.1)continue;
    // (the shape's own outline: the middle of its drawn ink, measured all the way round its centre and fitted with a
    // smooth closed curve, a few gentle waves of the distance from the centre, so a shape drawn a little narrower or
    // wider than a circle keeps that form with none of the ink's small wobbles. Where its ink runs into another line's
    // the measure is left out. The upper part of that curve is then stretched toward the line just enough for its top
    // to touch it)
    if(!dmap)continue;
    const hw=0.5*med,samp=[];
    for(let k=0;k<120;k++){const a=k*Math.PI/60;let best=-1,bv=-1;for(let rr=0.6*C.r;rr<=1.4*C.r;rr+=0.5){const y=Math.round(C.c[0]+rr*Math.cos(a)),x=Math.round(C.c[1]+rr*Math.sin(a));
        if(y<0||x<0||y>=H||x>=W)continue;const v=dmap[y*W+x];if(v>bv){bv=v;best=rr;}}
      if(best>0&&bv>0.5&&bv<=1.45*hw)samp.push([a,best]);}
    if(samp.length<60)continue;
    const K=3,fitR=pts=>{const nP=2*K+1,M=Array.from({length:nP},()=>new Array(nP).fill(0)),v=new Array(nP).fill(0);
        const basis=a=>{const b=[1];for(let q=1;q<=K;q++){b.push(Math.cos(q*a),Math.sin(q*a));}return b;};
        for(const[a,rr]of pts){const b=basis(a);for(let u=0;u<nP;u++){v[u]+=b[u]*rr;for(let w=0;w<nP;w++)M[u][w]+=b[u]*b[w];}}
        // (plain elimination)
        for(let c=0;c<nP;c++){let pv=c;for(let r2=c+1;r2<nP;r2++)if(Math.abs(M[r2][c])>Math.abs(M[pv][c]))pv=r2;[M[c],M[pv]]=[M[pv],M[c]];[v[c],v[pv]]=[v[pv],v[c]];
          if(Math.abs(M[c][c])<1e-9)return null;for(let r2=c+1;r2<nP;r2++){const f=M[r2][c]/M[c][c];for(let w=c;w<nP;w++)M[r2][w]-=f*M[c][w];v[r2]-=f*v[c];}}
        const x=new Array(nP).fill(0);for(let c=nP-1;c>=0;c--){let t=v[c];for(let w=c+1;w<nP;w++)t-=M[c][w]*x[w];x[c]=t/M[c][c];}
        return a=>{const b=basis(a);let r3=0;for(let u=0;u<nP;u++)r3+=b[u]*x[u];return r3;};};
    let fr=fitR(samp);if(!fr)continue;
    // (once more without the samples the curve misses by much: a stray reading of another line's ink)
    const keep=samp.filter(([a,rr])=>Math.abs(fr(a)-rr)<0.35*med);if(keep.length>=50){const f2=fitR(keep);if(f2)fr=f2;}
    const rT=fr(thT),gapT=cDepth-rT;if(gapT<-0.6*med||gapT>1.6*med)continue;
    const gapL=Math.max(0,gapT-1.7*rL);
    const cap=(dX,X)=>{const out=[],m=Math.max(12,Math.ceil(Math.abs(dX)*C.r/2)),rX=Math.hypot(X[0]-C.c[0],X[1]-C.c[1]);
      for(let i=1;i<=m;i++){const f=1-i/m,a=thT+dX*f,b=Math.min(1,(1-f)*3),e=b*b*(3-2*b),rr=rX+(fr(a)-rX)*e,cs=Math.max(0,Math.cos(a-thT)),up=cs*cs;
        out.push([C.c[0]+rr*Math.cos(a)+n[0]*gapL*up,C.c[1]+rr*Math.sin(a)+n[1]*gapL*up]);}
      return out;};
    const T0=[C.c[0]+n[0]*cDepth,C.c[1]+n[1]*cDepth],T=[C.c[0]+n[0]*(rT+gapL),C.c[1]+n[1]*(rT+gapL)];{const dT=Math.hypot(T0[0]-P[0],T0[1]-P[1]);if(dT>Math.max(2*med,Math.min(5*med,0.45*C.r)))continue;if(dT>2*med)relaxed=true;}
    // (the traced side just below each cut point eased onto the same curve over a few line widths, so there is no step
    // where the traced line hands over to it)
    const ease=(S,k)=>{let L=0;for(let i=k;i>0&&L<3*med;i--){L+=Math.hypot(S.R[i][0]-S.R[i-1][0],S.R[i][1]-S.R[i-1][1]);const q=S.R[i],a=Math.atan2(q[1]-C.c[1],q[0]-C.c[0]),rq=Math.hypot(q[0]-C.c[0],q[1]-C.c[1]);
        if(Math.abs(fr(a)-rq)>0.6*med)break;const w0=Math.max(0,1-L/(3*med)),w=w0*w0*(3-2*w0),r2=rq+(fr(a)-rq)*w;S.R[i]=[C.c[0]+r2*Math.cos(a),C.c[1]+r2*Math.sin(a)];}
      const q=S.R[k],a=Math.atan2(q[1]-C.c[1],q[0]-C.c[0]);if(Math.abs(fr(a)-Math.hypot(q[0]-C.c[0],q[1]-C.c[1]))<=0.6*med)S.R[k]=[C.c[0]+fr(a)*Math.cos(a),C.c[1]+fr(a)*Math.sin(a)];};
    // (and the round top has to lie on the drawing: a cap that would cross the glass is not used)
    {let bad=0,tot=0;for(const c of[cap(dA,S1.R[k1]),cap(dB,S2.R[k2])])for(let i=1;i<c.length;i++){const a=c[i-1],b=c[i],m=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));
        for(let t=0;t<m;t++){const y=Math.round(a[0]+(b[0]-a[0])*t/m),x=Math.round(a[1]+(b[1]-a[1])*t/m);tot++;if(y<0||x<0||y>=H||x>=W||dmap[y*W+x]<0.5)bad++;}}
      if(relaxed&&bad>Math.max(0.5*med,0.05*tot))continue;}
    ease(S1,k1);ease(S2,k2);
    const aA=cap(dA,S1.R[k1]),aB=cap(dB,S2.R[k2]);aA[aA.length-1]=T.slice();aB[aB.length-1]=T.slice();
    const i1b=k1,i2b=k2;
    const new1=S1.R.slice(0,i1b+1).concat(aA),new2=S2.R.slice(0,i2b+1).concat(aB);
    if(E1.s===E2.s){
      // (one loop, both of whose ends land here: start and end it at the touching point)
      const Q=strokes[E1.s],j1=Q.length-1-i1b;if(j1>=i2b)continue;for(let i=0;i<=i1b;i++)Q[Q.length-1-i]=S1.R[i];
      strokes[E1.s]=[T.slice()].concat(aA.slice(0,-1).reverse(),Q.slice(j1,i2b+1).map(q=>q.slice()),aB);}
    else{strokes[E1.s]=E1.end===1?new1:new1.slice().reverse();strokes[E2.s]=E2.end===1?new2:new2.slice().reverse();}
    joins.push([E1.s,S1.R[k1].slice()],[E2.s,S2.R[k2].slice()]);used.add(x);used.add(y);}
  // (where a shape was rounded at both ends, its two new halves meet at its sides; each meeting is evened out over a
  // few line widths either way, over the stretch each side was eased, so no small step shows there)
  for(const[s,p]of joins){const Q=strokes[s];if(!Q||Q.length<10)continue;let bi=0,bd=1e18;for(let i=0;i<Q.length;i++){const d=(Q[i][0]-p[0])**2+(Q[i][1]-p[1])**2;if(d<bd){bd=d;bi=i;}}
    if(bd>(0.6*med)**2)continue;const R=3.5*med;let lo=bi,hi=bi,L=0;while(lo>1&&L<R){L+=Math.hypot(Q[lo][0]-Q[lo-1][0],Q[lo][1]-Q[lo-1][1]);lo--;}L=0;while(hi<Q.length-2&&L<R){L+=Math.hypot(Q[hi+1][0]-Q[hi][0],Q[hi+1][1]-Q[hi][1]);hi++;}
    for(let it=0;it<4;it++){const c=Q.map(q=>q.slice());for(let i=lo;i<=hi;i++){let a=0,b=0,n2=0;for(let j=Math.max(0,i-4);j<=Math.min(Q.length-1,i+4);j++){a+=c[j][0];b+=c[j][1];n2++;}const w0=Math.max(0,1-Math.abs(i-bi)/Math.max(1,i<bi?bi-lo:hi-bi)),w=w0*w0*(3-2*w0);Q[i]=[c[i][0]+(a/n2-c[i][0])*w,c[i][1]+(b/n2-c[i][1])*w];}}}
  return strokes;}
