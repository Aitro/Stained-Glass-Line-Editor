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
    // (and a sliver: a piece much narrower than the lead is wide, and long, is where two lines run side by side)
    const dd=edt(m),far=new Float64Array(sz.length);for(let i=0;i<N;i++)if(lab[i]&&dd[i]>far[lab[i]])far[lab[i]]=dd[i];
    for(let i=0;i<N;i++){const l=lab[i];if(!l)continue;const r=Math.sqrt(far[l]),sliver=r<0.6*lw&&sz[l]/(2*Math.max(1,r))>3*lw&&sz[l]<30*lw*lw;
      if(sz[l]<lim||(sz[l]<darkLim&&sum[l]/sz[l]<75)||sliver)m[i]=1;}};

  // (along the middle; loose ends taken back, short lines on their own dropped; then once more, as the redrawing
  // closes rings that the first pass left)
  let sk=null;
  for(let round=0;round<3;round++){fillHoles(round?2.5*lw*lw:1.3*lw*lw,16*lw*lw);sk=m.slice();thin(sk,W,H);
    // (an end: one neighbour, or two that touch each other, as at the stair-stepped tip of a thinned line)
    const nbs=i=>{const o=[];const y=(i/W)|0,x=i-y*W;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<W&&Y<H&&sk[Y*W+X])o.push(Y*W+X);}return o;};
    const nb=i=>{const o=nbs(i);if(o.length===2){const a=o[0],b=o[1];if(Math.abs(a%W-b%W)<=1&&Math.abs(((a/W)|0)-((b/W)|0))<=1)return 1;}return o.length;};
    const q=[];for(let i=0;i<N;i++)if(sk[i]&&nb(i)<=1)q.push(i);
    while(q.length){const i=q.pop();if(!sk[i]||nb(i)>1)continue;sk[i]=0;const y=(i/W)|0,x=i-y*W;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const k=Y*W+X;if(sk[k]&&nb(k)<=1)q.push(k);}}
    {const sz=comps(sk,true);for(let i=0;i<N;i++)if(sk[i]&&sz[lab[i]]<20*lw)sk[i]=0;}
    if(round===2)splitTips(sk,lw);
    m=dil(sk,lw/2);}
  return{m,lw};}
// (a sharp tip, like a tree's point meeting the sky: in the photo the lead of its two sides runs together just below
// the tip, so the middle shows the two sides joining a little way down with one short line on up to the tip. The two
// sides are carried on, each straight, to the tip itself)
function splitTips(sk,lw){const N=W*H;
  const nbs=i=>{const o=[];const y=(i/W)|0,x=i-y*W;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<W&&Y<H&&sk[Y*W+X])o.push(Y*W+X);}return o;};
  // (joints: clusters of pixels with three or more neighbours)
  // (a true joint: its neighbours fall in three or more separate groups, not just a stair-step corner)
  const groups=i=>{const o=nbs(i);if(o.length<3)return o.length;const g=o.map((_,k)=>k),f=k=>{while(g[k]!==k)k=g[k]=g[g[k]];return k;};
    for(let a=0;a<o.length;a++)for(let b=a+1;b<o.length;b++)if(Math.abs(o[a]%W-o[b]%W)<=1&&Math.abs(((o[a]/W)|0)-((o[b]/W)|0))<=1)g[f(a)]=f(b);
    return new Set(o.map((_,k)=>f(k))).size;};
  const isJ=new Uint8Array(N);for(let i=0;i<N;i++)if(sk[i]&&groups(i)>=3)isJ[i]=1;
  const jl=new Int32Array(N),J=[];for(let i=0;i<N;i++){if(!isJ[i]||jl[i])continue;const id=J.length+1,px=[],st=[i];jl[i]=id;
    while(st.length){const k=st.pop();px.push(k);for(const n of nbs(k))if(!jl[n]&&isJ[n]){jl[n]=id;st.push(n);}}
    let sx=0,sy=0;for(const k of px){sx+=k%W;sy+=(k/W)|0;}J.push({id,px,c:[sx/px.length,sy/px.length]});}
  // (each branch out of a joint, walked until the next joint or a few line widths)
  const walk=(j,start,lim)=>{const path=[start],seen=new Set([start]);let cur=start;for(let k=0;k<lim;k++){if(jl[cur]&&jl[cur]!==j.id)return{path,to:jl[cur]};
      const nx=nbs(cur).filter(n=>!seen.has(n)&&jl[n]!==j.id);if(!nx.length)break;const jn=nx.find(n=>jl[n]);cur=jn!==undefined?jn:nx[0];seen.add(cur);path.push(cur);}
    return{path,to:jl[cur]&&jl[cur]!==j.id?jl[cur]:0};};
  const xy=k=>[k%W,(k/W)|0];const used=new Set();let n=0;
  for(const j of J){if(used.has(j.id))continue;const starts=[];for(const k of j.px)for(const s of nbs(k))if(!jl[s]&&!starts.some(t=>Math.abs(t%W-s%W)<=1&&Math.abs(((t/W)|0)-((s/W)|0))<=1))starts.push(s);
    if(starts.length!==3)continue;const br=starts.map(s=>walk(j,s,Math.round(4*lw)));
    const link=br.findIndex(b=>b.to&&b.path.length<3.5*lw);if(link<0)continue;const others=br.filter((_,i)=>i!==link);
    if(others.some(b=>b.path.length<2*lw))continue;
    const dir=b=>{const p=xy(b.path[Math.min(b.path.length-1,Math.round(2*lw))]);const v=[p[0]-j.c[0],p[1]-j.c[1]],l=Math.hypot(v[0],v[1])||1;return[v[0]/l,v[1]/l];};
    const L=br[link],J2=J[L.to-1];if(!J2||used.has(J2.id))continue;const lv=[J2.c[0]-j.c[0],J2.c[1]-j.c[1]],ll=Math.hypot(lv[0],lv[1])||1;
    const d1=dir(others[0]),d2=dir(others[1]),ang=Math.acos(Math.max(-1,Math.min(1,d1[0]*d2[0]+d1[1]*d2[1])))*180/Math.PI;
    // (the two sides close together, both heading away from the tip)
    if(ang>50||(d1[0]*lv[0]+d1[1]*lv[1])/ll>-0.5||(d2[0]*lv[0]+d2[1]*lv[1])/ll>-0.5)continue;
    for(const k of L.path)sk[k]=0;for(const k of j.px)sk[k]=0;
    for(const b of others){const cut=Math.min(b.path.length-1,Math.round(1.5*lw));for(let q=0;q<cut;q++)sk[b.path[q]]=0;const a=xy(b.path[cut]);
      const steps=Math.ceil(Math.hypot(J2.c[0]-a[0],J2.c[1]-a[1])*2);for(let t=0;t<=steps;t++){const x=Math.round(a[0]+(J2.c[0]-a[0])*t/steps),y=Math.round(a[1]+(J2.c[1]-a[1])*t/steps);sk[y*W+x]=1;}}
    used.add(j.id);used.add(J2.id);n++;}
  return n;}
