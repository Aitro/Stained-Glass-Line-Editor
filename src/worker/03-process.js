// One run: threshold the picture, close gaps, thin it, measure line width, then hand off to buildStrokes.
// ------------------------------------------------------------------------------------------------
function process(p){
  const say=t=>postMessage({type:'progress',text:t});
  say('Finding lines…');
  const t=p.auto?otsuT:p.threshold;const m=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++)m[i]=p.invert?(gray[i]>=t?1:0):(gray[i]<t?1:0);
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
  if(!colorIn){const r=Math.max(1.5,0.33*med),r2=r*r;const d1=edt(m);const dil=new Uint8Array(W*H);
    for(let i=0;i<W*H;i++)dil[i]=d1[i]<=r2?1:0;
    const notd=new Uint8Array(W*H);for(let i=0;i<W*H;i++)notd[i]=dil[i]?0:1;
    // pixels outside the image count as paper so the outer border is not pulled inward
    const d2=edt(notd);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;
      const edge=Math.min(x+1,y+1,W-x,H-y);if(!m[i]&&d2[i]>r2&&edge*edge>r2)m[i]=1;}}
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
  const built=buildStrokes(sk,u,med,dmap,p.smooth,say,p);const strokes=built.strokes;
  const fl=[],fo=[0],cl=[],co=[0];for(const f of built.fillets){for(const q of f.fill)fl.push(q[1]+0.5,q[0]+0.5);fo.push(fl.length/2);for(const q of f.curve)cl.push(q[1]+0.5,q[0]+0.5);co.push(cl.length/2);}
  const flat=[],offs=[0],hwf=[];
  // the original line's half-width at each point (largest distance-to-paper nearby), with a running
  // median along the line so junction blobs don't count; used to line a border up with an edge
  for(const S of strokes){const raw=S.map(q=>{let mx=0;const yy=Math.round(q[0]),xx=Math.round(q[1]);
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const y=yy+dy,x=xx+dx;if(y>=0&&x>=0&&y<H&&x<W)mx=Math.max(mx,dmap[y*W+x]);}return Math.max(0.5,mx-0.5);});
    const hw=raw.map((_,i)=>{const a=raw.slice(Math.max(0,i-75),Math.min(raw.length,i+76)).sort((p,q)=>p-q);return a[Math.floor(a.length*0.4)];});
    S.forEach((q,i)=>{flat.push(q[1]+0.5,q[0]+0.5);hwf.push(hw[i]);});offs.push(flat.length/2);}
  return{pts:new Float32Array(flat),offs:new Int32Array(offs),hw:new Float32Array(hwf),stats,rot:built.rot,fill:{pts:new Float32Array(fl),offs:new Int32Array(fo)},fcurve:{pts:new Float32Array(cl),offs:new Int32Array(co)}};}

// ===================================================================== curve stage
// Trace the centerline into a graph of lines and junctions, rebuild junctions the way a
// pattern is drawn (lines run through, branches land on them, crossings stay crossings),
// keep real corners sharp, and smooth each long curve with a fidelity-checked smoother.
