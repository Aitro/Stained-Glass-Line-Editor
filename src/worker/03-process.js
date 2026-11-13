// One run: threshold the picture, close gaps, thin it, measure line width, then hand off to buildStrokes.
// ------------------------------------------------------------------------------------------------
function process(p){
  const say=t=>postMessage({type:'progress',text:t});
  say('Finding lines…');
  const t=p.auto?otsuT:p.threshold;const m=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++)m[i]=p.invert?(gray[i]>=t?1:0):(gray[i]<t?1:0);
  // mirrored areas (picked by hand): inside each box the picture is replaced by the matching spot on the other side
  // of the pattern's centre line (upright, or level for top-to-bottom; see symAxis), flipped. Where a line crosses the box's edge, the two sides may draw it a
  // little apart: near the edge the copy is shifted so each line meets its own line outside exactly, easing back to
  // an exact copy further in. Right at the edge both pictures are kept, so crossing lines stay joined.
  const areas=Array.isArray(p.areas)?p.areas.filter(a=>a&&[a.x0,a.y0,a.x1,a.y1].every(isFinite)):[];
  // (the centre lines are always found, so the page can show where a new box will copy from)
  let axes={lr:symAxis(m,'lr'),tb:symAxis(m,'tb'),areas:[]},axesOut=axes;
  // (the centre line of the drawing itself, where the lines on both sides best fall on each other: for making
  // the whole pattern symmetric)
  // the whole pattern made symmetric (picked by hand): one half replaced by the other, flipped across the centre
  // line; right along the centre line both pictures are kept, so a line running down it stays whole
  const halves=Array.isArray(p.halves)?p.halves.filter(h=>h&&(h.flip==='lr'||h.flip==='tb')):[];
  // (found only when wanted: it takes a moment)
  if(p.inkAxes||halves.length){axes.inkLr=inkAxis(m,'lr',axes.lr);axes.inkTb=inkAxis(m,'tb',axes.tb);}
  for(const hf of halves){const A=hf.flip==='tb'?axes.inkTb:axes.inkLr;if(!A)continue;const src=m.slice(),u=A.u,nv=[u[1],-u[0]],off=+hf.off||0;
    const cx=A.cx+nv[0]*off,cy=A.cy+nv[1]*off,keepSide=hf.keep>0?1:-1;
    // (half a line's width either side of the centre line, at this picture's scale)
    let band=2;{const r=[];for(let y=1;y<H-1;y+=3)for(let x=1;x<W-1;x+=3){const i=y*W+x;if(src[i]&&!src[i-1])for(let k=1;k<60;k++){if(x+k>=W||!src[i+k]){r.push(k);break;}}}r.sort((a,b)=>a-b);if(r.length)band=Math.max(2,0.6*r[r.length>>1]);}
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const dx=x-cx,dy=y-cy,sd=dx*nv[0]+dy*nv[1];if(Math.sign(sd)===keepSide&&Math.abs(sd)>band)continue;
      const k=2*(dx*u[0]+dy*u[1]),mx=Math.round(cx+k*u[0]-dx),my=Math.round(cy+k*u[1]-dy),v=mx>=0&&mx<W&&my>=0&&my<H?src[my*W+mx]:0;
      m[y*W+x]=Math.abs(sd)<=band?(v|src[y*W+x]):v;}}
  if(areas.length){const src=m.slice(),at=(x,y)=>{x=Math.round(x);y=Math.round(y);return x>=0&&x<W&&y>=0&&y<H?src[y*W+x]:0;};
    const areaAxes=axes.areas;
    {for(const a of areas){const G=axes[a.flip==='tb'?'tb':'lr'];areaAxes.push(null);if(!G)continue;
        const ox=+a.ox||0,oy=+a.oy||0,moved=Math.hypot(ox,oy)>0.5;
        // (a copy-from box the person moved: their spot is taken as it is, across the outline's centre line)
        const A=moved?Object.assign({},G):refineAxis(src,G,a.flip==='tb'?'tb':'lr',a);areaAxes[areaAxes.length-1]=A;const cx=A.cx,cy=A.cy,u=A.u;
        // (reflected across the pattern's centre line: through (cx,cy) along u)
        const mirAt=(x,y)=>{const dx=x-cx,dy=y-cy,k=2*(dx*u[0]+dy*u[1]);return at(cx+k*u[0]-dx+ox,cy+k*u[1]-dy+oy);};A.ox=ox;A.oy=oy;let x0=Math.max(1,Math.floor(a.x0)),x1=Math.min(W-2,Math.ceil(a.x1)),y0=Math.max(1,Math.floor(a.y0)),y1=Math.min(H-2,Math.ceil(a.y1));if(x1-x0<4||y1-y0<4)continue;
        // (where lines cross each edge, in the picture and in the copy: the middles of the runs of ink along it)
        const runs=(f,E)=>{const out=[];let st=-1;for(let t=0;t<=E[4]+1;t++){const v=t<=E[4]&&f(E[0]+E[2]*t,E[1]+E[3]*t);if(v&&st<0)st=t;if(!v&&st>=0){out.push([(st+t-1)/2,t-st]);st=-1;}}return out;};
        const edgesOf=()=>[[x0,y0,1,0,x1-x0],[x0,y1,1,0,x1-x0],[x0,y0,0,1,y1-y0],[x1,y0,0,1,y1-y0]];
        const widths=[];for(const E of edgesOf())for(const r of runs(at,E))widths.push(r[1]);
        widths.sort((p,q)=>p-q);const lw=Math.max(2,Math.min(40,widths.length?widths[widths.length>>1]:4));
        // (each line meets the nearest unclaimed line of the copy, if one is close enough)
        const pair=(ro,rm)=>{const c=[];for(let i=0;i<ro.length;i++)for(let j=0;j<rm.length;j++){const d=Math.abs(ro[i][0]-rm[j][0]);if(d<=Math.max(2.5*lw,0.75*(ro[i][1]+rm[j][1])))c.push([d,i,j]);}
          c.sort((p,q)=>p[0]-q[0]);const ui=new Set(),uj=new Set(),out=[];for(const[d,i,j]of c){if(ui.has(i)||uj.has(j))continue;ui.add(i);uj.add(j);out.push([i,j,d]);}return out;};
        // (each edge is nudged a little, in or out, to where the lines on both sides agree best)
        const K=Math.round(2.5*lw),cost=E=>{const ro=runs(at,E),rm=runs(mirAt,E),pr=pair(ro,rm);let c=2.5*lw*(ro.length+rm.length-2*pr.length);for(const q of pr)c+=q[2];return c;};
        for(let k=0;k<(moved?0:4);k++){let bo=0,bc=Infinity;for(let o=-K;o<=K;o++){const nx0=x0+(k===2?o:0),nx1=x1+(k===3?o:0),ny0=y0+(k===0?o:0),ny1=y1+(k===1?o:0);
            if(nx0<1||ny0<1||nx1>W-2||ny1>H-2||nx1-nx0<4||ny1-ny0<4)continue;const E=[[nx0,ny0,1,0,nx1-nx0],[nx0,ny1,1,0,nx1-nx0],[nx0,ny0,0,1,ny1-ny0],[nx1,ny0,0,1,ny1-ny0]][k];
            const c=cost(E)+0.02*lw*Math.abs(o);if(c<bc){bc=c;bo=o;}}
          if(k===0)y0+=bo;else if(k===1)y1+=bo;else if(k===2)x0+=bo;else x1+=bo;}
        A.box=[x0,y0,x1,y1];
        const cross=[];for(const E of edgesOf())cross.push([E,runs(at,E),runs(mirAt,E)]);
        // (each line crossing an edge, with how far the copy must move along the edge to meet it)
        // (a box across the centre line: the part on the side holding most of the box takes the copy, the rest stays)
        const nv=[u[1],-u[0]],sideOf=(x,y)=>Math.sign((x-cx)*nv[0]+(y-cy)*nv[1]),bs=sideOf((x0+x1)/2,(y0+y1)/2)||1,keep=(x,y)=>!moved&&sideOf(x,y)===-bs;
        const pins=[];for(const[E,ro,rm]of cross)for(const[i,j]of pair(ro,rm)){const r=ro[i],best=rm[j];if(keep(E[0]+E[2]*r[0],E[1]+E[3]*r[0]))continue;
          pins.push({x:E[0]+E[2]*r[0],y:E[1]+E[3]*r[0],dx:E[2]*(r[0]-best[0]),dy:E[3]*(r[0]-best[0])});}
        const B=Math.max(3*lw,0.4*Math.min(x1-x0,y1-y0)),S2=4*lw,band=Math.max(2,Math.round(0.35*lw));
        for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){if(keep(x,y))continue;const e=Math.min(x-x0,x1-x,y-y0,y1-y);let sx=0,sy=0;
          if(pins.length){let sw=0;for(const q of pins){const w=1/((x-q.x)**2+(y-q.y)**2+1e-3);sw+=w;sx+=w*q.dx;sy+=w*q.dy;}sx/=sw;sy/=sw;}
          const v=mirAt(x-sx,y-sy);m[y*W+x]=e<band?(v|src[y*W+x]):v;}}}}
  // lines drawn by hand, as wide as the picture's own lines
  const lines=Array.isArray(p.lines)?p.lines.filter(L=>L&&[L.ax,L.ay,L.bx,L.by].every(isFinite)):[];
  if(lines.length){const lw=inkWidth(m);for(const L of lines)drawSeg(m,L.ax,L.ay,L.bx,L.by,lw/2);}
  // numbers and labels written in the pieces: small separate bits of ink drawn much thinner than the lines
  if(p.dropText!==false)dropText(m);
  // estimate typical line thickness from ridge of distance map
  const bg=new Uint8Array(W*H);for(let i=0;i<W*H;i++)bg[i]=m[i]?0:1;
  let dbg=edt(bg);const ridge=[];
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;const d=dbg[i];if(d<1)continue;
    if(d>=dbg[i-1]&&d>=dbg[i+1]&&d>=dbg[i-W]&&d>=dbg[i+W])ridge.push(2*Math.sqrt(d)-1);}
  ridge.sort((a,b)=>a-b);const med=ridge.length?ridge[ridge.length>>1]:3;
  const u=Math.max(1.5,med/1.75); // working unit ≈ one source-pixel line width
  // close gaps narrower than ~2/3 of a line width (hollow or skipping marker strokes),
  // using distance maps: grow the lines by r, then shrink them back by r
  // (not for colored patterns: they are clean drawings where every gap, however thin, is glass)
  // (and not for Change width only: lines are kept as drawn, gaps and all)
  if(!colorIn&&!p.asDrawn){const r=Math.max(1.5,0.33*med),r2=r*r;const d1=edt(m);const dil=new Uint8Array(W*H);
    for(let i=0;i<W*H;i++)dil[i]=d1[i]<=r2?1:0;
    const notd=new Uint8Array(W*H);for(let i=0;i<W*H;i++)notd[i]=dil[i]?0:1;
    // pixels outside the image count as paper so the outer border is not pulled inward
    const d2=edt(notd);const fill=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;
      const edge=Math.min(x+1,y+1,W-x,H-y);if(!m[i]&&d2[i]>r2&&edge*edge>r2)fill[i]=1;}
    if(p.keepGaps)closeGapsKept(m,fill,r);else for(let i=0;i<W*H;i++)if(fill[i])m[i]=1;}
  removeSmall(m,1,Math.round(40*u*u),true,false);
  removeSmall(m,0,Math.round(4*u*u),false,true);
  say('Finding line centers…');
  const PW=W+2,PH=H+2;const img=new Uint8Array(PW*PH);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)img[(y+1)*PW+x+1]=m[y*W+x];
  thin(img,PW,PH);
  // remove staircase pixels: drop a pixel whose neighbours stay connected without it,
  // so ordinary line pixels have exactly two neighbours and only real junctions have three
  {const ring=[[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]];const ro=ring.map(([dx,dy])=>dy*PW+dx);
    for(let pass=0;pass<2;pass++)for(let k=PW;k<PW*(PH-1);k++){if(!img[k])continue;
      const on=[];for(let r=0;r<8;r++)if(img[k+ro[r]])on.push(r);if(on.length<2||on.length>4)continue;
      const par=on.map((_,i)=>i);const f=i=>par[i]===i?i:(par[i]=f(par[i]));
      for(let a=0;a<on.length;a++)for(let b=a+1;b<on.length;b++){const A=ring[on[a]],B=ring[on[b]];
        if(Math.abs(A[0]-B[0])<=1&&Math.abs(A[1]-B[1])<=1)par[f(a)]=f(b);}
      let comps=0;for(let i=0;i<on.length;i++)if(f(i)===i)comps++;
      if(comps===1&&on.length<=3)img[k]=0;}}
  const sk=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)sk[y*W+x]=img[(y+1)*PW+x+1];
  // stats: thickness sampled on the centerline
  for(let i=0;i<W*H;i++)bg[i]=m[i]?0:1;dbg=edt(bg);let dbg2=dbg;const th=[];
  for(let i=0;i<W*H;i++)if(sk[i])th.push(2*Math.sqrt(dbg[i])-1);th.sort((a,b)=>a-b);
  const q=f=>th.length?th[Math.min(th.length-1,Math.floor(f*th.length))]:0;
  const stats={thin:q(.08),mid:q(.5),thick:q(.92),threshold:t};
  dbg=null;

  say('Tracing curves…');
  const dmap=new Float32Array(W*H);for(let i=0;i<W*H;i++)dmap[i]=Math.sqrt(dbg2[i]);dbg2=null;
  const built=p.asDrawn?traceAsDrawn(sk,u,dmap,p):buildStrokes(sk,u,med,dmap,p.smooth,say,p);
  if(p.keepGaps&&!p.asDrawn)uncross(built.strokes,traceAsDrawn(sk,u,dmap,{}).strokes,med);
  if(p.keepGaps&&!p.asDrawn)built.strokes=reachLines(built.strokes,med);
  if(p.dropIslands!==false)built.strokes=dropIslands(built.strokes,med);
  if(!p.asDrawn)built.strokes=roundTouches(built.strokes,med);
  const strokes=built.strokes;
  const fl=[],fo=[0],cl=[],co=[0];for(const f of built.fillets){for(const q of f.fill)fl.push(q[1]+0.5,q[0]+0.5);fo.push(fl.length/2);for(const q of f.curve)cl.push(q[1]+0.5,q[0]+0.5);co.push(cl.length/2);}
  const flat=[],offs=[0],hwf=[];
  // the original line's half-width at each point (largest distance-to-paper nearby), with a running
  // median along the line so junction blobs don't count; used to line a border up with an edge
  for(const S of strokes){const raw=S.map(q=>{let mx=0;const yy=Math.round(q[0]),xx=Math.round(q[1]);
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const y=yy+dy,x=xx+dx;if(y>=0&&x>=0&&y<H&&x<W)mx=Math.max(mx,dmap[y*W+x]);}return Math.max(0.5,mx-0.5);});
    const hw=raw.map((_,i)=>{const a=raw.slice(Math.max(0,i-75),Math.min(raw.length,i+76)).sort((p,q)=>p-q);return a[Math.floor(a.length*0.4)];});
    S.forEach((q,i)=>{flat.push(q[1]+0.5,q[0]+0.5);hwf.push(hw[i]);});offs.push(flat.length/2);}
  const junctions=(built.junctions||[]).map(J=>({x:J.p[1]+0.5,y:J.p[0]+0.5,wx:J.q[1],wy:J.q[0],arms:J.arms,pairs:J.pairs,fixed:J.fixed}));
  return{axes:axesOut,junctions,pts:new Float32Array(flat),offs:new Int32Array(offs),hw:new Float32Array(hwf),stats,rot:built.rot,fill:{pts:new Float32Array(fl),offs:new Int32Array(fo)},fcurve:{pts:new Float32Array(cl),offs:new Int32Array(co)}};}

// ===================================================================== curve stage
// Trace the centerline into a graph of lines and junctions, rebuild junctions the way a
// pattern is drawn (lines run through, branches land on them, crossings stay crossings),
// keep real corners sharp, and smooth each long curve with a fidelity-checked smoother.

// The line a pattern's outline is most nearly mirror-symmetric about: upright ('lr') or level ('tb'). The outline (the
// whole panel, holes filled) is used rather than the lines inside, which may not be symmetric (a wavy stem, say); lines a
// few degrees either way and a little off the middle are tried, and the one whose flip lands most of the panel on itself
// is kept. A crooked scan or an uneven outer border is then still flipped across its true centre line.
// The centre line a box is mirrored across, fitted to the lines where they cross the box's edge: tried a little to
// either side of (and a little tilted from) both the outline's centre line and the plain middle of the drawing, keeping
// whichever lays the most ink of the copy on the ink outside.
function refineAxis(src,G,flip,a){const x0=Math.max(1,Math.floor(a.x0)),x1=Math.min(W-2,Math.ceil(a.x1)),y0=Math.max(1,Math.floor(a.y0)),y1=Math.min(H-2,Math.ceil(a.y1));
  if(x1-x0<4||y1-y0<4)return Object.assign({},G);
  let lo=W,hi=-1,ly=H,hy=-1;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(src[y*W+x]){if(x<lo)lo=x;if(x>hi)hi=x;if(y<ly)ly=y;if(y>hy)hy=y;}
  const R=Math.max(6,Math.round(0.012*Math.max(W,H))),pts=[],st=Math.max(1,Math.round(Math.max(x1-x0,y1-y0)/400));
  for(let y=Math.max(0,y0-R);y<=Math.min(H-1,y1+R);y+=st)for(let x=Math.max(0,x0-R);x<=Math.min(W-1,x1+R);x+=st){
    const e=Math.min(Math.abs(x-x0),Math.abs(x-x1),Math.abs(y-y0),Math.abs(y-y1));const inside=x>=x0&&x<=x1&&y>=y0&&y<=y1;if(inside&&e>R)continue;if(!inside&&!(x>=x0-R&&x<=x1+R&&y>=y0-R&&y<=y1+R))continue;pts.push(x,y);}
  const n=pts.length/2;if(!n)return Object.assign({},G);
  const mk=(c,ang)=>{const u=flip==='tb'?[Math.cos(ang),Math.sin(ang)]:[-Math.sin(ang),Math.cos(ang)];return flip==='tb'?{cx:G.cx,cy:c,u}:{cx:c,cy:G.cy,u};};
  const score=A=>{const{cx,cy,u}=A;let both=0,any=0;for(let i=0;i<n;i++){const x=pts[2*i],y=pts[2*i+1],dx=x-cx,dy=y-cy,k=2*(dx*u[0]+dy*u[1]);
      const mx=Math.round(cx+k*u[0]-dx),my=Math.round(cy+k*u[1]-dy),v=src[y*W+x],w=mx>=0&&mx<W&&my>=0&&my<H?src[my*W+mx]:0;if(v&&w)both++;if(v||w)any++;}return any?both/any:0;};
  const angOf=A=>flip==='tb'?Math.atan2(A.u[1],A.u[0]):Math.atan2(-A.u[0],A.u[1]);
  let best=null,bs=-1;const span=Math.max(8,Math.round(0.015*(flip==='tb'?H:W)));
  for(const[c0,a0]of[[flip==='tb'?G.cy:G.cx,angOf(G)],[flip==='tb'?(ly+hy)/2:(lo+hi)/2,0]]){let c=c0,an=a0,b=score(mk(c,an));
    for(const[dc,da,nc,na]of[[1,0.25,span,2],[0.25,0.05,4,5]]){const cc=c,aa=an;for(let ia=-na;ia<=na;ia++)for(let ic=-nc;ic<=nc;ic++){const A=mk(cc+ic*dc,aa+ia*da*Math.PI/180),sc=score(A);if(sc>b+1e-9){b=sc;c=cc+ic*dc;an=aa+ia*da*Math.PI/180;}}}
    if(b>bs){bs=b;best=mk(c,an);}}
  // (a box across the centre line, with a line running down that centre line: the centre line is laid right along it)
  {const side=(x,y)=>Math.sign((x-best.cx)*best.u[1]-(y-best.cy)*best.u[0]),sg=[side(x0,y0),side(x1,y0),side(x0,y1),side(x1,y1)];
    if(sg.includes(1)&&sg.includes(-1)){const c0=flip==='tb'?best.cy:best.cx,a0=angOf(best);let top=0,ta=a0,hits=null;
      for(let da=-1;da<=1.001;da+=0.1){const an=a0+da*Math.PI/180,u=mk(c0,an).u,h=[];
        for(let o=-span;o<=span;o+=0.5){let n=0,t=0;if(flip==='tb'){for(let x=x0;x<=x1;x++){const y=Math.round(c0+o+(x-best.cx)*u[1]/u[0]);t++;if(y>=y0&&y<=y1&&src[y*W+x])n++;}}
            else{for(let y=y0;y<=y1;y++){const x=Math.round(c0+o+(y-best.cy)*u[0]/u[1]);t++;if(x>=x0&&x<=x1&&src[y*W+x])n++;}}h.push([o,n/(t||1)]);}
        const m=Math.max(...h.map(q=>q[1]));if(m>top+1e-9){top=m;ta=an;hits=h;}}
      if(top>0.6){const on=hits.filter(q=>q[1]>=0.9*top),near=on.reduce((p,q)=>Math.abs(q[0])<Math.abs(p[0])?q:p);
        let a=near[0],b=near[0];while(on.some(q=>q[0]===a-0.5))a-=0.5;while(on.some(q=>q[0]===b+0.5))b+=0.5;const o=(a+b)/2,nb=mk(c0+o,ta);best.cx=nb.cx;best.cy=nb.cy;best.u=nb.u;}}}
  best.match=bs;return best;}
// The centre line that lays the drawing's own lines best onto themselves when flipped: tried a little to either side
// of the outline's centre line and a little tilted, coarse first, then finely.
function inkAxis(mask,flip,G){if(!G)return null;const f=Math.max(1,Math.round(Math.max(W,H)/600)),w=Math.ceil(W/f),h=Math.ceil(H/f),s=new Uint8Array(w*h);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(mask[y*W+x])s[((y/f)|0)*w+((x/f)|0)]=1;
  const dl=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;for(let j=-1;j<=1&&!v;j++)for(let i=-1;i<=1;i++){const X=x+i,Y=y+j;if(X>=0&&Y>=0&&X<w&&Y<h&&s[Y*w+X]){v=1;break;}}dl[y*w+x]=v;}
  const pts=[];for(let i=0;i<w*h;i++)if(s[i])pts.push(i%w,(i/w)|0);const n=pts.length/2;if(!n)return Object.assign({},G);const st=Math.max(1,Math.floor(n/30000));
  const mk=(c,ang)=>{const u=flip==='tb'?[Math.cos(ang),Math.sin(ang)]:[-Math.sin(ang),Math.cos(ang)];return flip==='tb'?{cx:G.cx,cy:c,u}:{cx:c,cy:G.cy,u};};
  const score=A=>{const cx=(A.cx+0.5)/f-0.5,cy=(A.cy+0.5)/f-0.5,u=A.u;let hit=0,tot=0;for(let i=0;i<n;i+=st){const dx=pts[2*i]-cx,dy=pts[2*i+1]-cy,k=2*(dx*u[0]+dy*u[1]),x=Math.round(cx+k*u[0]-dx),y=Math.round(cy+k*u[1]-dy);tot++;if(x>=0&&x<w&&y>=0&&y<h&&dl[y*w+x])hit++;}return hit/(tot||1);};
  const angOf=A=>flip==='tb'?Math.atan2(A.u[1],A.u[0]):Math.atan2(-A.u[0],A.u[1]);
  let c=flip==='tb'?G.cy:G.cx,an=angOf(G),b=score(mk(c,an));const span=0.03*(flip==='tb'?H:W);
  for(const[dc,da,nc,na]of[[f,0.25,Math.ceil(span/f),6],[f/4,0.05,6,5]]){const cc=c,aa=an;for(let ia=-na;ia<=na;ia++)for(let ic=-nc;ic<=nc;ic++){const A=mk(cc+ic*dc,aa+ia*da*Math.PI/180),sc=score(A);if(sc>b+1e-9){b=sc;c=cc+ic*dc;an=aa+ia*da*Math.PI/180;}}}
  const out=mk(c,an);out.match=b;return out;}
function symAxis(mask,flip){const f=Math.max(1,Math.round(Math.max(W,H)/500)),w=Math.ceil(W/f),h=Math.ceil(H/f),s=new Uint8Array(w*h);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(mask[y*W+x])s[((y/f)|0)*w+((x/f)|0)]=1;
  // (the panel: everything not reachable from the picture's edge without crossing a line)
  const out=new Uint8Array(w*h),st=[];for(let x=0;x<w;x++){st.push(x,(h-1)*w+x);}for(let y=0;y<h;y++){st.push(y*w,y*w+w-1);}
  while(st.length){const i=st.pop();if(out[i]||s[i])continue;out[i]=1;const x=i%w,y=(i/w)|0;if(x>0)st.push(i-1);if(x<w-1)st.push(i+1);if(y>0)st.push(i-w);if(y<h-1)st.push(i+w);}
  const pan=[];let lo=w,hi=-1,ly=h,hy=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!out[y*w+x]){pan.push(x,y);if(x<lo)lo=x;if(x>hi)hi=x;if(y<ly)ly=y;if(y>hy)hy=y;}
  if(hi<=lo)return null;const n=pan.length/2,step=Math.max(1,Math.floor(n/40000));
  const score=(cx,cy,ang)=>{const u=flip==='tb'?[Math.cos(ang),Math.sin(ang)]:[-Math.sin(ang),Math.cos(ang)];let hit=0,tot=0;
    for(let i=0;i<n;i+=step){const dx=pan[2*i]-cx,dy=pan[2*i+1]-cy,k=2*(dx*u[0]+dy*u[1]),x=Math.round(cx+k*u[0]-dx),y=Math.round(cy+k*u[1]-dy);tot++;
      if(x>=0&&x<w&&y>=0&&y<h&&!out[y*w+x])hit++;}return hit/(tot||1);};
  let cx=(lo+hi)/2,cy=(ly+hy)/2,ang=0,best=score(cx,cy,ang);const span=flip==='tb'?(hy-ly):(hi-lo),base=best;
  // (coarse, then finer: angle in degrees, and how far off the middle)
  for(const[da,dd,na,nd]of[[0.5,Math.max(1,span*0.01),6,4],[0.1,Math.max(0.5,span*0.002),5,5],[0.02,0.25,5,4]]){const a0=ang,c0=flip==='tb'?cy:cx;
    for(let ia=-na;ia<=na;ia++)for(let id=-nd;id<=nd;id++){const a=a0+ia*da*Math.PI/180,c=c0+id*dd,sc=flip==='tb'?score(cx,c,a):score(c,cy,a);
      if(sc>best+1e-9){best=sc;ang=a;if(flip==='tb')cy=c;else cx=c;}}}
  const u=flip==='tb'?[Math.cos(ang),Math.sin(ang)]:[-Math.sin(ang),Math.cos(ang)];
  return{cx:(cx+0.5)*f-0.5,cy:(cy+0.5)*f-0.5,u,match:best,base};}

// Cleanup -> Keep narrow gaps: which of the gaps found above really are gaps. Each patch of white the closing would
// fill is filled only when it is a hole inside a line (a hollow marker stroke: no paper next to it) or when it cuts
// across a line between two open pieces of glass (a break in the ink). A patch with paper on one side only is the thin
// tip of a piece, and one that cuts off a strip narrower than a lead line is the narrow white between two lines drawn
// close together: both are the drawing's own shape, so they stay as drawn.
function closeGapsKept(m,fill,r){
  const N=W*H,open=new Uint8Array(N);for(let i=0;i<N;i++)open[i]=m[i]||fill[i]?0:1;
  const dw=edt(open);
  // the paper, in separate pieces, each with the widest spot it has
  const lab=new Int32Array(N),st=new Int32Array(N),wide=[0],area=[0];let nl=0;
  for(let s=0;s<N;s++){if(!open[s]||lab[s])continue;nl++;let sp=0,mx=0,n=0;st[sp++]=s;lab[s]=nl;
    while(sp){const i=st[--sp];n++;if(dw[i]>mx)mx=dw[i];const x=i%W,y=(i/W)|0;
      if(x>0&&open[i-1]&&!lab[i-1]){lab[i-1]=nl;st[sp++]=i-1;}if(x<W-1&&open[i+1]&&!lab[i+1]){lab[i+1]=nl;st[sp++]=i+1;}
      if(y>0&&open[i-W]&&!lab[i-W]){lab[i-W]=nl;st[sp++]=i-W;}if(y<H-1&&open[i+W]&&!lab[i+W]){lab[i+W]=nl;st[sp++]=i+W;}}
    wide.push(mx);area.push(n);}
  const need=(1.5*r)*(1.5*r),small=Math.pow(8*r/0.33,2),seen=new Uint8Array(N),cells=[];
  for(let s=0;s<N;s++){if(!fill[s]||seen[s])continue;let sp=0;cells.length=0;st[sp++]=s;seen[s]=1;const near=new Set();
    while(sp){const i=st[--sp];cells.push(i);const x=i%W,y=(i/W)|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const j=Y*W+X;
        if(fill[j]){if(!seen[j]){seen[j]=1;st[sp++]=j;}}else if(open[j])near.add(lab[j]);}}
    // (the tip of a small piece, such as the little windows of a church, is still filled: a small piece's tip is
    // too tight for its lines to be told apart)
    let keep=near.size===0||(near.size===1&&area[[...near][0]]<small);
    if(near.size>=2){keep=true;for(const l of near)if(wide[l]<need){keep=false;break;}}
    if(keep)for(const i of cells)m[i]=1;}}
