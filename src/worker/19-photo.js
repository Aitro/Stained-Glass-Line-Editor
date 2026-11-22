// ================================================================================================
// A photo of a finished panel: the lead is near black and colourless, but dark glass (deep blue, green, a black
// dog) can be nearly as dark, glass texture leaves dark streaks and specks, and thin came or a soft photo leaves
// lead that is only dark next to the glass around it. So the lead is found in two parts: what is very dark and
// grey, and what is a dark grey streak in light glass that joins it. The result is cleaned (pinholes and the
// little rings that glass texture makes filled, every loose end taken back to where it joins, since in a panel
// each lead line runs between two others, and any short line left on its own dropped) and redrawn at one width
// along its middle. The rest of the tool then works on it as a plain line drawing.
// ================================================================================================
let mxBuf=null,chBuf=null;
// (the largest or smallest value within r either side, along rows or columns: van Herk / Gil-Werman)
function runMaxMin(src,r,isMax,horiz){const N=W*H,out=new Uint8Array(N),L=horiz?W:H,n=horiz?H:W,k=2*r+1;
  const g=new Uint8Array(L+k),h=new Uint8Array(L+k),line=new Uint8Array(L+2*r),pad=isMax?0:255;
  const f=isMax?(a,b)=>a>b?a:b:(a,b)=>a<b?a:b;
  for(let j=0;j<n;j++){for(let i=0;i<L+2*r;i++){const t=i-r;line[i]=t<0||t>=L?pad:src[horiz?j*W+t:t*W+j];}
    const M=L+2*r;for(let i=0;i<M;i++)g[i]=i%k===0?line[i]:f(g[i-1],line[i]);
    for(let i=M-1;i>=0;i--)h[i]=(i%k===k-1||i===M-1)?line[i]:f(h[i+1],line[i]);
    for(let t=0;t<L;t++){const a=t,b=t+2*r;out[horiz?j*W+t:t*W+j]=f(h[a],g[b]);}}
  return out;}
function photoLines(T,C){
  const N=W*H,sc=Math.max(W,H)/3000,lab=new Int32Array(N),st=new Int32Array(N);
  const notM=a=>{const o=new Uint8Array(N);for(let i=0;i<N;i++)o[i]=a[i]?0:1;return o;};
  const dil=(a,r)=>{const d=edt(a),o=new Uint8Array(N),r2=r*r;for(let i=0;i<N;i++)o[i]=d[i]<=r2?1:0;return o;};
  const ero=(a,r)=>{const d=edt(notM(a)),o=new Uint8Array(N),r2=r*r;for(let i=0;i<N;i++)o[i]=d[i]>r2?1:0;return o;};
  const comps=(a,eight)=>{lab.fill(0);const sz=[0];let n=0;for(let s=0;s<N;s++){if(!a[s]||lab[s])continue;n++;let sp=0,c=0;st[sp++]=s;lab[s]=n;
      while(sp){const i=st[--sp];c++;const y=(i/W)|0,x=i-y*W;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;if(!eight&&dx&&dy)continue;const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const k=Y*W+X;if(a[k]&&!lab[k]){lab[k]=n;st[sp++]=k;}}}
      sz.push(c);}return sz;};
  const r1=Math.max(1,Math.round(sc)),r2=Math.max(1,Math.round(2*sc));
  // (very dark and grey)
  let core=new Uint8Array(N);for(let i=0;i<N;i++)core[i]=mxBuf[i]<T&&chBuf[i]<C?1:0;core=dil(ero(core,r2),r2);
  // (a dark grey streak in light glass: much darker than the brightest glass close by)
  const R=Math.max(6,Math.round(20*sc));const cl=runMaxMin(runMaxMin(runMaxMin(runMaxMin(mxBuf,R,true,true),R,true,false),R,false,true),R,false,false);
  let ridge=new Uint8Array(N);for(let i=0;i<N;i++)ridge[i]=cl[i]-mxBuf[i]>40&&mxBuf[i]<80&&chBuf[i]<45&&cl[i]>130?1:0;ridge=dil(ero(ridge,r1),r1);
  // (streaks only where they join the dark lead, and not specks)
  let m=core.slice();{const sz=comps(ridge,true),touch=new Uint8Array(sz.length);for(let i=0;i<N;i++)if(lab[i]&&core[i])touch[lab[i]]=1;
    const lim=200*sc*sc;for(let i=0;i<N;i++)if(lab[i]&&touch[lab[i]]&&sz[lab[i]]>lim)m[i]=1;}
  m=ero(dil(m,r2),r2);
  {const sz=comps(m,true);let big=1;for(const v of sz)if(v>big)big=v;for(let i=0;i<N;i++)if(m[i]&&sz[lab[i]]<0.002*big)m[i]=0;}
  const lw=Math.max(4,inkWidth(m));
  // (holes: a pinhole, or a little dark ring of glass texture, is filled; a real small piece is light glass)
  const fillHoles=(lim,darkLim)=>{const inv=notM(m),sz=comps(inv,false),sum=new Float64Array(sz.length);for(let i=0;i<N;i++)if(lab[i])sum[lab[i]]+=mxBuf[i];
    for(let i=0;i<N;i++){const l=lab[i];if(!l)continue;if(sz[l]<lim||(sz[l]<darkLim&&sum[l]/sz[l]<45))m[i]=1;}};
  fillHoles(1.3*lw*lw,8*lw*lw);
  // (along the middle; loose ends taken back, short lines on their own dropped; then once more, as the redrawing
  // closes rings that the first pass left)
  let sk=null;
  for(let round=0;round<3;round++){sk=m.slice();thin(sk,W,H);
    const nb=i=>{let c=0;const y=(i/W)|0,x=i-y*W;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<W&&Y<H&&sk[Y*W+X])c++;}return c;};
    const q=[];for(let i=0;i<N;i++)if(sk[i]&&nb(i)<=1)q.push(i);
    while(q.length){const i=q.pop();if(!sk[i]||nb(i)>1)continue;sk[i]=0;const y=(i/W)|0,x=i-y*W;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const k=Y*W+X;if(sk[k]&&nb(k)<=1)q.push(k);}}
    {const sz=comps(sk,true);for(let i=0;i<N;i++)if(sk[i]&&sz[lab[i]]<20*lw)sk[i]=0;}
    m=dil(sk,lw/2);fillHoles(2.5*lw*lw,0);}
  return{m,lw};}
