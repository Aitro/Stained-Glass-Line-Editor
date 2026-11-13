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
  if(rid.length<50)return 0;rid.sort((a,b)=>a-b);const wLine=rid[Math.floor(rid.length*0.75)];if(wLine<4)return 0;
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
    let la=0,two=false;
    while(sp){const i=st[--sp];cells.push(i);const x=i%W,y=(i/W)|0;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const j=Y*W+X;if(thin[j]&&!seen2[j]){seen2[j]=1;st[sp++]=j;}else if(lab[j]){if(!la)la=lab[j];else if(lab[j]!==la)two=true;}}}
    // (writing: small, never cut off by the picture's edge (a border line the scan clipped is thin but is lead), and more than a few line widths of it, so a line's rounded end or a corner's tip is not taken)
    const size=Math.max(x1-x0,y1-y0),edge=x0<=2||y0<=2||x1>=W-3||y1>=H-3;if(!edge&&!two&&size<=15*wLine&&size>=1.2*wLine&&cells.length>=wLine*wLine*0.6){for(const i of cells)m[i]=0;dropped++;}}
  return dropped;}
