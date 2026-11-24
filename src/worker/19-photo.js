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
// (the lead found before any hand guides, and the last finished result, kept for the next run: a fix only redoes
// what it changes)
let photoBase=null,photoLast=null;
// (the largest or smallest value within r either side, along rows or columns: van Herk / Gil-Werman)
function runMaxMin(src,r,isMax,horiz){const N=W*H,out=new Uint8Array(N),L=horiz?W:H,n=horiz?H:W,k=2*r+1;
  const g=new Uint8Array(L+k),h=new Uint8Array(L+k),line=new Uint8Array(L+2*r),pad=isMax?0:255;
  const f=isMax?(a,b)=>a>b?a:b:(a,b)=>a<b?a:b;
  for(let j=0;j<n;j++){for(let i=0;i<L+2*r;i++){const t=i-r;line[i]=t<0||t>=L?pad:src[horiz?j*W+t:t*W+j];}
    const M=L+2*r;for(let i=0;i<M;i++)g[i]=i%k===0?line[i]:f(g[i-1],line[i]);
    for(let i=M-1;i>=0;i--)h[i]=(i%k===k-1||i===M-1)?line[i]:f(h[i+1],line[i]);
    for(let t=0;t<L;t++){const a=t,b=t+2*r;out[horiz?j*W+t:t*W+j]=f(h[a],g[b]);}}
  return out;}
function photoLines(T,C,guides){
  const N=W*H,sc=Math.max(W,H)/3000,lab=new Int32Array(N),st=new Int32Array(N);
  const notM=a=>{const o=new Uint8Array(N);for(let i=0;i<N;i++)o[i]=a[i]?0:1;return o;};
  const dil=(a,r)=>diskDil(a,r);
  const ero=(a,r)=>{const d=diskDil(notM(a),r);for(let i=0;i<N;i++)d[i]=d[i]?0:1;return d;};
  const comps=(a,eight)=>{lab.fill(0);const sz=[0];let n=0;for(let s=0;s<N;s++){if(!a[s]||lab[s])continue;n++;let sp=0,c=0;st[sp++]=s;lab[s]=n;
      while(sp){const i=st[--sp];c++;const y=(i/W)|0,x=i-y*W;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;if(!eight&&dx&&dy)continue;const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const k=Y*W+X;if(a[k]&&!lab[k]){lab[k]=n;st[sp++]=k;}}}
      sz.push(c);}return sz;};
  const gkey=JSON.stringify(guides||[]),bkey=T+':'+C+':'+W+'x'+H;
  if(photoLast&&photoLast.mx===mxBuf&&photoLast.bkey===bkey&&photoLast.gkey===gkey)return{m:photoLast.m.slice(),lw:photoLast.lw};
  let m,lw;if(photoBase&&photoBase.mx===mxBuf&&photoBase.key===bkey){m=photoBase.m.slice();lw=photoBase.lw;}else{
  const r1=Math.max(1,Math.round(sc)),r2=Math.max(1,Math.round(2*sc));
  // (very dark and grey)
  let core=new Uint8Array(N);for(let i=0;i<N;i++)core[i]=mxBuf[i]<T&&chBuf[i]<C?1:0;core=dil(ero(core,r2),r2);
  // (a dark grey streak in light glass: much darker than the brightest glass close by)
  const R=Math.max(6,Math.round(20*sc));const cl=runMaxMin(runMaxMin(runMaxMin(runMaxMin(mxBuf,R,true,true),R,true,false),R,false,true),R,false,false);
  let ridge=new Uint8Array(N);for(let i=0;i<N;i++)ridge[i]=cl[i]-mxBuf[i]>40&&mxBuf[i]<80&&chBuf[i]<45&&cl[i]>130?1:0;ridge=dil(ero(ridge,r1),r1);
  // (streaks only where they join the dark lead, and not specks)
  m=core.slice();{const sz=comps(ridge,true),touch=new Uint8Array(sz.length);for(let i=0;i<N;i++)if(lab[i]&&core[i])touch[lab[i]]=1;
    const lim=200*sc*sc;for(let i=0;i<N;i++)if(lab[i]&&touch[lab[i]]&&sz[lab[i]]>lim)m[i]=1;}
  m=ero(dil(m,r2),r2);
  {const sz=comps(m,true);let big=1;for(const v of sz)if(v>big)big=v;for(let i=0;i<N;i++)if(m[i]&&sz[lab[i]]<0.002*big)m[i]=0;}
  lw=Math.max(4,inkWidth(m));photoBase={mx:mxBuf,key:bkey,m:m.slice(),lw};}

  // (a fix that only adds or takes back hand guides redoes the cleaning just round them: the rest is as last time)
  const local=photoLocal(m,guides,lw,bkey);if(local){m=local;}else m=cleanPhoto(m,guides,lw,null);
  photoLast={mx:mxBuf,bkey,gkey,m:m.slice(),lw,guides:Array.isArray(guides)?guides:[]};
  return{m,lw};}
// (the cleaning of the lead found: holes filled, lines thinned to their middles, loose ends taken back, scraps dropped,
// redrawn; with the hand guides followed. 'edge', when given, marks pixels at the edge of a part of the picture being
// cleaned on its own: lines running off it are not loose ends and pieces cut by it are not holes)
function cleanPhoto(m,guides,lw,edge){const N=W*H,lab=new Int32Array(N),st=new Int32Array(N);
  const notM=a=>{const o=new Uint8Array(N);for(let i=0;i<N;i++)o[i]=a[i]?0:1;return o;};
  const dil=(a,r)=>diskDil(a,r);
  const comps=(a,eight)=>{lab.fill(0);const sz=[0];let n=0;for(let s=0;s<N;s++){if(!a[s]||lab[s])continue;n++;let sp=0,c=0;st[sp++]=s;lab[s]=n;
      while(sp){const i=st[--sp];c++;const y=(i/W)|0,x=i-y*W;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;if(!eight&&dx&&dy)continue;const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const k=Y*W+X;if(a[k]&&!lab[k]){lab[k]=n;st[sp++]=k;}}}
      sz.push(c);}return sz;};
  // (holes: a pinhole, or a little dark ring of glass texture, is filled; a real small piece, an eye or a nostril, is
  // light glass and stays however small)
  const fillHoles=(lim,darkLim)=>{const inv=notM(m),sz=comps(inv,false),sum=new Float64Array(sz.length);for(let i=0;i<N;i++)if(lab[i])sum[lab[i]]+=mxBuf[i];
    // (a piece that a hand guide closes is a real piece, however dark or small: the person drew it)
    const gHole=gm?new Uint8Array(sz.length):null;if(gm)for(let i=0;i<N;i++)if(lab[i]&&gm[i])gHole[lab[i]]=1;
    // (a light piece found in the first pass, an eye or a nostril, stays a piece when the lines round it are redrawn
    // at full lead width and it shrinks)
    const keepLab=lightKeep?new Uint8Array(sz.length):null;if(lightKeep)for(let i=0;i<N;i++)if(lab[i]&&lightKeep[i])keepLab[lab[i]]=1;
    // (and a sliver: a piece much narrower than the lead is wide, and long, is where two lines run side by side)
    const dd=edt(m),far=new Float64Array(sz.length);for(let i=0;i<N;i++)if(lab[i]&&dd[i]>far[lab[i]])far[lab[i]]=dd[i];
    for(let i=0;i<N;i++){const l=lab[i];if(!l)continue;const r=Math.sqrt(far[l]),sliver=r<0.6*lw&&sz[l]/(2*Math.max(1,r))>3*lw&&sz[l]<30*lw*lw;
      const mean=sum[l]/sz[l];if(gHole&&gHole[l]&&sz[l]>=0.3*lw*lw)continue;if(keepLab&&keepLab[l])continue;if((sz[l]<lim&&(mean<120||sz[l]<0.25*lw*lw))||(sz[l]<darkLim&&mean<40)||(sliver&&mean<120))m[i]=1;}};

  // (along the middle; loose ends taken back, short lines on their own dropped; then once more, as the redrawing
  // closes rings that the first pass left)
  // (guides marked by hand: along each, the lead in the photo is found and kept, even where it is lighter or broken;
  // where none shows, the guide itself is drawn)
  // (and kept through the cleaning below: a guide's line is not a loose end or a scrap to be dropped, and the pieces
  // it closes are not holes to fill)
  // (a guide through a wide patch of dark, lead or dark glass with no line of its own to find, is drawn again once the
  // patch has been cleaned down to lines: drawn into it before, it would be lost in it)
  const late=[];
  let gm=null;if(Array.isArray(guides)&&guides.length){gm=new Uint8Array(N);for(const G of guides){if(!followGuide(m,G,lw))late.push(G);for(let i=2;i+1<G.length;i+=2)drawSeg(gm,G[i-2],G[i-1],G[i],G[i+1],0.65*lw);}}
  if(edge){if(!gm)gm=new Uint8Array(N);for(let i=0;i<N;i++)if(edge[i])gm[i]=1;}
  let sk=null;
  let lightKeep=null;
  for(let round=0;round<3;round++){fillHoles(round?2.5*lw*lw:1.3*lw*lw,8*lw*lw);
    if(round===0){// (the light pieces left after the first filling: their middles, kept open from here on)
      const inv=notM(m),sz=comps(inv,false),sum=new Float64Array(sz.length);for(let i=0;i<N;i++)if(lab[i])sum[lab[i]]+=mxBuf[i];
      // (only one ringed by real lead, near black all round: a light fleck in streaky glass texture is no piece)
      const bx=new Map();for(let i=0;i<N;i++){const l=lab[i];if(!l||sz[l]<2*lw*lw||sz[l]>=6*lw*lw||sum[l]/sz[l]<120)continue;const x=i%W,y=(i/W)|0;let b=bx.get(l);if(!b)bx.set(l,b=[x,y,x,y]);else{if(x<b[0])b[0]=x;if(x>b[2])b[2]=x;if(y<b[1])b[1]=y;if(y>b[3])b[3]=y;}}
      const ok=new Set();for(const[l,b]of bx){let n=0,dk=0;for(let y=Math.max(0,b[1]-4);y<=Math.min(H-1,b[3]+4);y++)for(let x=Math.max(0,b[0]-4);x<=Math.min(W-1,b[2]+4);x++){const i=y*W+x;if(!m[i])continue;
          let near=false;for(let dy=-4;dy<=4&&!near;dy++)for(let dx=-4;dx<=4;dx++){const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<W&&Y<H&&lab[Y*W+X]===l){near=true;break;}}
          if(near){n++;if(mxBuf[i]<30)dk++;}}
        if(n&&dk>=0.3*n)ok.add(l);}
      const nearM=diskDil(m,Math.sqrt(3));lightKeep=new Uint8Array(N);for(let i=0;i<N;i++){const l=lab[i];if(l&&ok.has(l)&&!nearM[i])lightKeep[i]=1;}}
    sk=m.slice();thin(sk,W,H);
    // (an end: one neighbour, or two that touch each other, as at the stair-stepped tip of a thinned line)
    const nbs=i=>{const o=[];const y=(i/W)|0,x=i-y*W;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<W&&Y<H&&sk[Y*W+X])o.push(Y*W+X);}return o;};
    const nb=i=>{const o=nbs(i);if(o.length===2){const a=o[0],b=o[1];if(Math.abs(a%W-b%W)<=1&&Math.abs(((a/W)|0)-((b/W)|0))<=1)return 1;}return o.length;};
    // (a lead line broken for a moment, by a reflection or a dark spot of glass beside it, is joined again: a loose end
    // carried straight on to a line close ahead of it)
    if(round===0)bridgeEnds(sk,lw,nb,nbs);
    const q=[];for(let i=0;i<N;i++)if(sk[i]&&nb(i)<=1)q.push(i);
    while(q.length){const i=q.pop();if(!sk[i]||nb(i)>1||(gm&&gm[i]))continue;sk[i]=0;const y=(i/W)|0,x=i-y*W;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const k=Y*W+X;if(sk[k]&&nb(k)<=1)q.push(k);}}
    {const sz=comps(sk,true),keepG=new Uint8Array(sz.length);if(gm)for(let i=0;i<N;i++)if(sk[i]&&gm[i])keepG[lab[i]]=1;for(let i=0;i<N;i++)if(sk[i]&&sz[lab[i]]<20*lw&&!keepG[lab[i]])sk[i]=0;}
    if(round===2)splitTips(sk,lw);
    m=dil(sk,lw/2);
    if(lightKeep)for(let i=0;i<N;i++)if(lightKeep[i])m[i]=0;}
  for(const G of late)for(let i=2;i+1<G.length;i+=2)drawSeg(m,G[i-2],G[i-1],G[i],G[i+1],Math.max(2,0.35*lw));
  return m;}
// (only the guides changed since last time, and the part of the picture round them small: that part is cleaned again
// on its own, from the lead as first found, with every guide that reaches into it, and set into last time's result.
// A margin all round is cleaned too but not set back, so the edge of the part leaves no mark)
function photoLocal(m,guides,lw,bkey){const P=photoLast;if(!P||P.mx!==mxBuf||P.bkey!==bkey||!P.guides)return null;
  const now=Array.isArray(guides)?guides:[],kn=new Set(now.map(g=>JSON.stringify(g))),kp=new Set(P.guides.map(g=>JSON.stringify(g)));
  const changed=now.filter(g=>!kp.has(JSON.stringify(g))).concat(P.guides.filter(g=>!kn.has(JSON.stringify(g))));if(!changed.length)return null;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const G of changed)for(let i=0;i+1<G.length;i+=2){x0=Math.min(x0,G[i]);x1=Math.max(x1,G[i]);y0=Math.min(y0,G[i+1]);y1=Math.max(y1,G[i+1]);}
  if(!isFinite(x0))return null;const M=Math.ceil(14*lw),pad=Math.ceil(5*lw);
  const cx0=Math.max(0,Math.floor(x0-M)),cy0=Math.max(0,Math.floor(y0-M)),cx1=Math.min(W-1,Math.ceil(x1+M)),cy1=Math.min(H-1,Math.ceil(y1+M));
  const cw=cx1-cx0+1,ch=cy1-cy0+1;if(cw*ch>0.35*W*H||cw<4*pad||ch<4*pad)return null;
  const FW=W,FH=H,fmx=mxBuf,fch=chBuf;
  const sub=a=>{const o=new Uint8Array(cw*ch);for(let y=0;y<ch;y++)o.set(a.subarray((cy0+y)*FW+cx0,(cy0+y)*FW+cx0+cw),y*cw);return o;};
  const mC=sub(m),mxC=sub(fmx),chC=sub(fch);
  const gC=[];for(const G of now){let hit=false;for(let i=0;i+1<G.length;i+=2)if(G[i]>=cx0-lw&&G[i]<=cx1+lw&&G[i+1]>=cy0-lw&&G[i+1]<=cy1+lw){hit=true;break;}
    if(hit){const g=new Array(G.length);for(let i=0;i+1<G.length;i+=2){g[i]=G[i]-cx0;g[i+1]=G[i+1]-cy0;}gC.push(g);}}
  // (the part's own edges, where it is cut from the rest: not the picture's edges)
  const edge=new Uint8Array(cw*ch);for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){if((x<2&&cx0>0)||(x>=cw-2&&cx1<FW-1)||(y<2&&cy0>0)||(y>=ch-2&&cy1<FH-1))edge[y*cw+x]=1;}
  let r;W=cw;H=ch;mxBuf=mxC;chBuf=chC;try{r=cleanPhoto(mC,gC,lw,edge);}finally{W=FW;H=FH;mxBuf=fmx;chBuf=fch;}
  const out=P.m.slice(),ix0=cx0>0?pad:0,iy0=cy0>0?pad:0,ix1=cx1<FW-1?cw-pad:cw,iy1=cy1<FH-1?ch-pad:ch;
  for(let y=iy0;y<iy1;y++)out.set(r.subarray(y*cw+ix0,y*cw+ix1),(cy0+y)*FW+cx0+ix0);
  return out;}

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

function bridgeEnds(sk,lw,nb,nbs){const N=W*H,ends=[];for(let i=0;i<N;i++)if(sk[i]&&nb(i)<=1)ends.push(i);
  const reach=1.6*lw,walkN=Math.round(2*lw);let n=0;
  for(const e of ends){const own=new Set([e]);let cur=e,path=[e];
    // (only a long line ending in nothing: a short stub off a line is glass texture, and is taken back instead)
    let ok=true;for(let k=0;k<3*lw;k++){const nx=nbs(cur).filter(j=>!own.has(j));if(nx.length!==1&&!(nx.length===2&&Math.abs(nx[0]%W-nx[1]%W)<=1&&Math.abs(((nx[0]/W)|0)-((nx[1]/W)|0))<=1)){ok=false;break;}cur=nx[0];own.add(cur);path.push(cur);}
    if(!ok)continue;path.length=Math.min(path.length,walkN);
    // (the line's own pixels further back are not a target either)
    for(let k=0;k<3*walkN;k++){const nx=nbs(cur).filter(j=>!own.has(j));if(!nx.length)break;cur=nx[0];own.add(cur);}
    const ex=e%W,ey=(e/W)|0,bx=path[path.length-1]%W,by=(path[path.length-1]/W)|0;let vx=ex-bx,vy=ey-by;const vl=Math.hypot(vx,vy)||1;vx/=vl;vy/=vl;
    let best=-1,bd=Infinity;const R=Math.ceil(reach);
    for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const X=ex+dx,Y=ey+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const k=Y*W+X;if(!sk[k]||own.has(k))continue;
      const d=Math.hypot(dx,dy);if(d<1.5||d>reach)continue;const c=(dx*vx+dy*vy)/d;if(c<0.85)continue;const score=d*(2-c);if(score<bd){bd=score;best=k;}}
    if(best<0)continue;const X=best%W,Y=(best/W)|0,steps=Math.ceil(2*Math.hypot(X-ex,Y-ey));
    // (and the gap itself dark in the photo, as lead under a reflection still is; not open glass)
    let dk=0;for(let t=0;t<=steps;t++){const k=Math.round(ey+(Y-ey)*t/steps)*W+Math.round(ex+(X-ex)*t/steps);if(mxBuf[k]<100)dk++;}if(dk<0.6*(steps+1))continue;
    for(let t=0;t<=steps;t++)sk[Math.round(ey+(Y-ey)*t/steps)*W+Math.round(ex+(X-ex)*t/steps)]=1;n++;}
  return n;}

function followGuide(m,G,lw){if(!G||G.length<4)return true;const N=W*H,R=1.3*lw;
  let x0=W,y0=H,x1=0,y1=0;for(let i=0;i<G.length;i+=2){x0=Math.min(x0,G[i]);x1=Math.max(x1,G[i]);y0=Math.min(y0,G[i+1]);y1=Math.max(y1,G[i+1]);}
  x0=Math.max(0,Math.floor(x0-R-2));y0=Math.max(0,Math.floor(y0-R-2));x1=Math.min(W-1,Math.ceil(x1+R+2));y1=Math.min(H-1,Math.ceil(y1+R+2));
  const dseg=(x,y)=>{let bd=Infinity,bt=0,acc=0,tot=0;for(let i=2;i+1<G.length;i+=2){const ax=G[i-2],ay=G[i-1],dx=G[i]-ax,dy=G[i+1]-ay,l=Math.hypot(dx,dy)||1;let t=((x-ax)*dx+(y-ay)*dy)/(l*l);t=Math.max(0,Math.min(1,t));const d=Math.hypot(ax+t*dx-x,ay+t*dy-y);if(d<bd){bd=d;bt=acc+t*l;}acc+=l;}return[bd,bt,acc];};
  // (the darkest grey pixels in the band round the guide: the lead under it)
  const band=[];let total=1;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const[d,t,L]=dseg(x,y);total=L;if(d<=R)band.push([y*W+x,t,d]);}
  if(!band.length)return true;const vals=band.map(b=>mxBuf[b[0]]).sort((a,b)=>a-b);const lo=vals[Math.floor(0.05*vals.length)],hi=vals[Math.floor(0.6*vals.length)];
  const T=Math.min(90,lo+0.4*(hi-lo));const found=new Uint8Array(N);for(const[i]of band)if(mxBuf[i]<=T&&chBuf[i]<50)found[i]=1;
  // (how much of the guide's length has lead beside it)
  // (lead is a thin line in the band; when most of the band reads as dark, it is dark glass round a small piece, and
  // the mark itself is the better line)
  let nf=0;for(const[i]of band)if(found[i])nf++;const clear=nf<0.5*band.length;
  const nb=Math.max(1,Math.ceil(total/lw)),hit=new Uint8Array(nb);for(const[i,t]of band)if(found[i])hit[Math.min(nb-1,Math.floor(t/lw))]=1;let c=0;for(const v of hit)c+=v;
  const use=clear&&c>=0.7*nb&&hi-lo>25;
  if(use){for(let i=0;i<N;i++)if(found[i])m[i]=1;
    // (and its breaks closed along the guide)
    for(let k=0;k<nb;k++)if(!hit[k]){}
  }
  // (where the photo shows no lead along a stretch, the guide is drawn there)
  let acc=0;for(let i=2;i+1<G.length;i+=2){const ax=G[i-2],ay=G[i-1],bx=G[i],by=G[i+1],l=Math.hypot(bx-ax,by-ay);const n=Math.max(1,Math.ceil(l/(lw/2)));
    for(let j=0;j<n;j++){const t=acc+l*(j+0.5)/n,k=Math.min(nb-1,Math.floor(t/lw));if(use&&hit[k])continue;const px=ax+(bx-ax)*j/n,py=ay+(by-ay)*j/n,qx=ax+(bx-ax)*(j+1)/n,qy=ay+(by-ay)*(j+1)/n;drawSeg(m,px,py,qx,qy,lw/2);}acc+=l;}
  return use;}

// (for the blue pen's preview: the line a guide will become, before it is applied. Along the guide, where the photo
// shows lead beside it (as followGuide decides), the middle of that lead; elsewhere the guide itself)
function previewGuide(G){const P=photoLast||photoBase;if(!mxBuf||!chBuf||!P||P.mx!==mxBuf||!G||G.length<4)return G;
  const lw=P.lw,R=1.3*lw;let L=0;const seg=[];for(let i=2;i+1<G.length;i+=2){const l=Math.hypot(G[i]-G[i-2],G[i+1]-G[i-1]);seg.push(l);L+=l;}
  let x0=W,y0=H,x1=0,y1=0;for(let i=0;i<G.length;i+=2){x0=Math.min(x0,G[i]);x1=Math.max(x1,G[i]);y0=Math.min(y0,G[i+1]);y1=Math.max(y1,G[i+1]);}
  x0=Math.max(0,Math.floor(x0-R-2));y0=Math.max(0,Math.floor(y0-R-2));x1=Math.min(W-1,Math.ceil(x1+R+2));y1=Math.min(H-1,Math.ceil(y1+R+2));
  const near=(x,y)=>{let bd=Infinity,bt=0,acc=0;for(let i=2,k=0;i+1<G.length;i+=2,k++){const ax=G[i-2],ay=G[i-1],dx=G[i]-ax,dy=G[i+1]-ay,l=seg[k]||1;let t=((x-ax)*dx+(y-ay)*dy)/(l*l);t=Math.max(0,Math.min(1,t));const d=Math.hypot(ax+t*dx-x,ay+t*dy-y);if(d<bd){bd=d;bt=acc+t*l;}acc+=l;}return[bd,bt];};
  const band=[];for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const[d,t]=near(x,y);if(d<=R)band.push([x,y,t]);}
  if(!band.length)return G;const vals=band.map(b=>mxBuf[b[1]*W+b[0]]).sort((a,b)=>a-b);const lo=vals[Math.floor(0.05*vals.length)],hi=vals[Math.floor(0.6*vals.length)];
  const T=Math.min(90,lo+0.4*(hi-lo)),nb=Math.max(1,Math.ceil(L/lw)),sx=new Float64Array(nb),sy=new Float64Array(nb),cnt=new Float64Array(nb);let nf=0;
  for(const[x,y,t]of band){const i=y*W+x;if(mxBuf[i]<=T&&chBuf[i]<50){nf++;const k=Math.min(nb-1,Math.floor(t/lw));sx[k]+=x;sy[k]+=y;cnt[k]++;}}
  let c=0;for(let k=0;k<nb;k++)if(cnt[k])c++;const use=nf<0.5*band.length&&c>=0.7*nb&&hi-lo>25;if(!use)return G;
  // (each stretch of a lead's width: the middle of the lead found there, or the guide where none was)
  const out=[];const at=t=>{let acc=0;for(let i=2,k=0;i+1<G.length;i+=2,k++){const l=seg[k];if(t<=acc+l||i+2>=G.length){const u=l?Math.max(0,Math.min(1,(t-acc)/l)):0;return[G[i-2]+(G[i]-G[i-2])*u,G[i-1]+(G[i+1]-G[i-1])*u];}acc+=l;}return[G[0],G[1]];};
  out.push(G[0],G[1]);for(let k=0;k<nb;k++){const g=at(Math.min(L,(k+0.5)*lw));if(cnt[k]>=2)out.push(sx[k]/cnt[k],sy[k]/cnt[k]);else out.push(g[0],g[1]);}out.push(G[G.length-2],G[G.length-1]);
  // (smoothed a little, as the finished line will be)
  for(let pass=0;pass<2;pass++){const c=out.slice();for(let i=2;i+3<out.length;i+=2){out[i]=(c[i-2]+2*c[i]+c[i+2])/4;out[i+1]=(c[i-1]+2*c[i+1]+c[i+3])/4;}}
  return out;}
