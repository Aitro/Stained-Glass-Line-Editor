// Keep narrow gaps: lines that cross where the drawing has them meet.
// ------------------------------------------------------------------------------------------------
// Where two traced lines cross close to the end of one of them (not at a joint), the drawing almost always has one
// line ending on the other there, as where two lines run into a border through a wedge of ink. The line whose last
// stretch past the crossing wanders off the lines as drawn (checked against the Change width only trace) is the one
// that overshoots: it is cut at the crossing, so it ends on the other line.
function uncross(strokes,drawn,med){
  const mask=new Uint8Array(W*H);
  for(const Q of drawn)for(let k=1;k<Q.length;k++){const a=Q[k-1],b=Q[k],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));
    for(let t=0;t<=n;t++){const y=Math.round(a[0]+(b[0]-a[0])*t/n),x=Math.round(a[1]+(b[1]-a[1])*t/n);if(y>=0&&x>=0&&y<H&&x<W)mask[y*W+x]=1;}}
  const dd=edt(mask);const dev=(y,x)=>{y=Math.round(y);x=Math.round(x);return(y>=0&&x>=0&&y<H&&x<W)?Math.sqrt(dd[y*W+x]):0;};
  const len=(Q,i0,i1)=>{let L=0;for(let k=i0+1;k<=i1;k++)L+=Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]);return L;};
  // (how far a stretch strays from the lines as drawn, on average)
  const stray=(Q,i0,i1)=>{let s=0,n=0;for(let k=i0;k<=i1;k++){s+=dev(Q[k][0],Q[k][1]);n++;}return n?s/n:0;};
  const near=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1])<3;
  // (crossings found through a grid of the lines' segments, so long lines don't make it slow)
  const crossings=()=>{const cell=16,G=new Map(),out=[],seen=new Set();
    strokes.forEach((Q,si)=>{for(let k=1;k<Q.length;k++){const a=Q[k-1],b=Q[k];
      for(let cy=Math.floor(Math.min(a[0],b[0])/cell);cy<=Math.floor(Math.max(a[0],b[0])/cell);cy++)for(let cx=Math.floor(Math.min(a[1],b[1])/cell);cx<=Math.floor(Math.max(a[1],b[1])/cell);cx++){
        const key=cy*100000+cx;let L=G.get(key);if(!L)G.set(key,L=[]);L.push(si,k);}}});
    G.forEach(L=>{for(let x=0;x<L.length;x+=2)for(let y=x+2;y<L.length;y+=2){let i=L[x],k=L[x+1],j=L[y],l=L[y+1];if(i===j)continue;if(i>j){[i,j]=[j,i];[k,l]=[l,k];}
      const id=i+','+k+','+j+','+l;if(seen.has(id))continue;seen.add(id);const A=strokes[i],C=strokes[j],p=A[k-1],r=[A[k][0]-p[0],A[k][1]-p[1]],q=C[l-1],s2=[C[l][0]-q[0],C[l][1]-q[1]],den=r[0]*s2[1]-r[1]*s2[0];
      if(Math.abs(den)<1e-9)continue;const t=((q[0]-p[0])*s2[1]-(q[1]-p[1])*s2[0])/den,v=((q[0]-p[0])*r[1]-(q[1]-p[1])*r[0])/den;if(t<=0||t>=1||v<=0||v>=1)continue;
      out.push({i,k,j,l,X:[p[0]+t*r[0],p[1]+t*r[1]]});}});
    return out;};
  // (how much of a stretch of one line lies within about a line width of some other line)
  const beside=(si,i0,i1)=>{const r=0.8*med,cell=Math.max(4,Math.ceil(r)),G=new Map();
    strokes.forEach((Q,s)=>{if(s===si)return;for(let k=0;k<Q.length;k++){const a=k?Q[k-1]:Q[k],q=Q[k],n=Math.max(1,Math.ceil(Math.hypot(q[0]-a[0],q[1]-a[1])/2));
      for(let t=1;t<=n;t++){const y=a[0]+(q[0]-a[0])*t/n,x=a[1]+(q[1]-a[1])*t/n,kk=((y/cell)|0)*100000+((x/cell)|0);let L=G.get(kk);if(!L)G.set(kk,L=[]);L.push(y,x);}}});
    const Q=strokes[si];let n=0,c=0;for(let k=i0;k<=i1;k++){const q=Q[k];n++;const cy=(q[0]/cell)|0,cx=(q[1]/cell)|0;let hit=false;
      for(let dy=-1;dy<=1&&!hit;dy++)for(let dx=-1;dx<=1&&!hit;dx++){const L=G.get((cy+dy)*100000+cx+dx);if(L)for(let t=0;t<L.length;t+=2)if(Math.hypot(L[t]-q[0],L[t+1]-q[1])<=r){hit=true;break;}}
      if(hit)c++;}return n?c/n:0;};
  for(let pass=0;pass<8;pass++){let cut=false;
    for(const{i,k,j,l,X}of crossings()){const A=strokes[i],C=strokes[j];
      if([A[0],A[A.length-1],C[0],C[C.length-1]].some(e=>near(e,X)))continue;
      // (each line's tail past the crossing, toward its nearer end)
      const tail=(Q,m)=>{const toStart=len(Q,0,m-1)+Math.hypot(X[0]-Q[m-1][0],X[1]-Q[m-1][1]),toEnd=len(Q,m,Q.length-1)+Math.hypot(X[0]-Q[m][0],X[1]-Q[m][1]);
        return toStart<toEnd?{start:true,L:toStart,dev:stray(Q,0,m-1)}:{start:false,L:toEnd,dev:stray(Q,m,Q.length-1)};};
      // (and only a tail that runs alongside other lines, doubling them: a tail that is the only line along its way
      // is a real edge of a piece, such as the bottom of a small window, and is never cut away)
      const cand=[[i,k,tail(A,k)],[j,l,tail(C,l)]].filter(([si,m,T])=>T.L<=6*med&&T.dev>0.15*med&&(T.start?beside(si,0,m-1):beside(si,m,strokes[si].length-1))>=0.7);if(!cand.length)continue;
      cand.sort((x,y)=>y[2].dev-x[2].dev);const[si,m,T]=cand[0];const Q=strokes[si];
      if(T.start)strokes[si]=[X].concat(Q.slice(m));else strokes[si]=Q.slice(0,m).concat([X]);
      cut=true;break;}
    if(!cut)break;}
  return strokes;}

// Keep narrow gaps: a line that stops just short of another line (the drawing leaves a sliver of paper between them)
// is carried on along its own direction until it meets that line, so every piece is closed.
function reachLines(strokes,med){
  const ends=[];strokes.forEach((Q,s)=>{if(Q.length<3)return;const a=Q[0],b=Q[Q.length-1];if(Math.hypot(a[0]-b[0],a[1]-b[1])<3)return;ends.push([s,0],[s,1]);});
  const touches=(p,s)=>strokes.some((F,t)=>{if(F.length<2)return false;for(let k=0;k<F.length;k++){if(t===s&&(k<4||k>F.length-5))continue;if(Math.hypot(F[k][0]-p[0],F[k][1]-p[1])<3)return true;}return false;});
  for(const[s,e]of ends){const Q=strokes[s],p=e?Q[Q.length-1]:Q[0],q=e?Q[Math.max(0,Q.length-6)]:Q[Math.min(Q.length-1,5)];
    if(touches(p,s))continue;const n=Math.hypot(p[0]-q[0],p[1]-q[1])||1,dir=[(p[0]-q[0])/n,(p[1]-q[1])/n];
    // (the nearest line straight ahead, within about two line widths)
    let best=null;strokes.forEach((F,t)=>{for(let k=1;k<F.length;k++){if(t===s&&Math.min(k,F.length-k)<8)continue;const a=F[k-1],b=F[k],sg=[b[0]-a[0],b[1]-a[1]],den=dir[0]*sg[1]-dir[1]*sg[0];if(Math.abs(den)<1e-9)continue;
      const tt=((a[0]-p[0])*sg[1]-(a[1]-p[1])*sg[0])/den,v=((a[0]-p[0])*dir[1]-(a[1]-p[1])*dir[0])/den;if(tt>0&&tt<=2*med&&v>=0&&v<=1&&(!best||tt<best))best=tt;}});
    if(best==null)continue;const hit=[p[0]+dir[0]*best,p[1]+dir[1]*best],add=[];const m=Math.max(1,Math.ceil(best));for(let i=1;i<=m;i++)add.push([p[0]+dir[0]*best*i/m,p[1]+dir[1]*best*i/m]);void hit;
    strokes[s]=e?Q.concat(add):add.reverse().concat(Q);}
  return strokes;}

// Keep narrow gaps: a traced line that cuts across open paper (where tidying has pulled it straight past a bend, or
// joined it to the wrong joint) is laid back along the line as drawn: the Change width only trace, which follows the
// middle of the ink, between the same two ends.
function followDrawn(strokes,drawn,dmap,med){
  const on=new Uint8Array(W*H);
  for(const Q of drawn)for(let k=1;k<Q.length;k++){const a=Q[k-1],b=Q[k],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));
    for(let t=0;t<=n;t++){const y=Math.round(a[0]+(b[0]-a[0])*t/n),x=Math.round(a[1]+(b[1]-a[1])*t/n);if(y>=0&&x>=0&&y<H&&x<W)on[y*W+x]=1;}}
  const dense=Q=>{const out=[Q[0]];for(let k=1;k<Q.length;k++){const a=Q[k-1],b=Q[k],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));for(let t=1;t<=n;t++)out.push([a[0]+(b[0]-a[0])*t/n,a[1]+(b[1]-a[1])*t/n]);}return out;};
  const paperRun=Q=>{let run=0,best=0;for(const q of dense(Q)){const y=Math.round(q[0]),x=Math.round(q[1]);if(y>=0&&x>=0&&y<H&&x<W&&dmap[y*W+x]<0.5){run++;if(run>best)best=run;}else run=0;}return best;};
  const nearOn=(p,R)=>{let best=-1,bd=1e9;const py=Math.round(p[0]),px=Math.round(p[1]);for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const y=py+dy,x=px+dx;if(y<0||x<0||y>=H||x>=W||!on[y*W+x])continue;const d=dx*dx+dy*dy;if(d<bd){bd=d;best=y*W+x;}}return best;};
  const len=Q=>{let L=0;for(let k=1;k<Q.length;k++)L+=Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]);return L;};
  return strokes.map(Q=>{if(Q.length<3)return Q;const pr=paperRun(Q);if(pr<0.6*med)return Q;
    const R=Math.ceil(1.5*med),s=nearOn(Q[0],R),t=nearOn(Q[Q.length-1],R);if(s<0||t<0||s===t)return Q;
    // (shortest way along the drawn lines, kept to the neighbourhood of this line)
    let y0=1e9,x0=1e9,y1=-1e9,x1=-1e9;for(const q of Q){y0=Math.min(y0,q[0]);y1=Math.max(y1,q[0]);x0=Math.min(x0,q[1]);x1=Math.max(x1,q[1]);}
    const m=3*med;y0-=m;x0-=m;y1+=m;x1+=m;const L0=len(Q),lim=1.6*L0+2*med;
    const dist=new Map(),prev=new Map(),heap=[];const push=(d,i)=>{heap.push([d,i]);let c=heap.length-1;while(c>0){const p=(c-1)>>1;if(heap[p][0]<=heap[c][0])break;[heap[p],heap[c]]=[heap[c],heap[p]];c=p;}};
    const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let c=0;for(;;){const l=2*c+1,r=l+1;let m2=c;if(l<heap.length&&heap[l][0]<heap[m2][0])m2=l;if(r<heap.length&&heap[r][0]<heap[m2][0])m2=r;if(m2===c)break;[heap[m2],heap[c]]=[heap[c],heap[m2]];c=m2;}}return top;};
    dist.set(s,0);push(0,s);let found=false;
    while(heap.length){const[d,i]=pop();if(d>dist.get(i))continue;if(i===t){found=true;break;}if(d>lim)break;const y=(i/W)|0,x=i%W;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const Y=y+dy,X=x+dx;if(Y<y0||X<x0||Y>y1||X>x1||Y<0||X<0||Y>=H||X>=W)continue;const j=Y*W+X;if(!on[j])continue;
        const nd=d+(dx&&dy?1.4142:1);if(nd<(dist.has(j)?dist.get(j):1e18)){dist.set(j,nd);prev.set(j,i);push(nd,j);}}}
    if(!found)return Q;const path=[];for(let i=t;i!==undefined;i=prev.get(i)){path.push([(i/W)|0,i%W]);if(i===s)break;}path.reverse();
    // (evened out a little, every couple of pixels, and joined to this line's own two ends)
    const full=[Q[0].slice()].concat(path,[Q[Q.length-1].slice()]);let sm=full;
    // (smoothed well, a dozen pixels either way, the two ends held where they are)
    for(let it=0;it<3;it++)sm=sm.map((q,i)=>{if(i===0||i===sm.length-1)return q;const R2=Math.min(12,i,sm.length-1-i);let a=0,b=0,c=0;for(let j=i-R2;j<=i+R2;j++){a+=sm[j][0];b+=sm[j][1];c++;}return[a/c,b/c];});
    const out=[Q[0].slice()];for(let i=2;i<sm.length-2;i+=2)out.push(sm[i]);out.push(Q[Q.length-1].slice());
    // (and no sharp bend: the drawn trace can wobble where lines meet; a line that would come out kinked is left as it was)
    const turn=R=>{let mx=0;const st=Math.max(2,Math.round(0.25*med/2));for(let i=st;i<R.length-st;i++){const a=R[i-st],b=R[i],c=R[i+st];const v1=[b[0]-a[0],b[1]-a[1]],v2=[c[0]-b[0],c[1]-b[1]];const n1=Math.hypot(...v1),n2=Math.hypot(...v2);if(n1<1e-6||n2<1e-6)continue;mx=Math.max(mx,Math.acos(Math.max(-1,Math.min(1,(v1[0]*v2[0]+v1[1]*v2[1])/(n1*n2)))));}return mx;};
    if(turn(out)>Math.max(0.6,turn(Q)+0.2))return Q;
    // (only a fix of the stretch that strayed: the new way stays near the old line, a line width or so, and is not
    // much longer; otherwise the drawn lines lead somewhere else and the line is left as it was)
    const Ln=len(out);if(Ln>1.15*L0+0.5*med)return Q;
    const DQ=dense(Q);for(let i=0;i<out.length;i+=2){const q=out[i];let bd=1e18;for(let j=0;j<DQ.length;j+=2){const d=(DQ[j][0]-q[0])**2+(DQ[j][1]-q[1])**2;if(d<bd)bd=d;}if(bd>(1.0*med)**2)return Q;}
    return paperRun(out)<pr?out:Q;});}


// Keep narrow gaps: a line that ends on another line ends where the drawing has it end.
// ------------------------------------------------------------------------------------------------
// Where two strips of lead run close together into a third line, or a strip bends round into a line it nearly
// touches, the levelled line can take a short cut and end on the neighbour at the wrong spot (a little V where two
// lines share one end, or a hook across the paper). The Change width only trace has the end in the right place: from
// a point a few widths back, where both traces agree, the end is followed along the drawn lines to the first other
// line they reach, and the line ends there instead.
function drawnEnds(strokes,drawn,dmap,med){
  const on=new Uint8Array(W*H);
  for(const Q of drawn)for(let k=1;k<Q.length;k++){const a=Q[k-1],b=Q[k],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));
    for(let t=0;t<=n;t++){const y=Math.round(a[0]+(b[0]-a[0])*t/n),x=Math.round(a[1]+(b[1]-a[1])*t/n);if(y>=0&&x>=0&&y<H&&x<W)on[y*W+x]=1;}}
  const dense=Q=>{const out=[Q[0]];for(let k=1;k<Q.length;k++){const a=Q[k-1],b=Q[k],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));for(let t=1;t<=n;t++)out.push([a[0]+(b[0]-a[0])*t/n,a[1]+(b[1]-a[1])*t/n]);}return out;};
  const paper=P=>{let n=0;for(const q of P){const y=Math.round(q[0]),x=Math.round(q[1]);if(y>=0&&x>=0&&y<H&&x<W&&dmap[y*W+x]<0.5)n++;}return n;};
  const nearOn=(p,R)=>{let best=-1,bd=1e9;const py=Math.round(p[0]),px=Math.round(p[1]);for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const y=py+dy,x=px+dx;if(y<0||x<0||y>=H||x>=W||!on[y*W+x])continue;const d=dx*dx+dy*dy;if(d<bd){bd=d;best=y*W+x;}}return bd<=R*R?best:-1;};
  // (nearest point on any line but this one)
  const nearOther=(p,q,lim,skip)=>{let bd=lim*lim,bp=null,bs=-1,bt=null;for(let s=0;s<strokes.length;s++){if(s===q||(skip&&skip.has(s)))continue;const S=strokes[s];
      for(let k=1;k<S.length;k++){const a=S[k-1],b=S[k],vy=b[0]-a[0],vx=b[1]-a[1],L2=vy*vy+vx*vx;let t=L2>0?((p[0]-a[0])*vy+(p[1]-a[1])*vx)/L2:0;t=Math.max(0,Math.min(1,t));
        const y=a[0]+vy*t,x=a[1]+vx*t,d=(y-p[0])**2+(x-p[1])**2;if(d<bd){bd=d;bp=[y,x];bs=s;bt=[vy,vx];}}}return bp?{p:bp,s:bs,d:Math.sqrt(bd),t:bt}:null;};
  const R1=Math.max(2,Math.ceil(0.25*med)),Rt=Math.max(2,0.3*med);
  // (which line is near each pixel, so the walk can stop at the first other line it reaches)
  const own=new Int32Array(W*H).fill(-1),two=new Uint8Array(W*H),Ri=Math.ceil(Rt);
  for(let s=0;s<strokes.length;s++){if(!strokes[s]||strokes[s].length<2)continue;for(const p of dense(strokes[s])){const py=Math.round(p[0]),px=Math.round(p[1]);
    for(let dy=-Ri;dy<=Ri;dy++)for(let dx=-Ri;dx<=Ri;dx++){if(dx*dx+dy*dy>Rt*Rt)continue;const y=py+dy,x=px+dx;if(y<0||x<0||y>=H||x>=W)continue;const j=y*W+x;
      if(own[j]<0)own[j]=s;else if(own[j]!==s)two[j]=1;}}}
  for(let q=0;q<strokes.length;q++)for(let side=0;side<2;side++){
    let Q=strokes[q];if(!Q||Q.length<4)continue;if(side)Q=Q.slice().reverse();
    const e=Q[0],F=nearOther(e,q,1.0*med);if(!F)continue; // (only a line that ends on another line)
    // (cumulative length, and the anchor: the first point a few widths back where the line sits on the drawn trace for a width)
    const cum=[0];for(let k=1;k<Q.length;k++)cum.push(cum[k-1]+Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]));
    if(cum[cum.length-1]<8*med)continue;
    // (the tip of a round shape resting on the other line, its two sides arriving from either hand, is left to the
    // rounding of touches)
    const arrive=S=>{const R=Math.hypot(S[0][0]-e[0],S[0][1]-e[1])<Math.hypot(S[S.length-1][0]-e[0],S[S.length-1][1]-e[1])?S:S.slice().reverse();
      let L=0,k=0;while(k<R.length-1&&L<2*med){L+=Math.hypot(R[k+1][0]-R[k][0],R[k+1][1]-R[k][1]);k++;}return[R[0][0]-R[k][0],R[0][1]-R[k][1]];};
    {const v=arrive(Q),cr=w=>w[0]*F.t[1]-w[1]*F.t[0];let tip=false;
      // (the two sides one circle, its centre on their side of the line)
      const round=(A,B,v)=>{const pts=[];for(const S of[A,B]){const R=Math.hypot(S[0][0]-e[0],S[0][1]-e[1])<Math.hypot(S[S.length-1][0]-e[0],S[S.length-1][1]-e[1])?S:S.slice().reverse();
          let L=0;for(let k=1;k<R.length&&L<5*med;k++){L+=Math.hypot(R[k][0]-R[k-1][0],R[k][1]-R[k-1][1]);if(L>0.5*med)pts.push(R[k]);}}
        let sx=0,sy=0,sxx=0,syy=0,sxy=0,sxz=0,syz=0,sz=0;const n=pts.length;if(n<8)return false;
        for(const[y,x]of pts){const z=x*x+y*y;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;sxz+=x*z;syz+=y*z;sz+=z;}
        const M=[[sxx,sxy,sx],[sxy,syy,sy],[sx,sy,n]],vv=[-sxz,-syz,-sz];const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
        const D=det(M);if(Math.abs(D)<1e-9)return false;const col=i=>M.map((r,j)=>r.map((c,k)=>k===i?vv[j]:c));
        const cx=-det(col(0))/D/2,cy=-det(col(1))/D/2,r=Math.sqrt(Math.max(0,cx*cx+cy*cy-det(col(2))/D));if(r<1.5*med||r>40*med)return false;
        let er=0;for(const[y,x]of pts)er=Math.max(er,Math.abs(Math.hypot(x-cx,y-cy)-r));if(er>0.35*med)return false;
        return cr([cy-e[0],cx-e[1]])*cr(v)<0;};
      for(let s2=0;s2<strokes.length;s2++){const S=strokes[s2];if(s2===q||!S||S.length<4)continue;
        if(Math.min(Math.hypot(S[0][0]-e[0],S[0][1]-e[1]),Math.hypot(S[S.length-1][0]-e[0],S[S.length-1][1]-e[1]))>1.0*med)continue;
        const w=arrive(S);if(v[0]*w[0]+v[1]*w[1]<0&&cr(v)*cr(w)>0&&round(Q,S,v))tip=true;}
      if(tip)continue;}
    let ai=-1;for(let k=1;k<Q.length;k++){if(cum[k]<3*med)continue;if(cum[k]>12*med||cum[cum.length-1]-cum[k]<3*med)break;
      let ok=true;for(let j=k;j<Q.length&&cum[j]-cum[k]<1.5*med;j++)if(nearOn(Q[j],R1)<0){ok=false;break;}if(ok){ai=k;break;}}
    if(ai<0)continue;
    // (lines that end at this same point are not where it should end instead)
    const sib=new Set();for(let s=0;s<strokes.length;s++){const S=strokes[s];if(s===q||!S||S.length<2)continue;for(const t of [S[0],S[S.length-1]])if(Math.hypot(t[0]-e[0],t[1]-e[1])<1.0*med)sib.add(s);}
    const a0=nearOn(Q[ai],R1);
    // (the rest of this line, widened, is out of bounds: the walk has to go toward the end)
    const ban=new Set(),Rb=Math.ceil(0.5*med);let bi=ai;while(bi<Q.length-1&&cum[bi]-cum[ai]<1.5*med)bi++;for(const p of dense(Q.slice(bi))){const py=Math.round(p[0]),px=Math.round(p[1]);
      for(let dy=-Rb;dy<=Rb;dy++)for(let dx=-Rb;dx<=Rb;dx++)if(dx*dx+dy*dy<=Rb*Rb)ban.add((py+dy)*W+px+dx);}
    ban.delete(a0);
    const lim=1.6*cum[ai]+2*med;const dist=new Map([[a0,0]]),prev=new Map(),heap=[[0,a0]];let hit=-1,hitF=null;
    const push=(d,i)=>{heap.push([d,i]);let c=heap.length-1;while(c>0){const p=(c-1)>>1;if(heap[p][0]<=heap[c][0])break;[heap[p],heap[c]]=[heap[c],heap[p]];c=p;}};
    const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let c=0;for(;;){const l=2*c+1,r=l+1;let m2=c;if(l<heap.length&&heap[l][0]<heap[m2][0])m2=l;if(r<heap.length&&heap[r][0]<heap[m2][0])m2=r;if(m2===c)break;[heap[m2],heap[c]]=[heap[c],heap[m2]];c=m2;}}return top;};
    while(heap.length){const[d,i]=pop();if(d>dist.get(i))continue;if(d>lim)break;const y=(i/W)|0,x=i%W;
      if(d>1.5*med&&own[i]>=0&&(own[i]!==q||two[i])&&!(sib.has(own[i])&&!two[i])){const f=nearOther([y,x],q,Rt+1,sib);if(f){hit=i;hitF=f;break;}}
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const Y=y+dy,X=x+dx;if(Y<0||X<0||Y>=H||X>=W)continue;const j=Y*W+X;if(!on[j]||ban.has(j))continue;
        const nd=d+(dx&&dy?1.4142:1);if(nd<(dist.has(j)?dist.get(j):1e18)){dist.set(j,nd);prev.set(j,i);push(nd,j);}}}
    if(hit<0)continue;
    // (an end already where the drawing has it is left alone)
    if(Math.hypot(hitF.p[0]-e[0],hitF.p[1]-e[1])<0.8*med)continue;
    // (nor onto the outer border: lines that end by the border keep the end they were traced with)
    {const m=1.5*med;if(hitF.p[0]<m||hitF.p[1]<m||hitF.p[0]>H-1-m||hitF.p[1]>W-1-m)continue;}
    // (nor a walk that just stops at a joint it passes on its way: the new end is about as far out as the old one)
    {const ay=(a0/W)|0,ax=a0%W;if(Math.hypot(hitF.p[0]-ay,hitF.p[1]-ax)<0.5*Math.hypot(e[0]-ay,e[1]-ax))continue;}
    const path=[];for(let i=hit;i!==undefined;i=prev.get(i)){path.push([(i/W)|0,i%W]);if(i===a0)break;}
    // (new end: the meeting point on the other line, then the drawn way back to the anchor, evened out; the rest as it was)
    let nw=[hitF.p.slice()].concat(path);for(let it=0;it<3;it++)nw=nw.map((p,i)=>{if(i===0||i===nw.length-1)return p;const R2=Math.min(6,i,nw.length-1-i);let a=0,b=0,c=0;for(let j=i-R2;j<=i+R2;j++){a+=nw[j][0];b+=nw[j][1];c++;}return[a/c,b/c];});
    const thin=[nw[0]];for(let i=2;i<nw.length-1;i+=2)thin.push(nw[i]);
    const cand=thin.concat(Q.slice(ai));
    // (the seam where the drawn way joins the old line is eased over a couple of widths each way, the end held)
    {const J=thin.length,c0=cand.map(p=>p.slice());let lo=J,hi=J,L=0;while(lo>1&&L<2*med){L+=Math.hypot(c0[lo][0]-c0[lo-1][0],c0[lo][1]-c0[lo-1][1]);lo--;}
      L=0;while(hi<c0.length-2&&L<2*med){L+=Math.hypot(c0[hi+1][0]-c0[hi][0],c0[hi+1][1]-c0[hi][1]);hi++;}
      for(let it=0;it<4;it++){const c=cand.map(p=>p.slice());for(let i=lo;i<=hi;i++){let a=0,b=0,n=0;for(let j=Math.max(0,i-3);j<=Math.min(c.length-1,i+3);j++){a+=c[j][0];b+=c[j][1];n++;}
        const w0=Math.max(0,1-Math.abs(i-J)/Math.max(1,i<J?J-lo:hi-J)),w=w0*w0*(3-2*w0);cand[i]=[c[i][0]+(a/n-c[i][0])*w,c[i][1]+(b/n-c[i][1])*w];}}}
    // (the old end has to have been off the drawing: over paper, or away from the drawn lines; the new one no worse)
    const oldP=dense(Q.slice(0,ai+1)),newP=dense(cand.slice(0,thin.length+1));
    let off=0;for(const p of oldP){const y=Math.round(p[0]),x=Math.round(p[1]);if(nearOn(p,Math.ceil(0.35*med))<0)off++;}
    if(paper(oldP)<0.5*med&&off<1.0*med)continue;if(paper(newP)>paper(oldP))continue;
    const Ln=cum[ai]>0?newP.length:0;if(Ln>1.8*cum[ai]+2*med)continue;
    // (and no sharp bend where the old line was smooth: a drawn way that kinks into the other line is not used)
    const turn=(R,n)=>{let m=0;const st=Math.max(2,Math.round(0.4*med/2));for(let i=st;i<Math.min(R.length,n)-st;i++){const a=R[i-st],b=R[i],c=R[i+st];const v1=[b[0]-a[0],b[1]-a[1]],v2=[c[0]-b[0],c[1]-b[1]];const n1=Math.hypot(...v1),n2=Math.hypot(...v2);if(n1<1e-6||n2<1e-6)continue;m=Math.max(m,Math.acos(Math.max(-1,Math.min(1,(v1[0]*v2[0]+v1[1]*v2[1])/(n1*n2)))));}return m;};
    if(turn(cand,thin.length+Math.ceil(med))>Math.max(0.6,turn(Q,ai+Math.ceil(med))+0.25))continue;
    strokes[q]=side?cand.reverse():cand;}
  return strokes;}

// Keep narrow gaps: two lines that run into a third through one patch of ink join each other where the ink parts.
// ------------------------------------------------------------------------------------------------
// Where two strips of lead merge into solid ink just before they reach another line, the two levelled lines would run
// on side by side to it with a sliver of glass between them that the drawing does not have. The line is ended on its
// neighbour instead, at the point where the paper between them stops (a Y), and the neighbour alone goes on.
function joinMerged(strokes,dmap,med){
  const near=(p,skip)=>{let bd=1e18,bp=null,bs=-1;for(let s=0;s<strokes.length;s++){if(skip.has(s))continue;const S=strokes[s];if(!S||S.length<2)continue;
      for(let k=1;k<S.length;k++){const a=S[k-1],b=S[k],vy=b[0]-a[0],vx=b[1]-a[1],L2=vy*vy+vx*vx;let t=L2>0?((p[0]-a[0])*vy+(p[1]-a[1])*vx)/L2:0;t=Math.max(0,Math.min(1,t));
        const y=a[0]+vy*t,x=a[1]+vx*t,d=(y-p[0])**2+(x-p[1])**2;if(d<bd){bd=d;bp=[y,x];bs=s;}}}return bp?{p:bp,s:bs,d:Math.sqrt(bd)}:null;};
  const inkBetween=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));for(let t=0;t<=n;t++){const y=Math.round(a[0]+(b[0]-a[0])*t/n),x=Math.round(a[1]+(b[1]-a[1])*t/n);
      if(y<0||x<0||y>=H||x>=W||dmap[y*W+x]<0.5)return false;}return true;};
  for(let q=0;q<strokes.length;q++)for(let side=0;side<2;side++){
    let Q=strokes[q];if(!Q||Q.length<6)continue;if(side)Q=Q.slice().reverse();
    const e=Q[0],F=near(e,new Set([q]));if(!F||F.d>0.6*med)continue;
    {const m=1.5*med;if(F.p[0]<m||F.p[1]<m||F.p[0]>H-1-m||F.p[1]>W-1-m)continue;} // (not at the outer border) // (a line that ends on another line)
    const skip=new Set([q,F.s]);
    // (from the end inward: how far the ink between this line and its nearest neighbour stays unbroken)
    let L=0,cut=-1,G=null;for(let k=0;k<Q.length-1&&L<5*med;k++){if(k)L+=Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]);
      const g=near(Q[k],skip);if(!g||g.d>1.6*med||g.d<0.3*med||!inkBetween(Q[k],g.p))break;if(G&&g.s!==G.s)break;G=g;cut=k;}
    if(cut<0||L<0.8*med||!G)continue;let Lc=0;for(let k=1;k<=cut;k++)Lc+=Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]);if(Lc<0.8*med||Lc>2*med)continue; // (a short merge, as where two strips run together just below a line; a long wedge is left alone)
    // (only a neighbour that runs into the same line right beside this one, alongside it: two strips merging)
    const S=strokes[G.s],gEnd=Math.hypot(S[0][0]-e[0],S[0][1]-e[1])<Math.hypot(S[S.length-1][0]-e[0],S[S.length-1][1]-e[1])?S:S.slice().reverse();
    if(Math.hypot(gEnd[0][0]-e[0],gEnd[0][1]-e[1])>2.5*med)continue;
    const back=(R,d)=>{let l=0,k=0;while(k<R.length-1&&l<d){l+=Math.hypot(R[k+1][0]-R[k][0],R[k+1][1]-R[k][1]);k++;}return k;};
    {const kq=back(Q,2*med),kg=back(gEnd,2*med),v1=[Q[0][0]-Q[kq][0],Q[0][1]-Q[kq][1]],v2=[gEnd[0][0]-gEnd[kg][0],gEnd[0][1]-gEnd[kg][1]];
      if((v1[0]*v2[0]+v1[1]*v2[1])/((Math.hypot(...v1)*Math.hypot(...v2))||1)<Math.cos(Math.PI*40/180))continue;}
    // (the join: from where the ink parts, a short smooth bend over to where the neighbour meets the line, so no scrap of
    // glass is closed off between them; all of it on the ink)
    const k0=Math.min(Q.length-2,cut);
    let gi=0,gd=1e18;for(let i=0;i<gEnd.length;i++){const d=(gEnd[i][0]-G.p[0])**2+(gEnd[i][1]-G.p[1])**2;if(d<gd){gd=d;gi=i;}}
    let l=0,j=gi;while(j>0&&l<0.6*med){l+=Math.hypot(gEnd[j][0]-gEnd[j-1][0],gEnd[j][1]-gEnd[j-1][1]);j--;}
    // (an arch over the top of the glass between them: up from where the ink parts, over, and down onto the neighbour a
    // little below the line, its top just under that line)
    let lj=0,jb=0;while(jb<gEnd.length-1&&lj<0.5*med){lj+=Math.hypot(gEnd[jb+1][0]-gEnd[jb][0],gEnd[jb+1][1]-gEnd[jb][1]);jb++;}
    const A=Q[k0],B=gEnd[jb],tq=Math.min(Q.length-1,k0+3),dA=[Q[k0][0]-Q[tq][0],Q[k0][1]-Q[tq][1]],nA=Math.hypot(dA[0],dA[1])||1;
    const tb=Math.min(gEnd.length-1,jb+3),dB=[gEnd[jb][0]-gEnd[tb][0],gEnd[jb][1]-gEnd[tb][1]],nB=Math.hypot(dB[0],dB[1])||1;
    const kk=Math.max(0.4*med,1.2*lj+0.5*Math.max(0,Math.hypot(A[0]-e[0],A[1]-e[1])-lj));
    const P1=[A[0]+dA[0]/nA*kk,A[1]+dA[1]/nA*kk],P2=[B[0]+dB[0]/nB*kk,B[1]+dB[1]/nB*kk];
    const curve=[];for(let i=16;i>=1;i--){const t=i/16,u=1-t;curve.push([u*u*u*A[0]+3*u*u*t*P1[0]+3*u*t*t*P2[0]+t*t*t*B[0],u*u*u*A[1]+3*u*u*t*P1[1]+3*u*t*t*P2[1]+t*t*t*B[1]]);}
    {let off=0;for(const c of curve){const y=Math.round(c[0]),x=Math.round(c[1]);if(y<0||x<0||y>=H||x>=W||dmap[y*W+x]<0.5)off++;}if(off)continue;}
    const cand=curve.concat(Q.slice(k0));strokes[q]=side?cand.reverse():cand;}
  return strokes;}
