// ================================================================================================
// The outside outline evened out: a hand-drawn border wobbles a little where the pen did, and the
// usual smoothing keeps close to the drawn line. Along the pattern's outside edge only, each stretch
// between corners is smoothed over a longer reach, so the border runs as one even curve. Lines that
// end on the border move their ends with it, so every joint stays joined. Straight lines, exact
// circles and clean curves come out as they went in; only wobble is taken out.
// ================================================================================================
function smoothOutline(strokes,m,med,junctions){
  const{out,wall,side}=outsideOf(strokes,med);
  const K=25;   // (K: the shortest wobble taken out, in lead widths)
  // (what lies just off a line on one side: step out across its own width and look at the first open pixel, so a
  // narrow wedge beside the line is seen as the wedge and not as whatever lies past the next line)
  // (every line end with the direction the line leaves it in, to find lines meeting the border at a slant)
  const endDir=[];for(const S of strokes){if(S.length<3)continue;for(const end of[0,1]){const e=end?S[S.length-1]:S[0];let j=end?S.length-1:0,c=0;
      while(c<med&&(end?j>0:j<S.length-1)){const k=end?j-1:j+1;c+=Math.hypot(S[k][0]-S[j][0],S[k][1]-S[j][1]);j=k;}
      const L=Math.hypot(S[j][0]-e[0],S[j][1]-e[1])||1;endDir.push([e,[(S[j][0]-e[0])/L,(S[j][1]-e[1])/L],S]);}}
  const res=strokes.map(Q=>{const n=Q.length;if(n<8)return Q;
    const cum=[0];for(let k=1;k<n;k++)cum.push(cum[k-1]+Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]));
    const at=(k,dl)=>{let j=k;if(dl<0)while(j>0&&cum[k]-cum[j]<-dl)j--;else while(j<n-1&&cum[j]-cum[k]<dl)j++;return j;};
    // (points with the outside paper on one side of them)
    const edge=Q.map((q,k)=>{const a=Q[at(k,-0.5*med)],b=Q[at(k,0.5*med)];let ty=b[0]-a[0],tx=b[1]-a[1];const L=Math.hypot(ty,tx);if(L<1e-6)return false;ty/=L;tx/=L;
      return side(q,-tx,ty)!==side(q,tx,-ty);});
    if(!edge.some(v=>v))return Q;
    // (corners stay put: a clear turn within a short reach)
    const corner=Q.map((q,k)=>{const a=Q[at(k,-med)],b=Q[at(k,med)];if(a===q||b===q)return false;const v1=[q[0]-a[0],q[1]-a[1]],v2=[b[0]-q[0],b[1]-q[1]];
      const c=(v1[0]*v2[0]+v1[1]*v2[1])/((Math.hypot(...v1)*Math.hypot(...v2))||1);return c<Math.cos(12*Math.PI/180);});
    // (the weight a point is held by: 0 free, 1 fixed; the stroke's own ends (and a lead width in from them, where a
    // corner there can't be seen), corners and non-border points are held,
    // and the hold eases off over a short reach so nothing kinks where the smoothing starts)
    const hold=new Float64Array(n);for(let k=0;k<n;k++)hold[k]=(cum[k]<med||cum[n-1]-cum[k]<med||corner[k]||!edge[k])?1:0;
    // (and where another line meets the border at a slant, in a narrow wedge, the border stays as traced: there the
    // two lines were placed together and moving one would open or close the wedge)
    for(const[e,d,S]of endDir){if(S===Q)continue;let bi=-1,bd=2.5;for(let k=0;k<n;k++){const v=Math.hypot(Q[k][0]-e[0],Q[k][1]-e[1]);if(v<bd){bd=v;bi=k;}}if(bi<0)continue;
      const a=Q[at(bi,-0.5*med)],b=Q[at(bi,0.5*med)],tl=Math.hypot(b[0]-a[0],b[1]-a[1])||1,cs=Math.abs(((b[0]-a[0])*d[0]+(b[1]-a[1])*d[1])/tl);
      if(cs>Math.cos(45*Math.PI/180))for(let k=0;k<n;k++)if(Math.abs(cum[k]-cum[bi])<2.5*med)hold[k]=1;}   // (the whole wedge, a couple of leads along)
    // (a smoothing spline along each free stretch of border between corners, as even as it can be while keeping
    // within a third of a lead width of the traced line; where the spline would stray further it is pulled back)
    const ds=cum[n-1]/(n-1)||1,sl=(K*med/ds)/(2*Math.PI),lam=Math.pow(sl,4),tol=0.22*med;
    // (every joint on this line breaks the smoothing too: a line can run on through a joint at a slight turn, from the
    // border into the pattern, and that turn is kept)
    const jn=new Uint8Array(n);for(const[e,d,S]of endDir){if(S===Q)continue;let bi=-1,bd=2.5;for(let k=0;k<n;k++){const v=Math.hypot(Q[k][0]-e[0],Q[k][1]-e[1]);if(v<bd){bd=v;bi=k;}}if(bi>=0)jn[bi]=1;}
    const brk=k=>cum[k]<med||cum[n-1]-cum[k]<med||corner[k]||!edge[k]||jn[k];const Z=Q.map(q=>q.slice());
    for(let a=0;a<n;){if(brk(a)){a++;continue;}let b=a;while(b+1<n&&!brk(b+1))b++;
      if(cum[b]-cum[a]>=3*med){const Y=Q.slice(a,b+1),m=Y.length;let wc=new Array(m).fill(1),F=Y;
        for(let it=0;it<12;it++){F=whittaker(Y,wc,lam);const over=new Float64Array(m);let mx=0;
          for(let k=0;k<m;k++){const d=Math.hypot(F[k][0]-Y[k][0],F[k][1]-Y[k][1])/tol;over[k]=d;if(d>mx)mx=d;}
          if(mx<=1)break;const g=gaussFilter(maxFilter(over,Math.max(3,Math.floor(med/ds))|1),med/ds);
          wc=wc.map((v,k)=>v*(1+2*Math.pow(Math.max(0,g[k]-0.7),2)));}
        for(let k=0;k<m;k++)Z[a+k]=F[k];}
      a=b+1;}
    // (the move eases off over a short reach towards every held point, so the border meets them without a kink)
    // (and a line coming into a joint is left as traced for a couple of lead widths: the tracing may have drawn it
    // towards a joint set a little off the line, and evening that out would spread the bend along the border)
    const ease=1.2*med,h2=new Float64Array(n);
    for(let k=0;k<n;k++){if(!jn[k])continue;for(let j=0;j<n;j++)if(Math.abs(cum[j]-cum[k])<2*med)h2[j]=1;}
    for(let k=0;k<n;k++){if(!hold[k]&&!brk(k))continue;for(let j=k;j>=0&&cum[k]-cum[j]<ease;j--){const f=1-(cum[k]-cum[j])/ease;h2[j]=Math.max(h2[j],f*f*(3-2*f));}
      for(let j=k;j<n&&cum[j]-cum[k]<ease;j++){const f=1-(cum[j]-cum[k])/ease;h2[j]=Math.max(h2[j],f*f*(3-2*f));}}
    const R=Q.map((q,k)=>{const t=1-h2[k];return t>0?[q[0]+(Z[k][0]-q[0])*t,q[1]+(Z[k][1]-q[1])*t]:q;});
    return R;});
  // (a line ending on a moved stretch of border moves its end with it, eased back along itself)
  const moved=[];res.forEach((R,t)=>{if(R!==strokes[t])moved.push(t);});if(!moved.length)return strokes;
  const shiftAt=(p,skip)=>{let bd=2.5,v=null;for(const u of moved){if(u===skip)continue;const Q=strokes[u];for(let i=0;i<Q.length;i++){const d=Math.hypot(Q[i][0]-p[0],Q[i][1]-p[1]);if(d<bd){bd=d;v=[res[u][i][0]-Q[i][0],res[u][i][1]-Q[i][1]];}}}return v;};
  const fin=res.map((R,t)=>{if(R.length<2)return R;let o=R;
    for(const end of[0,1]){const e=strokes[t][end?strokes[t].length-1:0],v=shiftAt(e,t);if(!v||Math.hypot(v[0],v[1])<0.05)continue;if(o===R)o=R.slice();
      const n=o.length;let c=0;for(let s=0;s<n;s++){const k=end?n-1-s:s;if(s>0){const p=end?k+1:k-1;c+=Math.hypot(strokes[t][k][0]-strokes[t][p][0],strokes[t][k][1]-strokes[t][p][1]);}
        if(c>1.5*med)break;const f=1-c/(1.5*med),w=f*f*(3-2*f);o[k]=[o[k][0]+v[0]*w,o[k][1]+v[1]*w];}}
    return o;});
  if(junctions)for(const J of junctions){const v=shiftAt(J.p,-1);if(v)J.p=[J.p[0]+v[0],J.p[1]+v[1]];}
  return fin;}

// The paper outside the pattern, found from the new lines themselves (so a gap in the drawn border can't let the
// paper in), and side(q,dy,dx): whether the first open pixel just off a line in that direction is that paper.
function outsideOf(strokes,med){
  const N=W*H,out=new Uint8Array(N),st=new Int32Array(N),wall=new Uint8Array(N);let sp=0;
  const rr=Math.max(1.5,0.3*med);
  for(const S of strokes)for(let k=0;k<S.length;k++){const a=S[k],b=S[Math.min(S.length-1,k+1)],L=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));
    for(let t=0;t<=L;t++){const y=a[0]+(b[0]-a[0])*t/L,x=a[1]+(b[1]-a[1])*t/L;
      for(let dy=-Math.ceil(rr);dy<=Math.ceil(rr);dy++)for(let dx=-Math.ceil(rr);dx<=Math.ceil(rr);dx++){if(dy*dy+dx*dx>rr*rr)continue;const yy=Math.round(y)+dy,xx=Math.round(x)+dx;if(yy>=0&&xx>=0&&yy<H&&xx<W)wall[yy*W+xx]=1;}}}
  const seed=i=>{if(!wall[i]&&!out[i]){out[i]=1;st[sp++]=i;}};
  for(let x=0;x<W;x++){seed(x);seed((H-1)*W+x);}for(let y=0;y<H;y++){seed(y*W);seed(y*W+W-1);}
  while(sp){const j=st[--sp],y=(j/W)|0,x=j-y*W;if(x>0)seed(j-1);if(x<W-1)seed(j+1);if(y>0)seed(j-W);if(y<H-1)seed(j+W);}
  // (step out across the line's own width and look at the first open pixel, so a narrow wedge beside the line is
  // seen as the wedge and not as whatever lies past the next line)
  const side=(q,dy,dx)=>{for(let t=1;t<=2*med;t++){const y=Math.round(q[0]+dy*t),x=Math.round(q[1]+dx*t);if(y<0||x<0||y>=H||x>=W)return true;const i=y*W+x;if(!wall[i])return out[i]===1;}return false;};
  return{out,wall,side};}

// ================================================================================================
// Square up a hand-drawn border: when the pattern's outside edge is a rectangle drawn by hand (a little
// slanted, wobbly, its corners rounded), it is set on a true rectangle with sharp right-angle corners,
// level and upright on the page. Lines ending on the border move their ends with it. A border that
// isn't close to a rectangle all the way round is left alone.
// ================================================================================================
function squareBorder(strokes,med,junctions){
  const{side}=outsideOf(strokes,med);
  // (the border's points: the outside paper on one side of them)
  const marks=strokes.map(Q=>{const n=Q.length;if(n<4)return null;const cum=[0];for(let k=1;k<n;k++)cum.push(cum[k-1]+Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]));
    // (with the line's heading there, as 0 level, 1 upright, -1 neither, so a line that only comes up to the border
    // at a slant is never laid along it)
    let j0=0,j1=0;return Q.map((q,k)=>{while(cum[k]-cum[j0]>0.5*med)j0++;while(j1<n-1&&cum[j1]-cum[k]<0.5*med)j1++;const a=Q[j0],b=Q[j1];let ty=b[0]-a[0],tx=b[1]-a[1];const L=Math.hypot(ty,tx);if(L<1e-6)return false;ty/=L;tx/=L;
      if(side(q,-tx,ty)===side(q,tx,-ty))return false;const c=Math.cos(30*Math.PI/180);return Math.abs(tx)>c?'h':Math.abs(ty)>c?'v':false;});});
  // (only long straight-ish runs along the edge count: a line that just touches the border, running beside it for a
  // moment, would otherwise be laid onto it)
  strokes.forEach((Q,t)=>{const mk=marks[t];if(!mk)return;for(let a=0;a<Q.length;){if(!mk[a]){a++;continue;}let b=a,L=0;while(b+1<Q.length&&mk[b+1]===mk[a]){L+=Math.hypot(Q[b+1][0]-Q[b][0],Q[b+1][1]-Q[b][1]);b++;}
      if(L<8*med)for(let k=a;k<=b;k++)mk[k]=false;a=b+1;}});
  const P=[];strokes.forEach((Q,t)=>{if(marks[t])Q.forEach((q,k)=>{if(marks[t][k])P.push(q);});});if(P.length<100)return strokes;
  // (each side: the middle of the border points lying near that edge of their box)
  let y0=1e9,y1=-1e9,x0=1e9,x1=-1e9;for(const q of P){if(q[0]<y0)y0=q[0];if(q[0]>y1)y1=q[0];if(q[1]<x0)x0=q[1];if(q[1]>x1)x1=q[1];}
  const bw=x1-x0,bh=y1-y0;if(bw<20*med||bh<20*med)return strokes;const band=Math.max(3*med,0.04*Math.min(bw,bh));
  const med1=a=>{if(a.length<10)return null;a.sort((p,q)=>p-q);return a[a.length>>1];};
  const T=med1(P.filter(q=>q[0]<y0+band).map(q=>q[0])),B=med1(P.filter(q=>q[0]>y1-band).map(q=>q[0])),
        Lx=med1(P.filter(q=>q[1]<x0+band).map(q=>q[1])),Rx=med1(P.filter(q=>q[1]>x1-band).map(q=>q[1]));
  if(T===null||B===null||Lx===null||Rx===null)return strokes;
  // (near a rectangle all the way round: nearly every border point within a couple of lead widths of a side)
  const tol=Math.max(2.5*med,0.012*Math.max(bw,bh));
  const dist=q=>{const dy=Math.max(T-q[0],0,q[0]-B),dx=Math.max(Lx-q[1],0,q[1]-Rx);if(dy>0||dx>0)return Math.hypot(dy,dx);return Math.min(q[0]-T,B-q[0],q[1]-Lx,Rx-q[1]);};
  let near=0;for(const q of P)if(dist(q)<=tol)near++;if(near<0.97*P.length)return strokes;
  // (a border already drawn true, its sides straight and level (squared up with the other exact lines), is left as it is:
  // this is for one drawn by hand)
  {const dv=P.map(dist).sort((a,b)=>a-b);if(dv[Math.floor(dv.length*0.9)]<1.5)return strokes;}
  // (each border point onto the nearest side; where a line turns from one side to the next, the true corner)
  const snap=(q,hv)=>{const c=[[Math.abs(q[0]-T),0],[Math.abs(q[0]-B),1],[Math.abs(q[1]-Lx),2],[Math.abs(q[1]-Rx),3]].filter(v=>!hv||(hv==='h')===(v[1]<2)).sort((a,b)=>a[0]-b[0])[0][1];
    const y=Math.min(B,Math.max(T,q[0])),x=Math.min(Rx,Math.max(Lx,q[1]));return{s:c,p:c===0?[T,x]:c===1?[B,x]:c===2?[y,Lx]:[y,Rx]};};
  const corner=(a,b)=>{const ys=[a,b].includes(0)?T:[a,b].includes(1)?B:null,xs=[a,b].includes(2)?Lx:[a,b].includes(3)?Rx:null;return ys!==null&&xs!==null?[ys,xs]:null;};
  // (a short break in a run along one side, where a joint sits just inside the border and the line dips to it, is
  // laid on the side too)
  strokes.forEach((Q,t)=>{const mk=marks[t];if(!mk)return;let lastK=-1;
    for(let k=0;k<Q.length;k++){if(!mk[k])continue;if(lastK>=0&&k-lastK>1&&mk[lastK]!==mk[k]&&mk[lastK]!=='c'){let L=0;for(let j=lastK+1;j<=k;j++)L+=Math.hypot(Q[j][0]-Q[j-1][0],Q[j][1]-Q[j-1][1]);
        if(L<6*med){let ok=true;for(let j=lastK+1;j<k;j++)if(dist(Q[j])>tol)ok=false;if(ok)for(let j=lastK+1;j<k;j++)mk[j]='c';}}
      else if(lastK>=0&&k-lastK>1&&mk[lastK]===mk[k]){let L=0;for(let j=lastK+1;j<=k;j++)L+=Math.hypot(Q[j][0]-Q[j-1][0],Q[j][1]-Q[j-1][1]);
        if(L<3*med){let ok=true;for(let j=lastK+1;j<k;j++)if(dist(Q[j])>tol)ok=false;if(ok)for(let j=lastK+1;j<k;j++)mk[j]=mk[k];}}lastK=k;}});
  // (a border line's own last stretch, turning off into a joint set just inside the border, goes onto the border too, so
  // the joint comes out on it instead of a little step being left)
  strokes.forEach((Q,t)=>{const mk=marks[t];if(!mk)return;const n=Q.length;
    for(const end of[0,1]){let k=end?n-1:0;const step=end?-1:1;const tail=[];while(k>=0&&k<n&&!mk[k]&&dist(Q[k])<=tol){tail.push(k);k+=step;}
      if(k>=0&&k<n&&mk[k]&&tail.length)for(const j of tail)mk[j]=mk[k];}});
  const res=strokes.map((Q,t)=>{const mk=marks[t];if(!mk)return Q;let any=false;const R=[];let last=-1;
    for(let k=0;k<Q.length;k++){if(mk[k]==='c'){any=true;continue;}   // (a rounded corner: dropped, the true corner goes in its place)
      const sd=mk[k]?snap(Q[k],mk[k]):null;if(!sd||Math.abs((sd.s<2?sd.p[0]-Q[k][0]:sd.p[1]-Q[k][1]))>tol||dist(Q[k])>tol){R.push(Q[k]);last=-1;continue;}const v=sd;any=true;
      if(last>=0&&v.s!==last){const c=corner(last,v.s);if(c)R.push(c);}R.push(v.p);last=v.s;}
    // (a border line that ends at a corner ends exactly on it, so the two sides meeting there close up)
    if(any)for(const end of[0,1]){const k=end?R.length-1:0,q=R[k];const cy=Math.abs(q[0]-T)<=tol?T:Math.abs(q[0]-B)<=tol?B:null,cx=Math.abs(q[1]-Lx)<=tol?Lx:Math.abs(q[1]-Rx)<=tol?Rx:null;
      if(cy!==null&&cx!==null&&(q[0]===cy||q[1]===cx))R[k]=[cy,cx];}
    return any?R:Q;});
  // (a line ending on the border moves its end with it, eased back along itself)
  const moved=[];res.forEach((R,t)=>{if(R!==strokes[t])moved.push(t);});if(!moved.length)return strokes;
  const shiftAt=(p,skip)=>{let bd=Math.max(2.5,0.8*med),v=null;for(const u of moved){if(u===skip)continue;const Q=strokes[u];for(const q of Q){const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<bd&&marks[u]){bd=d;const R=res[u],j=Q.indexOf(q);const s=(R.length===Q.length&&j>=0)?R[j]:(dist(q)<=tol?snap(q).p:q);v=[s[0]-q[0],s[1]-q[1]];}}}return v;};
  const fin=res.map((R,t)=>{if(R!==strokes[t]||R.length<2)return R;let o=R;
    for(const end of[0,1]){const e=R[end?R.length-1:0];let v=shiftAt(e,t);if(!v||Math.hypot(v[0],v[1])<0.05)continue;if(o===R)o=R.slice();
      // (a line meeting the border at an angle is run on, or cut back, along its own heading to the moved border, rather
      // than bent sideways to it)
      {const n=R.length;let j=end?n-1:0,c=0;while(c<med&&(end?j>0:j<n-1)){const k=end?j-1:j+1;c+=Math.hypot(R[k][0]-R[j][0],R[k][1]-R[j][1]);j=k;}
        const dy=e[0]-R[j][0],dx=e[1]-R[j][1],L=Math.hypot(dy,dx);
        if(L>1e-6){const uy=dy/L,ux=dx/L,horiz=Math.abs(v[1])>Math.abs(v[0]);const den=horiz?ux:uy,goal=horiz?e[1]+v[1]:e[0]+v[0],from=horiz?e[1]:e[0];
          if(Math.abs(den)>0.35){const tt=(goal-from)/den;if(Math.abs(tt)<=3*Math.hypot(v[0],v[1])+med)v=[uy*tt,ux*tt];}}}
      const n=o.length;let c=0;for(let s=0;s<n;s++){const k=end?n-1-s:s;if(s>0){const p=end?k+1:k-1;c+=Math.hypot(R[k][0]-R[p][0],R[k][1]-R[p][1]);}
        const reach=Math.max(1.5*med,3*Math.hypot(v[0],v[1]));if(c>reach)break;const f=1-c/reach,w=f*f*(3-2*f);o[k]=[o[k][0]+v[0]*w,o[k][1]+v[1]*w];}}
    return o;});
  if(junctions)for(const J of junctions){const v=shiftAt(J.p,-1);if(v)J.p=[J.p[0]+v[0],J.p[1]+v[1]];}
  return fin;}
