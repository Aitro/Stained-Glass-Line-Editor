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
function dropWords(m){
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
      if(b.x0-a.x1>1.2*hm)break;const ov=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0)+1;if(ov<0.5*Math.min(ha,hb)||hm>3*Math.min(ha,hb))continue;par[find(a.id)]=find(b.id);}}
  const rows=new Map();for(const c of sm){const r=find(c.id);if(!rows.has(r))rows.set(r,[]);rows.get(r).push(c);}
  // (whether a mark closes round on itself: some paper inside its box that can't be reached from the box's edge)
  const holed=c=>{const w=c.x1-c.x0+3,h=c.y1-c.y0+3,seen=new Uint8Array(w*h);let sp=0;
    const ink=(x,y)=>{const X=x+c.x0-1,Y=y+c.y0-1;return X>=0&&Y>=0&&X<W&&Y<H&&lab[Y*W+X]===c.id;};
    for(let x=0;x<w;x++){seen[x]=1;st[sp++]=x;seen[(h-1)*w+x]=1;st[sp++]=(h-1)*w+x;}for(let y=0;y<h;y++){seen[y*w]=1;st[sp++]=y*w;seen[y*w+w-1]=1;st[sp++]=y*w+w-1;}
    while(sp){const k=st[--sp],y=(k/w)|0,x=k-y*w;for(const[X,Y]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(X<0||Y<0||X>=w||Y>=h)continue;const q=Y*w+X;if(seen[q]||ink(X,Y))continue;seen[q]=1;st[sp++]=q;}}
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(!seen[y*w+x]&&!ink(x,y))return true;return false;};
  const gone=new Uint8Array(n),blocks=[];
  for(const R of rows.values()){if(R.length<3)continue;let x0=1e9,y0=1e9,x1=-1,y1=-1;for(const c of R){x0=Math.min(x0,c.x0);y0=Math.min(y0,c.y0);x1=Math.max(x1,c.x1);y1=Math.max(y1,c.y1);}
    if(x1-x0<2*(y1-y0))continue;let open=0;for(const c of R)if(!holed(c))open++;if(open<0.4*R.length)continue;
    for(const c of R)gone[c.id]=1;const g=2*(y1-y0+1);blocks.push([x0-g,y0-g,x1+g,y1+g]);}
  if(!blocks.length)return 0;
  // (anything else standing on its own among the writing goes with it, a logo or an underline too, and so on out
  // from there: a short word or a ® next to it)
  const cap=0.3*Math.min(W,H);let more=true;
  while(more){more=false;for(const c of C){if(c===big||c.edge||gone[c.id])continue;let hit=false;for(const b of blocks)if(c.x0<=b[2]&&c.x1>=b[0]&&c.y0<=b[3]&&c.y1>=b[1]){hit=true;break;}if(!hit)continue;
      if(Math.max(c.x1-c.x0,c.y1-c.y0)>cap&&holed(c))continue;   // (a long rule under a heading goes too; a big closed shape stays)
      for(const b of blocks)if(c.x0<=b[2]&&c.x1>=b[0]&&c.y0<=b[3]&&c.y1>=b[1]){gone[c.id]=1;more=true;const g=Math.min(c.y1-c.y0+1,lim);blocks.push([c.x0-g,c.y0-g,c.x1+g,c.y1+g]);break;}}}
  let k=0;for(let i=0;i<N;i++)if(lab[i]>=0&&gone[lab[i]]){m[i]=0;k++;}
  return k;}
