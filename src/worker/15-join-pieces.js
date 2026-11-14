// Cleanup -> Join pieces drawn apart.
// ------------------------------------------------------------------------------------------------
// Some patterns draw every piece as its own outline, with a narrow white channel between neighbouring pieces (a
// sticker or vinyl design). In glass the neighbours share one lead line. Each narrow channel of the white outside
// the pieces is filled with ink, so the two outlines and the channel between them become one line, traced down its
// middle; the white inside the pieces is never touched, so no piece is lost or changed. How narrow counts as a
// channel is read from the picture: the most common width of the outside white between lines. A shape left on its
// own afterwards (a circle above the rest, say) is joined to the nearest line by a short bar, so the whole design
// holds together as one panel.
function joinPieces(m,dropBits){
  const N=W*H,out=new Uint8Array(N),st=new Int32Array(N);let sp=0;
  // (the white outside every piece: reached from the picture's edge without crossing a line)
  const seed=i=>{if(!m[i]&&!out[i]){out[i]=1;st[sp++]=i;}};
  for(let x=0;x<W;x++){seed(x);seed((H-1)*W+x);}for(let y=0;y<H;y++){seed(y*W);seed(y*W+W-1);}
  while(sp){const i=st[--sp],y=(i/W)|0,x=i-y*W;if(x>0)seed(i-1);if(x<W-1)seed(i+1);if(y>0)seed(i-W);if(y<H-1)seed(i+W);}
  // (the channel width: the commonest half-width of that outside white, measured along its middle)
  const din=new Uint8Array(N);for(let i=0;i<N;i++)din[i]=m[i]?1:0;const d=edt(din),hist=new Float64Array(64);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;if(!out[i])continue;const v=d[i];if(v<1)continue;
    if(v>=d[i-1]&&v>=d[i+1]&&v>=d[i-W]&&v>=d[i+W]){const r=Math.round(Math.sqrt(v));if(r<64)hist[r]++;}}
  let mode=1;for(let r=1;r<40;r++)if(hist[r]>hist[mode])mode=r;
  const R=Math.max(2,Math.min(25,Math.round(1.6*mode))),R2=R*R;
  // (fill the narrow outside white: grow the lines by R, shrink them back by R, and keep what was outside)
  const d1=edt(din);
  const nd=new Uint8Array(N);for(let i=0;i<N;i++)nd[i]=d1[i]<=R2?0:1;   // (1 where the grown lines don't reach)
  const d2=edt(nd);let filled=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(m[i]||!out[i])continue;const edge=Math.min(x+1,y+1,W-x,H-y);
    if(d1[i]<=R2&&d2[i]>R2&&edge*edge>R2){m[i]=1;filled++;}}
  // (the outline round the outside of the design is widened outward by a channel's width, so a line that runs along
  // a gap between two pieces and then on along the outside edge keeps the same place: the middle of the gap is a
  // channel's half-width outside each piece, and so is the middle of the widened outline)
  {const reach=new Uint8Array(N);sp=0;const sd=i=>{if(!m[i]&&!reach[i]){reach[i]=1;st[sp++]=i;}};
    for(let x=0;x<W;x++){sd(x);sd((H-1)*W+x);}for(let y=0;y<H;y++){sd(y*W);sd(y*W+W-1);}
    while(sp){const i=st[--sp],y=(i/W)|0,x=i-y*W;if(x>0)sd(i-1);if(x<W-1)sd(i+1);if(y>0)sd(i-W);if(y<H-1)sd(i+W);}
    const dd=new Uint8Array(N);for(let i=0;i<N;i++)dd[i]=m[i]?1:0;const d4=edt(dd),gw=(2*mode)*(2*mode);
    for(let i=0;i<N;i++)if(reach[i]&&d4[i]<=gw)m[i]=1;}
  // (where several channels meet, the white between them is wider than a channel and is left as a small pocket, cut off
  // from the outside now; such a pocket was never a piece, so it is filled too: only a small, roundish one, since a
  // longer pocket is a piece of glass drawn open to the outside)
  {const reach=new Uint8Array(N);sp=0;const sd=i=>{if(!m[i]&&!reach[i]){reach[i]=1;st[sp++]=i;}};
    for(let x=0;x<W;x++){sd(x);sd((H-1)*W+x);}for(let y=0;y<H;y++){sd(y*W);sd(y*W+W-1);}
    while(sp){const i=st[--sp],y=(i/W)|0,x=i-y*W;if(x>0)sd(i-1);if(x<W-1)sd(i+1);if(y>0)sd(i-W);if(y<H-1)sd(i+W);}
    const din2=new Uint8Array(N);for(let i=0;i<N;i++)din2[i]=m[i]?1:0;const d3=edt(din2),seen=new Uint8Array(N),lim=(1.6*R)*(1.6*R),maxArea=Math.PI*(2.5*R)*(2.5*R);
    for(let i=0;i<N;i++){if(m[i]||!out[i]||reach[i]||seen[i])continue;const comp=[i];seen[i]=1;let mx=0;
      for(let h=0;h<comp.length;h++){const j=comp[h],y=(j/W)|0,x=j-y*W;if(d3[j]>mx)mx=d3[j];
        for(const k of[x>0?j-1:-1,x<W-1?j+1:-1,y>0?j-W:-1,y<H-1?j+W:-1])if(k>=0&&!m[k]&&out[k]&&!reach[k]&&!seen[k]){seen[k]=1;comp.push(k);}}
      if(mx<=lim&&comp.length<=maxArea){for(const j of comp)m[j]=1;filled+=comp.length;}}}
  // (and any scrap of white too small to be cut as glass, whether drawn as a piece or left between the lines: a
  // little triangle where a line ends against another, say. Real pieces, even narrow ones, are far bigger)
  {const seen=new Uint8Array(N),maxA=4*R*R;sp=0;
    for(let i=0;i<N;i++){if(m[i]||seen[i])continue;const comp=[i];seen[i]=1;let edge=false;
      for(let h=0;h<comp.length;h++){const j=comp[h],y=(j/W)|0,x=j-y*W;if(x===0||y===0||x===W-1||y===H-1)edge=true;
        for(const k of[x>0?j-1:-1,x<W-1?j+1:-1,y>0?j-W:-1,y<H-1?j+W:-1])if(k>=0&&!m[k]&&!seen[k]){seen[k]=1;comp.push(k);}}
      if(!edge&&comp.length<=maxA){for(const j of comp)m[j]=1;filled+=comp.length;}}}
  // (shapes left on their own: joined to the nearest other line by a bar as wide as a channel)
  const lab=new Int32Array(N).fill(-1),size=[];let nl=0;
  for(let i=0;i<N;i++){if(!m[i]||lab[i]>=0)continue;let n=0;sp=0;st[sp++]=i;lab[i]=nl;
    while(sp){const j=st[--sp],y=(j/W)|0,x=j-y*W;n++;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const Y=y+dy,X=x+dx;if(Y<0||X<0||Y>=H||X>=W)continue;const k=Y*W+X;if(m[k]&&lab[k]<0){lab[k]=nl;st[sp++]=k;}}}
    size.push(n);nl++;}
  let main=0;for(let c=1;c<nl;c++)if(size[c]>size[main])main=c;
  // (only real shapes: a closed outline round a piece of its own, such as a circle; never a number or a speck)
  const minSize=Math.max(60,40*R);let bars=0;const shape=new Map();
  const isShape=c=>{if(shape.has(c))return shape.get(c);let y0=H,y1=-1,x0=W,x1=-1;
    for(let i=0;i<N;i++)if(lab[i]===c){const y=(i/W)|0,x=i-y*W;if(y<y0)y0=y;if(y>y1)y1=y;if(x<x0)x0=x;if(x>x1)x1=x;}
    let ok=false;if(size[c]>=minSize&&y1-y0>=6*R&&x1-x0>=6*R){
      // (flood the white from the middle of its box, with only this shape as walls: a hole of its own if it never gets out)
      const bw=x1-x0+1,bh=y1-y0+1,seen=new Uint8Array(bw*bh),cy=((y0+y1)/2)|0,cx=((x0+x1)/2)|0;
      if(lab[cy*W+cx]!==c){const q=[(cy-y0)*bw+(cx-x0)];seen[q[0]]=1;let out2=false,n=0;
        for(let h=0;h<q.length&&!out2;h++){const j=q[h],y=(j/bw)|0,x=j-y*bw;n++;
          for(const[dy,dx]of[[1,0],[-1,0],[0,1],[0,-1]]){const Y=y+dy,X=x+dx;if(Y<0||X<0||Y>=bh||X>=bw){out2=true;break;}const k=Y*bw+X;if(seen[k]||lab[(Y+y0)*W+X+x0]===c)continue;seen[k]=1;q.push(k);}}
        ok=!out2&&n>=9*R*R;}}
    shape.set(c,ok);return ok;};
  for(let pass=0;pass<nl&&nl>1;pass++){
    // (distance outward from the main shape, with the spot it came from)
    const dist=new Float32Array(N).fill(Infinity),from=new Int32Array(N).fill(-1);const q=[];
    for(let i=0;i<N;i++)if(lab[i]===main){dist[i]=0;from[i]=i;q.push(i);}
    let best=-1,bd=Infinity;const lim=12*R;
    for(let h=0;h<q.length;h++){const i=q[h],y=(i/W)|0,x=i-y*W;if(dist[i]>lim)break;
      for(const[dy,dx]of[[1,0],[-1,0],[0,1],[0,-1]]){const Y=y+dy,X=x+dx;if(Y<0||X<0||Y>=H||X>=W)continue;const k=Y*W+X;if(dist[k]!==Infinity)continue;
        dist[k]=dist[i]+1;from[k]=from[i];
        if(m[k]&&lab[k]!==main&&size[lab[k]]>=minSize&&isShape(lab[k])){const f=from[k],fy=(f/W)|0,fx=f-fy*W,e=Math.hypot(X-fx,Y-fy);if(e<bd){bd=e;best=k;}}
        if(!m[k])q.push(k);}}
    if(best<0)break;
    const c=lab[best],f=from[best],fy=(f/W)|0,fx=f-fy*W,by=(best/W)|0,bx=best-by*W;
    drawSeg(m,fx,fy,bx,by,R);bars++;
    // (that shape is now part of the main one)
    for(let i=0;i<N;i++)if(lab[i]===c)lab[i]=main;size[main]+=size[c];
    {const x0=Math.max(0,Math.min(fx,bx)-R-1),x1=Math.min(W-1,Math.max(fx,bx)+R+1),y0=Math.max(0,Math.min(fy,by)-R-1),y1=Math.min(H-1,Math.max(fy,by)+R+1);
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*W+x;if(m[i])lab[i]=main;}}}
  // (numbers and other small marks left on their own inside the pieces: drawn as thin as the old outlines, so the
  // usual text clean-up keeps them; here they stand apart from every line, and are taken out)
  let bits=0;if(dropBits){const box=new Map();for(let i=0;i<N;i++){const c=lab[i];if(c<0||c===main)continue;const y=(i/W)|0,x=i-y*W;let b=box.get(c);if(!b)box.set(c,b=[y,y,x,x]);
      if(y<b[0])b[0]=y;if(y>b[1])b[1]=y;if(x<b[2])b[2]=x;if(x>b[3])b[3]=x;}
    for(const[c,b]of box){if(Math.max(b[1]-b[0],b[3]-b[2])>10*R||isShape(c))continue;for(let y=b[0];y<=b[1];y++)for(let x=b[2];x<=b[3];x++){const i=y*W+x;if(lab[i]===c){m[i]=0;}}bits++;}}
  return{R,filled,bars,bits,main:size[main]};}

// Join pieces drawn apart, after the lines are traced: a stretch of line with no glass beside it goes.
// ------------------------------------------------------------------------------------------------
// Where a piece ends right against a line (the end of a staff resting on a snake's body), the end of the piece and
// the line it rests on can both be traced, a lead's width apart, with nothing but ink between them: a sliver that is
// not glass. Such a stretch, from one joint to the next, is taken out, and the lines that met it at its ends are
// brought on to the line beside it.
function dropDoubles(strokes,dmap,med){
  const D=1.6*med;
  const inkTo=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));for(let t=0;t<=n;t++){const y=Math.round(a[0]+(b[0]-a[0])*t/n),x=Math.round(a[1]+(b[1]-a[1])*t/n);
      if(y<0||x<0||y>=H||x>=W||dmap[y*W+x]<0.5)return false;}return true;};
  const turnAt=(S,p)=>{// (the sharpest bend within a couple of widths of p)
    let m=0;const st=Math.max(2,Math.round(0.3*med));for(let i=st;i<S.length-st;i++){if(Math.hypot(S[i][0]-p[0],S[i][1]-p[1])>2*med)continue;const a=S[i-st],b=S[i],c=S[i+st];
      const v1=[b[0]-a[0],b[1]-a[1]],v2=[c[0]-b[0],c[1]-b[1]],n1=Math.hypot(...v1),n2=Math.hypot(...v2);if(n1<1e-6||n2<1e-6)continue;m=Math.max(m,Math.acos(Math.max(-1,Math.min(1,(v1[0]*v2[0]+v1[1]*v2[1])/(n1*n2)))));}return m;};
  // (where other lines end on each line, and the stretches between)
  const attach=(L,NI)=>{const att=L.map(()=>[]);L.forEach((S,t)=>{if(!S||S.length<2)return;for(const e of[S[0],S[S.length-1]]){const b=NI.near(e,u=>u===t,3);if(b)att[b.s].push({k:b.k,t,p:e});}});return att;};
  // (a stretch of line s between two joints with one other line G beside it all along its middle, only ink between)
  const beside=(L,NI,s,k0,k1)=>{const Q=L[s];let len=0;const cl=[0];for(let k=k0+1;k<=k1;k++){len+=Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]);cl.push(len);}
    if(len<0.5*med||len>8*med)return-1;let G=-1,n=0;
    for(let k=k0;k<=k1;k++){const c=cl[k-k0];if(c<0.8*med||len-c<0.8*med)continue;n++;const b=NI.near(Q[k],u=>u===s,D);if(!b||(G>=0&&b.s!==G)||!inkTo(Q[k],b.p))return-1;G=b.s;}
    return n>=3?G:-1;};
  // (take the stretch out, bring the ends that met it on to G; returns the new lines and the sharpest bend this makes)
  const remove=(L0,s,k0,k1,G,att)=>{const L=L0.map(S=>S&&S.map(p=>p.slice()));const Q=L[s],e0=Q[k0].slice(),e1=Q[k1].slice();
    const A=Q.slice(0,k0+1),B=Q.slice(k1);L[s]=A.length>=2?A:null;if(B.length>=2)L.push(B);
    const onG=p=>{let bd=1e18,bp=null;const F=L[G];for(let k=1;k<F.length;k++){const a=F[k-1],c=F[k],vy=c[0]-a[0],vx=c[1]-a[1],l2=vy*vy+vx*vx;let u=l2?((p[0]-a[0])*vy+(p[1]-a[1])*vx)/l2:0;u=Math.max(0,Math.min(1,u));const y=a[0]+vy*u,x=a[1]+vx*u,d=(y-p[0])**2+(x-p[1])**2;if(d<bd){bd=d;bp=[y,x];}}return bp;};
    let worst=0;const moved=[];
    const moveEnd=(t,p)=>{const S=L[t];if(!S)return;const atStart=Math.hypot(S[0][0]-p[0],S[0][1]-p[1])<=Math.hypot(S[S.length-1][0]-p[0],S[S.length-1][1]-p[1]);
      const R0=atStart?S:S.slice().reverse(),g=onG(R0[0]);if(!g)return;const dv=[g[0]-R0[0][0],g[1]-R0[0][1]];if(Math.hypot(...dv)<1)return;let l=0;const Lr=1.5*med;
      for(let k=0;k<R0.length;k++){if(k)l+=Math.hypot(R0[k][0]-R0[k-1][0],R0[k][1]-R0[k-1][1]);if(l>Lr)break;const t0=Math.min(1,l/Lr),w=1-t0*t0*(3-2*t0);R0[k]=[R0[k][0]+dv[0]*w,R0[k][1]+dv[1]*w];}
      L[t]=atStart?R0:R0.reverse();moved.push([t,g]);};
    for(const a of att[s])if(a.t!==G&&(Math.hypot(a.p[0]-e0[0],a.p[1]-e0[1])<4||Math.hypot(a.p[0]-e1[0],a.p[1]-e1[1])<4))moveEnd(a.t,a.p);
    if(L[s])moveEnd(s,e0);if(B.length>=2)moveEnd(L.length-1,e1);
    for(const[t,g]of moved)if(L[t])worst=Math.max(worst,turnAt(L[t],g));
    return{L,worst};};
  let L=strokes.slice();
  for(let pass=0;pass<6;pass++){const NI=nearIndex(L.map(S=>S||[]),2*med),att=attach(L,NI);let done=false;
    for(let s=0;s<L.length&&!done;s++){const Q=L[s];if(!Q||Q.length<4)continue;const ks=[...new Set([0,Q.length-1].concat(att[s].map(a=>a.k)))].sort((a,b)=>a-b);   // (its own ends count as joints too: they end on other lines)
      for(let i=0;i+1<ks.length&&!done;i++){const k0=ks[i],k1=ks[i+1];if(k1-k0<2)continue;const G=beside(L,NI,s,k0,k1);if(G<0)continue;
        // (the line beside it may have a stretch of its own beside this one: of the two, the one whose going leaves the
        // smoother lines is taken out)
        let best=remove(L,s,k0,k1,G,att);
        const kg=[...new Set([0,L[G].length-1].concat(att[G].map(a=>a.k)))].sort((a,b)=>a-b);
        for(let j=0;j+1<kg.length;j++){if(kg[j+1]-kg[j]<2)continue;if(beside(L,NI,G,kg[j],kg[j+1])!==s)continue;const alt=remove(L,G,kg[j],kg[j+1],s,att);if(alt.worst<best.worst)best=alt;}
        if(best.worst>0.8)continue;   // (a hook either way: left as it is)
        L=best.L;done=true;}}
    L=L.filter(Boolean);if(!done)break;}
  // (and a line whose end runs in alongside another, a sliver apart with only ink between, as two outlines of one
  // edge do, is cut back to where the two part, and its end brought on to the other)
  for(let pass=0;pass<6;pass++){const NI=nearIndex(L,2*med);let done=false;
    for(let s=0;s<L.length&&!done;s++)for(let side=0;side<2&&!done;side++){let Q=L[s];if(!Q||Q.length<6)continue;if(side)Q=Q.slice().reverse();
      // (lines that end where this one ends are not the one it runs beside)
      const sk=new Set([s]);for(let t=0;t<L.length;t++){const S=L[t];if(t===s||!S||S.length<2)continue;if(Math.hypot(S[0][0]-Q[0][0],S[0][1]-Q[0][1])<4||Math.hypot(S[S.length-1][0]-Q[0][0],S[S.length-1][1]-Q[0][1])<4)sk.add(t);}
      let G=-1,len=0,k=0;
      for(;k<Q.length-1;k++){if(k)len+=Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]);const b=G<0?NI.near(Q[k],u=>sk.has(u),0.75*med):NI.near(Q[k],u=>u!==G,0.75*med);   // (once found, it is that line it must stay beside)
        if(!b||!inkTo(Q[k],b.p))break;G=b.s;}
      if(G<0||len<1.5*med||len>8*med||k>=Q.length-3)continue;
      const keep=Q.slice(k),F=L[G];let bd=1e18,bp=null;for(let j=1;j<F.length;j++){const a=F[j-1],c=F[j],vy=c[0]-a[0],vx=c[1]-a[1],l2=vy*vy+vx*vx;let u=l2?((keep[0][0]-a[0])*vy+(keep[0][1]-a[1])*vx)/l2:0;u=Math.max(0,Math.min(1,u));const y=a[0]+vy*u,x=a[1]+vx*u,d=(y-keep[0][0])**2+(x-keep[0][1])**2;if(d<bd){bd=d;bp=[y,x];}}
      const dv=[bp[0]-keep[0][0],bp[1]-keep[0][1]];let l=0;const Lr=1.6*med;
      for(let j=0;j<keep.length;j++){if(j)l+=Math.hypot(keep[j][0]-keep[j-1][0],keep[j][1]-keep[j-1][1]);if(l>Lr)break;const t0=Math.min(1,l/Lr),w=1-t0*t0*(3-2*t0);keep[j]=[keep[j][0]+dv[0]*w,keep[j][1]+dv[1]*w];}
      // (lines that ended on the cut-off part go on to the other line too)
      const cut=Q.slice(0,k+1),cNI=nearIndex([cut],med);
      for(let t=0;t<L.length;t++){if(t===s||t===G||!L[t])continue;const S=L[t];for(const e of[0,1]){const p=e?S[S.length-1]:S[0];if(!cNI.near(p,null,3))continue;
          let bd2=1e18,bq=null;for(let j=1;j<F.length;j++){const a=F[j-1],c=F[j],vy=c[0]-a[0],vx=c[1]-a[1],l2=vy*vy+vx*vx;let u=l2?((p[0]-a[0])*vy+(p[1]-a[1])*vx)/l2:0;u=Math.max(0,Math.min(1,u));const y=a[0]+vy*u,x=a[1]+vx*u,d=(y-p[0])**2+(x-p[1])**2;if(d<bd2){bd2=d;bq=[y,x];}}
          const R0=e?S.slice().reverse():S.slice(),dw=[bq[0]-R0[0][0],bq[1]-R0[0][1]];let l3=0;
          for(let j=0;j<R0.length;j++){if(j)l3+=Math.hypot(R0[j][0]-R0[j-1][0],R0[j][1]-R0[j-1][1]);if(l3>Lr)break;const t0=Math.min(1,l3/Lr),w=1-t0*t0*(3-2*t0);R0[j]=[R0[j][0]+dw[0]*w,R0[j][1]+dw[1]*w];}
          L[t]=e?R0.reverse():R0;}}
      L[s]=side?keep.reverse():keep;done=true;}
    if(!done)break;}
  return L;}
