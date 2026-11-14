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
