// Numbers and labels: the piece numbers many patterns print inside each piece.
// ------------------------------------------------------------------------------------------------
// Any separate bit of ink that is small (no more than about fifteen line widths across) and drawn with a stroke
// well under the lines' thickness (its thickest point less than about 55% of a typical line) is writing, not lead,
// and is taken out before anything else looks at the picture. A small ring drawn as thick as the lines (the
// little circles in a star) is lead and stays; so does a short line on its own.
function dropText(m){
  const bg=new Uint8Array(W*H);for(let i=0;i<W*H;i++)bg[i]=m[i]?0:1;const d=edt(bg);
  // (a typical line's thickness: the thick end of the widths along the middles of all the ink, since writing,
  // though there may be a lot of it, is short next to the lines)
  const rid=[];for(let y=1;y<H-1;y+=2)for(let x=1;x<W-1;x+=2){const i=y*W+x,v=d[i];if(v<1)continue;if(v>=d[i-1]&&v>=d[i+1]&&v>=d[i-W]&&v>=d[i+W])rid.push(2*Math.sqrt(v)-1);}
  if(rid.length<50)return 0;rid.sort((a,b)=>a-b);
  // (the most common width in the thicker part, not a fixed share up: a heavy border all round the pattern can be a
  // quarter of all the ink and would otherwise be taken for the usual line, making every inside line look thin)
  const lo=rid[Math.floor(rid.length*0.4)],hist=new Map();for(const v of rid)if(v>=lo){const b=Math.round(v);hist.set(b,(hist.get(b)||0)+1);}
  let wLine=rid[Math.floor(rid.length*0.75)],best=0;for(const[b,c]of hist)if(c>best){best=c;wLine=Math.max(lo,b);}if(wLine<4)return 0;
  const seen=new Uint8Array(W*H),st=new Int32Array(W*H),cells=[];let dropped=0;
  for(let s=0;s<W*H;s++){if(!m[s]||seen[s])continue;let sp=0,x0=W,y0=H,x1=0,y1=0,wMax=0;cells.length=0;st[sp++]=s;seen[s]=1;
    while(sp){const i=st[--sp];cells.push(i);const x=i%W,y=(i/W)|0;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;const w=2*Math.sqrt(d[i])-1;if(w>wMax)wMax=w;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const j=Y*W+X;if(m[j]&&!seen[j]){seen[j]=1;st[sp++]=j;}}}
    const edge=x0<=2||y0<=2||x1>=W-3||y1>=H-3;
    if(!edge&&Math.max(x1-x0,y1-y0)<=15*wLine&&wMax<0.55*wLine){for(const i of cells)m[i]=0;dropped++;}}
  // (a number touching a line: the ink too thin to hold a disc a third of a line wide is cut away from the lines,
  // and any small piece of it is writing; whatever thin ink is long, a hairline or a sharp tip, is kept)
  const rc=0.3*wLine,rc2=rc*rc,core=new Uint8Array(W*H);let any=0;for(let i=0;i<W*H;i++)if(m[i]&&d[i]>=rc2){core[i]=1;any=1;}
  if(!any)return dropped;const dc=edt(core),thin=new Uint8Array(W*H);for(let i=0;i<W*H;i++)if(m[i]&&dc[i]>rc2+2*rc+1)thin[i]=1;
  // (the thick ink, each joined piece numbered: a thin stretch running from one of these to another is a line,
  // only thinner here, never writing)
  const lab=new Int32Array(W*H);let nl=0;
  for(let s=0;s<W*H;s++){if(!m[s]||thin[s]||lab[s])continue;nl++;let sp=0;st[sp++]=s;lab[s]=nl;
    while(sp){const i=st[--sp],x=i%W,y=(i/W)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const j=Y*W+X;if(m[j]&&!thin[j]&&!lab[j]){lab[j]=nl;st[sp++]=j;}}}}
  const seen2=new Uint8Array(W*H);
  for(let s=0;s<W*H;s++){if(!thin[s]||seen2[s])continue;let sp=0,x0=W,y0=H,x1=0,y1=0;cells.length=0;st[sp++]=s;seen2[s]=1;
    let la=0,two=false,cy0=1e9,cy1=-1,cx0=1e9,cx1=-1;
    while(sp){const i=st[--sp];cells.push(i);const x=i%W,y=(i/W)|0;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const j=Y*W+X;if(thin[j]&&!seen2[j]){seen2[j]=1;st[sp++]=j;}else if(lab[j]){if(!la)la=lab[j];else if(lab[j]!==la)two=true;if(Y<cy0)cy0=Y;if(Y>cy1)cy1=Y;if(X<cx0)cx0=X;if(X>cx1)cx1=X;}}}
    // (a thin stretch meeting thick ink at two places well apart is a line running between them, even where all the
    // thick ink is one joined piece, as it is in a connected pattern; writing touches a line in one spot)
    if(cy1>=0&&Math.max(cy1-cy0,cx1-cx0)>1.2*wLine)two=true;
    // (writing: small, never cut off by the picture's edge (a border line the scan clipped is thin but is lead), and more than a few line widths of it, so a line's rounded end or a corner's tip is not taken)
    const size=Math.max(x1-x0,y1-y0),edge=x0<=2||y0<=2||x1>=W-3||y1>=H-3;if(!edge&&!two&&size<=15*wLine&&size>=1.2*wLine&&cells.length>=wLine*wLine*0.6){for(const i of cells)m[i]=0;dropped++;}}
  return dropped;}

// Words printed on the pattern: a title, a publisher's name, a web address, set in the open away from the lines.
// ------------------------------------------------------------------------------------------------
// Separate small marks (each no more than about a twenty-fifth of the picture across) that sit side by side in a
// row, like letters (at least three in a row, the row at least twice as long as it is tall, and many of them open
// strokes with no hole, as most letters are, where a row of jewels or border tiles is all closed shapes), are
// writing and are taken out, with anything else left standing on its own among them (an underline, a ©).
// (the height of the piece labels found, when a pattern is numbered all over: used later to clear label scraps that
// touched a line and so could not be lifted off as marks of their own)
let labelH=0,labelBoxes=[],touchBoxes=[];
function dropWords(m){labelH=0;labelBoxes=[];touchBoxes=[];
  const N=W*H,lab=new Int32Array(N).fill(-1),st=new Int32Array(N),C=[];let n=0;
  for(let i=0;i<N;i++){if(!m[i]||lab[i]>=0)continue;let sp=0;st[sp++]=i;lab[i]=n;const c={id:n,x0:1e9,y0:1e9,x1:-1,y1:-1,cnt:0,edge:false};
    while(sp){const j=st[--sp],y=(j/W)|0,x=j-y*W;c.cnt++;if(x<c.x0)c.x0=x;if(x>c.x1)c.x1=x;if(y<c.y0)c.y0=y;if(y>c.y1)c.y1=y;if(x===0||y===0||x===W-1||y===H-1)c.edge=true;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const k=Y*W+X;if(m[k]&&lab[k]<0){lab[k]=n;st[sp++]=k;}}}
    C.push(c);n++;}
  if(n<4)return 0;let big=C[0];for(const c of C)if(c.cnt>big.cnt)big=c;
  const lim=0.04*Math.min(W,H),sm=C.filter(c=>c!==big&&!c.edge&&Math.max(c.x1-c.x0,c.y1-c.y0)+1<=lim);if(sm.length<3)return 0;
  // (side by side in a row: overlapping up and down, close left to right, of a like height)
  const par=new Int32Array(n).map((_,i)=>i),find=a=>{while(par[a]!==a)a=par[a]=par[par[a]];return a;};
  sm.sort((a,b)=>a.x0-b.x0);
  for(let i=0;i<sm.length;i++){const a=sm[i],ha=a.y1-a.y0+1;for(let j=i+1;j<sm.length;j++){const b=sm[j],hb=b.y1-b.y0+1,hm=Math.max(ha,hb);
      if(b.x0-a.x1>1.2*hm)break;const ov=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0)+1;
      // (a dash between a letter and a number, as in a piece label like H-40: short and flat, sitting at the middle
      // height of the marks either side)
      const flat=(c,h,o)=>{const w=c.x1-c.x0+1;return w>=1.3*h&&h<=0.45*o;},mid=(c,o)=>{const cy=(c.y0+c.y1)/2;return cy>o.y0&&cy<o.y1;};
      if((flat(a,ha,hb)&&mid(a,b))||(flat(b,hb,ha)&&mid(b,a))){par[find(a.id)]=find(b.id);continue;}
      if(ov<0.5*Math.min(ha,hb)||hm>3*Math.min(ha,hb))continue;par[find(a.id)]=find(b.id);}}
  const rows=new Map();for(const c of sm){const r=find(c.id);if(!rows.has(r))rows.set(r,[]);rows.get(r).push(c);}
  // (whether a mark closes round on itself: some paper inside its box that can't be reached from the box's edge)
  const holed=c=>{const w=c.x1-c.x0+3,h=c.y1-c.y0+3,seen=new Uint8Array(w*h);let sp=0;
    const ink=(x,y)=>{const X=x+c.x0-1,Y=y+c.y0-1;return X>=0&&Y>=0&&X<W&&Y<H&&lab[Y*W+X]===c.id;};
    for(let x=0;x<w;x++){seen[x]=1;st[sp++]=x;seen[(h-1)*w+x]=1;st[sp++]=(h-1)*w+x;}for(let y=0;y<h;y++){seen[y*w]=1;st[sp++]=y*w;seen[y*w+w-1]=1;st[sp++]=y*w+w-1;}
    while(sp){const k=st[--sp],y=(k/w)|0,x=k-y*w;for(const[X,Y]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(X<0||Y<0||X>=w||Y>=h)continue;const q=Y*w+X;if(seen[q]||ink(X,Y))continue;seen[q]=1;st[sp++]=q;}}
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(!seen[y*w+x]&&!ink(x,y))return true;return false;};
  const gone=new Uint8Array(n),blocks=[],lblH=[];
  // (letters printed small, or blurred when a small picture is enlarged, run together into blobs wider than they are
  // tall; small round decorations, a string of pearls or bubbles, stay about as wide as tall)
  const wideBlob=c=>c.x1-c.x0+1>=1.8*(c.y1-c.y0+1);
  for(const R of rows.values()){if(R.length<3)continue;let x0=1e9,y0=1e9,x1=-1,y1=-1;for(const c of R){x0=Math.min(x0,c.x0);y0=Math.min(y0,c.y0);x1=Math.max(x1,c.x1);y1=Math.max(y1,c.y1);}
    if(x1-x0<2*(y1-y0))continue;let open=0;for(const c of R)if(!holed(c))open++;
    if(R.filter(wideBlob).length>=2&&x1-x0>=3*(y1-y0))open=R.length;   // (words run together)
    // (a word in a closed-up font: a long row of marks of quite different widths, where a row of pearls or bubbles
    // would be all alike)
    {const ws=R.map(c=>c.x1-c.x0+1);if(R.length>=3&&x1-x0>=4*(y1-y0)&&Math.max(...ws)>=2*Math.min(...ws))open=R.length;}
    // (a piece label: a mark, a dash, then more marks of the same height; numbers close round on themselves (0, 4, 6, 8,
    // 9) so the share of open marks does not tell, but small round decorations do not come with a dash between them)
    const hs=R.map(c=>c.y1-c.y0+1),hT=Math.max(...hs),srt=R.slice().sort((a,b)=>a.x0-b.x0);
    const isDash=c=>{const h=c.y1-c.y0+1,w=c.x1-c.x0+1;return w>=1.3*h&&h<=0.45*hT;};
    const label=srt.length>=3&&srt.some((c,i)=>i>0&&i<srt.length-1&&isDash(c))&&srt.filter(c=>!isDash(c)).every(c=>c.y1-c.y0+1>=0.6*hT);
    if(open<0.4*R.length&&!label)continue;
    for(const c of R)gone[c.id]=1;const g=2*(y1-y0+1);blocks.push([x0-g,y0-g,x1+g,y1+g]);lblH.push(y1-y0+1);}
  // (short labels of one or two blobs: on their own they could be anything, but a pattern numbered all over has many
  // of them, all of one height: the same height as the labels found in full)
  const shortRows=[],touchRows=[];for(const R of rows.values()){if(R.length>2)continue;let x0=1e9,y0=1e9,x1=-1,y1=-1;for(const c of R){x0=Math.min(x0,c.x0);y0=Math.min(y0,c.y0);x1=Math.max(x1,c.x1);y1=Math.max(y1,c.y1);}
    // (or what is left of a label whose first letter touched a line and went with it: a short number set right
    // beside the line)
    const h=y1-y0+1,beside=()=>{const r=Math.round(1.5*h);for(let y=y0;y<=y1;y++)for(const[a,b]of[[x0-r,x0-1],[x1+1,x1+r]])for(let x=Math.max(0,a);x<=Math.min(W-1,b);x++)if(lab[y*W+x]===big.id)return true;return false;};
    if(x1-x0+1>=1.8*h&&R.some(wideBlob))shortRows.push({R,h,box:[x0,y0,x1,y1]});else if(x1-x0+1>=1.2*h&&beside())touchRows.push({R,h,box:[x0,y0,x1,y1]});}
  if(lblH.length+shortRows.length>=8&&lblH.length>=3){const hs=lblH.slice().sort((a,b)=>a-b),hm=hs[hs.length>>1];labelH=lblH.length+shortRows.length>=8?hm:0;const like=shortRows.filter(r=>r.h>=0.65*hm&&r.h<=1.5*hm);
    for(const r of like){for(const c of r.R)gone[c.id]=1;const g=2*r.h;blocks.push([r.box[0]-g,r.box[1]-g,r.box[2]+g,r.box[3]+g]);}
    // (kept apart: used only to smooth the line where such a label's letter was taken off it)
    if(labelH)for(const r of touchRows)if(r.h>=0.65*hm&&r.h<=1.5*hm){const g=2*r.h;touchBoxes.push([r.box[0]-g,r.box[1]-g,r.box[2]+g,r.box[3]+g]);}}
  if(!blocks.length)return 0;
  // (anything else standing on its own among the writing goes with it, a logo or an underline too, and so on out
  // from there: a short word or a ® next to it)
  const cap=0.3*Math.min(W,H);let more=true;
  while(more){more=false;for(const c of C){if(c===big||c.edge||gone[c.id])continue;let hit=false;for(const b of blocks)if(c.x0<=b[2]&&c.x1>=b[0]&&c.y0<=b[3]&&c.y1>=b[1]){hit=true;break;}if(!hit)continue;
      if(Math.max(c.x1-c.x0,c.y1-c.y0)>cap&&holed(c))continue;   // (a long rule under a heading goes too; a big closed shape stays)
      for(const b of blocks)if(c.x0<=b[2]&&c.x1>=b[0]&&c.y0<=b[3]&&c.y1>=b[1]){gone[c.id]=1;more=true;const g=Math.min(c.y1-c.y0+1,lim);blocks.push([c.x0-g,c.y0-g,c.x1+g,c.y1+g]);break;}}}
  labelBoxes=blocks.slice();
  let k=0;for(let i=0;i<N;i++)if(lab[i]>=0&&gone[lab[i]]){m[i]=0;k++;}
  return k;}

// Label scraps: where a piece label touched a line it stays on the paper with the line, and traces as a short
// squiggle beside it. In a pattern numbered all over, a short line no bigger than a label, with an end loose, is one.
function dropLabelScraps(strokes,lh,u){if(!lh)return strokes;const len=S=>{let L=0;for(let i=1;i<S.length;i++)L+=Math.hypot(S[i][0]-S[i-1][0],S[i][1]-S[i-1][1]);return L;};
  const grid=new Map(),cell=Math.max(4,lh),key=(y,x)=>((y/cell)|0)+','+((x/cell)|0);
  strokes.forEach((S,si)=>{for(let i=0;i<S.length;i+=2){const k=key(S[i][0],S[i][1]);if(!grid.has(k))grid.set(k,[]);grid.get(k).push([si,S[i]]);}});
  const loose=(S,si,p)=>{const cy=(p[0]/cell)|0,cx=(p[1]/cell)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const L=grid.get((cy+dy)+','+(cx+dx));if(!L)continue;
      for(const[sj,q]of L)if(sj!==si&&Math.hypot(q[0]-p[0],q[1]-p[1])<=2*u)return false;}return true;};
  const near=q=>labelBoxes.some(b=>q[1]>=b[0]-lh&&q[1]<=b[2]+lh&&q[0]>=b[1]-lh&&q[0]<=b[3]+lh);
  // (a label touching a line from beside it can leave a small notch or jog on the line where its letter was taken
  // off. Where a line runs right through a label's box and runs smooth on both sides of it, its stretch inside the
  // box is put back on the smooth path the two sides make: a gentle curve fitted to the line either side)
  {const TB=labelBoxes.concat(touchBoxes),inB=q=>TB.some(b=>q[1]>=b[0]-0.25*lh&&q[1]<=b[2]+0.25*lh&&q[0]>=b[1]-0.25*lh&&q[0]<=b[3]+0.25*lh);
    for(const S of strokes){const n=S.length;if(n<8)continue;const cum=[0];for(let i=1;i<n;i++)cum.push(cum[i-1]+Math.hypot(S[i][0]-S[i-1][0],S[i][1]-S[i-1][1]));
      const ins=S.map(inB);
      for(let a=1;a<n-1;a++){if(!ins[a]||ins[a-1])continue;let b=a;while(b<n-1&&ins[b+1])b++;if(b>=n-1)break;
        const runL=cum[b]-cum[a];if(runL<0.5*lh||runL>6*lh){a=b;continue;}
        // (the line either side: 2 label heights each way, clear of the box)
        let p0=a-1;while(p0>0&&cum[a-1]-cum[p0-1]<=2*lh&&!ins[p0-1])p0--;let q1=b+1;while(q1<n-1&&cum[q1+1]-cum[b+1]<=2*lh&&!ins[q1+1])q1++;
        if(cum[a-1]-cum[p0]<1.5*lh||cum[q1]-cum[b+1]<1.5*lh){a=b;continue;}
        const O=S[p0],E=S[q1],dl=Math.hypot(E[0]-O[0],E[1]-O[1]);if(dl<1e-6){a=b;continue;}const dv=[(E[0]-O[0])/dl,(E[1]-O[1])/dl];
        const T=q=>(q[0]-O[0])*dv[0]+(q[1]-O[1])*dv[1],Sd=q=>(q[1]-O[1])*dv[0]-(q[0]-O[0])*dv[1];
        // (it must run on through the box, not turn back)
        let mono=true;for(let k=p0+1;k<=q1;k++)if(T(S[k])<T(S[k-1])-0.5){mono=false;break;}if(!mono){a=b;continue;}
        // (a gentle curve, s = c0 + c1 t + c2 t^2, fitted to the two sides only)
        const out=[];for(let k=p0;k<a;k++)out.push(k);for(let k=b+1;k<=q1;k++)out.push(k);
        const M=[[0,0,0],[0,0,0],[0,0,0]],r=[0,0,0];for(const k of out){const t=T(S[k])/dl,s=Sd(S[k]),f=[1,t,t*t];for(let x=0;x<3;x++){r[x]+=f[x]*s;for(let y=0;y<3;y++)M[x][y]+=f[x]*f[y];}}
        const det=A=>A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])-A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])+A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);
        const D=det(M);if(Math.abs(D)<1e-9){a=b;continue;}const c=[0,1,2].map(x=>det(M.map((row,i)=>row.map((v,j)=>j===x?r[i]:v)))/D);
        const fit=k=>{const t=T(S[k])/dl;return c[0]+c[1]*t+c[2]*t*t;};
        let ss=0,om=0;for(const k of out){const e=Sd(S[k])-fit(k);ss+=e*e;om=Math.max(om,Math.abs(e));}
        if(Math.sqrt(ss/out.length)>0.08*lh||om>0.2*lh){a=b;continue;}
        let im=0;for(let k=a;k<=b;k++)im=Math.max(im,Math.abs(Sd(S[k])-fit(k)));
        if(im<0.5*u||im>lh){a=b;continue;}
        // (a line that is smooth right through the box, a wave's crest say, is left as drawn: only a short sharp jog that
        // a smooth curve over the whole stretch cannot follow is a notch)
        {const K=5,A=[...Array(K)].map(()=>Array(K+1).fill(0));for(let k=p0;k<=q1;k++){const t=2*T(S[k])/dl-1,s=Sd(S[k]),f=[1,t,t*t,t*t*t,t*t*t*t];for(let x=0;x<K;x++){A[x][K]+=f[x]*s;for(let y=0;y<K;y++)A[x][y]+=f[x]*f[y];}}
          let ok=true;for(let cI=0;cI<K;cI++){let pv=cI;for(let rI=cI+1;rI<K;rI++)if(Math.abs(A[rI][cI])>Math.abs(A[pv][cI]))pv=rI;if(Math.abs(A[pv][cI])<1e-12){ok=false;break;}[A[cI],A[pv]]=[A[pv],A[cI]];
            for(let rI=0;rI<K;rI++){if(rI===cI)continue;const f=A[rI][cI]/A[cI][cI];for(let x=cI;x<=K;x++)A[rI][x]-=f*A[cI][x];}}
          if(!ok){a=b;continue;}const cc=A.map((row,i)=>row[K]/row[i]);let rm=0;
          for(let k=a;k<=b;k++){const t=2*T(S[k])/dl-1;rm=Math.max(rm,Math.abs(Sd(S[k])-(cc[0]+cc[1]*t+cc[2]*t*t+cc[3]*t*t*t+cc[4]*t*t*t*t)));}
          if(rm<0.5*u){a=b;continue;}}
        // (put back on the curve, easing in and out over the half label height either side)
        const ease=0.5*lh;for(let k=p0;k<=q1;k++){let w=1;if(k<a)w=Math.max(0,1-(cum[a]-cum[k])/ease);else if(k>b)w=Math.max(0,1-(cum[k]-cum[b])/ease);if(w<=0)continue;
          const t=T(S[k]),s=Sd(S[k]),s2=s+w*(fit(k)-s);S[k]=[O[0]+t*dv[0]-s2*dv[1],O[1]+t*dv[1]+s2*dv[0]];}
        a=b;}}}
  // (a label run into the line itself: the line takes a little detour through it, out and back within a label's
  // size. The detour is cut out and the line runs straight across)
  for(const S of strokes){if(S.length<8)continue;const cum=[0];for(let i=1;i<S.length;i++)cum.push(cum[i-1]+Math.hypot(S[i][0]-S[i-1][0],S[i][1]-S[i-1][1]));
    for(let i=0;i<S.length-2;i++){let best=-1;
      for(let j=i+2;j<S.length&&cum[j]-cum[i]<=4*lh;j++){const arc=cum[j]-cum[i];if(arc<0.8*lh)continue;
        if(Math.hypot(S[j][0]-S[i][0],S[j][1]-S[i][1])<0.6*arc)best=j;}
      if(best<0)continue;let mid=S[(i+best)>>1];if(!near(S[i])||!near(mid))continue;let far=0;for(let k=i;k<=best;k++)far=Math.max(far,Math.hypot(S[k][0]-S[i][0],S[k][1]-S[i][1]));if(far>2*lh)continue;
      const A=S[i],B=S[best],n=best-i;for(let k=1;k<n;k++){const t=k/n;S[i+k]=[A[0]+t*(B[0]-A[0]),A[1]+t*(B[1]-A[1])];}i=best;}}
  // (a label touching a line from beside it leaves a little bump on the line: next to where a label was found, a
  // bump on one side only, with the line running smooth either side of it, is taken out. A wavy line goes both ways
  // and so stays as drawn)
  for(const S of strokes){const n=S.length;if(n<6*lh)continue;const R=Math.max(3,Math.round(1.2*lh));
    const sm=S.map((_,i)=>{let a=0,b=0,c=0;for(let k=Math.max(0,i-R);k<=Math.min(n-1,i+R);k++){a+=S[k][0];b+=S[k][1];c++;}return[a/c,b/c];});
    const sd=S.map((q,i)=>{const j0=Math.max(0,i-2),j1=Math.min(n-1,i+2),t=[S[j1][0]-S[j0][0],S[j1][1]-S[j0][1]],tl=Math.hypot(t[0],t[1])||1;return((q[0]-sm[i][0])*(-t[1])+(q[1]-sm[i][1])*t[0])/tl;});
    const thr=Math.max(1.5*u,0.12*lh);
    for(let i=R;i<n-R;i++){if(Math.abs(sd[i])<=thr||!near(S[i]))continue;let j=i;while(j<n-R&&Math.abs(sd[j])>0.4*thr&&Math.sign(sd[j])===Math.sign(sd[i]))j++;
      let a=i;while(a>R&&Math.abs(sd[a-1])>0.4*thr&&Math.sign(sd[a-1])===Math.sign(sd[i]))a--;
      if(j-a>2.5*lh){i=j;continue;}
      // (smooth either side: no bump the other way close by)
      let calm=true;for(let k=Math.max(0,a-Math.round(1.5*lh));k<Math.min(n,j+Math.round(1.5*lh));k++)if((k<a||k>=j)&&Math.sign(sd[k])!==Math.sign(sd[i])&&Math.abs(sd[k])>0.6*thr){calm=false;break;}
      if(!calm){i=j;continue;}
      const A=S[Math.max(0,a-2)],B=S[Math.min(n-1,j+1)],a0=Math.max(0,a-2),b0=Math.min(n-1,j+1);
      for(let k=a0+1;k<b0;k++){const t=(k-a0)/(b0-a0),base=[A[0]+t*(B[0]-A[0]),A[1]+t*(B[1]-A[1])],sb=[sm[a0][0]+t*(sm[b0][0]-sm[a0][0]),sm[a0][1]+t*(sm[b0][1]-sm[a0][1])];
        S[k]=[base[0]+(sm[k][0]-sb[0])*0.0,base[1]+(sm[k][1]-sb[1])*0.0];}
      i=j;}}
  // (a label stuck to a line from beside it can trace as a second short path between the same two points as the
  // line, closing a sliver round the label: of two short paths joining the same two points, the straighter is the line)
  const twin=new Set();{const E=strokes.map((S,si)=>S.length>=2?{si,a:S[0],b:S[S.length-1],L:len(S)}:null).filter(Boolean),same=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1])<=2*u;
    for(let i=0;i<E.length;i++)for(let j=i+1;j<E.length;j++){const A=E[i],B=E[j];if(A.L>=4*lh||B.L>=4*lh)continue;
      if(!((same(A.a,B.a)&&same(A.b,B.b))||(same(A.a,B.b)&&same(A.b,B.a))))continue;const ch=Math.hypot(A.a[0]-A.b[0],A.a[1]-A.b[1]);if(ch<0.5*lh)continue;
      twin.add(A.L/ch>B.L/ch?A.si:B.si);}}
  return strokes.filter((S,si)=>{if(twin.has(si))return false;if(S.length<2)return true;const L=len(S);if(L>=4*lh)return true;
    let y0=1e9,y1=-1e9,x0=1e9,x1=-1e9;for(const q of S){y0=Math.min(y0,q[0]);y1=Math.max(y1,q[0]);x0=Math.min(x0,q[1]);x1=Math.max(x1,q[1]);}
    // (a label is flat: about as tall as a letter, up to three or so letters wide)
    if(Math.min(y1-y0,x1-x0)>1.6*lh||Math.max(y1-y0,x1-x0)>3.2*lh)return true;if(loose(S,si,S[0])||loose(S,si,S[S.length-1]))return false;if(!near(S[S.length>>1]))return true;
    // (or a little loop hanging off a line, both its ends back on that line close together)
    return!(L<3*lh&&Math.hypot(S[0][0]-S[S.length-1][0],S[0][1]-S[S.length-1][1])<1.2*lh);});}

// Outside the panel: when the pattern has a closed border (its biggest line runs right round the edges of its own
// box, like a rectangle frame), anything wholly outside that box is no part of the panel: a title, a logo, a
// designer's mark. A pattern with no such border keeps everything.
function dropOutside(m){const N=W*H,lab=new Int32Array(N).fill(-1),st=new Int32Array(N),C=[];let n=0;
  for(let i=0;i<N;i++){if(!m[i]||lab[i]>=0)continue;let sp=0;st[sp++]=i;lab[i]=n;const c={x0:1e9,y0:1e9,x1:-1,y1:-1,cnt:0};
    while(sp){const j=st[--sp],y=(j/W)|0,x=j-y*W;c.cnt++;if(x<c.x0)c.x0=x;if(x>c.x1)c.x1=x;if(y<c.y0)c.y0=y;if(y>c.y1)c.y1=y;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const k=Y*W+X;if(m[k]&&lab[k]<0){lab[k]=n;st[sp++]=k;}}}
    C.push(c);n++;}
  if(n<2)return 0;let bi=0;for(let i=1;i<n;i++)if(C[i].cnt>C[bi].cnt)bi=i;const B=C[bi];
  if((B.x1-B.x0)<0.3*W||(B.y1-B.y0)<0.3*H)return 0;
  // (is it a border: along each side of its box, its ink within a few pixels of that side nearly all the way)
  const band=Math.max(3,Math.round(0.004*Math.max(W,H)));
  const side=(horiz,at)=>{let hit=0,tot=0;const a=horiz?B.x0:B.y0,b=horiz?B.x1:B.y1;for(let t=a;t<=b;t++){tot++;let f=false;
      for(let d=0;d<=band&&!f;d++){const v=horiz?(at===B.y0?at+d:at-d):(at===B.x0?at+d:at-d);const k=horiz?v*W+t:t*W+v;if(v>=0&&v<(horiz?H:W)&&lab[k]===bi)f=true;}if(f)hit++;}return hit/tot;};
  if(Math.min(side(true,B.y0),side(true,B.y1),side(false,B.x0),side(false,B.x1))<0.9)return 0;
  const g=band;let k=0;const gone=new Uint8Array(n);
  for(let i=0;i<n;i++){if(i===bi)continue;const c=C[i];if(c.x1<B.x0-g||c.x0>B.x1+g||c.y1<B.y0-g||c.y0>B.y1+g)gone[i]=1;}
  for(let i=0;i<N;i++)if(lab[i]>=0&&gone[lab[i]]){m[i]=0;k++;}
  return k;}

// Slivers: where a label was run together with a line, the tracing can leave a tiny piece no glass could be cut to
// (a little hook hanging off the line, a short stub across a small piece). A piece far narrower than a label is tall
// and smaller than a few labels is such a sliver: its shortest short side line is taken out, and so on until none
// is left. Only where the ink there was a solid lump (letters run together), never a real small piece drawn as an
// outline round open paper, like an eye; and only on a pattern whose labels were found.
function dropSlivers(strokes,lh,m){if(!lh||!m)return strokes;
  const len=S=>{let L=0;for(let i=1;i<S.length;i++)L+=Math.hypot(S[i][0]-S[i-1][0],S[i][1]-S[i-1][1]);return L;};
  let live=strokes.map(()=>true);
  for(let pass=0;pass<6;pass++){
    const own=new Int32Array(W*H).fill(-1);
    strokes.forEach((S,si)=>{if(!live[si])return;for(let i=1;i<S.length;i++){const a=S[i-1],b=S[i],n=Math.max(1,Math.ceil(2*Math.hypot(b[0]-a[0],b[1]-a[1])));
      for(let k=0;k<=n;k++){const y=Math.round(a[0]+(b[0]-a[0])*k/n),x=Math.round(a[1]+(b[1]-a[1])*k/n);if(x>=0&&y>=0&&x<W&&y<H)own[y*W+x]=si;}}});
    // (a short line running all its length close beside another, a hook hanging under a line, is a sliver too)
    {let hug=false;const R=Math.ceil(lh);strokes.forEach((S,si)=>{if(!live[si]||hug)return;const L=len(S);if(L>=5*lh||L<1)return;
      // (both its ends on one and the same line, and all of it close beside that line)
      const near=(p,r,o)=>{const y0=Math.round(p[0]),x0=Math.round(p[1]);const got=new Set();for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(dx*dx+dy*dy>r*r)continue;const X=x0+dx,Y=y0+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const q=own[Y*W+X];if(q>=0&&q!==si&&(o<0||q===o))got.add(q);}return got;};
      const ra=Math.max(3,Math.ceil(0.25*lh)),ea=near(S[0],ra,-1),eb=near(S[S.length-1],ra,-1);let all=false;
      const endOk=(e,o)=>e.has(o)||[...e].every(q=>q===o);
      const nearest=(p,r,o)=>{const y0=Math.round(p[0]),x0=Math.round(p[1]);let b=null,bd=Infinity;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const dd=dx*dx+dy*dy;if(dd>r*r||dd>=bd)continue;const X=x0+dx,Y=y0+dy;if(X<0||Y<0||X>=W||Y>=H)continue;if(own[Y*W+X]===o){bd=dd;b=[Y,X];}}return b;};
      for(const o of new Set([...ea,...eb])){if(!(endOk(ea,o)&&endOk(eb,o))||!(ea.has(o)||eb.has(o)))continue;all=true;let ink=0,tot=0;
        let dmx=0;const dEnd=[];for(let i=0;i<S.length&&all;i+=2){const q=nearest(S[i],R,o);if(!q){all=false;break;}const dd=Math.hypot(q[0]-S[i][0],q[1]-S[i][1]);dmx=Math.max(dmx,dd);if(i===0)dEnd.push(dd);if(dd<3)continue;tot++;const my=Math.round((q[0]+S[i][0])/2),mx=Math.round((q[1]+S[i][1])/2);if(m[my*W+mx])ink++;}
        if(all){const qe=nearest(S[S.length-1],R,o);dEnd.push(qe?Math.hypot(qe[0]-S[S.length-1][0],qe[1]-S[S.length-1][1]):R);}
        // (it bows out from the line and comes back, as a hook does; a line running alongside at one distance is a
        // double line, and stays)
        if(all&&(dmx<0.35*lh||Math.max(...dEnd)>0.55*dmx))all=false;
        if(all&&tot&&ink<0.5*tot)all=false;if(all)break;}
      if(all){live[si]=false;hug=true;}});if(hug)continue;}
    const bg=new Uint8Array(W*H);for(let i=0;i<W*H;i++)bg[i]=own[i]<0?1:0;const d=edt(bg);
    const lab=new Int32Array(W*H).fill(-1),st=new Int32Array(W*H);let changed=false;
    for(let s=0;s<W*H;s++){if(own[s]>=0||lab[s]>=0)continue;let sp=0;st[sp++]=s;lab[s]=s;let area=0,dmax=0,edge=false;const nb=new Set();
      let inked=0;while(sp){const i=st[--sp],y=(i/W)|0,x=i-y*W;area++;if(m[i])inked++;if(d[i]>dmax)dmax=d[i];if(x===0||y===0||x===W-1||y===H-1)edge=true;
        for(const[X,Y]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(X<0||Y<0||X>=W||Y>=H)continue;const k=Y*W+X;if(own[k]>=0){nb.add(own[k]);continue;}if(lab[k]<0){lab[k]=s;st[sp++]=k;}}}
      if(edge||Math.sqrt(dmax)>=0.45*lh||area>=2*lh*lh||inked<0.4*area)continue;
      let best=-1,bl=Infinity;for(const si of nb){const L=len(strokes[si]);if(L<3*lh&&L<bl){bl=L;best=si;}}
      if(best>=0){live[best]=false;changed=true;}}
    if(!changed)break;}
  return strokes.filter((_,si)=>live[si]);}
