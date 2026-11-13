
(function(){
const $=id=>document.getElementById(id);
const OUT_PPI=300, MARGIN_IN=0.25, MAX_WORK=3000, PAD=6;
const S={name:'sample-pattern',src:null,crop:null,work:null,workPPI:0,strokes:null,offs:null,stats:null,
  view:'result',zoom:'fit',running:false,pending:false,loadId:0,runId:0,otsu:128,sample:true,dl:null,
  resultBlob:null,resultURL:null,overlayURL:null,origURL:null,svg:null,borderFlags:null,
  fixes:[],fixKey:null,junctions:[],fixMode:false,fixSel:null};

const worker=new Worker(URL.createObjectURL(new Blob([$('worker-src').textContent],{type:'text/javascript'})));
worker.onmessage=e=>{const m=e.data;
  if(m.type==='progress')setStatus(m.text,true);
  else if(m.type==='loaded'){if(m.id!==S.loadId)return;S.otsu=m.otsu;if($('threshAuto').checked)$('thresh').value=m.otsu;updateLabels();S.running=false;run();}
  else if(m.type==='done'){S.running=false;if(!S.go){S.pending=false;return;}
    if(S.pending){S.pending=false;run();return;}
    S.rawStrokes=m.pts;S.rawOffs=m.offs;S.rawHw=m.hw;S.rawFill=m.fill;S.rawFcurve=m.fcurve;S.areaCache=null;S.offs=m.offs;S.hw=m.hw;S.stats=m.stats;S.rot=m.rot||0;if(m.axes)S.axes=m.axes;S.fill=m.fill;S.fcurve=m.fcurve;S.junctions=m.junctions||[];S.strokes=applyDrags();markBorder();render();drawFixLayer();
    if(S.symWaiting&&S.symPending){S.symWaiting=false;if(symAxisOf(S.symPending)){drawFixLayer();symMenu();}}
    setStatus('Done in '+(m.ms/1000).toFixed(1)+' s',false);}
  else if(m.type==='error'){S.running=false;setStatus('Could not process this image: '+m.message,false);}};
function setStatus(t,busy){$('statusText').textContent=t;$('status').classList.toggle('busy',!!busy);}

// ---- units ----
const UNIT={in:1,pt:1/72,mm:1/25.4};
function toIn(v){return(+v)*UNIT[$('unit').value];}
function fromIn(v){return v/UNIT[$('unit').value];}
function fmtUnit(inches){const u=$('unit').value;const v=fromIn(inches);return(u==='in'?v.toFixed(4):v.toFixed(2))+' '+u;}
function widthIn(){const v=toIn($('widthNum').value);return v>0?v:0.042;}
function borderIn(){const v=toIn($('borderNum').value);return v>0?v:0.125;}
function sizeIn(){const w=+$('sizeW').value,h=+$('sizeH').value;return{w:w>0?w:9,h:h>0?h:12};}
function fit2(v){return Math.round(v*100)/100;}
function syncSize(changed){if(!S.crop||!$('lockRatio').checked)return;const r=S.crop.h/S.crop.w;
  if(changed==='w')$('sizeH').value=fit2(sizeIn().w*r);else $('sizeW').value=fit2(sizeIn().h/r);}

// ---- load & prepare ----
function loadImage(img,name,isSample){
  const c=document.createElement('canvas');c.width=img.width||img.naturalWidth;c.height=img.height||img.naturalHeight;
  const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0);
  S.src=c;S.name=name;S.sample=isSample;S.go=false;S.strokes=null;if(S.resultURL)URL.revokeObjectURL(S.resultURL);S.resultURL=null;S.resultBlob=null;S.svg=null;
  if(S.fixMode)$('fixBtn').click();closeFixPop();waitForGo();
  loadFixes(name,c.width,c.height);
  $('fileName').textContent=name;$('sampleTag').hidden=!isSample;$('sSize').textContent=c.width+' × '+c.height+' px';
  if(S.origURL)URL.revokeObjectURL(S.origURL);c.toBlob(b=>{S.origURL=URL.createObjectURL(b);if(S.view==='original')showView();});
  findCrop();
  // (the size this picture was last used at here, or the size a saved PNG says it was made at; otherwise the
  // longest side stays as it is and the other follows the picture)
  let known=null;try{known=JSON.parse(localStorage.getItem(sizeKey())||'null');}catch(e){}if(!known&&!isSample)known=S.fileSize;S.fileSize=null;
  if(known&&known.w>0&&known.h>0){$('lockRatio').checked=!!known.lock;$('sizeW').value=fit2(known.w);$('sizeH').value=fit2(known.h);updateLabels();}
  else if(!isSample||$('lockRatio').checked){$('lockRatio').checked=true;const z=sizeIn(),L=Math.max(z.w,z.h);const r=S.crop.h/S.crop.w;
    if(r>=1){$('sizeH').value=fit2(L);$('sizeW').value=fit2(L/r);}else{$('sizeW').value=fit2(L);$('sizeH').value=fit2(L*r);}}
  prepare();}
function findCrop(){const c=S.src,d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const inv=$('invert').checked;
  let x0=c.width,y0=c.height,x1=-1,y1=-1;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=4*(y*c.width+x);const l=d[i+3]<128?(inv?0:255):Math.min(.299*d[i]+.587*d[i+1]+.114*d[i+2],Math.max(d[i],d[i+1],d[i+2])+40);
    if(inv?l>128:l<128){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
  S.crop=x1<0?{x:0,y:0,w:c.width,h:c.height}:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};}
function prepare(){if(!S.src)return;
  const cr=S.crop,z=sizeIn();
  // work at 300 px per inch, or less for very large panels; stretching (if any) happens here,
  // before the lines are rebuilt, so every line still comes out at one width
  S.workPPI=Math.min(OUT_PPI,MAX_WORK/Math.max(z.w,z.h));
  S.sx=z.w*S.workPPI/cr.w;S.sy=z.h*S.workPPI/cr.h;
  const ww=Math.round((cr.w+2*PAD)*S.sx),wh=Math.round((cr.h+2*PAD)*S.sy);
  const w=document.createElement('canvas');w.width=ww;w.height=wh;const g=w.getContext('2d');
  g.fillStyle=$('invert').checked?'#000':'#fff';g.fillRect(0,0,ww,wh);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  g.drawImage(S.src,cr.x-PAD,cr.y-PAD,cr.w+2*PAD,cr.h+2*PAD,0,0,ww,wh);
  const d=g.getImageData(0,0,ww,wh).data;const gr=new Uint8Array(ww*wh);
  // A colored pattern (glass filled in with color) has dark colors, like deep blue or green, that are
  // as dark as a gray line once the color is dropped. Lead lines are dark in every color, glass is not,
  // so for those patterns each pixel counts as dark only as far as its brightest color is dark.
  // (Line drawings done in colored ink keep the usual brightness, so their lines still show.)
  let colored=0,seen=0;for(let i=0;i<ww*wh;i+=7){const r=d[4*i],gg=d[4*i+1],b=d[4*i+2],mx=Math.max(r,gg,b),mn=Math.min(r,gg,b);seen++;if(mx-mn>60&&mx>70)colored++;}
  S.colorFill=colored>0.15*seen;
  for(let i=0;i<ww*wh;i++)gr[i]=S.colorFill?Math.max(d[4*i],d[4*i+1],d[4*i+2]):Math.round(.299*d[4*i]+.587*d[4*i+1]+.114*d[4*i+2]);
  S.work={w:ww,h:wh};S.lastGray=gr.slice();S.loadId++;S.running=true;setStatus('Enlarging…',true);
  worker.postMessage({type:'load',id:S.loadId,w:ww,h:wh,colored:S.colorFill,buf:gr.buffer},[gr.buffer]);
  updateLabels();}
function params(){return{auto:$('threshAuto').checked,threshold:+$('thresh').value,invert:$('invert').checked,smooth:+$('smooth').value,exact:$('exactShapes').checked,dropText:$('dropText').checked,keepGaps:$('keepGaps').checked,square:$('squareUp').checked,fixes:fixesForWorker(),areas:areasForWorker(),halves:halvesForWorker(),inkAxes:!!S.wantInk||S.fixes.some(f=>f.mode==='half'),
  lines:linesForWorker(),asDrawn:S.mode==='drawn',newHalf:widthIn()*S.workPPI/2};}
let timer=null;
// A new picture is only shown at first. Level lines redraws it tidied (smooth curves, rebuilt joints, exact lines
// and circles); Change width only keeps every line exactly as drawn and just changes its width. Fix lines works
// with either, and on a picture not yet redrawn it uses Change width only. Either can be switched to at any time;
// from then on every change to the settings or fixes redraws it as before.
function waitForGo(){S.view='original';document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.view==='original')));
  showMode();['savePng','saveSvg','saveDxf'].forEach(id=>$(id).disabled=true);showView();
  setStatus('Ready: choose Level lines or Change width only',false);}
function showMode(){$('levelBtn').setAttribute('aria-pressed',String(S.go&&S.mode==='level'));$('drawnBtn').setAttribute('aria-pressed',String(S.go&&S.mode==='drawn'));
  const off=S.go&&S.mode==='drawn';['smooth','exactShapes','squareUp','keepGaps'].forEach(id=>{$(id).disabled=off;const r=$(id).closest('.slider-row,.check');if(r)r.classList.toggle('is-off',off);});}
function setMode(mode){const was=S.go&&S.mode;S.go=true;S.mode=mode;showMode();if(was===mode)return;
  if(S.view==='original'){S.view='result';document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.view==='result')));}
  setStatus('Working…',true);schedule(run,0);}
$('levelBtn').addEventListener('click',()=>setMode('level'));
$('drawnBtn').addEventListener('click',()=>setMode('drawn'));
function schedule(fn,ms){clearTimeout(timer);timer=setTimeout(fn,ms);}
function run(){if(!S.work)return;if(!S.go){waitForGo();return;}if(S.running){S.pending=true;return;}S.running=true;S.runId++;setStatus('Working…',true);
  worker.postMessage({type:'run',id:S.runId,params:params()});}

// ---- geometry: work px -> output px on the page ----
function pageGeom(){const cr=S.crop;const k=OUT_PPI/S.workPPI;const m=MARGIN_IN*OUT_PPI;const ox=PAD*S.sx,oy=PAD*S.sy;
  const pw=Math.round(cr.w*S.sx*k+2*m),ph=Math.round(cr.h*S.sy*k+2*m);
  return{k,m,pw,ph,map:(x,y)=>[(x-ox)*k+m,(y-oy)*k+m]};}
// ---- saving at exactly the pattern's size ----
// The saved page is exactly the width and height typed in, with no margin, and the lines are spread or drawn in
// a hair (well under 1% as a rule) so the outside edge of the outermost lead lands exactly on the page's edge.
// The lead keeps its width; only where the lines run moves. The preview on screen keeps its margin.
function exactGeo(){const base=pageGeom(),wIn=widthIn(),bIn=borderIn(),useB=$('borderOn').checked&&S.hasBorder,P=allStrokePts(base,wIn,bIn);
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,hL=0,hR=0,hT=0,hB=0;
  P.forEach((L,s)=>{const h=((useB&&S.borderFlags[s])?bIn:wIn)*OUT_PPI/2;for(const p of L){if(p[0]-h<x0){x0=p[0]-h;hL=h;}if(p[0]+h>x1){x1=p[0]+h;hR=h;}if(p[1]-h<y0){y0=p[1]-h;hT=h;}if(p[1]+h>y1){y1=p[1]+h;hB=h;}}});
  const Wt=base.pw-2*base.m,Ht=base.ph-2*base.m;if(!isFinite(x0)||x1-x0<1||y1-y0<1)return Object.assign(base,{sx:1,sy:1});
  const cL=x0+hL,cR=x1-hR,cT=y0+hT,cB=y1-hB,sx=(Wt-hL-hR)/Math.max(1,cR-cL),sy=(Ht-hT-hB)/Math.max(1,cB-cT);
  return{k:base.k*(sx+sy)/2,m:0,pw:Math.round(Wt),ph:Math.round(Ht),sx,sy,map:(x,y)=>{const q=base.map(x,y);return[hL+(q[0]-cL)*sx,hT+(q[1]-cT)*sy];}};}
const exactOn=()=>$('exactSize').checked;
function saveGeom(){return exactOn()?exactGeo():pageGeom();}
function drawPage(geo,f){const c=document.createElement('canvas');c.width=Math.round(geo.pw*f);c.height=Math.round(geo.ph*f);const g=c.getContext('2d');if(!g)return null;
  g.setTransform(f,0,0,f,0,0);if(!$('transparent').checked){g.fillStyle='#fff';g.fillRect(0,0,geo.pw,geo.ph);}
  drawStrokes(g,geo,'#000',widthIn(),borderIn());drawFillets(g,geo,'#000',widthIn());return c;}
function markBorder(){const pts=S.strokes,offs=S.offs,n=offs.length-1;const flags=new Uint8Array(n);
  if(!n){S.borderFlags=flags;return;}
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let i=0;i<pts.length;i+=2){x0=Math.min(x0,pts[i]);x1=Math.max(x1,pts[i]);y0=Math.min(y0,pts[i+1]);y1=Math.max(y1,pts[i+1]);}
  const tol=0.015*Math.max(x1-x0,y1-y0);let any=false;
  for(let s=0;s<n;s++){let near=0,tot=0;for(let j=offs[s];j<offs[s+1];j++){const x=pts[2*j],y=pts[2*j+1];tot++;
      if(Math.min(x-x0,x1-x,y-y0,y1-y)<tol)near++;}
    if(tot>1&&near/tot>0.95){flags[s]=1;any=true;}}
  S.borderFlags=flags;S.hasBorder=any;
  const geo=pageGeom();const c0=geo.map(x0,y0),c1=geo.map(x1,y1);S.center=[(c0[0]+c1[0])/2,(c0[1]+c1[1])/2];}

// points of stroke s on the page; a border line can be shifted so that its outer (or inner) edge
// lands where the original border's edge was, using the original line's measured half-width
function strokePts(s,geo,wOutPx){const pts=S.strokes,a=S.offs[s],b=S.offs[s+1];const P=[];
  for(let j=a;j<b;j++)P.push(geo.map(pts[2*j],pts[2*j+1]));
  const mode=$('borderPos').value;if(mode==='center'||!S.hasBorder||!S.borderFlags[s]||P.length<2||!S.hw)return P;
  const n=P.length,segN=[];for(let i=0;i<n-1;i++){const dx=P[i+1][0]-P[i][0],dy=P[i+1][1]-P[i][1],l=Math.hypot(dx,dy);segN.push(l>1e-9?[-dy/l,dx/l]:null);}
  for(let i=0;i<segN.length;i++)if(!segN[i])segN[i]=segN[i-1]||[0,0];
  // outward = away from the middle of the drawing
  const c=S.center;let sg=0;for(let i=0;i<n-1;i++)sg+=segN[i][0]*(P[i][0]-c[0])+segN[i][1]*(P[i][1]-c[1]);const out=sg>=0?1:-1;
  const sign=mode==='outer'?1:-1;
  const hs=Array.from(S.hw.subarray(a,S.offs[s+1])).sort((p,q)=>p-q);const hwMed=hs[hs.length>>1];
  return P.map((p,i)=>{const n1=segN[Math.max(0,i-1)],n2=segN[Math.min(segN.length-1,i)];let nx=n1[0]+n2[0],ny=n1[1]+n2[1];const nl=Math.hypot(nx,ny);
    if(nl<1e-9){nx=n2[0];ny=n2[1];}else{nx/=nl;ny/=nl;}
    const miter=1/Math.max(0.35,nx*n2[0]+ny*n2[1]);            // keep square corners square
    const shift=sign*out*(hwMed*geo.k-wOutPx/2)*miter;
    return[p[0]+nx*shift,p[1]+ny*shift];});}
let ptsCache=null;
function allStrokePts(geo,wIn,bIn){const useB=$('borderOn').checked&&S.hasBorder;const mode=$('borderPos').value;
  const ck=[S.strokes,geo.pw,geo.ph,mode,wIn,bIn,useB].join('|');if(ptsCache&&ptsCache.k===ck&&ptsCache.s===S.strokes)return ptsCache.v;
  const n=S.offs.length-1,orig=[],out=[];
  for(let s=0;s<n;s++){const a=S.offs[s],b=S.offs[s+1];const P=[];for(let j=a;j<b;j++)P.push(geo.map(S.strokes[2*j],S.strokes[2*j+1]));orig.push(P);
    out.push(S.offs[s+1]-S.offs[s]<1?P:strokePts(s,geo,(S.borderFlags[s]&&useB?bIn:wIn)*OUT_PPI));}
  if(mode!=='center'&&S.hasBorder){const wpx=wIn*OUT_PPI,near=Math.max(3*wpx,30);
    const endDir=(P,atStart)=>{const n=P.length;if(n<2)return null;const a=atStart?P[0]:P[n-1],b=atStart?P[Math.min(n-1,3)]:P[Math.max(0,n-4)];
      const d=[a[0]-b[0],a[1]-b[1]],l=Math.hypot(d[0],d[1]);return l>1e-9?[d[0]/l,d[1]/l]:null;};
    const lineHit=(p,d,q,e)=>{const det=d[0]*(-e[1])+e[0]*d[1];if(Math.abs(det)<1e-9)return null;const rx=q[0]-p[0],ry=q[1]-p[1];const t=(rx*(-e[1])+e[0]*ry)/det;return[p[0]+t*d[0],p[1]+t*d[1]];};
    const polyHit=(p,d,P)=>{let best=null,bt=Infinity;for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1],e=[b[0]-a[0],b[1]-a[1]];const det=d[0]*(-e[1])+e[0]*d[1];if(Math.abs(det)<1e-9)continue;
        const rx=a[0]-p[0],ry=a[1]-p[1];const t=(rx*(-e[1])+e[0]*ry)/det,s_=(d[0]*ry-d[1]*rx)/det;if(s_>=-0.01&&s_<=1.01&&Math.abs(t)<near&&Math.abs(t)<Math.abs(bt)){bt=t;best=[p[0]+t*d[0],p[1]+t*d[1]];}}return best;};
    // move an end to q: extend, or trim away any points that would now stick out past q
    const setEnd=(P,atStart,q)=>{const d=endDir(P,atStart);
      if(d){if(atStart){while(P.length>2&&((P[0][0]-q[0])*d[0]+(P[0][1]-q[1])*d[1])>=0&&((P[1][0]-q[0])*d[0]+(P[1][1]-q[1])*d[1])>=0)P.shift();}
        else{while(P.length>2&&((P[P.length-1][0]-q[0])*d[0]+(P[P.length-1][1]-q[1])*d[1])>=0&&((P[P.length-2][0]-q[0])*d[0]+(P[P.length-2][1]-q[1])*d[1])>=0)P.pop();}}
      if(atStart)P[0]=q;else P[P.length-1]=q;};
    const B=[];for(let s=0;s<n;s++)if(S.borderFlags[s]&&out[s].length>1)B.push(s);
    // border sides meet their neighbours exactly at the corners
    for(let x=0;x<B.length;x++)for(const ax of[true,false]){const sx=B[x],ox=orig[sx],ex=ax?ox[0]:ox[ox.length-1];
      for(let y=x+1;y<B.length;y++)for(const ay of[true,false]){const sy=B[y],oy=orig[sy],ey=ay?oy[0]:oy[oy.length-1];
        if(Math.hypot(ex[0]-ey[0],ex[1]-ey[1])>near)continue;
        const dx=endDir(out[sx],ax),dy=endDir(out[sy],ay);if(!dx||!dy)continue;
        const px=ax?out[sx][0]:out[sx][out[sx].length-1],py=ay?out[sy][0]:out[sy][out[sy].length-1];
        const q=lineHit(px,dx,py,dy);if(!q||Math.hypot(q[0]-px[0],q[1]-px[1])>2*near)continue;setEnd(out[sx],ax,q);setEnd(out[sy],ay,q.slice());}}
    // lines that end on the border end exactly on the moved border
    for(let s=0;s<n;s++){if(S.borderFlags[s]||out[s].length<2)continue;
      for(const at0 of[true,false]){const o=orig[s],e=at0?o[0]:o[o.length-1];
        let hit=null;for(const b of B){const ob=orig[b];let dmin=Infinity;for(const p of ob)dmin=Math.min(dmin,Math.hypot(p[0]-e[0],p[1]-e[1]));if(dmin>near)continue;
          const d=endDir(out[s],at0);if(!d)continue;const p0=at0?out[s][0]:out[s][out[s].length-1];const h=polyHit(p0,d,out[b]);if(h)hit=h;}
        if(hit)setEnd(out[s],at0,hit);}}}
  ptsCache={k:ck,s:S.strokes,v:out};return out;}
function filletPaths(geo){const out=[];if(!S.fill)return out;const F=S.fill,C=S.fcurve;
  for(let i=0;i<F.offs.length-1;i++){const poly=[],cur=[];for(let j=F.offs[i];j<F.offs[i+1];j++)poly.push(geo.map(F.pts[2*j],F.pts[2*j+1]));
    for(let j=C.offs[i];j<C.offs[i+1];j++)cur.push(geo.map(C.pts[2*j],C.pts[2*j+1]));out.push({poly,cur});}
  return out;}
function drawFillets(g,geo,color,wIn){g.fillStyle=color;g.strokeStyle=color;g.lineWidth=wIn*OUT_PPI;g.lineCap='round';g.lineJoin='round';
  for(const f of filletPaths(geo)){if(f.poly.length<3)continue;g.beginPath();g.moveTo(f.poly[0][0],f.poly[0][1]);for(const p of f.poly.slice(1))g.lineTo(p[0],p[1]);g.closePath();g.fill();
    g.beginPath();g.moveTo(f.cur[0][0],f.cur[0][1]);for(const p of f.cur.slice(1))g.lineTo(p[0],p[1]);g.stroke();}}
function drawStrokes(g,geo,color,wIn,bIn){const offs=S.offs,n=offs.length-1;const useB=$('borderOn').checked&&S.hasBorder;
  g.lineCap='round';g.lineJoin='miter';g.miterLimit=10;g.strokeStyle=color;
  for(const pass of [0,1]){g.lineWidth=(pass&&useB?bIn:wIn)*OUT_PPI;g.beginPath();
    for(let s=0;s<n;s++){if((useB?S.borderFlags[s]:0)!==pass)continue;if(offs[s+1]-offs[s]<1)continue;
      const P=allStrokePts(geo,wIn,bIn)[s];
      g.moveTo(P[0][0],P[0][1]);if(P.length===1)g.lineTo(P[0][0]+.01,P[0][1]);
      for(let j=1;j<P.length;j++)g.lineTo(P[j][0],P[j][1]);if(isLoop(P,wIn))g.closePath();}
    g.stroke();}}
// (a line that ends where it began, like a whole border, is closed, so the spot where its ends meet is drawn as a
// corner like any other, not as two line ends side by side)
function isLoop(P,wIn){return P.length>3&&Math.hypot(P[0][0]-P[P.length-1][0],P[0][1]-P[P.length-1][1])<0.5*wIn*OUT_PPI;}

function render(){if(!S.strokes)return;const geo=pageGeom();
  const c=document.createElement('canvas');c.width=geo.pw;c.height=geo.ph;const g=c.getContext('2d');
  if(!$('transparent').checked){g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);}
  drawStrokes(g,geo,'#000',widthIn(),borderIn());drawFillets(g,geo,'#000',widthIn());
  $('borderWarn').hidden=!($('borderOn').checked&&!S.hasBorder);
  c.toBlob(async b=>{S.resultBlob=await withPPI(b,OUT_PPI);if(S.resultURL)URL.revokeObjectURL(S.resultURL);S.resultURL=URL.createObjectURL(S.resultBlob);
    if(S.overlayURL){URL.revokeObjectURL(S.overlayURL);S.overlayURL=null;}
    if(S.origPageURL&&S.origPageKey!==origPageKey()){URL.revokeObjectURL(S.origPageURL);S.origPageURL=null;}
    $('savePng').disabled=false;$('saveSvg').disabled=false;$('saveDxf').disabled=false;showView();if(S.checkOn)runCheck();},'image/png');
  S.svg=buildSVG(geo);showStats(geo);}

// ---- before and after: the original on the left of a divider, the new lines on the right ----
// The original is drawn on a page of its own exactly like the result's page (same size and margin), so the two
// line up; dragging anywhere on the picture moves the divider.
const origPageKey=()=>{const g=pageGeom(),c=S.crop;return[g.pw,g.ph,S.rot||0,S.name,c.x,c.y,c.w,c.h,S.src&&S.src.width].join(':');};
function makeOrigPage(cb){S.origPageKey=origPageKey();const geo=pageGeom(),c=document.createElement('canvas');c.width=geo.pw;c.height=geo.ph;const g=c.getContext('2d');
  g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.imageSmoothingQuality='high';const cr=S.crop;g.save();
  if(S.rot){const q=geo.map(S.work.w/2,S.work.h/2);g.translate(q[0],q[1]);g.rotate(-S.rot*Math.PI/180);g.translate(-q[0],-q[1]);}
  g.drawImage(S.src,cr.x,cr.y,cr.w,cr.h,geo.m,geo.m,geo.pw-2*geo.m,geo.ph-2*geo.m);g.restore();
  c.toBlob(b=>{if(S.origPageURL)URL.revokeObjectURL(S.origPageURL);S.origPageURL=URL.createObjectURL(b);cb();});}
S.cmp=0.5;
function placeCompare(){const L=$('cmpLayer'),img=$('view');if(L.hidden||!img.naturalWidth)return;
  L.style.left=img.offsetLeft+'px';L.style.top=img.offsetTop+'px';L.style.width=img.offsetWidth+'px';L.style.height=img.offsetHeight+'px';
  const sc=layerScale(),dw=img.naturalWidth*sc,dh=img.naturalHeight*sc,ox=(img.offsetWidth-dw)/2,oy=(img.offsetHeight-dh)/2,x=ox+S.cmp*dw;
  const ci=$('cmpImg');ci.style.left=ox+'px';ci.style.top=oy+'px';ci.style.width=dw+'px';ci.style.height=dh+'px';ci.style.clipPath=`inset(0 ${(1-S.cmp)*dw}px 0 0)`;
  const bar=$('cmpBar');bar.style.left=x+'px';bar.style.top=oy+'px';bar.style.height=dh+'px';}
{let drag=false;const L=$('cmpLayer'),at=e=>{const img=$('view'),r=L.getBoundingClientRect(),sc=layerScale(),dw=img.naturalWidth*sc,ox=(r.width-dw)/2;
    S.cmp=Math.max(0,Math.min(1,(e.clientX-r.left-ox)/(dw||1)));placeCompare();};
  L.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag=true;L.setPointerCapture(e.pointerId);at(e);e.preventDefault();});
  L.addEventListener('pointermove',e=>{if(drag)at(e);});
  L.addEventListener('pointerup',()=>{drag=false;});L.addEventListener('pointercancel',()=>{drag=false;});
  L.tabIndex=0;L.setAttribute('role','slider');L.setAttribute('aria-label','Divider between the original and the new lines');
  L.addEventListener('keydown',e=>{const d=e.key==='ArrowLeft'?-0.05:e.key==='ArrowRight'?0.05:0;if(!d)return;e.preventDefault();S.cmp=Math.max(0,Math.min(1,S.cmp+d));placeCompare();});}
window.addEventListener('resize',()=>placeCompare());
function makeOverlay(cb){const geo=pageGeom();const c=document.createElement('canvas');c.width=geo.pw;c.height=geo.ph;const g=c.getContext('2d');
  g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.globalAlpha=.45;g.imageSmoothingQuality='high';
  const cr=S.crop;g.save();if(S.rot){const c=geo.map(S.work.w/2,S.work.h/2);g.translate(c[0],c[1]);g.rotate(-S.rot*Math.PI/180);g.translate(-c[0],-c[1]);}
  g.drawImage(S.src,cr.x,cr.y,cr.w,cr.h,geo.m,geo.m,geo.pw-2*geo.m,geo.ph-2*geo.m);g.restore();g.globalAlpha=.8;
  drawStrokes(g,geo,'rgb(205,28,58)',widthIn(),borderIn());drawFillets(g,geo,'rgb(205,28,58)',widthIn());
  c.toBlob(b=>{S.overlayURL=URL.createObjectURL(b);cb();});}

function buildSVG(geo){const offs=S.offs,n=offs.length-1;const useB=$('borderOn').checked&&S.hasBorder;
  const group=(pass,w)=>{let out=`<g fill="none" stroke="#000" stroke-width="${(w*OUT_PPI).toFixed(3)}" stroke-linecap="round" stroke-linejoin="miter" stroke-miterlimit="10">\n`;
    for(let s=0;s<n;s++){if((useB?S.borderFlags[s]:0)!==pass)continue;if(offs[s+1]-offs[s]<2)continue;let d='';
      const P=allStrokePts(geo,widthIn(),borderIn())[s];
      P.forEach((p,j)=>{d+=(j===0?'M':'L')+p[0].toFixed(2)+','+p[1].toFixed(2);});if(isLoop(P,w))d+='Z';
      out+=`<path d="${d}"/>\n`;}return out+'</g>\n';};
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${(geo.pw/OUT_PPI).toFixed(4)}in" height="${(geo.ph/OUT_PPI).toFixed(4)}in" viewBox="0 0 ${geo.pw} ${geo.ph}">\n`+
    ($('transparent').checked?'':'<rect width="100%" height="100%" fill="#fff"/>\n')+group(0,widthIn())+(useB?group(1,borderIn()):'')+filletSVG(geo)+'</svg>\n';}
function filletSVG(geo){const fp=filletPaths(geo);if(!fp.length)return'';const d=P=>P.map((p,j)=>(j?'L':'M')+p[0].toFixed(2)+','+p[1].toFixed(2)).join('');
  return '<g fill="#000" stroke="none">\n'+fp.map(f=>'<path d="'+d(f.poly)+'Z"/>').join('\n')+'\n</g>\n<g fill="none" stroke="#000" stroke-width="'+(widthIn()*OUT_PPI).toFixed(3)+'" stroke-linecap="round">\n'+fp.map(f=>'<path d="'+d(f.cur)+'"/>').join('\n')+'\n</g>\n';}

// add a pHYs chunk so the PNG prints at the right size
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(b){let c=0xffffffff;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return(c^0xffffffff)>>>0;}
// (a saved PNG also carries the pattern size it was made at, so opening it again here keeps that size)
function textChunk(key,val){const t=new TextEncoder().encode(key+'\0'+val),c=new Uint8Array(12+t.length),dv=new DataView(c.buffer);dv.setUint32(0,t.length);c.set([116,69,88,116],4);c.set(t,8);dv.setUint32(8+t.length,crc32(c.subarray(4,8+t.length)));return c;}
function readPngSize(buf){try{const b=new Uint8Array(buf),dv=new DataView(buf);if(b[1]!==80||b[2]!==78)return null;let i=8;
  while(i+8<=b.length){const n=dv.getUint32(i),type=String.fromCharCode(b[i+4],b[i+5],b[i+6],b[i+7]);
    if(type==='tEXt'){const t=new TextDecoder().decode(b.subarray(i+8,i+8+n)),z=t.indexOf('\0');if(t.slice(0,z)==='LeadLineLeveler'){const m=JSON.parse(t.slice(z+1));if(m.w>0&&m.h>0)return m;}}
    if(type==='IEND'||type==='IDAT')break;i+=12+n;}}catch(e){}return null;}
async function withPPI(blob,ppi){try{const buf=new Uint8Array(await blob.arrayBuffer());const ppm=Math.round(ppi/0.0254);
  const chunk=new Uint8Array(21);const dv=new DataView(chunk.buffer);dv.setUint32(0,9);chunk.set([112,72,89,115],4);dv.setUint32(8,ppm);dv.setUint32(12,ppm);chunk[16]=1;
  dv.setUint32(17,crc32(chunk.subarray(4,17)));const z=sizeIn(),tx=textChunk('LeadLineLeveler',JSON.stringify({w:z.w,h:z.h,lock:$('lockRatio').checked})),out=new Uint8Array(buf.length+21+tx.length);out.set(buf.subarray(0,33));out.set(chunk,33);out.set(tx,54);out.set(buf.subarray(33),54+tx.length);
  return new Blob([out],{type:'image/png'});}catch(e){return blob;}}

function showView(){const img=$('view');
  if(!S.go&&S.view!=='original'){S.view='original';document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.view==='original')));}
  if(!S.fixMode||S.view==='original'||S.view==='compare')$('fixLayer').setAttribute('hidden','');
  $('cmpLayer').hidden=S.view!=='compare';
  if(S.view==='original'){if(S.origURL)img.src=S.origURL;img.alt='Original pattern';}
  else if(S.view==='overlay'){if(!S.strokes)return;if(!S.overlayURL){makeOverlay(showView);return;}img.src=S.overlayURL;img.alt='New lines in red over the original';}
  else if(S.view==='compare'){if(!S.strokes)return;if(!S.origPageURL){makeOrigPage(showView);return;}if(S.resultURL)img.src=S.resultURL;img.alt='Pattern with even line width';$('cmpImg').src=S.origPageURL;}
  else{if(S.resultURL)img.src=S.resultURL;img.alt='Pattern with even line width';}
  applyZoom();}
function applyZoom(){requestAnimationFrame(()=>{placeFixLayer();placeCompare();});const mat=$('mat'),img=$('view');mat.classList.toggle('fit',S.zoom==='fit');
  if(S.zoom==='fit'){img.style.width='';img.style.height='';}
  else{const z=+S.zoom;img.onload=()=>{if(S.zoom!=='fit'){img.style.width=img.naturalWidth*z+'px';img.style.height=img.naturalHeight*z+'px';}};
    if(img.complete&&img.naturalWidth){img.style.width=img.naturalWidth*z+'px';img.style.height=img.naturalHeight*z+'px';}}}

function updateLabels(){const w=widthIn();
  $('widthConv').textContent='= '+w.toFixed(4)+' in · '+(w*72).toFixed(2)+' pt · '+(w*25.4).toFixed(2)+' mm';
  document.querySelectorAll('#presets button').forEach(b=>b.setAttribute('aria-pressed',String(Math.abs(+b.dataset.in-w)<0.0006)));
  $('borderRow').hidden=!$('borderOn').checked;$('borderUnit').textContent=$('unit').value;
  $('threshVal').textContent=$('threshAuto').checked?'auto ('+S.otsu+')':$('thresh').value;
  const sm=+$('smooth').value;$('smoothVal').textContent=sm<0.8?'light':sm>1.4?'strong':'normal';
  if(S.crop){const cr=S.crop,z=sizeIn();const stretch=(z.h/z.w)/(cr.h/cr.w);
    const pct=Math.round((stretch-1)*100);
    $('panelNote').textContent='Source has '+Math.round(Math.max(cr.w/z.w,cr.h/z.h))+' px per inch at this size; preview is drawn at 300 px per inch.'+
      (Math.abs(pct)>=1?' Stretched '+Math.abs(pct)+'% '+(pct>0?'taller':'wider')+' than the original.':'');}}
function showStats(geo){const s=S.stats;if(!s||!S.offs||S.offs.length<2){['sThin','sMid','sThick'].forEach(i=>$(i).textContent='no lines found');return;}
  const f=v=>fmtUnit(Math.max(1,v)/S.workPPI);$('sThin').textContent=f(s.thin);$('sMid').textContent=f(s.mid);$('sThick').textContent=f(s.thick);
  $('sOut').textContent=exactOn()?((geo.pw-2*geo.m)/OUT_PPI).toFixed(2)+' × '+((geo.ph-2*geo.m)/OUT_PPI).toFixed(2)+' in':(geo.pw/OUT_PPI).toFixed(2)+' × '+(geo.ph/OUT_PPI).toFixed(2)+' in';}


// ---- fix lines: the user's own choices at junctions and along lines ----
// A fix is kept in the source picture's own pixels, so it stays put when the size or line width changes,
// and it is remembered in this browser for the same picture.
const PAGE_FIX=new Set(['drag','mirror','smooth','straight','fillet','joint','remove']);   // fixes applied to the finished lines (no re-run needed)
const FIXCOL=['#d2392c','#1f6fd1','#e08a00','#7b3fbf','#13917b','#c2185b','#5d6b70'];
function srcToWork(sx,sy){const cr=S.crop;return[(sx-cr.x+PAD)*S.sx-0.5,(sy-cr.y+PAD)*S.sy-0.5];}   // -> worker's own x,y
function workToSrc(wx,wy){const cr=S.crop;return[(wx+0.5)/S.sx+cr.x-PAD,(wy+0.5)/S.sy+cr.y-PAD];}
function areasForWorker(){if(!S.crop||!S.sx)return[];return S.fixes.filter(f=>f.mode==='area').map(f=>{const c=[[f.x0,f.y0],[f.x1,f.y1]].map(([x,y])=>srcToWork(x,y));
  return{x0:Math.min(c[0][0],c[1][0]),y0:Math.min(c[0][1],c[1][1]),x1:Math.max(c[0][0],c[1][0]),y1:Math.max(c[0][1],c[1][1]),flip:f.flip||'lr',ox:(f.ox||0)*S.sx,oy:(f.oy||0)*S.sy};});}
function halvesForWorker(){if(!S.crop||!S.sx)return[];return S.fixes.filter(f=>f.mode==='half').map(f=>({flip:f.flip,keep:f.keep,off:(f.off||0)*(f.flip==='tb'?S.sy:S.sx)}));}
function fixesForWorker(){if(!S.crop||!S.sx)return[];return S.fixes.filter(f=>!PAGE_FIX.has(f.mode)&&f.mode!=='area'&&f.mode!=='half'&&f.mode!=='line').map(f=>{const[x,y]=srcToWork(f.sx,f.sy);return{x,y,mode:f.mode,arms:f.arms,sharp:f.sharp};});}
function linesForWorker(){if(!S.crop||!S.sx)return[];return S.fixes.filter(f=>f.mode==='line').map(f=>{const a=srcToWork(f.ax,f.ay),b=srcToWork(f.bx,f.by);return{ax:a[0],ay:a[1],bx:b[0],by:b[1]};});}
function saveFixes(){try{if(S.fixKey)localStorage.setItem(S.fixKey,JSON.stringify(S.fixes));}catch(e){}updateFixBar();}
function loadFixes(name,w,h){S.fixKey='lll-fixes:'+name+':'+w+'x'+h;S.fixes=[];S.fixSel=null;S.undo=[];
  try{const v=JSON.parse(localStorage.getItem(S.fixKey)||'[]');if(Array.isArray(v))S.fixes=v.filter(f=>f&&f.mode&&(f.mode==='half'?(f.flip==='lr'||f.flip==='tb'):f.mode==='area'?[f.x0,f.y0,f.x1,f.y1].every(isFinite):f.mode==='line'?[f.ax,f.ay,f.bx,f.by].every(isFinite):isFinite(f.sx)&&isFinite(f.sy)));}catch(e){}
  closeFixPop();updateFixBar();}
function updateFixBar(){const n=S.fixes.length;$('fixCount').textContent=n?n+(n===1?' fix':' fixes'):'';
  $('fixClear').disabled=!n;$('fixUndo').disabled=!(S.undo&&S.undo.length);}
function changeFixes(fn){S.undo=S.undo||[];S.undo.push(JSON.stringify(S.fixes));if(S.undo.length>50)S.undo.shift();fn();saveFixes();closeFixPop();setStatus('Applying your fix…',true);schedule(run,0);}

// where things are on the preview: page px of the result picture
function jPage(J){const geo=pageGeom();let[x,y]=[J.x,J.y];
  // (a junction the user dragged is shown where they put it)
  for(const f of S.fixes){if(f.mode!=='drag'||!f.j)continue;const a=outPos(...srcToWork(f.sx,f.sy));
    if(Math.hypot(a[0]-x,a[1]-y)<3*Math.max(2,widthIn()*S.workPPI)){const v=rotVec(f.dx*S.sx,f.dy*S.sy);x+=v[0];y+=v[1];}}
  return geo.map(x,y);}
function pageToWorkInternal(px,py){const geo=pageGeom();const ox=PAD*S.sx,oy=PAD*S.sy;
  let x=(px-geo.m)/geo.k+ox-0.5,y=(py-geo.m)/geo.k+oy-0.5;          // output position, worker coords
  if(S.rot){const a=-S.rot*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),cy=S.work.h/2,cx=S.work.w/2;   // undo the squaring-up turn
    const Y=y-cy,X=x-cx;x=cx+X*ca+Y*sa;y=cy-X*sa+Y*ca;}
  return[x,y];}
function placeFixLayer(){const L=$('fixLayer'),img=$('view');if(L.hasAttribute('hidden')||!img.naturalWidth)return;
  L.style.left=img.offsetLeft+'px';L.style.top=img.offsetTop+'px';L.style.width=img.offsetWidth+'px';L.style.height=img.offsetHeight+'px';
  L.setAttribute('viewBox','0 0 '+img.naturalWidth+' '+img.naturalHeight);L.setAttribute('preserveAspectRatio','xMidYMid meet');}
function layerScale(){const img=$('view');return img.naturalWidth?Math.min(img.offsetWidth/img.naturalWidth,img.offsetHeight/img.naturalHeight):1;}
function fixAtJunction(J){return S.fixes.filter(f=>{const[x,y]=srcToWork(f.sx,f.sy);return Math.hypot(x-J.wx,y-J.wy)<8;});}
function drawFixLayer(){const L=$('fixLayer');if(!S.fixMode||!S.strokes||S.view==='original'||S.view==='compare'){L.setAttribute('hidden','');return;}
  L.removeAttribute('hidden');placeFixLayer();const k=1/layerScale(),r=7*k;let h='';
  const areaFx=S.fixes.filter(f=>f.mode==='area');
  areaFx.forEach((f,i)=>{const b=areaPageBox(f);h+=`<rect class="area" x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" style="stroke-width:${2*k}px"/>`;
    // (the spot it copies from, with a handle to move it)
    const moving=press&&press.grip===f,d=moving?press.d||[0,0]:[0,0],poly=areaSrcPoly(f,i).map(q=>[q[0]+d[0],q[1]+d[1]]),g=gripAt(poly);
    h+=`<polygon class="area src" points="${poly.map(q=>q[0]+','+q[1]).join(' ')}" style="stroke-width:${2*k}px;stroke-dasharray:${6*k} ${4*k}"/>`;
    h+=`<g class="area-grip" transform="translate(${g[0]} ${g[1]})"><title>Drag to move the spot this box copies from</title><circle r="${11*k}" style="stroke-width:${2*k}px"/><path d="M${-6*k},0H${6*k}M0,${-6*k}V${6*k}" style="stroke-width:${2*k}px"/></g>`;});
  if(S.areaPending){const f=S.areaPending,b=areaPageBox(f),moving=press&&press.grip===f,d=moving?press.d||[0,0]:[0,0],poly=areaSrcPoly(f,-1).map(q=>[q[0]+d[0],q[1]+d[1]]),g=gripAt(poly);
    h+=`<rect class="area" x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" style="stroke-width:${2*k}px"/>`;
    h+=`<polygon class="area src pending" points="${poly.map(q=>q[0]+','+q[1]).join(' ')}" style="stroke-width:${2.5*k}px;stroke-dasharray:${6*k} ${4*k}"/>`;
    h+=`<g class="area-grip" transform="translate(${g[0]} ${g[1]})"><circle r="${11*k}" style="stroke-width:${2*k}px"/><path d="M${-6*k},0H${6*k}M0,${-6*k}V${6*k}" style="stroke-width:${2*k}px"/></g>`;
    h+=seamDots(b,k,f,d);}
  // (the centre line of a symmetric pattern; while choosing, the half that will be replaced is shaded)
  {const img=$('view'),hv=S.symPending||S.fixes.find(f=>f.mode==='half');if(hv){const ln=symLine(hv,S.symPending&&press&&press.sym?press.off:0);if(ln){
      const W_=img.naturalWidth,H_=img.naturalHeight;h+=`<clipPath id="imgClip"><rect width="${W_}" height="${H_}"/></clipPath>`;
      if(S.symPending)h+=`<polygon clip-path="url(#imgClip)" class="sym-shade" points="${ln.shade.map(q=>q[0]+','+q[1]).join(' ')}"/>`;
      h+=`<line clip-path="url(#imgClip)" class="sym-line${S.symPending?' pending':''}" x1="${ln.a[0]}" y1="${ln.a[1]}" x2="${ln.b[0]}" y2="${ln.b[1]}" style="stroke-width:${2.5*k}px;stroke-dasharray:${10*k} ${6*k}"/>`;
      if(S.symPending)h+=`<g class="area-grip" transform="translate(${ln.mid[0]} ${ln.mid[1]})"><circle r="${12*k}" style="stroke-width:${2*k}px"/><path d="M${-7*k},0H${7*k}M0,${-7*k}V${7*k}" style="stroke-width:${2*k}px"/></g>`;}}}
  // (pieces that are hard to cut in glass)
  if(S.checkOn&&S.checkMarks)h+=checkMarkup(k);
  h+=addedLinesMarkup(k);h+=tidyMarkup(k);
  for(let i=0;i<S.junctions.length;i++){const J=S.junctions[i],p=jPage(J),fx=fixAtJunction(J).length>0;
    h+=`<circle class="jn${fx?' fixed':''}${S.fixSel&&S.fixSel.j===i?' sel':''}" cx="${p[0]}" cy="${p[1]}" r="${r}" style="stroke-width:${(fx?2:2.5)*k}"/>`;}
  // fixes that sit on a line rather than at a junction
  const geo=pageGeom();
  for(const f of S.fixes){if(f.mode==='area')continue;if(f.mode!=='corner'&&f.mode!=='round'&&!PAGE_FIX.has(f.mode))continue;if(f.mode==='drag'&&f.j)continue;   // (a dragged junction shows as its dot)
let[x,y]=srcToWork(f.sx+(f.mode==='drag'?f.dx:0),f.sy+(f.mode==='drag'?f.dy:0));
    if(!PAGE_FIX.has(f.mode)&&S.junctions.some(J=>Math.hypot(J.wx-x,J.wy-y)<12))continue;const q=outPos(x,y);const p=geo.map(q[0],q[1]);
    h+=f.mode==='joint'?`<rect class="pt joint" x="${p[0]-r*.6}" y="${p[1]-r*.6}" width="${r*1.2}" height="${r*1.2}" style="stroke-width:${2*k}"/>`:`<rect class="pt" x="${p[0]-r*.8}" y="${p[1]-r*.8}" width="${r*1.6}" height="${r*1.6}" transform="rotate(45 ${p[0]} ${p[1]})" style="stroke-width:${2*k}"/>`;}
  if(S.fixSel&&S.fixSel.j!=null){const J=S.junctions[S.fixSel.j];if(J){const p=jPage(J),len=46*k;
    J.arms.forEach((a,i)=>{const t=a*Math.PI/180;h+=`<line class="spoke" x1="${p[0]}" y1="${p[1]}" x2="${p[0]+Math.cos(t)*len}" y2="${p[1]+Math.sin(t)*len}" stroke="${FIXCOL[i%FIXCOL.length]}" style="stroke-width:${7*k}"/>`;});}}
  if(S.fixSel&&S.fixSel.pt){const q=S.fixSel.pt;h+=`<circle cx="${q[0]}" cy="${q[1]}" r="${r}" fill="none" stroke="var(--fix)" style="stroke-width:${3*k}"/>`;}
  L.innerHTML=h;}
// worker x,y (before squaring up) -> output x,y
function outPos(x,y){if(!S.rot)return[x+0.5,y+0.5];const a=-S.rot*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),cy=S.work.h/2,cx=S.work.w/2;
  const Y=y-cy,X=x-cx;return[cx+X*ca-Y*sa+0.5,cy+X*sa+Y*ca+0.5];}
function nearestStroke(px,py,lim){let best=null,bd=lim;const pts=S.strokes,geo=pageGeom();
  for(let j=0;j<pts.length/2;j++){const p=geo.map(pts[2*j],pts[2*j+1]);const d=Math.hypot(p[0]-px,p[1]-py);if(d<bd){bd=d;best=p;}}return best;}

function closeFixPop(){$('fixPop').hidden=true;S.fixSel=null;S.tidy=null;if(S.fixMode)drawFixLayer();}
function openFixPop(html,px,py,left){const pop=$('fixPop'),img=$('view'),mat=$('mat'),sc=layerScale();
  // (the picture may be letterboxed inside its box; the layer sits exactly on that box)
  const L={offsetLeft:img.offsetLeft+(img.offsetWidth-img.naturalWidth*sc)/2,offsetTop:img.offsetTop+(img.offsetHeight-img.naturalHeight*sc)/2};
  pop.innerHTML='<button class="close" aria-label="Close">×</button>'+html;pop.hidden=false;
  let x=left?L.offsetLeft+px*sc-pop.offsetWidth-18:L.offsetLeft+px*sc+18,y=L.offsetTop+py*sc-20;if(left&&x<mat.scrollLeft+8)x=L.offsetLeft+px*sc+18;const mw=mat.scrollLeft+mat.clientWidth,mh=mat.scrollTop+mat.clientHeight;
  if(x+pop.offsetWidth>mw-8)x=L.offsetLeft+px*sc-pop.offsetWidth-18;if(x<mat.scrollLeft+8)x=mat.scrollLeft+8;
  if(y+pop.offsetHeight>mh-8)y=mh-pop.offsetHeight-8;if(y<mat.scrollTop+8)y=mat.scrollTop+8;
  pop.style.left=x+'px';pop.style.top=y+'px';pop.querySelector('.close').onclick=closeFixPop;
  const first=pop.querySelector('button:not(.close)');if(first)first.focus({preventScroll:true});}
const sw=i=>`<span class="sw" style="background:${FIXCOL[i%FIXCOL.length]}"></span>`;
function junctionMenu(i){const J=S.junctions[i];if(!J)return;S.fixSel={j:i};drawFixLayer();
  const here=fixAtJunction(J),has=m=>here.some(f=>f.mode===m),pairFix=(a,b)=>here.some(f=>f.mode==='pair'&&f.arms&&[f.arms[0],f.arms[1]].every(v=>[J.arms[a],J.arms[b]].some(w=>Math.abs(((v-w+540)%360)-180)<15)));
  const cur=new Set(J.pairs.map(p=>p[0]+'-'+p[1]));
  let h=`<h3>Junction of ${J.arms.length} lines</h3><p>Pick which two lines are one line running straight through. The colors match the spokes on the picture.</p><div class="row">`;
  for(let a=0;a<J.arms.length;a++)for(let b=a+1;b<J.arms.length;b++){const on=cur.has(a+'-'+b);
    h+=`<button data-pair="${a},${b}" aria-pressed="${on}">${sw(a)}${sw(b)} ${on?'run through (now)':'run through'}</button>`;}
  h+=`</div><button data-act="apart" aria-pressed="${has('apart')}">No line runs through: they all just meet here</button>`;
  h+=`<button data-act="corner" aria-pressed="${has('corner')}">Make it a sharp corner</button>`;
  h+=`<button data-act="round" aria-pressed="${has('round')}">Make it a smooth curve</button>`;
  const jf=S.fixes.filter(f=>f.mode==='fillet'&&(()=>{const[x,y]=srcToWork(f.sx,f.sy);return Math.hypot(x-J.wx,y-J.wy)<20;})());
  if(J.arms.length===2){const FSEL=z=>jf.some(f=>f.size===z);h+=`<div class="row"><span class="row-label">Rounded corner:</span>${["small","medium","large"].map(z=>`<button data-fillet="${z}" aria-pressed="${FSEL(z)}">${z}</button>`).join("")}</div>`;}
  h+=`<button data-act="auto" aria-pressed="${!here.length&&!jf.length}">Automatic${here.length||jf.length?' (remove my fix)':''}</button>`;
  const p=jPage(J);openFixPop(h,p[0],p[1]);
  const [sx,sy]=workToSrc(J.wx,J.wy);
  $('fixPop').querySelectorAll('[data-fillet]').forEach(bt=>bt.onclick=()=>{const f={sx,sy,mode:'fillet',size:bt.dataset.fillet};
    if(!changesLines(f)){closeFixPop();setStatus('Could not round this corner: the two lines here are too short.',false);return;}
    const before=S.fixes.slice();S.undo=S.undo||[];S.undo.push(JSON.stringify(S.fixes));
    S.fixes=S.fixes.filter(x=>!jf.includes(x));S.fixes.push(f);saveFixes();closeFixPop();afterFixChange(before);});
  $('fixPop').querySelectorAll('[data-pair]').forEach(bt=>bt.onclick=()=>{const[a,b]=bt.dataset.pair.split(',').map(Number);
    changeFixes(()=>{// a line can only run through one way: drop my other pairings that use either of these two lines
      S.fixes=S.fixes.filter(f=>!(here.includes(f)&&(f.mode==='pair'?f.arms.some(v=>[J.arms[a],J.arms[b]].some(w=>Math.abs(((v-w+540)%360)-180)<15)):f.mode==='apart')));
      S.fixes.push({sx,sy,mode:'pair',arms:[J.arms[a],J.arms[b]]});});});
  $('fixPop').querySelectorAll('[data-act]').forEach(bt=>bt.onclick=()=>{const act=bt.dataset.act;
    changeFixes(()=>{if(act==='auto'){S.fixes=S.fixes.filter(f=>!here.includes(f)&&!jf.includes(f));return;}
      if(act==='apart')S.fixes=S.fixes.filter(f=>!here.includes(f));
      else S.fixes=S.fixes.filter(f=>!(here.includes(f)&&(f.mode==='corner'||f.mode==='round')));
      S.fixes.push({sx,sy,mode:act});});});}
function pointMenu(px,py){const[wx,wy]=pageToWorkInternal(px,py);const[sx,sy]=workToSrc(wx,wy);
  const near=S.fixes.filter(f=>(f.mode==='corner'||f.mode==='round'||PAGE_FIX.has(f.mode))&&(()=>{const m=f.mode==='drag';const[x,y]=srcToWork(f.sx+(m?f.dx:0),f.sy+(m?f.dy:0));return Math.hypot(x-wx,y-wy)<(m?2.5:1)*20;})());
  S.fixSel={pt:[px,py]};drawFixLayer();
  let h=`<h3>This spot on the line</h3><p>Choose how the line should look here.</p>`;
  h+=`<button data-act="corner" aria-pressed="${near.some(f=>f.mode==='corner')}">Sharp corner here</button>`;
  h+=`<button data-act="round" aria-pressed="${near.some(f=>f.mode==='round')}">Smooth curve here (no corner)</button>`;
  {const FSEL=z=>near.some(f=>f.mode==='fillet'&&f.size===z);h+=`<div class="row"><span class="row-label">Rounded corner:</span>${["small","medium","large"].map(z=>`<button data-fillet="${z}" aria-pressed="${FSEL(z)}">${z}</button>`).join("")}</div>`;}
  h+=`<button data-act="smooth" aria-pressed="${near.some(f=>f.mode==='smooth')}">Smooth this line (one even curve between its joints)</button>`;
  h+=`<button data-act="straight" aria-pressed="${near.some(f=>f.mode==='straight')}">Straighten this line (between its joints)</button>`;
  h+=`<button data-act="remove">Remove this line (between its joints)</button>`;
  h+=`<button data-act="joint" aria-pressed="${near.some(f=>f.mode==='joint')}">Add a joint here (Smooth and Straighten then stop at it)</button>`;
  h+=`<button data-act="mirror" aria-pressed="${near.some(f=>f.mode==='mirror')}">Mirror the matching line from the other side…</button>`;
  const areasHere=S.fixes.filter(f=>{if(f.mode!=='area')return false;const b=areaPageBox(f);return px>b[0]&&px<b[2]&&py>b[1]&&py<b[3];});
  if(areasHere.length)h+=`<button data-act="unarea">Remove the mirrored area here</button>`;
  h+=`<button data-act="auto" aria-pressed="${!near.length}">Automatic${near.length?(near.some(f=>PAGE_FIX.has(f.mode))?' (undo my changes here)':' (remove my fix)'):''}</button>`;
  openFixPop(h,px,py);
  $('fixPop').querySelectorAll('[data-fillet]').forEach(bt=>bt.onclick=()=>{const f={sx,sy,mode:'fillet',size:bt.dataset.fillet};
    if(!changesLines(f)){closeFixPop();setStatus('No corner to round there. Click right on the point of the corner.',false);return;}
    const before=S.fixes.slice();S.undo=S.undo||[];S.undo.push(JSON.stringify(S.fixes));
    S.fixes=S.fixes.filter(x=>!(near.includes(x)&&x.mode==='fillet'));S.fixes.push(f);saveFixes();closeFixPop();afterFixChange(before);});
  {const ua=$('fixPop').querySelector('[data-act="unarea"]');if(ua)ua.onclick=()=>{closeFixPop();S.undo=S.undo||[];S.undo.push(JSON.stringify(S.fixes));
    const before=S.fixes;S.fixes=S.fixes.filter(f=>!areasHere.includes(f));saveFixes();afterFixChange(before);};}
  $('fixPop').querySelector('[data-act="mirror"]').onclick=()=>{closeFixPop();S.mirrorPick={sx,sy,px,py,near};S.fixSel={pt:[px,py]};drawFixLayer();
    setStatus('Now click the line on the other side to copy (Esc to cancel)');};
  $('fixPop').querySelectorAll('[data-act]:not([data-act="mirror"]):not([data-act="unarea"])').forEach(bt=>bt.onclick=()=>{const act=bt.dataset.act;
    {const before=S.fixes.slice();S.undo=S.undo||[];S.undo.push(JSON.stringify(S.fixes));
    // (each choice replaces only fixes of its own kind here: a joint sits alongside the others and pressing it
    // again takes it away; Smooth or Straighten replaces a Smooth or Straighten of the same stretch only, so
    // the stretches on either side of a joint keep theirs; Automatic takes everything here away)
    if(act==='remove'){const mine=stretchAt(sx,sy);if(!S.fixes.some(f=>f.mode==='remove'&&stretchAt(f.sx,f.sy)===mine))S.fixes.push({sx,sy,mode:'remove'});}
    else if(act==='joint'){const had=near.filter(f=>f.mode==='joint');S.fixes=S.fixes.filter(f=>!had.includes(f));if(!had.length)S.fixes.push({sx,sy,mode:'joint'});}
    else if(act==='auto')S.fixes=S.fixes.filter(f=>!near.includes(f));
    else{const kinds=act==='smooth'||act==='straight'?['smooth','straight']:['corner','round','fillet'];
      const mine=stretchAt(sx,sy),gone=S.fixes.filter(f=>kinds.includes(f.mode)&&(act==='smooth'||act==='straight'?stretchAt(f.sx,f.sy)===mine:near.includes(f)));
      const f={sx,sy,mode:act};
      if((act==='smooth'||act==='straight')&&!changesLines(f)){S.undo.pop();closeFixPop();setStatus(act==='smooth'?'That stretch has nothing to smooth (a whole closed loop, or too short).':'That stretch cannot be straightened (a whole closed loop, or too short).',false);return;}
      S.fixes=S.fixes.filter(x=>!gone.includes(x));S.fixes.push(f);}
    saveFixes();closeFixPop();afterFixChange(before);}});}
// (which stretch of which line a spot is on, as a key, in the lines as they are now)
function stretchAt(sx,sy){if(!S.strokes)return'';const lw=Math.max(2,widthIn()*S.workPPI),[tx,ty]=outPos(...srcToWork(sx,sy)),P=S.strokes,o=S.offs;let bs=-1,bi=-1,bd=3*lw;
  for(let s=0;s+1<o.length;s++)for(let j=o[s];j<o[s+1];j++){const d=Math.hypot(P[2*j]-tx,P[2*j+1]-ty);if(d<bd){bd=d;bs=s;bi=j;}}
  if(bs<0)return'';const[i0,i1]=stretchTools(P,o,lw).piece(bs,bi);return bs+':'+i0+':'+i1;}
// (whether a fix on the finished lines would change them at all)
function changesLines(f){const P=Float32Array.from(S.strokes);const m=f.mode==='fillet'?applyOneFillet(P,S.offs,f):f.mode==='smooth'||f.mode==='straight'?applyOneSmooth(P,S.offs,f):new Set([1]);return m.size>0;}
function fixClick(px,py){const sc=layerScale(),lim=16/sc;
  if(S.mirrorPick){const m=S.mirrorPick;S.mirrorPick=null;const q=nearestStroke(px,py,16/sc);S.fixSel=null;
    if(!q){drawFixLayer();setStatus('No line there: mirror cancelled');return;}
    const[wx,wy]=pageToWorkInternal(q[0],q[1]);const[msx,msy]=workToSrc(wx,wy);
    const f={mode:'mirror',sx:m.sx,sy:m.sy,msx,msy};
    // (it must actually change something)
    const test=Float32Array.from(applyDrags());if(!applyOneMirror(test,S.offs,f).size){drawFixLayer();setStatus('Could not mirror that line onto the first one: mirror cancelled');return;}
    S.undo=S.undo||[];S.undo.push(JSON.stringify(S.fixes));if(S.undo.length>50)S.undo.shift();
    S.fixes=S.fixes.filter(x=>!m.near.includes(x)||x.mode!=='mirror');S.fixes.push(f);saveFixes();redrawDrags();setStatus('Mirrored');return;}
  // (a joint takes the click when it is right on it; otherwise a line nearby does, so lines close to a joint can
  // still be picked; failing both, a joint a little further off)
  let bi=-1,bd=lim;S.junctions.forEach((J,i)=>{const p=jPage(J);const d=Math.hypot(p[0]-px,p[1]-py);if(d<bd){bd=d;bi=i;}});
  if(bi>=0&&bd<7/sc){junctionMenu(bi);return;}
  if(S.tidy){const c=tidyAt(px,py,12/sc);if(c){c.on=!c.on;drawFixLayer();tidyMenu();}return;}
  {const ln=addedLineAt(px,py,10/sc);if(ln){addedLineMenu(ln,px,py);return;}}
  const q=nearestStroke(px,py,12/sc);if(q){pointMenu(q[0],q[1]);return;}
  if(bi>=0){junctionMenu(bi);return;}
  closeFixPop();}

// ---- dragging a line to reshape it ----
// A drag is kept like the other fixes, in the source picture's pixels: where the line was grabbed, how far it
// was moved, and how far along the line the pull reaches. It is applied to the program's finished lines, so
// it never changes any of the program's own decisions, and redrawing after a drag needs no re-run.
const REACH={short:5,medium:14,wide:34};           // in line widths
function reachWork(){return (REACH[$('fixReach').value]||REACH.medium)*Math.max(2,widthIn()*S.workPPI);}
function rotVec(vx,vy){if(!S.rot)return[vx,vy];const a=-S.rot*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);return[vx*ca-vy*sa,vx*sa+vy*ca];}
function unrotVec(vx,vy){if(!S.rot)return[vx,vy];const a=S.rot*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);return[vx*ca-vy*sa,vx*sa+vy*ca];}
const smooth01=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
// move the lines in P (flat x,y in output working pixels) for one drag; returns the strokes it moved
function applyOneDrag(P,offs,d){const n=offs.length-1;const[ax,ay]=outPos(...srcToWork(d.sx,d.sy));const[vx,vy]=rotVec(d.dx*S.sx,d.dy*S.sy);
  const R=Math.max(4,d.r*S.sx),lw=Math.max(2,widthIn()*S.workPPI),orig=Float32Array.from(P),moved=new Set();
  const arc=s=>{const a=offs[s],b=offs[s+1],L=new Float64Array(b-a);for(let j=a+1;j<b;j++)L[j-a]=L[j-a-1]+Math.hypot(P[2*j]-P[2*j-2],P[2*j+1]-P[2*j-1]);return L;};
  // move stroke s by (vx,vy) times a weight that falls off along the line from index i0 (or ramps for a straight line)
  const pull=(s,i0,ux,uy,reach)=>{const a=offs[s],b=offs[s+1];if(b-a<2)return;const L=arc(s),tot=L[L.length-1],s0=L[i0-a];
    let x0=P[2*a],y0=P[2*a+1],x1=P[2*b-2],y1=P[2*b-1],lx=x1-x0,ly=y1-y0,ll=Math.hypot(lx,ly),dev=0;
    for(let j=a;j<b;j++)dev=Math.max(dev,ll>1e-6?Math.abs((P[2*j]-x0)*ly-(P[2*j+1]-y0)*lx)/ll:0);
    const straight=ll>4*lw&&dev<0.35*lw;const t0=tot>0?s0/tot:0;
    for(let j=a;j<b;j++){const t=tot>0?L[j-a]/tot:0;let w;
      if(straight){w=t0<0.3?(1-t)/(1-t0):t0>0.7?t/t0:1;}            // a straight line stays straight: it turns about its far end, or moves as a whole
      else w=1-smooth01(Math.abs(L[j-a]-s0)/reach);
      if(w<=0)continue;P[2*j]+=ux*w;P[2*j+1]+=uy*w;}moved.add(s);};
  if(d.j){// a junction: every line ending there moves its end, easing off along the line
    for(let s=0;s<n;s++){const a=offs[s],b=offs[s+1];if(b-a<2)continue;
      for(const e of[a,b-1]){if(Math.hypot(orig[2*e]-ax,orig[2*e+1]-ay)>1.5*lw)continue;pull(s,e,vx,vy,Math.min(R,arc(s)[b-a-1]*0.6));}}
    // ...and a line running through it bends there
    let bs=-1,bi=-1,bd=1.2*lw;for(let s=0;s<n;s++){if(moved.has(s))continue;for(let j=offs[s]+1;j<offs[s+1]-1;j++){const dd=Math.hypot(orig[2*j]-ax,orig[2*j+1]-ay);if(dd<bd){bd=dd;bs=s;bi=j;}}}
    if(bs>=0)pull(bs,bi,vx,vy,R);}
  else{let bs=-1,bi=-1,bd=2*lw;for(let s=0;s<n;s++)for(let j=offs[s];j<offs[s+1];j++){const dd=Math.hypot(P[2*j]-ax,P[2*j+1]-ay);if(dd<bd){bd=dd;bs=s;bi=j;}}
    if(bs<0)return moved;
    if(d.whole){// the whole stretch between its joints moves as one; past a joint the line eases back, and lines
      // that meet it at a joint move their ends with it
      const T=stretchTools(orig,offs,lw),[i0,i1]=T.piece(bs,bi),a=offs[bs],b=offs[bs+1],L=arc(bs),ease=Math.min(R,14*lw);
      for(let j=a;j<b;j++){const g=j<i0?L[i0-a]-L[j-a]:j>i1?L[j-a]-L[i1-a]:0,w=1-smooth01(g/ease);if(w>0){P[2*j]+=vx*w;P[2*j+1]+=vy*w;}}moved.add(bs);
      for(const e0 of[i0,i1]){for(let s=0;s<n;s++){if(s===bs)continue;const sa=offs[s],sb=offs[s+1];if(sb-sa<2)continue;
          for(const e of[sa,sb-1]){if(!(Math.hypot(orig[2*e]-orig[2*e0],orig[2*e0+1]-orig[2*e+1])<1.5*lw)||moved.has(s))continue;
            // (it turns about its own next joint, so a straight line stays straight)
            const[p0,p1]=T.piece(s,e),Ls=arc(s),far=e===sa?p1:p0,span=Math.abs(Ls[far-sa]-Ls[e-sa])||1;
            for(let j=sa;j<sb;j++){const w=1-Math.abs(Ls[j-sa]-Ls[e-sa])/span;if(w>0&&(e===sa?j<=far:j>=far)){P[2*j]+=vx*w;P[2*j+1]+=vy*w;}}moved.add(s);}}}}
    else pull(bs,bi,vx,vy,R);}
  // lines that end on a moved line stay on it: their end moves with the spot they land on
  const movedNow=[...moved];
  for(let s=0;s<n;s++){if(moved.has(s))continue;const a=offs[s],b=offs[s+1];if(b-a<2)continue;
    for(const e of[a,b-1]){let best=null,bd=0.8*lw;for(const m of movedNow)for(let j=offs[m];j<offs[m+1];j++){const dd=Math.hypot(orig[2*j]-orig[2*e],orig[2*j+1]-orig[2*e+1]);if(dd<bd){bd=dd;best=j;}}
      if(best==null)continue;const ux=P[2*best]-orig[2*best],uy=P[2*best+1]-orig[2*best+1];if(Math.hypot(ux,uy)<0.05)continue;
      const L=arc(s);pull(s,e,ux,uy,Math.min(R,L[L.length-1]*0.6));}}
  return moved;}
// ---- mirroring a line from the other side of the pattern ----
// A mirror fix is kept as two spots in the source picture's pixels: on the line to change, and on the line to copy.
// Each picked line is taken between its joints (its own ends and the spots where other lines end on it). The line
// to copy is flipped across the pattern's upright centre line, and the line to change takes its shape exactly.
// Where it meets other lines it still meets them (see hold below), and lines that end on it stay on it.
// (the flip used for mirroring an area, in the finished lines' own coordinates: across the centre line the worker
// found, once it has run with an area; until then across the middle of the drawing)
function mirrorFn(flip){const A=S.axes&&S.axes[flip==='tb'?'tb':'lr'];
  if(A){const c=outPos(A.cx,A.cy),u=rotVec(A.u[0],A.u[1]);return(x,y)=>{const dx=x-c[0],dy=y-c[1],k=2*(dx*u[0]+dy*u[1]);return[c[0]+k*u[0]-dx,c[1]+k*u[1]-dy];};}
  const cx=patternMidX(),cy=patternMidY();return flip==='tb'?(x,y)=>[x,2*cy-y]:(x,y)=>[2*cx-x,y];}
function patternMidY(){const P=S.rawStrokes;let lo=Infinity,hi=-Infinity;for(let j=1;j<P.length;j+=2){if(P[j]<lo)lo=P[j];if(P[j]>hi)hi=P[j];}return(lo+hi)/2;}
function patternMidX(){const P=S.rawStrokes;let lo=Infinity,hi=-Infinity;for(let j=0;j<P.length;j+=2){if(P[j]<lo)lo=P[j];if(P[j]>hi)hi=P[j];}return(lo+hi)/2;}
// (shared by the fixes that reshape one stretch of a line between its joints: mirror, smooth, straighten)
function stretchTools(P,offs,lw){const n=offs.length-1,orig=Float32Array.from(P);
  // each picked line is taken between its joints: its own ends, and the spots where other lines end on it
  const piece=(s0,i)=>{const a=offs[s0],b=offs[s0+1]-1;let lo=a,hi=b;
    for(let s=0;s<n;s++){if(s===s0)continue;const sa=offs[s],sb=offs[s+1];if(sb-sa<2)continue;
      for(const e of[sa,sb-1]){let bj=-1,bd=1.2*lw;for(let j=a;j<=b;j++){const d=Math.hypot(orig[2*j]-orig[2*e],orig[2*j+1]-orig[2*e+1]);if(d<bd){bd=d;bj=j;}}
        if(bj<0)continue;const fromA=Math.hypot(orig[2*bj]-orig[2*a],orig[2*bj+1]-orig[2*a+1]),fromB=Math.hypot(orig[2*bj]-orig[2*b],orig[2*bj+1]-orig[2*b+1]);
        if(fromA<1.5*lw||fromB<1.5*lw)continue;if(bj<i&&bj>lo)lo=bj;if(bj>i&&bj<hi)hi=bj;}}
    // (joints the person added on this line count too)
    for(const f of S.fixes){if(f.mode!=='joint')continue;const[jx,jy]=outPos(...srcToWork(f.sx,f.sy));let bj=-1,bd=1.5*lw;
      for(let j=a;j<=b;j++){const d=Math.hypot(orig[2*j]-jx,orig[2*j+1]-jy);if(d<bd){bd=d;bj=j;}}if(bj<0||bj===i)continue;if(bj<i&&bj>lo)lo=bj;if(bj>i&&bj<hi)hi=bj;}
    return[lo,hi];};
  // how each end of the stretch is held: partway along the line, or where other lines end too (the point of a
  // V), it stays exactly where it is; an end that rests on another line slides along the copy to meet that
  // line again; a loose end goes where the copy puts it
  const hold=(e,isEnd)=>{if(!isEnd)return{pin:true};const ex=orig[2*e],ey=orig[2*e+1];let onLine=-1;
    for(let s=0;s<n;s++){if(s===T.ts)continue;const sa=offs[s],sb=offs[s+1];if(sb-sa<2)continue;
      for(const e2 of[sa,sb-1])if(Math.hypot(orig[2*e2]-ex,orig[2*e2+1]-ey)<1.2*lw)return{pin:true};
      for(let j=sa+1;j<sb-1;j++)if(Math.hypot(orig[2*j]-ex,orig[2*j+1]-ey)<1.2*lw){onLine=s;break;}}
    return onLine>=0?{on:onLine}:{};};
  // (an end resting on another line: carried on, or cut back, along its own direction to meet that line)
  const meetLine=(Q,s)=>{const E=Q[Q.length-1];let k=Q.length-2;while(k>0&&Math.hypot(Q[k][0]-E[0],Q[k][1]-E[1])<2*lw)k--;
    const dx=E[0]-Q[k][0],dy=E[1]-Q[k][1],dl=Math.hypot(dx,dy);if(dl<1e-6)return Q;let len=0;for(let i=1;i<Q.length;i++)len+=Math.hypot(Q[i][0]-Q[i-1][0],Q[i][1]-Q[i-1][1]);const reach=Math.max(8*lw,0.45*len);const u=[dx/dl,dy/dl];let best=null;
    for(let j=offs[s];j+1<offs[s+1];j++){const ax=P[2*j],ay=P[2*j+1],ex=P[2*j+2]-ax,ey=P[2*j+3]-ay,den=u[0]*ey-u[1]*ex;if(Math.abs(den)<1e-9)continue;
      const t=((ax-E[0])*ey-(ay-E[1])*ex)/den,r=((ax-E[0])*u[1]-(ay-E[1])*u[0])/den;if(r<0||r>1||Math.abs(t)>reach)continue;if(!best||Math.abs(t)<Math.abs(best[0]))best=[t,[E[0]+t*u[0],E[1]+t*u[1]]];}
    if(!best)return Q;const[t,X]=best;if(t>=0)return[...Q,X];
    const R=Q.slice();let cut=-t;while(R.length>2){const l=Math.hypot(R[R.length-1][0]-R[R.length-2][0],R[R.length-1][1]-R[R.length-2][1]);if(l>cut)break;cut-=l;R.pop();}R[R.length-1]=X;return R;};
  // (laid back onto a stretch's own points j0..j1, evenly along its length)
  const layBack=(j0,j1,Q)=>{const LQ=[0];for(let k=1;k<Q.length;k++)LQ.push(LQ[k-1]+Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]));const totQ=LQ[LQ.length-1]||1;
    for(let j=j0,k=1;j<=j1;j++){const d=(j-j0)/(j1-j0)*totQ;while(k<Q.length-1&&LQ[k]<d)k++;const f=(d-LQ[k-1])/((LQ[k]-LQ[k-1])||1);
      P[2*j]=Q[k-1][0]+(Q[k][0]-Q[k-1][0])*f;P[2*j+1]=Q[k-1][1]+(Q[k][1]-Q[k-1][1])*f;}};
  // lines that end on the changed stretch stay on it
  const follow=(ts,i0,i1,moved)=>{
  for(let s=0;s<n;s++){if(s===ts)continue;const sa=offs[s],sb=offs[s+1];if(sb-sa<2)continue;
    for(const e of[sa,sb-1]){let best=-1,bd=0.8*lw;for(let j=i0+1;j<i1;j++){const d=Math.hypot(orig[2*j]-orig[2*e],orig[2*j+1]-orig[2*e+1]);if(d<bd){bd=d;best=j;}}
      if(best<0)continue;const ux=P[2*best]-orig[2*best],uy=P[2*best+1]-orig[2*best+1];if(Math.hypot(ux,uy)<0.05)continue;
      {const F=[];for(let j=sa;j<sb;j++)F.push([P[2*j],P[2*j+1]]);if(e===sa)F.reverse();const G=meetLine(F,ts);
        if(G!==F){layBack(sa,sb-1,e===sa?G.reverse():G);moved.add(s);continue;}}
      const L=[0];for(let j=sa+1;j<sb;j++)L.push(L[j-sa-1]+Math.hypot(P[2*j]-P[2*j-2],P[2*j+1]-P[2*j-1]));const tot=L[L.length-1],reach=Math.min(14*lw,0.6*tot),s0e=L[e-sa];
      for(let j=sa;j<sb;j++){const w=1-smooth01(Math.abs(L[j-sa]-s0e)/reach);if(w>0){P[2*j]+=ux*w;P[2*j+1]+=uy*w;}}moved.add(s);}}
  };
  const T={ts:-1};return{orig,piece,hold,meetLine,layBack,follow,T};}
function applyOneMirror(P,offs,m){const n=offs.length-1,lw=Math.max(2,widthIn()*S.workPPI),moved=new Set();
  const cx=patternMidX(),[tx,ty]=outPos(...srcToWork(m.sx,m.sy)),[qx,qy]=outPos(...srcToWork(m.msx,m.msy));
  const near=(x,y,lim)=>{let bs=-1,bi=-1,bd=lim;for(let s=0;s<n;s++)for(let j=offs[s];j<offs[s+1];j++){const d=Math.hypot(P[2*j]-x,P[2*j+1]-y);if(d<bd){bd=d;bs=s;bi=j;}}return[bs,bi];};
  const[ts,ti]=near(tx,ty,3*lw),[ss,si]=near(qx,qy,3*lw);if(ts<0||ss<0)return moved;
  const K=stretchTools(P,offs,lw),{orig,piece,hold,meetLine,layBack,follow}=K;K.T.ts=ts;
  const[i0,i1]=piece(ts,ti),[k0,k1]=piece(ss,si);if(i1-i0<3||k1-k0<2||(ts===ss&&!(k1<i0||k0>i1)))return moved;
  // the line to copy, flipped across the centre, running the same way as the line to change
  let C=[];for(let j=k0;j<=k1;j++)C.push([2*cx-orig[2*j],orig[2*j+1]]);
  const dd=(p,j)=>Math.hypot(p[0]-orig[2*j],p[1]-orig[2*j+1]);if(dd(C[0],i0)+dd(C[C.length-1],i1)>dd(C[C.length-1],i0)+dd(C[0],i1))C.reverse();
  const a=offs[ts],b=offs[ts+1];
  const LC=[0];for(let k=1;k<C.length;k++)LC.push(LC[k-1]+Math.hypot(C[k][0]-C[k-1][0],C[k][1]-C[k-1][1]));const totC=LC[LC.length-1];if(totC<1)return moved;
  const h0=hold(i0,i0===a),h1=hold(i1,i1===b-1);
  const s0=[P[2*i0],P[2*i0+1]],s1=[P[2*i1],P[2*i1+1]],c0=C[0],c1=C[C.length-1];
  const d0=h0.pin?[s0[0]-c0[0],s0[1]-c0[1]]:[0,0],d1=h1.pin?[s1[0]-c1[0],s1[1]-c1[1]]:[0,0];
  let Q=C.map((c,k)=>{const t=LC[k]/totC;return[c[0]+d0[0]*(1-t)+d1[0]*t,c[1]+d0[1]*(1-t)+d1[1]*t];});
  if(h1.on!=null)Q=meetLine(Q,h1.on);if(h0.on!=null)Q=meetLine(Q.slice().reverse(),h0.on).reverse();
  layBack(i0,i1,Q);moved.add(ts);
  follow(ts,i0,i1,moved);
  return moved;}
// ---- smoothing or straightening one stretch of a line ----
// The stretch between the line's joints is redrawn as one even curve (or a ruler-straight line) between the same
// two ends; lines that end on it stay on it.
function applyOneSmooth(P,offs,m){const n=offs.length-1,lw=Math.max(2,widthIn()*S.workPPI),moved=new Set();const[tx,ty]=outPos(...srcToWork(m.sx,m.sy));
  let ts=-1,ti=-1,bd=3*lw;for(let s=0;s<n;s++)for(let j=offs[s];j<offs[s+1];j++){const d=Math.hypot(P[2*j]-tx,P[2*j+1]-ty);if(d<bd){bd=d;ts=s;ti=j;}}if(ts<0)return moved;
  const K=stretchTools(P,offs,lw);K.T.ts=ts;const[i0,i1]=K.piece(ts,ti);if(i1-i0<3)return moved;
  let A=[P[2*i0],P[2*i0+1]],B=[P[2*i1],P[2*i1+1]],Q;
  // (a whole closed loop with no joint on it has no two ends to run between: left as it is)
  if(Math.hypot(A[0]-B[0],A[1]-B[1])<lw)return moved;
  // (an end that rests on another line close to that line's point, as at the bottom of a V, goes to the point)
  const toTip=(E,on)=>{const a=offs[on],b=offs[on+1];if(b-a<5)return E;const L=[0];for(let j=a+1;j<b;j++)L.push(L[L.length-1]+Math.hypot(P[2*j]-P[2*j-2],P[2*j+1]-P[2*j-1]));
    let jn=a,dn=Infinity;for(let j=a;j<b;j++){const d=Math.hypot(P[2*j]-E[0],P[2*j+1]-E[1]);if(d<dn){dn=d;jn=j;}}
    const at=(l)=>{let j=a;while(j<b-1&&L[j-a+1]<l)j++;return j;},h=2*lw;let best=null,bt=Math.sin(45*Math.PI/180);
    for(let j=a;j<b;j++){if(Math.abs(L[j-a]-L[jn-a])>10*lw||L[j-a]<h||L[j-a]>L[b-a-1]-h)continue;const p=at(L[j-a]-h),q=at(L[j-a]+h);
      const ux=P[2*j]-P[2*p],uy=P[2*j+1]-P[2*p+1],vx=P[2*q]-P[2*j],vy=P[2*q+1]-P[2*j+1],nu=Math.hypot(ux,uy),nv=Math.hypot(vx,vy);if(nu<1e-6||nv<1e-6)continue;
      const c=(ux*vx+uy*vy)/(nu*nv),turn=Math.sqrt(Math.max(0,1-Math.min(1,c)*Math.min(1,c)))*(c<0?1:1)+(c<0?1:0);if(turn>bt){bt=turn;best=[P[2*j],P[2*j+1]];}}
    return best||E;};
  {const h0=K.hold(i0,i0===offs[ts]),h1=K.hold(i1,i1===offs[ts+1]-1);if(h0.on!=null)A=toTip(A,h0.on);if(h1.on!=null)B=toTip(B,h1.on);}
  if(m.mode==='straight'){const N=Math.max(2,i1-i0);Q=[];for(let k=0;k<=N;k++)Q.push([A[0]+(B[0]-A[0])*k/N,A[1]+(B[1]-A[1])*k/N]);}
  else{// (one cubic curve through both ends, its two middle handles fitted to the line by least squares)
    const L=[0];for(let j=i0+1;j<=i1;j++)L.push(L[L.length-1]+Math.hypot(P[2*j]-P[2*j-2],P[2*j+1]-P[2*j-1]));const tot=L[L.length-1]||1;
    let a11=0,a12=0,a22=0,rx1=0,ry1=0,rx2=0,ry2=0;
    const dA=[A[0]-P[2*i0],A[1]-P[2*i0+1]],dB=[B[0]-P[2*i1],B[1]-P[2*i1+1]];
    for(let j=i0;j<=i1;j++){const t=L[j-i0]/tot,u=1-t,b0=u*u*u,b1=3*u*u*t,b2=3*u*t*t,b3=t*t*t,px=P[2*j]+u*dA[0]+t*dB[0]-b0*A[0]-b3*B[0],py=P[2*j+1]+u*dA[1]+t*dB[1]-b0*A[1]-b3*B[1];
      a11+=b1*b1;a12+=b1*b2;a22+=b2*b2;rx1+=b1*px;ry1+=b1*py;rx2+=b2*px;ry2+=b2*py;}
    const det=a11*a22-a12*a12;if(Math.abs(det)<1e-9)return moved;
    const C1=[(a22*rx1-a12*rx2)/det,(a22*ry1-a12*ry2)/det],C2=[(a11*rx2-a12*rx1)/det,(a11*ry2-a12*ry1)/det],N=Math.max(8,2*(i1-i0));Q=[];
    for(let k=0;k<=N;k++){const t=k/N,u=1-t,b0=u*u*u,b1=3*u*u*t,b2=3*u*t*t,b3=t*t*t;Q.push([b0*A[0]+b1*C1[0]+b2*C2[0]+b3*B[0],b0*A[1]+b1*C1[1]+b2*C2[1]+b3*B[1]]);}}
  K.layBack(i0,i1,Q);moved.add(ts);K.follow(ts,i0,i1,moved);return moved;}
// ---- rounding a corner ----
// A sharp corner, in one line or where two lines end together, is replaced by an even curve that leaves each
// side the chosen distance back from the point (small, medium or large: 2, 4 or 8 line widths).
const FILLET={small:2,medium:4,large:8};
function applyOneFillet(P,offs,m){const n=offs.length-1,lw=Math.max(2,widthIn()*S.workPPI),moved=new Set(),[tx,ty]=outPos(...srcToWork(m.sx,m.sy)),R0=(FILLET[m.size]||4)*lw;
  const arcFrom=(s,e,dir)=>{const a=offs[s],b=offs[s+1],out=[];let L=0;for(let j=e;j>=a&&j<b;j+=dir){if(j!==e)L+=Math.hypot(P[2*j]-P[2*(j-dir)],P[2*j+1]-P[2*(j-dir)+1]);out.push([j,L]);}return out;};
  // the two sides of the corner, each a run of [index, distance from the corner] going away from it
  let sides=null;
  {const ends=[];for(let s=0;s<n;s++){const a=offs[s],b=offs[s+1];if(b-a<3)continue;for(const e of[a,b-1])if(Math.hypot(P[2*e]-tx,P[2*e+1]-ty)<1.5*lw)ends.push([s,e,e===a?1:-1]);}
    if(ends.length===2&&(ends[0][0]!==ends[1][0]||ends[0][1]!==ends[1][1]))sides=ends.map(([s,e,d])=>({s,run:arcFrom(s,e,d)}));}
  // (only a real corner: the line turns at least 30 degrees there)
  if(!sides){let bs=-1,bi=-1,bt=1-Math.cos(30*Math.PI/180);const lim=3*lw;
    for(let s=0;s<n;s++){const a=offs[s],b=offs[s+1];for(let j=a+1;j<b-1;j++){if(Math.hypot(P[2*j]-tx,P[2*j+1]-ty)>lim)continue;
      const f=arcFrom(s,j,-1).find(q=>q[1]>=lw),g=arcFrom(s,j,1).find(q=>q[1]>=lw);if(!f||!g)continue;
      const ux=P[2*j]-P[2*f[0]],uy=P[2*j+1]-P[2*f[0]+1],vx=P[2*g[0]]-P[2*j],vy=P[2*g[0]+1]-P[2*j+1],c=(ux*vx+uy*vy)/((Math.hypot(ux,uy)*Math.hypot(vx,vy))||1),t=1-c;if(t>bt){bt=t;bs=s;bi=j;}}}
    if(bs<0)return moved;sides=[{s:bs,run:arcFrom(bs,bi,-1)},{s:bs,run:arcFrom(bs,bi,1)}];}
  const C=[(P[2*sides[0].run[0][0]]+P[2*sides[1].run[0][0]])/2,(P[2*sides[0].run[0][0]+1]+P[2*sides[1].run[0][0]+1])/2];
  const R=Math.min(R0,...sides.map(q=>0.45*q.run[q.run.length-1][1]));if(R<lw)return moved;
  const at=run=>{for(let k=1;k<run.length;k++)if(run[k][1]>=R){const[j0,l0]=run[k-1],[j1,l1]=run[k],f=(R-l0)/((l1-l0)||1);return[P[2*j0]+(P[2*j1]-P[2*j0])*f,P[2*j0+1]+(P[2*j1+1]-P[2*j0+1])*f];}};
  const A=at(sides[0].run),B=at(sides[1].run);if(!A||!B)return moved;
  const bz=u=>[(1-u)*(1-u)*A[0]+2*u*(1-u)*C[0]+u*u*B[0],(1-u)*(1-u)*A[1]+2*u*(1-u)*C[1]+u*u*B[1]];
  sides.forEach((sd,k)=>{for(const[j,l]of sd.run){if(l>=R)break;const u=k===0?0.5*(1-l/R):1-0.5*(1-l/R),q=bz(u);P[2*j]=q[0];P[2*j+1]=q[1];}moved.add(sd.s);});
  return moved;}
// ---- mirroring an area ----
// An area fix is a box, kept as two corners in the source picture's pixels. The worker replaces the picture
// inside it with the matching spot on the other side of the pattern's centre line, flipped, and traces it all
// afresh (see 03-process.js).
function areaWorkBox(f){const c=[[f.x0,f.y0],[f.x1,f.y0],[f.x0,f.y1],[f.x1,f.y1]].map(([x,y])=>outPos(...srcToWork(x,y)));
  return[Math.min(...c.map(q=>q[0])),Math.min(...c.map(q=>q[1])),Math.max(...c.map(q=>q[0])),Math.max(...c.map(q=>q[1]))];}
// (the corners of the spot an area copies from, on the page: its box flipped across the centre line the worker
// used for it, then moved by however far the person dragged it)
function areaSrcPoly(f,i){const geo=pageGeom(),c=[[f.x0,f.y0],[f.x1,f.y0],[f.x1,f.y1],[f.x0,f.y1]].map(([x,y])=>srcToWork(x,y)),ox=(f.ox||0)*S.sx,oy=(f.oy||0)*S.sy;
  const A=S.axes&&S.axes.areas&&S.axes.areas[i]&&!(Math.hypot(ox,oy)>0.5)?S.axes.areas[i]:S.axes&&S.axes[f.flip==='tb'?'tb':'lr'];
  if(A)return c.map(([x,y])=>{const dx=x-A.cx,dy=y-A.cy,k=2*(dx*A.u[0]+dy*A.u[1]),q=outPos(A.cx+k*A.u[0]-dx+ox,A.cy+k*A.u[1]-dy+oy);return geo.map(q[0],q[1]);});
  const mf=mirrorFn(f.flip),o=rotVec(ox,oy);return c.map(([x,y])=>{const q=mf(...outPos(x,y));return geo.map(q[0]+o[0],q[1]+o[1]);});}
function inPoly(poly,x,y){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[d,e]=poly[j];if((b>y)!==(e>y)&&x<(d-a)*(y-b)/(e-b)+a)c=!c;}return c;}
function gripAt(poly){return[poly.reduce((t,q)=>t+q[0],0)/poly.length,poly.reduce((t,q)=>t+q[1],0)/poly.length];}
function areaPageBox(f){const geo=pageGeom(),b=areaWorkBox(f),p=geo.map(b[0],b[1]),q=geo.map(b[2],b[3]);return[Math.min(p[0],q[0]),Math.min(p[1],q[1]),Math.max(p[0],q[0]),Math.max(p[1],q[1])];}
function applyDrags(extra){if(!S.rawStrokes)return S.rawStrokes;const B={P:S.rawStrokes};S.offs=S.rawOffs;S.hw=S.rawHw;S.fill=S.rawFill;S.fcurve=S.rawFcurve;const ds=S.fixes.filter(f=>PAGE_FIX.has(f.mode));if(extra)ds.push(extra);if(!ds.length)return B.P;
  const P=Float32Array.from(B.P);for(const d of ds){if(d.mode==='mirror')applyOneMirror(P,S.offs,d);else if(d.mode==='smooth'||d.mode==='straight')applyOneSmooth(P,S.offs,d);else if(d.mode==='fillet')applyOneFillet(P,S.offs,d);else if(d.mode==='drag')applyOneDrag(P,S.offs,d);}return removeLines(P,ds.filter(d=>d.mode==='remove'));}
// (lines taken out: the stretch between two joints, or a whole ring, that each Remove fix points at. Done last,
// on the lines as every other fix left them; the strokes either side of a removed stretch carry on as lines of
// their own)
function removeLines(P,rm){if(!rm.length)return P;const o=S.offs,n=o.length-1,lw=Math.max(2,widthIn()*S.workPPI),K=stretchTools(P,o,lw),cut=[];
  for(const f of rm){const[tx,ty]=outPos(...srcToWork(f.sx,f.sy));let bs=-1,bi=-1,bd=3*lw;
    for(let s=0;s<n;s++)for(let i=o[s];i<o[s+1];i++){const d=Math.hypot(P[2*i]-tx,P[2*i+1]-ty);if(d<bd){bd=d;bs=s;bi=i;}}
    if(bs<0)continue;const[lo,hi]=K.piece(bs,bi);cut.push([bs,lo,hi]);}
  if(!cut.length)return P;
  const drop=new Uint8Array(P.length/2);for(const[,lo,hi]of cut)for(let i=lo+1;i<hi;i++)drop[i]=1;
  // (a stretch's own two end points belong to the joints there, unless the whole line goes)
  for(const[s,lo,hi]of cut)if(lo===o[s]&&hi===o[s+1]-1){drop[lo]=1;drop[hi]=1;}
  const NP=[],NH=[],NO=[0],H=S.hw;
  for(let s=0;s<n;s++){let run=[];const flush=()=>{if(run.length>=2){for(const i of run){NP.push(P[2*i],P[2*i+1]);NH.push(H?H[i]:0);}NO.push(NP.length/2);}run=[];};
    for(let i=o[s];i<o[s+1];i++){if(drop[i]){flush();continue;}
      // (a removed stretch's end point stays on both sides' strokes: it is the joint)
      run.push(i);const nxtGone=i+1<o[s+1]&&drop[i+1]&&cut.some(([cs,lo])=>cs===s&&lo===i);if(nxtGone){flush();}}
    flush();}
  S.offs=Int32Array.from(NO);S.hw=Float32Array.from(NH);return Float32Array.from(NP);}
function redrawDrags(){if(!S.rawStrokes)return;S.strokes=applyDrags();ptsCache=null;markBorder();render();drawFixLayer();}
// pointer handling on the layer: a press that doesn't move is a click (menus); one that moves is a drag
var press=null;
function layerPoint(e){const L=$('fixLayer'),r=L.getBoundingClientRect(),sc=layerScale(),img=$('view');
  const offx=(r.width-img.naturalWidth*sc)/2,offy=(r.height-img.naturalHeight*sc)/2;return[(e.clientX-r.left-offx)/sc,(e.clientY-r.top-offy)/sc];}
$('fixLayer').addEventListener('pointerdown',e=>{if(e.button!==0)return;const[px,py]=layerPoint(e),sc=layerScale();
  // (while Tidy all lines is showing its changes, a press only leaves a line out or puts it back; nothing is dragged)
  if(S.tidy){const c=tidyAt(px,py,12/sc);if(c){c.on=!c.on;drawFixLayer();tidyMenu();}return;}
  if(S.symPending){const ln=symLine(S.symPending);if(ln){const dx=ln.b[0]-ln.a[0],dy=ln.b[1]-ln.a[1],dd=Math.abs((px-ln.a[0])*dy-(py-ln.a[1])*dx)/(Math.hypot(dx,dy)||1);
      if(dd<14/sc||Math.hypot(ln.mid[0]-px,ln.mid[1]-py)<16/sc){closeFixPop();press={sym:true,px,py,x0:e.clientX,y0:e.clientY,off:0,dragging:false};$('fixLayer').setPointerCapture(e.pointerId);return;}}
    return;}
  if(S.areaPending){const f=S.areaPending,poly=areaSrcPoly(f,-1),g=gripAt(poly);if(inPoly(poly,px,py)||Math.hypot(g[0]-px,g[1]-py)<14/sc){closeFixPop();
      press={grip:f,pending:true,px,py,x0:e.clientX,y0:e.clientY,d:[0,0],dragging:false};$('fixLayer').setPointerCapture(e.pointerId);return;}}
  if(S.drawMode){closeFixPop();S.drawLine={a:snapEnd(px,py),b:null};press={draw:true,x0:e.clientX,y0:e.clientY};$('fixLayer').setPointerCapture(e.pointerId);return;}
  if(S.areaMode){if(S.areaPending)cancelPending();closeFixPop();press={area:true,px,py,x0:e.clientX,y0:e.clientY,dragging:false};$('fixLayer').setPointerCapture(e.pointerId);return;}
  {const af=S.fixes.filter(f=>f.mode==='area');for(let i=0;i<af.length;i++){const g=gripAt(areaSrcPoly(af[i],i));if(Math.hypot(g[0]-px,g[1]-py)<14/sc){closeFixPop();
      press={grip:af[i],px,py,x0:e.clientX,y0:e.clientY,d:[0,0],dragging:false};$('fixLayer').setPointerCapture(e.pointerId);return;}}}
  // (a drag takes a joint, and all the lines meeting there, only when it starts right on its dot; otherwise the line)
  let j=-1,bd=7/sc;S.junctions.forEach((J,i)=>{const p=jPage(J);const d=Math.hypot(p[0]-px,p[1]-py);if(d<bd){bd=d;j=i;}});
  let q=j<0?nearestStroke(px,py,12/sc):null;if(j<0&&!q){bd=12/sc;S.junctions.forEach((J,i)=>{const p=jPage(J);const d=Math.hypot(p[0]-px,p[1]-py);if(d<bd){bd=d;j=i;}});}
  press={px,py,x0:e.clientX,y0:e.clientY,j,q,dragging:false};$('fixLayer').setPointerCapture(e.pointerId);});
// (in box mode the box can start anywhere on the mat, including outside the picture; it is cut to the picture)
$('mat').addEventListener('pointerdown',e=>{if(press||!S.areaMode||e.button!==0||!S.fixMode||$('fixLayer').contains(e.target)||$('fixPop').contains(e.target))return;
  const[px,py]=layerPoint(e);closeFixPop();press={area:true,px,py,x0:e.clientX,y0:e.clientY,dragging:false};try{$('fixLayer').setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();});
// where the lines at a junction really meet (the program's junction point can sit a little off them)
function junctionMeet(J){const geo=pageGeom(),c=jPage(J),lw=Math.max(2,widthIn()*S.workPPI)*geo.k,pts=S.strokes,offs=S.offs,E=[];
  for(let s=0;s+1<offs.length;s++){if(offs[s+1]-offs[s]<2)continue;for(const e of[offs[s],offs[s+1]-1]){const p=geo.map(pts[2*e],pts[2*e+1]);if(Math.hypot(p[0]-c[0],p[1]-c[1])<2.5*lw)E.push(p);}}
  if(E.length)return[E.reduce((t,p)=>t+p[0],0)/E.length,E.reduce((t,p)=>t+p[1],0)/E.length];
  return nearestStroke(c[0],c[1],3*lw)||c;}
function pressDrag(e){const[px,py]=layerPoint(e),geo=pageGeom();if(press.j>=0&&!press.at)press.at=junctionMeet(S.junctions[press.j]);const at=press.j>=0?press.at:press.q;
  const[wx,wy]=pageToWorkInternal(at[0],at[1]);const[sx,sy]=workToSrc(wx,wy);
  const[ox,oy]=unrotVec((px-press.px)/geo.k,(py-press.py)/geo.k);
  return{mode:'drag',sx,sy,dx:ox/S.sx,dy:oy/S.sy,r:reachWork()/S.sx,j:press.j>=0,whole:press.j<0&&$('fixReach').value==='line'};}
// (the box being drawn, and the matching box on the other side that it will copy from)
function areaPreview(px,py){const k=1/layerScale(),geo=pageGeom(),img=$('view'),cx=v=>Math.max(0,Math.min(img.naturalWidth,v)),cy=v=>Math.max(0,Math.min(img.naturalHeight,v)),b=[cx(Math.min(press.px,px)),cy(Math.min(press.py,py)),cx(Math.max(press.px,px)),cy(Math.max(press.py,py))];
  const mf=mirrorFn(S.areaFlip),corners=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]].map(([x,y])=>{const o=outPos(...pageToWorkInternal(x,y)),q=mf(o[0],o[1]);return geo.map(q[0],q[1]);});
  return`<rect class="area" x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" style="stroke-width:${2*k}px"/>`+
    `<polygon class="area src" points="${corners.map(q=>q[0]+','+q[1]).join(' ')}" style="stroke-width:${2*k}px;stroke-dasharray:${6*k} ${4*k}"/>`+seamDots(b,k);}
// (where lines cross the edge of the box: green where the copy will line up with the line outside, red where the
// two sides draw it apart or only one side has it, so the edge is better moved)
function seamDots(b,k,f,d){if(!S.strokes||!S.offs)return'';const geo=pageGeom(),lw=Math.max(2,widthIn()*S.workPPI);
  // (copy-from: the box flipped across the centre line, then moved by however far its dashed box was dragged)
  let mf=mirrorFn(f?f.flip:S.areaFlip);if(f){const o=rotVec((f.ox||0)*S.sx+unrotVec((d||[0,0])[0]/geo.k,(d||[0,0])[1]/geo.k)[0],(f.oy||0)*S.sy+unrotVec((d||[0,0])[0]/geo.k,(d||[0,0])[1]/geo.k)[1]),m0=mf;mf=(x,y)=>{const q=m0(x,y);return[q[0]+o[0],q[1]+o[1]];};}
  const c=[[b[0],b[1]],[b[2],b[3]]].map(([x,y])=>outPos(...pageToWorkInternal(x,y)));
  const T=[Math.min(c[0][0],c[1][0]),Math.min(c[0][1],c[1][1]),Math.max(c[0][0],c[1][0]),Math.max(c[0][1],c[1][1])],mc=[[T[0],T[1]],[T[2],T[3]],[T[0],T[3]],[T[2],T[1]]].map(([x,y])=>mf(x,y)),
    M=[Math.min(...mc.map(q=>q[0])),Math.min(...mc.map(q=>q[1])),Math.max(...mc.map(q=>q[0])),Math.max(...mc.map(q=>q[1]))];
  const inB=(x,y,q)=>x>q[0]&&x<q[2]&&y>q[1]&&y<q[3];
  const crossings=(q,flip)=>{const out=[],P=S.strokes,o=S.offs;for(let s=0;s+1<o.length;s++)for(let j=o[s];j+1<o[s+1];j++){const ax=P[2*j],ay=P[2*j+1],bx=P[2*j+2],by=P[2*j+3];
      if(inB(ax,ay,q)===inB(bx,by,q))continue;let lo=0,hi=1;const ia=inB(ax,ay,q);for(let t=0;t<20;t++){const mid=(lo+hi)/2;if(inB(ax+(bx-ax)*mid,ay+(by-ay)*mid,q)===ia)lo=mid;else hi=mid;}
      const x=ax+(bx-ax)*lo,y=ay+(by-ay)*lo;out.push(flip?mf(x,y):[x,y]);}return out;};
  const mine=crossings(T,false),theirs=crossings(M,true);let h='';
  const dot=(p,good)=>{const q=geo.map(p[0],p[1]);h+=`<circle class="seam ${good?'ok':'bad'}" cx="${q[0]}" cy="${q[1]}" r="${5*k}" style="stroke-width:${1.5*k}px"/>`;};
  const used=new Set();
  for(const p of mine){let bi=-1,bd=Infinity;theirs.forEach((q,i)=>{const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<bd){bd=d;bi=i;}});if(bd<3*lw)used.add(bi);dot(p,bd<0.8*lw);}
  theirs.forEach((q,i)=>{if(!used.has(i))dot(q,false);});
  return h;}
// (hovering shows what a click or drag will take: the dot of a joint, or the one stretch of line between its joints)
let hoverRaf=0;
function showHover(px,py){const L=$('fixLayer'),old=L.querySelector('#hoverMark');if(old)old.remove();if(!S.fixMode||S.areaMode||S.drawMode||!S.strokes||press)return;
  const sc=layerScale(),k=1/sc,geo=pageGeom();let h='';
  let bj=-1,bd=7/sc;S.junctions.forEach((J,i)=>{const p=jPage(J);const d=Math.hypot(p[0]-px,p[1]-py);if(d<bd){bd=d;bj=i;}});
  if(bj>=0){const p=jPage(S.junctions[bj]);h=`<circle cx="${p[0]}" cy="${p[1]}" r="${11*k}" fill="none" stroke="var(--fix)" stroke-width="${3*k}"/>`;}
  else{const P=S.strokes,o=S.offs,lim=12/sc;let bs=-1,bi=-1,bb=Infinity;
    for(let s=0;s+1<o.length;s++)for(let j=o[s];j<o[s+1];j++){const q=geo.map(P[2*j],P[2*j+1]),d=Math.hypot(q[0]-px,q[1]-py);if(d<bb){bb=d;bs=s;bi=j;}}
    if(bs>=0&&bb<lim){const lw=Math.max(2,widthIn()*S.workPPI),[i0,i1]=stretchTools(P,o,lw).piece(bs,bi);let d='';
      for(let j=i0;j<=i1;j++){const q=geo.map(P[2*j],P[2*j+1]);d+=(j===i0?'M':'L')+q[0].toFixed(1)+','+q[1].toFixed(1);}
      h=`<path d="${d}" fill="none" stroke="var(--fix)" stroke-width="${7*k}" stroke-linecap="round" opacity=".45"/>`;}}
  if(h)L.insertAdjacentHTML('beforeend',`<g id="hoverMark" pointer-events="none">${h}</g>`);}
$('fixLayer').addEventListener('pointerleave',()=>{const m=$('fixLayer').querySelector('#hoverMark');if(m)m.remove();});
$('fixLayer').addEventListener('pointermove',e=>{if(!press){if(e.pointerType==='mouse'){const[px,py]=layerPoint(e);cancelAnimationFrame(hoverRaf);hoverRaf=requestAnimationFrame(()=>showHover(px,py));}return;}
  if(press.sym){const[px,py]=layerPoint(e),geo=pageGeom(),A=symAxisOf(S.symPending);if(!A)return;const[wx,wy]=unrotVec((px-press.px)/geo.k,(py-press.py)/geo.k);
    press.off=wx*A.u[1]-wy*A.u[0];press.dragging=true;drawFixLayer();return;}
  if(press.draw){const[px,py]=layerPoint(e);S.drawLine.b=snapEnd(px,py);drawFixLayer();return;}
  if(press.grip){const[px,py]=layerPoint(e);press.d=[px-press.px,py-press.py];if(Math.hypot(e.clientX-press.x0,e.clientY-press.y0)>=3)press.dragging=true;drawFixLayer();return;}
  if(press.area){if(Math.hypot(e.clientX-press.x0,e.clientY-press.y0)>=5)press.dragging=true;if(!press.dragging)return;const[px,py]=layerPoint(e);drawFixLayer();$('fixLayer').insertAdjacentHTML('beforeend',areaPreview(px,py));return;}
  if(!press.dragging){if(Math.hypot(e.clientX-press.x0,e.clientY-press.y0)<5||(press.j<0&&!press.q))return;press.dragging=true;closeFixPop();}
  const d=pressDrag(e),P=applyDrags(d),geo=pageGeom(),k=1/layerScale();
  // preview: the lines that this drag moves, drawn over the picture
  const Q=Float32Array.from(applyDrags()),moved=applyOneDrag(Q,S.offs,d);let h='';
  for(const s of moved){let pth='';for(let j=S.offs[s];j<S.offs[s+1];j++){const p=geo.map(P[2*j],P[2*j+1]);pth+=(j===S.offs[s]?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1);}
    h+=`<path d="${pth}" fill="none" stroke="var(--fix)" stroke-width="${3*k}" stroke-linecap="round" opacity=".9"/>`;}
  drawFixLayer();$('fixLayer').insertAdjacentHTML('beforeend',h);});
$('fixLayer').addEventListener('pointerup',e=>{if(!press)return;const p=press;
  if(p.draw){press=null;const d=S.drawLine;S.drawLine=null;if(!d||!d.b||Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])<10/layerScale()){drawFixLayer();return;}
    const[ax,ay]=workToSrc(...pageToWorkInternal(d.a[0],d.a[1])),[bx,by]=workToSrc(...pageToWorkInternal(d.b[0],d.b[1]));changeFixes(()=>S.fixes.push({mode:'line',ax,ay,bx,by}));return;}
  if(p.sym){press=null;const hv=S.symPending;if(hv&&p.dragging)hv.off=(hv.off||0)+p.off/(hv.flip==='tb'?S.sy:S.sx);drawFixLayer();symMenu();return;}
  if(p.grip&&p.pending){press=null;const f=p.grip;if(p.dragging){const geo=pageGeom(),[wx,wy]=unrotVec(p.d[0]/geo.k,p.d[1]/geo.k);f.ox+=wx/S.sx;f.oy+=wy/S.sy;}drawFixLayer();pendingMenu();return;}
  if(p.grip){press=null;if(!p.dragging){drawFixLayer();return;}const geo=pageGeom(),[wx,wy]=unrotVec(p.d[0]/geo.k,p.d[1]/geo.k),f=p.grip;
    S.undo=S.undo||[];S.undo.push(JSON.stringify(S.fixes));if(S.undo.length>50)S.undo.shift();const before=JSON.parse(JSON.stringify(S.fixes));
    f.ox=(f.ox||0)+wx/S.sx;f.oy=(f.oy||0)+wy/S.sy;saveFixes();drawFixLayer();afterFixChange(before);return;}
  if(p.area){press=null;const img=$('view'),cl=(v,m)=>Math.max(0,Math.min(m,v)),q=layerPoint(e),sc=layerScale();p.px=cl(p.px,img.naturalWidth);p.py=cl(p.py,img.naturalHeight);const px=cl(q[0],img.naturalWidth),py=cl(q[1],img.naturalHeight);if(!p.dragging||Math.abs(px-p.px)<8/sc||Math.abs(py-p.py)<8/sc){drawFixLayer();return;}
    const c=[[Math.min(p.px,px),Math.min(p.py,py)],[Math.max(p.px,px),Math.max(p.py,py)]].map(([x,y])=>workToSrc(...pageToWorkInternal(x,y)));
    const f={mode:'area',x0:Math.min(c[0][0],c[1][0]),y0:Math.min(c[0][1],c[1][1]),x1:Math.max(c[0][0],c[1][0]),y1:Math.max(c[0][1],c[1][1]),flip:S.areaFlip==='tb'?'tb':'lr'};
    f.ox=0;f.oy=0;S.areaPending=f;drawFixLayer();pendingMenu();return;}
  if(!p.dragging){press=null;fixClick(p.px,p.py);return;}
  const d=pressDrag(e);press=null;if(Math.hypot(d.dx,d.dy)<0.3){drawFixLayer();return;}
  S.undo=S.undo||[];S.undo.push(JSON.stringify(S.fixes));if(S.undo.length>50)S.undo.shift();S.fixes.push(d);saveFixes();redrawDrags();});
$('fixLayer').addEventListener('pointercancel',()=>{press=null;drawFixLayer();});
// (a box just drawn waits here: its copy-from box can be dragged into place first, then it is applied)
function pendingMenu(){const f=S.areaPending;if(!f)return;const b=areaPageBox(f);
  openFixPop(`<h3>Mirror this area</h3><p>The dashed box is the spot it will copy from. Drag the dashed box to line it up with what you want copied, then apply. Your box stays put.</p><button data-act="apply">Apply the mirror</button><button data-act="cancel">Cancel</button>`,...(()=>{const g=gripAt(areaSrcPoly(f,-1)),right=g[0]>(b[0]+b[2])/2,down=g[1]>(b[1]+b[3])/2;
    // (the box opens on the side away from the dashed box, so it never covers it)
    return Math.abs(g[0]-(b[0]+b[2])/2)>=Math.abs(g[1]-(b[1]+b[3])/2)?(right?[b[0],b[1],true]:[b[2],b[1],false]):[b[2],down?b[1]:b[3],false];})());
  const pop=$('fixPop');pop.querySelector('[data-act="apply"]').onclick=applyPending;pop.querySelector('[data-act="cancel"]').onclick=cancelPending;pop.querySelector('.close').onclick=cancelPending;}
function applyPending(){const f=S.areaPending;if(!f)return;S.areaPending=null;$('fixPop').hidden=true;
  S.undo=S.undo||[];S.undo.push(JSON.stringify(S.fixes));if(S.undo.length>50)S.undo.shift();const before=S.fixes.slice();S.fixes.push(f);saveFixes();setAreaMode(false);afterFixChange(before);}
function cancelPending(){S.areaPending=null;$('fixPop').hidden=true;S.fixSel=null;drawFixLayer();}
// ---- making the whole pattern symmetric ----
// One half is replaced by the other, flipped across the drawing's centre line (found by the program where the lines
// on both sides best fall on each other). The line can be slid sideways before applying, if it is off the middle.
function symAxisOf(hv){const A=S.axes&&(hv.flip==='tb'?S.axes.inkTb:S.axes.inkLr);return A||null;}
function symLine(hv,extra){const A=symAxisOf(hv);if(!A)return null;const geo=pageGeom(),u=A.u,nv=[u[1],-u[0]],off=(hv.off||0)*(hv.flip==='tb'?S.sy:S.sx)+(extra||0);
  const c=[A.cx+nv[0]*off,A.cy+nv[1]*off],L=3*Math.max(S.work.w,S.work.h),P=v=>{const q=outPos(v[0],v[1]);return geo.map(q[0],q[1]);};
  const a=P([c[0]-u[0]*L,c[1]-u[1]*L]),b=P([c[0]+u[0]*L,c[1]+u[1]*L]),mid=P(c),side=-(hv.keep>0?1:-1);
  const sa=P([c[0]-u[0]*L+nv[0]*L*side,c[1]-u[1]*L+nv[1]*L*side]),sb=P([c[0]+u[0]*L+nv[0]*L*side,c[1]+u[1]*L+nv[1]*L*side]);
  return{a,b,mid,shade:[a,b,sb,sa],nv,u};}
const SYMCH=[['lr',-1,'Copy the left half onto the right'],['lr',1,'Copy the right half onto the left'],['tb',1,'Copy the top half onto the bottom'],['tb',-1,'Copy the bottom half onto the top']];
function symMenu(){const hv=S.symPending;if(!hv)return;const ln=symLine(hv);const had=S.fixes.some(f=>f.mode==='half');
  let h=`<h3>Make the pattern symmetric</h3><p>The shaded half is replaced by the other half, flipped across the dashed centre line. If the line isn't on the middle of the design, drag it sideways first.</p>`;
  for(const[fl,kp,t]of SYMCH)h+=`<button data-sym="${fl},${kp}" aria-pressed="${hv.flip===fl&&hv.keep===kp}">${t}</button>`;
  h+=`<div class="row"><button data-act="apply">Apply</button><button data-act="cancel">Cancel</button></div>`;
  if(had)h+=`<button data-act="remove">Remove the symmetry (back to the drawing as it was)</button>`;
  const img=$('view');const px=ln?ln.mid[0]:img.naturalWidth/2,py=ln?Math.min(ln.mid[1],img.naturalHeight*0.25):40;
  openFixPop(h,px+0.18*img.naturalWidth,py);const pop=$('fixPop');
  pop.querySelectorAll('[data-sym]').forEach(bt=>bt.onclick=()=>{const[fl,kp]=bt.dataset.sym.split(',');if(hv.flip!==fl)hv.off=0;hv.flip=fl;hv.keep=+kp;drawFixLayer();symMenu();});
  pop.querySelector('[data-act="apply"]').onclick=()=>{const f={mode:'half',flip:hv.flip,keep:hv.keep,off:hv.off||0};S.symPending=null;$('fixPop').hidden=true;
    S.undo=S.undo||[];S.undo.push(JSON.stringify(S.fixes));if(S.undo.length>50)S.undo.shift();const before=S.fixes.slice();S.fixes=S.fixes.filter(x=>x.mode!=='half');S.fixes.push(f);saveFixes();afterFixChange(before);};
  pop.querySelector('[data-act="cancel"]').onclick=cancelSym;pop.querySelector('.close').onclick=cancelSym;
  const rm=pop.querySelector('[data-act="remove"]');if(rm)rm.onclick=()=>{S.symPending=null;$('fixPop').hidden=true;S.undo=S.undo||[];S.undo.push(JSON.stringify(S.fixes));const before=S.fixes.slice();S.fixes=S.fixes.filter(x=>x.mode!=='half');saveFixes();afterFixChange(before);};}
function cancelSym(){S.symPending=null;S.wantInk=false;$('fixPop').hidden=true;drawFixLayer();}
function openSym(){if(!S.strokes)return;setAreaMode(false);if(S.drawMode)setDrawMode(false);closeFixPop();const cur=S.fixes.find(f=>f.mode==='half');S.symPending=cur?{flip:cur.flip,keep:cur.keep,off:cur.off||0}:{flip:'lr',keep:-1,off:0};
  if(!symAxisOf(S.symPending)){S.wantInk=true;S.symWaiting=true;setStatus('Finding the centre line…',true);schedule(run,0);return;}
  drawFixLayer();symMenu();}
$('fixSym').addEventListener('click',openSym);

// ---- tidying every line at once ----
// Each stretch of line between its joints is looked at: one that is nearly straight (it never strays more than
// about half a lead width from the ruler line between its ends) is straightened; one that is nearly one even
// curve (smoothing would move it a little, but less than a lead width) is smoothed. Lines with real shape to them
// are left alone, as are stretches already straightened or smoothed. Every change is shown first, in color, and
// any can be left out; the rest go in together as ordinary Straighten and Smooth fixes, so one Undo takes them out.
const TIDY={straight:0.6,minLen:6,smoothMin:0.12,smoothMax:0.7};
function tidyCandidates(){const P=S.strokes,o=S.offs,n=o.length-1,lw=Math.max(2,widthIn()*S.workPPI),geo=pageGeom(),K=stretchTools(P,o,lw),out=[];
  const have=new Set(S.fixes.filter(f=>f.mode==='smooth'||f.mode==='straight').map(f=>stretchAt(f.sx,f.sy)));
  for(let s=0;s<n;s++){const a=o[s],b=o[s+1]-1;if(b-a<6)continue;let i=a+1,guard=0;
    while(i<b&&guard++<500){const[lo,hi]=K.piece(s,i);i=Math.max(i+1,hi+1);if(hi-lo<6||have.has(s+':'+lo+':'+hi))continue;
      const A=[P[2*lo],P[2*lo+1]],B=[P[2*hi],P[2*hi+1]],L=Math.hypot(B[0]-A[0],B[1]-A[1]);if(L<2*lw)continue;
      let dev=0;for(let j=lo;j<=hi;j++){const d=Math.abs((B[0]-A[0])*(A[1]-P[2*j+1])-(A[0]-P[2*j])*(B[1]-A[1]))/L;if(d>dev)dev=d;}
      const mid=(lo+hi)>>1,[sx,sy]=workToSrc(...pageToWorkInternal(...geo.map(P[2*mid],P[2*mid+1])));
      const tryMode=mode=>{const T=Float32Array.from(P);if(!applyOneSmooth(T,o,{sx,sy,mode}).size)return null;let mv=0;for(let j=lo;j<=hi;j++)mv=Math.max(mv,Math.hypot(T[2*j]-P[2*j],T[2*j+1]-P[2*j+1]));
        const pts=[];for(let j=lo;j<=hi;j++)pts.push(geo.map(T[2*j],T[2*j+1]));return{mv,pts};};
      let pick=null;
      if(L>=TIDY.minLen*lw&&dev<=TIDY.straight*lw){if(dev>TIDY.smoothMin*lw){const r=tryMode('straight');if(r&&r.mv>TIDY.smoothMin*lw)pick={mode:'straight',...r};}}
      else{const r=tryMode('smooth');if(r&&r.mv>TIDY.smoothMin*lw&&r.mv<=TIDY.smoothMax*lw)pick={mode:'smooth',...r};}
      if(pick)out.push({sx,sy,mode:pick.mode,pts:pick.pts,on:true});}}
  return out;}
function tidyMarkup(k){if(!S.tidy)return'';let h='';for(const c of S.tidy){const d=c.pts.map((p,j)=>(j?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join('');
    h+=`<path class="tidy-line ${c.on?c.mode:'off'}" d="${d}" style="stroke-width:${(c.on?5:3)*k}px"/>`;}return h;}
function tidyAt(px,py,lim){let best=null,bd=lim;for(const c of S.tidy||[])for(const p of c.pts){const d=Math.hypot(p[0]-px,p[1]-py);if(d<bd){bd=d;best=c;}}return best;}
function tidyMenu(){const T=S.tidy,ns=T.filter(c=>c.on&&c.mode==='straight').length,nm=T.filter(c=>c.on&&c.mode==='smooth').length,off=T.filter(c=>!c.on).length;
  const keep=S.tidy;openFixPop(`<h3>Tidy all lines</h3><p><span class="tidy-key straight"></span>${ns} to straighten &nbsp; <span class="tidy-key smooth"></span>${nm} to smooth${off?` &nbsp; <span class="tidy-key off"></span>${off} left out`:''}</p><p>Click a colored line to leave it out, or click it again to put it back.</p><div class="row"><button data-act="apply" class="primary"${ns+nm?'':' disabled'}>Apply ${ns+nm} change${ns+nm===1?'':'s'}</button><button data-act="cancel">Cancel</button></div>`,24,24);S.tidy=keep;
  const pop=$('fixPop');pop.querySelector('[data-act="apply"]').onclick=applyTidy;pop.querySelector('[data-act="cancel"]').onclick=cancelTidy;
  pop.querySelector('.close').onclick=cancelTidy;}
function applyTidy(){const on=(S.tidy||[]).filter(c=>c.on);if(!on.length){cancelTidy();return;}changeFixes(()=>{for(const c of on)S.fixes.push({sx:c.sx,sy:c.sy,mode:c.mode});});setStatus('Tidied '+on.length+' line'+(on.length===1?'':'s'),true);}
function cancelTidy(){S.tidy=null;closeFixPop();drawFixLayer();setStatus('Tidy cancelled: nothing changed',false);}
$('fixTidy').addEventListener('click',()=>{if(!S.strokes)return;closeFixPop();setAreaMode(false);if(S.drawMode)setDrawMode(false);S.symPending=null;
  setStatus('Looking over every line…',true);setTimeout(()=>{const c=tidyCandidates();
    if(!c.length){setStatus('Nothing to tidy: every line is already straight, smooth, or shaped on purpose.',false);return;}
    S.tidy=c;drawFixLayer();tidyMenu();setStatus(c.length+' line'+(c.length===1?'':'s')+' to tidy: check them, then Apply',false);},30);});

// ---- lines drawn by hand ----
// A line drawn by hand runs straight from one point to another; the program treats it like the picture's own lines.
// (on the preview: the lines drawn by hand)
function addedLines(){const geo=pageGeom(),P=(x,y)=>{const q=outPos(x,y);return geo.map(q[0],q[1]);},out=[];
  S.fixes.forEach(f=>{if(f.mode!=='line')return;out.push({kind:'hand',a:P(...srcToWork(f.ax,f.ay)),b:P(...srcToWork(f.bx,f.by)),fix:f});});
  return out;}
function addedLinesMarkup(k){let h='';for(const L of addedLines())h+=`<line class="added-line ${L.kind}" x1="${L.a[0]}" y1="${L.a[1]}" x2="${L.b[0]}" y2="${L.b[1]}" style="stroke-width:${3*k}px;stroke-dasharray:${8*k} ${5*k}"/>`;
  if(S.drawLine&&S.drawLine.b){const d=S.drawLine;h+=`<line class="added-line hand drawing" x1="${d.a[0]}" y1="${d.a[1]}" x2="${d.b[0]}" y2="${d.b[1]}" style="stroke-width:${4*k}px"/>`+
    [d.a,d.b].map(q=>`<circle class="draw-end${q.snap?' snap':''}" cx="${q[0]}" cy="${q[1]}" r="${6*k}" style="stroke-width:${2*k}px"/>`).join('');}
  return h;}
// (a click on the middle part of an added line picks it; near its ends the click goes to the joint there)
function addedLineAt(px,py,lim){let best=null,bd=lim;for(const L of addedLines()){const dx=L.b[0]-L.a[0],dy=L.b[1]-L.a[1],l2=dx*dx+dy*dy;if(l2<1)continue;
    const t=((px-L.a[0])*dx+(py-L.a[1])*dy)/l2;if(t<0.15||t>0.85)continue;const d=Math.hypot(L.a[0]+t*dx-px,L.a[1]+t*dy-py);if(d<bd){bd=d;best=L;}}return best;}
function addedLineMenu(L,px,py){S.fixSel={pt:[px,py]};drawFixLayer();
  openFixPop(`<h3>Line you drew</h3><button data-act="rm">Remove this line</button><button data-act="other">Other fixes for this spot</button>`,px,py);
  const pop=$('fixPop');pop.querySelector('[data-act="rm"]').onclick=()=>changeFixes(()=>{S.fixes=S.fixes.filter(f=>f!==L.fix);});
  pop.querySelector('[data-act="other"]').onclick=()=>{const q=nearestStroke(px,py,30/layerScale());if(q)pointMenu(q[0],q[1]);else closeFixPop();};}
// (drawing: drag from one point to another; an end near a line snaps onto it)
function setDrawMode(on){S.drawMode=on;S.drawLine=null;$('fixDraw').setAttribute('aria-pressed',String(on));$('fixLayer').classList.toggle('picking-area',on);
  $('fixHelp').textContent=on?'Drag from one line to another to add a straight lead line. Ends near a line snap onto it (Esc to stop).':'Click a dot or a line to choose how it should look, or drag it to reshape it.';}
function snapEnd(px,py){const q=nearestStroke(px,py,14/layerScale());if(q){const r=[q[0],q[1]];r.snap=true;return r;}return[px,py];}
$('fixDraw').addEventListener('click',()=>{closeFixPop();setAreaMode(false);S.symPending=null;setDrawMode(!S.drawMode);drawFixLayer();});

// ---- checking the pieces for glass cutting ----
// Every glass piece (the white space between lines) is looked at for what is hard to cut or likely to break:
// a point sharper than about 30 degrees, an inside curve deeper than it is wide, a sliver under 1/4 inch wide, or a
// piece too small to hold while grinding. Each is marked on the picture so it can be changed with the line tools.
const CHECK={pointDeg:30,pointArm:0.12,narrow:0.25,tinyArea:0.15,pocketDepth:0.3,pocketRatio:0.7};
async function runCheck(){if(!S.resultURL)return;const id=++S.checkRun;const c=await cutLoops(true);if(id!==S.checkRun)return;const ppi=c.ppi,marks=[];
  // (how wide each piece is at its widest: the biggest circle that fits inside it)
  const{lab,GW,GH,outside}=c,D=new Float32Array(GW*GH),INF=1e9;for(let i=0;i<GW*GH;i++)D[i]=lab[i]>=0&&lab[i]!==outside?INF:0;
  for(let y=1;y<GH-1;y++)for(let x=1;x<GW-1;x++){const i=y*GW+x;if(!D[i])continue;D[i]=Math.min(D[i],D[i-1]+1,D[i-GW]+1,D[i-GW-1]+1.4142,D[i-GW+1]+1.4142);}
  for(let y=GH-2;y>0;y--)for(let x=GW-2;x>0;x--){const i=y*GW+x;if(!D[i])continue;D[i]=Math.min(D[i],D[i+1]+1,D[i+GW]+1,D[i+GW+1]+1.4142,D[i+GW-1]+1.4142);}
  const rmax=new Float32Array(c.area.length);for(let i=0;i<GW*GH;i++){const l=lab[i];if(l>=0&&D[i]>rmax[l])rmax[l]=D[i];}
  // (each piece's outline: the longest loop it owns)
  const outer=new Map();c.loops.forEach((L,i)=>{const o=c.owners[i];let len=0;for(let k=1;k<L.length;k++)len+=Math.hypot(L[k][0]-L[k-1][0],L[k][1]-L[k-1][1]);if(!outer.has(o)||outer.get(o).len<len)outer.set(o,{L,len});});
  for(const[o,{L}]of outer){const iss=[],area=c.area[o]/(ppi*ppi),width=2*rmax[o]/ppi;
    if(area<CHECK.tinyArea)iss.push({t:'tiny piece',p:centroid(L)});
    else if(width<CHECK.narrow)iss.push({t:'sliver: under 1/4 inch wide',p:centroid(L)});
    // (evenly spaced points round the outline)
    const R=resampleLoop(L,0.02);const n=R.length;if(n<12){if(iss.length)marks.push({L,iss});continue;}
    let sa=0;for(let i=0;i<n;i++){const a=R[i],b=R[(i+1)%n];sa+=a[0]*b[1]-b[0]*a[1];}const sgn=Math.sign(sa)||1;
    const arm=Math.max(2,Math.round(CHECK.pointArm/0.02)),ang=new Float32Array(n),cvx=new Int8Array(n);
    for(let i=0;i<n;i++){const p=R[i],a=R[(i-arm+n)%n],b=R[(i+arm)%n],v1=[a[0]-p[0],a[1]-p[1]],v2=[b[0]-p[0],b[1]-p[1]];
      ang[i]=Math.acos(Math.max(-1,Math.min(1,(v1[0]*v2[0]+v1[1]*v2[1])/((Math.hypot(...v1)*Math.hypot(...v2))||1))))*180/Math.PI;
      const tx=p[0]-a[0],ty=p[1]-a[1],ux=b[0]-p[0],uy=b[1]-p[1];cvx[i]=Math.sign(tx*uy-ty*ux)===sgn?1:0;}
    for(let i=0;i<n;i++){if(!cvx[i]||ang[i]>=CHECK.pointDeg)continue;let isMin=true;for(let k=-arm;k<=arm;k++){const j=(i+k+n)%n;if(ang[j]<ang[i]||(ang[j]===ang[i]&&k<0)){isMin=false;break;}}
      if(isMin)iss.push({t:'sharp point ('+Math.round(ang[i])+'°)',p:R[i]});}
    // (inside curves: how far the outline dips in from a straight edge across the opening, against the opening's width)
    const H_=hullIdx(R);for(let q=0;q<H_.length;q++){const i0=H_[q],i1=H_[(q+1)%H_.length],A=R[i0],B=R[i1],mouth=Math.hypot(B[0]-A[0],B[1]-A[1]);if(mouth<0.05)continue;
      let best=0,bi=-1;for(let j=(i0+1)%n;j!==i1;j=(j+1)%n){const P_=R[j],d=Math.abs((B[0]-A[0])*(A[1]-P_[1])-(A[0]-P_[0])*(B[1]-A[1]))/mouth;if(d>best){best=d;bi=j;}}
      if(bi>=0&&best>=CHECK.pocketDepth&&best>=CHECK.pocketRatio*mouth)iss.push({t:'deep inside curve',p:R[bi]});}
    if(iss.length)marks.push({L,iss});}
  S.checkMarks=marks.map(m=>({poly:m.L.map(([x,y])=>[x*OUT_PPI,y*OUT_PPI]),iss:m.iss.map(q=>({t:q.t,p:[q.p[0]*OUT_PPI,q.p[1]*OUT_PPI]}))}));
  const cnt={};for(const m of marks)for(const q of m.iss){const t=q.t.replace(/ \(.*\)/,'').replace(/:.*/,'');cnt[t]=(cnt[t]||0)+1;}
  $('note').textContent=marks.length?'Pieces to look at: '+Object.entries(cnt).map(([t,n])=>n+' '+t+(n>1?'s':'')).join(', ')+'. They are marked in orange.':'No hard-to-cut pieces found.';
  drawFixLayer();}
function centroid(L){let x=0,y=0;for(const p of L){x+=p[0];y+=p[1];}return[x/L.length,y/L.length];}
function resampleLoop(L,step){const out=[];let carry=0;for(let i=0;i<L.length;i++){const a=L[i],b=L[(i+1)%L.length],d=Math.hypot(b[0]-a[0],b[1]-a[1]);let t=carry;
    while(t<d){out.push([a[0]+(b[0]-a[0])*t/d,a[1]+(b[1]-a[1])*t/d]);t+=step;}carry=t-d;}return out;}
function hullIdx(P){const idx=P.map((_,i)=>i).sort((a,b)=>P[a][0]-P[b][0]||P[a][1]-P[b][1]);const cr=(o,a,b)=>(P[a][0]-P[o][0])*(P[b][1]-P[o][1])-(P[a][1]-P[o][1])*(P[b][0]-P[o][0]);
  const lo=[],up=[];for(const i of idx){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],i)<=0)lo.pop();lo.push(i);}
  for(let k=idx.length-1;k>=0;k--){const i=idx[k];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],i)<=0)up.pop();up.push(i);}
  // (in the order the outline runs, so each hull edge spans the stretch of outline between its two ends)
  return[...new Set([...lo.slice(0,-1),...up.slice(0,-1)])].sort((a,b)=>a-b);}
function checkMarkup(k){let h='';for(const m of S.checkMarks){h+=`<polygon class="check-piece" points="${m.poly.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ')}" style="stroke-width:${2*k}px"/>`;
    for(const q of m.iss){h+=`<circle class="check-dot" cx="${q.p[0]}" cy="${q.p[1]}" r="${6*k}" style="stroke-width:${2*k}px"/><text class="check-label" x="${q.p[0]+9*k}" y="${q.p[1]-7*k}" style="font-size:${12*k}px;stroke-width:${3*k}px">${q.t}</text>`;}}
  return h;}
S.checkRun=0;
$('fixCheck').addEventListener('click',()=>{S.checkOn=!S.checkOn;$('fixCheck').setAttribute('aria-pressed',String(S.checkOn));if(S.checkOn){$('note').textContent='Checking the pieces…';runCheck();}else{S.checkMarks=null;$('note').textContent='';drawFixLayer();}});
function setAreaMode(on){if(!on&&S.areaPending)S.areaPending=null;S.areaMode=on;$('fixArea').setAttribute('aria-pressed',String(on));$('fixAreaFlip').hidden=!on;$('fixLayer').classList.toggle('picking-area',on);$('mat').classList.toggle('picking-area',on);
  $('fixHelp').textContent=on?'Drag a box around the spot to replace; the dashed box shows the spot it copies. Dots mark lines crossing the edge: aim for green; red ones won\'t line up, so move that edge (Esc to cancel).':'Click a dot or a line to choose how it should look, or drag it to reshape it.';}
S.areaFlip='lr';$('fixAreaFlip').addEventListener('change',e=>{S.areaFlip=e.target.value;});
$('fixArea').addEventListener('click',()=>{closeFixPop();S.mirrorPick=null;S.symPending=null;if(S.drawMode)setDrawMode(false);setAreaMode(!S.areaMode);});
$('fixBtn').addEventListener('click',()=>{if(!S.go&&!S.fixMode)setMode('drawn');S.fixMode=!S.fixMode;S.mirrorPick=null;setAreaMode(false);setDrawMode(false);S.symPending=null;$('fixBtn').setAttribute('aria-pressed',String(S.fixMode));$('fixBar').hidden=!S.fixMode;
  if(S.fixMode&&S.view==='original'){S.view='result';document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.view==='result')));showView();}
  closeFixPop();drawFixLayer();updateFixBar();});
// (only drags changed: redraw straight away; anything else: the program runs again)
function afterFixChange(before){const key=a=>JSON.stringify(a.filter(f=>!PAGE_FIX.has(f.mode)));if(key(before)!==key(S.fixes))schedule(run,0);else redrawDrags();}
$('fixUndo').addEventListener('click',()=>{if(!S.undo||!S.undo.length)return;const before=S.fixes;S.fixes=JSON.parse(S.undo.pop());saveFixes();closeFixPop();afterFixChange(before);});
// (clearing asks first, naming how many fixes go; Cancel is the default, and Undo can still bring them back)
$('fixClear').addEventListener('click',()=>{const n=S.fixes.length;if(!n)return;
  openFixPop(`<h3>Clear all fixes?</h3><p>All ${n} fix${n===1?'':'es'} on ${S.name.replace(/[<>&"]/g,'')} will be taken out. Undo can bring them back.</p><div class="row"><button data-act="clear" class="danger">Clear ${n} fix${n===1?'':'es'}</button><button data-act="cancel">Cancel</button></div>`,24,24);
  const pop=$('fixPop');pop.querySelector('[data-act="cancel"]').onclick=closeFixPop;pop.querySelector('[data-act="cancel"]').focus();
  pop.querySelector('[data-act="clear"]').onclick=()=>{const before=S.fixes;S.undo=S.undo||[];S.undo.push(JSON.stringify(S.fixes));S.fixes=[];saveFixes();closeFixPop();afterFixChange(before);$('fixClear').focus();};});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&S.areaPending&&!/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test((e.target||{}).tagName||'')){e.preventDefault();applyPending();return;}if(e.key==='Enter'&&S.tidy&&!/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test((e.target||{}).tagName||'')){e.preventDefault();applyTidy();return;}if(e.key!=='Escape')return;if(S.tidy){cancelTidy();return;}if(S.drawMode){press=null;setDrawMode(false);drawFixLayer();return;}if(S.symPending){cancelSym();return;}if(S.areaPending){cancelPending();return;}if(S.areaMode){setAreaMode(false);press=null;drawFixLayer();}if(S.mirrorPick){S.mirrorPick=null;S.fixSel=null;drawFixLayer();setStatus('Mirror cancelled');}if(!$('fixPop').hidden)closeFixPop();});
$('view').addEventListener('load',()=>{placeFixLayer();drawFixLayer();});
window.addEventListener('resize',()=>{placeFixLayer();});

// ---- controls ----
const rerender=()=>{updateLabels();schedule(S.go&&S.mode==='drawn'?run:render,S.go&&S.mode==='drawn'?300:120);};
$('widthNum').addEventListener('input',rerender);
let lastUnit='in';
$('unit').addEventListener('change',()=>{const f=UNIT[lastUnit]/UNIT[$('unit').value];lastUnit=$('unit').value;
  for(const id of ['widthNum','borderNum']){const v=+$(id).value*f;$(id).value=$('unit').value==='in'?v.toFixed(4):v.toFixed(2);}
  updateLabels();if(S.stats)showStats(pageGeom());});
$('presets').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const v=fromIn(+b.dataset.in);
  $('widthNum').value=$('unit').value==='in'?(+b.dataset.in).toFixed(4):v.toFixed(2);rerender();});
function sizeKey(){return 'lll-size:'+S.name+':'+(S.src?S.src.width+'x'+S.src.height:'');}
function rememberSize(){if(!S.src||S.sample)return;try{const z=sizeIn();localStorage.setItem(sizeKey(),JSON.stringify({w:z.w,h:z.h,lock:$('lockRatio').checked}));}catch(e){}}
['sizeW','sizeH'].forEach(id=>$(id).addEventListener('change',rememberSize));$('lockRatio').addEventListener('change',rememberSize);
$('sizeW').addEventListener('input',()=>{syncSize('w');updateLabels();schedule(prepare,600);});
$('sizeH').addEventListener('input',()=>{syncSize('h');updateLabels();schedule(prepare,600);});
$('lockRatio').addEventListener('change',()=>{if($('lockRatio').checked){syncSize('w');updateLabels();schedule(prepare,0);}});
$('borderOn').addEventListener('change',rerender);
const posHints={center:'The new border sits on the middle of the original border.',
  outer:'The border\'s outside edge stays where the original was, so the panel is exactly the width × height above.',
  inner:'The border\'s inside edge stays where the original was, so the glass inside the border keeps its size.'};
$('borderPos').addEventListener('change',()=>{$('borderPosHint').textContent=posHints[$('borderPos').value];rerender();});$('borderNum').addEventListener('input',rerender);
$('transparent').addEventListener('change',rerender);
$('thresh').addEventListener('input',()=>{$('threshAuto').checked=false;updateLabels();schedule(run,300);});
$('threshAuto').addEventListener('change',()=>{if($('threshAuto').checked)$('thresh').value=S.otsu;updateLabels();schedule(run,0);});
$('smooth').addEventListener('input',()=>{updateLabels();schedule(run,350);});
$('invert').addEventListener('change',()=>{if(S.src){findCrop();prepare();}});
$('dropText').addEventListener('change',()=>schedule(run,0));
$('keepGaps').addEventListener('change',()=>schedule(run,0));
$('exactShapes').addEventListener('change',()=>{$('squareUp').disabled=!$('exactShapes').checked;schedule(run,0);});
$('squareUp').addEventListener('change',()=>schedule(run,0));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{S.view=b.dataset.view;
  document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));showView();}));
document.querySelectorAll('[data-zoom]').forEach(b=>b.addEventListener('click',()=>{S.zoom=b.dataset.zoom;
  document.querySelectorAll('[data-zoom]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));applyZoom();}));

function loadFile(file){if(!file||!/^image\//.test(file.type)){setStatus('That file is not an image. Try a PNG or JPG.',false);return;}S.axes=null;
  const url=URL.createObjectURL(file);const img=new Image();S.fileSize=null;
  {const m=/-(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)in-/.exec(file.name);if(m)S.fileSize={w:+m[1],h:+m[2],lock:false};}
  img.onload=async()=>{try{const meta=readPngSize(await file.arrayBuffer());if(meta)S.fileSize=meta;}catch(e){}loadImage(img,file.name.replace(/\.[^.]+$/,''),false);URL.revokeObjectURL(url);};
  img.onerror=()=>setStatus('Could not read that image. Try exporting it as PNG or JPG.',false);img.src=url;}
$('fileInput').addEventListener('change',e=>{loadFile(e.target.files[0]);e.target.value='';});
const mat=$('mat');
['dragenter','dragover'].forEach(t=>mat.addEventListener(t,e=>{e.preventDefault();mat.classList.add('dragging');}));
['dragleave','drop'].forEach(t=>mat.addEventListener(t,e=>{e.preventDefault();mat.classList.remove('dragging');}));
mat.addEventListener('drop',e=>{const f=e.dataTransfer&&e.dataTransfer.files[0];if(f)loadFile(f);});
window.addEventListener('paste',e=>{const it=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'));if(it)loadFile(it.getAsFile());});

function fname(ext){const w=widthIn(),z=sizeIn();return S.name+'-'+fit2(z.w)+'x'+fit2(z.h)+'in-'+w.toFixed(3).replace(/^0/,'')+'in-lines.'+ext;}
async function save(data,ext){const note=$('note');
  if(!S.dl&&!window.claude){const blob=data instanceof Blob?data:new Blob([data],{type:ext==='svg'?'image/svg+xml':'application/octet-stream'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fname(ext);document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);note.textContent='Saved '+fname(ext)+'.';return;}
  if(!S.dl){note.textContent='Saving is not available in this view. Switch to Result, then right-click (or long-press) the image and choose Save image.';return;}
  try{const name=fname(ext);await S.dl.save({filename:name,data});note.textContent='Saved '+name+'.';}
  catch(err){const c=err&&err.code;note.textContent=c==='declined'?'Save cancelled.':c==='rate_limited'?'A save prompt is already open. Finish it, then try again.':
    'Saving is not available here. Switch to Result, then right-click (or long-press) the image and choose Save image.';}}
try{const v=localStorage.getItem('pngPPI');if(v==='600'||v==='300')$('pngPPI').value=v;}catch(e){}
$('pngPPI').addEventListener('change',e=>{try{localStorage.setItem('pngPPI',e.target.value);}catch(_){}});
try{$('exactSize').checked=localStorage.getItem('exactSize')==='1';}catch(e){}
$('exactSize').addEventListener('change',e=>{try{localStorage.setItem('exactSize',e.target.checked?'1':'0');}catch(_){}if(S.strokes)showStats(pageGeom());});
// (the preview is drawn at 300 px per inch; a finer PNG is drawn afresh at the chosen resolution when it is saved)
$('savePng').addEventListener('click',async()=>{if(!S.resultBlob)return;const ppi=+$('pngPPI').value||OUT_PPI;if(ppi===OUT_PPI&&!exactOn()){save(S.resultBlob,'png');return;}
  const note=$('note');note.textContent='Drawing the PNG at '+ppi+' px per inch…';await new Promise(r=>setTimeout(r,30));
  const geo=saveGeom(),f=ppi/OUT_PPI,c=drawPage(geo,f);
  if(!c){note.textContent='This browser cannot draw a picture that large. Try 300 px per inch, or Save SVG.';return;}
  const b=await new Promise(r=>c.toBlob(r,'image/png'));c.width=c.height=0;
  if(!b){note.textContent='This browser cannot make a PNG that large ('+Math.round(geo.pw*f)+' × '+Math.round(geo.ph*f)+' px). Try 300 px per inch, or Save SVG.';return;}
  save(await withPPI(b,ppi),'png');});
$('saveSvg').addEventListener('click',()=>{if(!S.svg)return;save(exactOn()?buildSVG(exactGeo()):S.svg,'svg');});
// ---- cut file for a cutter (Silhouette and the like) ----
// Every glass piece is the white space between the new lines; its edge is a closed cut line that already sits half
// a lead width back from each line, so the cut pieces keep the chosen gap between them. The result picture is read
// back, the white pieces are told apart (the white all round the panel is not a piece), and the edges between white
// and line are followed at the half-way grey, so they are smooth rather than stepped. Written as DXF (R12), which
// every edition of Silhouette Studio opens; units are inches.
async function cutLoops(full,url){const img=new Image();img.src=url||S.resultURL;await img.decode();
  const ppi=Math.min(OUT_PPI,Math.max(100,Math.floor(Math.sqrt(16e6/(img.naturalWidth*img.naturalHeight))*OUT_PPI)));   // (as fine as about 16 million pixels allows)
  const W=Math.round(img.naturalWidth*ppi/OUT_PPI),H=Math.round(img.naturalHeight*ppi/OUT_PPI),c=document.createElement('canvas');c.width=W+2;c.height=H+2;
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W+2,H+2);x.drawImage(img,1,1,W,H);const d=x.getImageData(0,0,W+2,H+2).data,GW=W+2,GH=H+2;
  const g=new Float32Array(GW*GH);for(let i=0;i<GW*GH;i++)g[i]=0.299*d[4*i]+0.587*d[4*i+1]+0.114*d[4*i+2];
  // (the white pieces, told apart; the one touching the edge is the white all round the panel)
  const lab=new Int32Array(GW*GH).fill(-1),area=[],stack=new Int32Array(GW*GH);let nl=0;
  for(let i=0;i<GW*GH;i++){if(lab[i]>=0||g[i]<128)continue;let sp=0,cnt=0;stack[sp++]=i;lab[i]=nl;
    while(sp){const k=stack[--sp];cnt++;const kx=k%GW,ky=(k/GW)|0;for(const nb of[kx>0?k-1:-1,kx<GW-1?k+1:-1,ky>0?k-GW:-1,ky<GH-1?k+GW:-1])if(nb>=0&&lab[nb]<0&&g[nb]>=128){lab[nb]=nl;stack[sp++]=nb;}}
    area.push(cnt);nl++;}
  const outside=lab[0],minArea=0.004*ppi*ppi;   // (specks under about 1/16 inch square are left out)
  // (edges between white and line, followed at the half-way grey: marching squares)
  const L=128,eid=(ax,ay,bx,by)=>ay===by?2*(ay*GW+Math.min(ax,bx)):2*(Math.min(ay,by)*GW+ax)+1;
  const ept=(ax,ay,bx,by)=>{const ga=g[ay*GW+ax],gb=g[by*GW+bx],t=(L-ga)/((gb-ga)||1e-9);return[ax+(bx-ax)*t,ay+(by-ay)*t];};
  const segs=new Map(),pos=new Map(),own=new Map();
  const add=(e1,e2)=>{(segs.get(e1)||segs.set(e1,[]).get(e1)).push(e2);(segs.get(e2)||segs.set(e2,[]).get(e2)).push(e1);};
  for(let y=0;y+1<GH;y++)for(let xx=0;xx+1<GW;xx++){const v=[g[y*GW+xx],g[y*GW+xx+1],g[(y+1)*GW+xx+1],g[(y+1)*GW+xx]],k=(v[0]>=L?1:0)|(v[1]>=L?2:0)|(v[2]>=L?4:0)|(v[3]>=L?8:0);
    if(k===0||k===15)continue;
    const E=[[xx,y,xx+1,y],[xx+1,y,xx+1,y+1],[xx,y+1,xx+1,y+1],[xx,y,xx,y+1]];   // top, right, bottom, left
    const id=j=>{const[a,b,cc,dd]=E[j],e=eid(a,b,cc,dd);if(!pos.has(e)){pos.set(e,ept(a,b,cc,dd));const wa=g[b*GW+a]>=L;own.set(e,wa?lab[b*GW+a]:lab[dd*GW+cc]);}return e;};
    const T={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[0,2]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[3,0]]};
    // (white touching white only at a corner stays two pieces, as they were told apart above)
    if(k===5||k===10){const pr=k===5?[[3,0],[1,2]]:[[0,1],[3,2]];for(const[a,b]of pr)add(id(a),id(b));}
    else for(const[a,b]of T[k])add(id(a),id(b));}
  // (linked into closed loops)
  const loops=[],owners=[],seen=new Set();
  for(const[e0]of segs){if(seen.has(e0))continue;const loop=[];let prev=-1,cur=e0;
    for(let guard=0;guard<4*segs.size;guard++){seen.add(cur);loop.push(pos.get(cur));const nb=segs.get(cur);const nx=nb[0]!==prev||nb.length<2?nb[0]:nb[1];
      if(nx===undefined||nx===e0){break;}if(seen.has(nx)&&nx!==e0)break;prev=cur;cur=nx;}
    const o=own.get(e0);if(o==null||o<0||o===outside||area[o]<minArea||loop.length<8)continue;
    loops.push(rdp(loop.map(([px,py])=>[(px-1)/ppi,(py-1)/ppi]),0.25/ppi));owners.push(o);}
  return{loops,owners,w:W/ppi,h:H/ppi,ppi,lab,GW,GH,outside,area};}
// (fewer points along the straight parts, within the given tolerance)
function rdp(P,tol){if(P.length<4)return P;const keep=new Uint8Array(P.length);keep[0]=keep[P.length-1]=1;const st=[[0,P.length-1]];
  while(st.length){const[a,b]=st.pop();const ax=P[a][0],ay=P[a][1],dx=P[b][0]-ax,dy=P[b][1]-ay,l=Math.hypot(dx,dy)||1e-9;let bi=-1,bd=tol;
    for(let i=a+1;i<b;i++){const dd=Math.abs((P[i][0]-ax)*dy-(P[i][1]-ay)*dx)/l;if(dd>bd){bd=dd;bi=i;}}if(bi>=0){keep[bi]=1;st.push([a,bi],[bi,b]);}}
  return P.filter((_,i)=>keep[i]);}
function dxfFile(cut){const o=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$INSUNITS','70','1','9','$EXTMIN','10','0','20','0','9','$EXTMAX','10',cut.w.toFixed(4),'20',cut.h.toFixed(4),'0','ENDSEC',
    '0','SECTION','2','TABLES','0','TABLE','2','LAYER','70','1','0','LAYER','2','PIECES','70','0','62','7','6','CONTINUOUS','0','ENDTAB','0','ENDSEC','0','SECTION','2','ENTITIES'];
  for(const L of cut.loops){o.push('0','POLYLINE','8','PIECES','66','1','70','1','10','0','20','0','30','0');
    for(const[x,y]of L)o.push('0','VERTEX','8','PIECES','10',x.toFixed(4),'20',(cut.h-y).toFixed(4),'30','0');o.push('0','SEQEND','8','PIECES');}
  o.push('0','ENDSEC','0','EOF');return o.join('\r\n')+'\r\n';}
$('saveDxf').addEventListener('click',async()=>{if(!S.resultURL)return;$('note').textContent='Making the cut file…';
  try{let url=null;if(exactOn()){const c=drawPage(exactGeo(),1);const b=await new Promise(r=>c.toBlob(r,'image/png'));url=URL.createObjectURL(b);}
    const cut=await cutLoops(false,url);if(url)URL.revokeObjectURL(url);save(dxfFile(cut),'dxf');$('note').textContent+=' '+cut.loops.length+' cut lines.';}catch(err){$('note').textContent='Could not make the cut file: '+(err&&err.message||err);}});
(async()=>{try{S.dl=await (window.claude&&window.claude.use?window.claude.use('downloads'):null);}catch(e){S.dl=null;}})();

// example pattern with deliberately uneven lines
function sample(){const c=document.createElement('canvas');c.width=900;c.height=1200;const g=c.getContext('2d');
  g.fillStyle='#fff';g.fillRect(0,0,900,1200);g.strokeStyle='#141414';g.lineCap='round';g.lineJoin='round';
  const L=(w,f)=>{g.lineWidth=w;g.beginPath();f();g.stroke();};
  L(16,()=>g.rect(28,28,844,1144));L(3,()=>g.arc(450,440,240,0,Math.PI*2));L(9,()=>g.arc(450,440,62,0,Math.PI*2));
  const pw=[4,11,6,13,5,8];for(let i=0;i<6;i++){const a=i*Math.PI/3;L(pw[i],()=>g.ellipse(450+148*Math.cos(a),440+148*Math.sin(a),86,40,a,0,Math.PI*2));}
  L(7,()=>{g.moveTo(28,28);g.lineTo(280,270);});L(3,()=>{g.moveTo(872,28);g.lineTo(620,270);});
  L(10,()=>{g.moveTo(28,440);g.lineTo(210,440);});L(4,()=>{g.moveTo(690,440);g.lineTo(872,440);});
  L(5,()=>{g.moveTo(28,820);g.lineTo(872,820);});L(12,()=>{g.moveTo(450,680);g.lineTo(450,820);});
  L(6,()=>{g.moveTo(28,1010);g.bezierCurveTo(260,900,560,1110,872,960);});
  L(4,()=>{g.moveTo(300,820);g.lineTo(300,1172);});L(13,()=>{g.moveTo(620,820);g.lineTo(620,1172);});
  L(8,()=>{g.moveTo(300,880);g.quadraticCurveTo(170,760,28,700);});L(3,()=>{g.moveTo(620,880);g.quadraticCurveTo(760,740,872,650);});
  g.fillStyle='#141414';[[120,150],[760,330],[400,960],[700,1100],[200,1100],[540,600],[150,560],[810,760]].forEach(([x,y],i)=>{g.beginPath();g.arc(x,y,1.5+(i%3),0,Math.PI*2);g.fill();});
  return c;}
window.__leadLineLeveler=()=>({w:S.work&&S.work.w,h:S.work&&S.work.h,gray:S.lastGray,strokes:S.strokes,offs:S.offs,fill:S.fill,fcurve:S.fcurve,rot:S.rot||0,status:$('statusText').textContent});
updateLabels();
loadImage(sample(),'sample-pattern',true);
})();
