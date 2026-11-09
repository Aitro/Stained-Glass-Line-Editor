
(function(){
const $=id=>document.getElementById(id);
const OUT_PPI=300, MARGIN_IN=0.25, MAX_WORK=3000, PAD=6;
const S={name:'sample-pattern',src:null,crop:null,work:null,workPPI:0,strokes:null,offs:null,stats:null,
  view:'result',zoom:'fit',running:false,pending:false,loadId:0,runId:0,otsu:128,sample:true,dl:null,
  resultBlob:null,resultURL:null,overlayURL:null,origURL:null,svg:null,borderFlags:null};

const worker=new Worker(URL.createObjectURL(new Blob([$('worker-src').textContent],{type:'text/javascript'})));
worker.onmessage=e=>{const m=e.data;
  if(m.type==='progress')setStatus(m.text,true);
  else if(m.type==='loaded'){if(m.id!==S.loadId)return;S.otsu=m.otsu;if($('threshAuto').checked)$('thresh').value=m.otsu;updateLabels();S.running=false;run();}
  else if(m.type==='done'){S.running=false;
    if(S.pending){S.pending=false;run();return;}
    S.strokes=m.pts;S.offs=m.offs;S.hw=m.hw;S.stats=m.stats;S.rot=m.rot||0;S.fill=m.fill;S.fcurve=m.fcurve;markBorder();render();
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
  S.src=c;S.name=name;S.sample=isSample;
  $('fileName').textContent=name;$('sampleTag').hidden=!isSample;$('sSize').textContent=c.width+' × '+c.height+' px';
  if(S.origURL)URL.revokeObjectURL(S.origURL);c.toBlob(b=>{S.origURL=URL.createObjectURL(b);if(S.view==='original')showView();});
  findCrop();if($('lockRatio').checked){const z=sizeIn(),L=Math.max(z.w,z.h);const r=S.crop.h/S.crop.w;
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
function params(){return{auto:$('threshAuto').checked,threshold:+$('thresh').value,invert:$('invert').checked,smooth:+$('smooth').value,exact:$('exactShapes').checked,square:$('squareUp').checked};}
let timer=null;
function schedule(fn,ms){clearTimeout(timer);timer=setTimeout(fn,ms);}
function run(){if(!S.work)return;if(S.running){S.pending=true;return;}S.running=true;S.runId++;setStatus('Working…',true);
  worker.postMessage({type:'run',id:S.runId,params:params()});}

// ---- geometry: work px -> output px on the page ----
function pageGeom(){const cr=S.crop;const k=OUT_PPI/S.workPPI;const m=MARGIN_IN*OUT_PPI;const ox=PAD*S.sx,oy=PAD*S.sy;
  const pw=Math.round(cr.w*S.sx*k+2*m),ph=Math.round(cr.h*S.sy*k+2*m);
  return{k,m,pw,ph,map:(x,y)=>[(x-ox)*k+m,(y-oy)*k+m]};}
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
      for(let j=1;j<P.length;j++)g.lineTo(P[j][0],P[j][1]);}
    g.stroke();}}

function render(){if(!S.strokes)return;const geo=pageGeom();
  const c=document.createElement('canvas');c.width=geo.pw;c.height=geo.ph;const g=c.getContext('2d');
  if(!$('transparent').checked){g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);}
  drawStrokes(g,geo,'#000',widthIn(),borderIn());drawFillets(g,geo,'#000',widthIn());
  $('borderWarn').hidden=!($('borderOn').checked&&!S.hasBorder);
  c.toBlob(async b=>{S.resultBlob=await withPPI(b,OUT_PPI);if(S.resultURL)URL.revokeObjectURL(S.resultURL);S.resultURL=URL.createObjectURL(S.resultBlob);
    if(S.overlayURL){URL.revokeObjectURL(S.overlayURL);S.overlayURL=null;}
    $('savePng').disabled=false;$('saveSvg').disabled=false;showView();},'image/png');
  S.svg=buildSVG(geo);showStats(geo);}

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
      P.forEach((p,j)=>{d+=(j===0?'M':'L')+p[0].toFixed(2)+','+p[1].toFixed(2);});
      out+=`<path d="${d}"/>\n`;}return out+'</g>\n';};
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${(geo.pw/OUT_PPI).toFixed(4)}in" height="${(geo.ph/OUT_PPI).toFixed(4)}in" viewBox="0 0 ${geo.pw} ${geo.ph}">\n`+
    ($('transparent').checked?'':'<rect width="100%" height="100%" fill="#fff"/>\n')+group(0,widthIn())+(useB?group(1,borderIn()):'')+filletSVG(geo)+'</svg>\n';}
function filletSVG(geo){const fp=filletPaths(geo);if(!fp.length)return'';const d=P=>P.map((p,j)=>(j?'L':'M')+p[0].toFixed(2)+','+p[1].toFixed(2)).join('');
  return '<g fill="#000" stroke="none">\n'+fp.map(f=>'<path d="'+d(f.poly)+'Z"/>').join('\n')+'\n</g>\n<g fill="none" stroke="#000" stroke-width="'+(widthIn()*OUT_PPI).toFixed(3)+'" stroke-linecap="round">\n'+fp.map(f=>'<path d="'+d(f.cur)+'"/>').join('\n')+'\n</g>\n';}

// add a pHYs chunk so the PNG prints at the right size
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(b){let c=0xffffffff;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return(c^0xffffffff)>>>0;}
async function withPPI(blob,ppi){try{const buf=new Uint8Array(await blob.arrayBuffer());const ppm=Math.round(ppi/0.0254);
  const chunk=new Uint8Array(21);const dv=new DataView(chunk.buffer);dv.setUint32(0,9);chunk.set([112,72,89,115],4);dv.setUint32(8,ppm);dv.setUint32(12,ppm);chunk[16]=1;
  dv.setUint32(17,crc32(chunk.subarray(4,17)));const out=new Uint8Array(buf.length+21);out.set(buf.subarray(0,33));out.set(chunk,33);out.set(buf.subarray(33),54);
  return new Blob([out],{type:'image/png'});}catch(e){return blob;}}

function showView(){const img=$('view');
  if(S.view==='original'){if(S.origURL)img.src=S.origURL;img.alt='Original pattern';}
  else if(S.view==='overlay'){if(!S.strokes)return;if(!S.overlayURL){makeOverlay(showView);return;}img.src=S.overlayURL;img.alt='New lines in red over the original';}
  else{if(S.resultURL)img.src=S.resultURL;img.alt='Pattern with even line width';}
  applyZoom();}
function applyZoom(){const mat=$('mat'),img=$('view');mat.classList.toggle('fit',S.zoom==='fit');
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
    $('panelNote').textContent='Source has '+Math.round(Math.max(cr.w/z.w,cr.h/z.h))+' px per inch at this size; output is drawn at 300.'+
      (Math.abs(pct)>=1?' Stretched '+Math.abs(pct)+'% '+(pct>0?'taller':'wider')+' than the original.':'');}}
function showStats(geo){const s=S.stats;if(!s||!S.offs||S.offs.length<2){['sThin','sMid','sThick'].forEach(i=>$(i).textContent='no lines found');return;}
  const f=v=>fmtUnit(Math.max(1,v)/S.workPPI);$('sThin').textContent=f(s.thin);$('sMid').textContent=f(s.mid);$('sThick').textContent=f(s.thick);
  $('sOut').textContent=(geo.pw/OUT_PPI).toFixed(2)+' × '+(geo.ph/OUT_PPI).toFixed(2)+' in';}

// ---- controls ----
const rerender=()=>{updateLabels();schedule(render,120);};
$('widthNum').addEventListener('input',rerender);
let lastUnit='in';
$('unit').addEventListener('change',()=>{const f=UNIT[lastUnit]/UNIT[$('unit').value];lastUnit=$('unit').value;
  for(const id of ['widthNum','borderNum']){const v=+$(id).value*f;$(id).value=$('unit').value==='in'?v.toFixed(4):v.toFixed(2);}
  updateLabels();if(S.stats)showStats(pageGeom());});
$('presets').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const v=fromIn(+b.dataset.in);
  $('widthNum').value=$('unit').value==='in'?(+b.dataset.in).toFixed(4):v.toFixed(2);rerender();});
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
$('exactShapes').addEventListener('change',()=>{$('squareUp').disabled=!$('exactShapes').checked;schedule(run,0);});
$('squareUp').addEventListener('change',()=>schedule(run,0));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{S.view=b.dataset.view;
  document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));showView();}));
document.querySelectorAll('[data-zoom]').forEach(b=>b.addEventListener('click',()=>{S.zoom=b.dataset.zoom;
  document.querySelectorAll('[data-zoom]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));applyZoom();}));

function loadFile(file){if(!file||!/^image\//.test(file.type)){setStatus('That file is not an image. Try a PNG or JPG.',false);return;}
  const url=URL.createObjectURL(file);const img=new Image();
  img.onload=()=>{loadImage(img,file.name.replace(/\.[^.]+$/,''),false);URL.revokeObjectURL(url);};
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
$('savePng').addEventListener('click',()=>{if(S.resultBlob)save(S.resultBlob,'png');});
$('saveSvg').addEventListener('click',()=>{if(S.svg)save(S.svg,'svg');});
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
