// Messages from the page: load a picture, run with the current settings.
// ------------------------------------------------------------------------------------------------
onmessage=e=>{const m=e.data;
  if(m.type==='load'){W=m.w;H=m.h;gray=new Uint8Array(m.buf);otsuT=otsu(gray);colorIn=!!m.colored;mxBuf=m.mx?new Uint8Array(m.mx):null;chBuf=m.ch?new Uint8Array(m.ch):null;
    // colored glass: the lines are the darkest group of all; split them from the darkest glass color
    if(m.colored){const lo=gray.filter(v=>v<otsuT);if(lo.length)otsuT=Math.min(otsuT,otsu(lo)+1);}postMessage({type:'loaded',otsu:otsuT,id:m.id});return;}
  if(m.type==='previewGuides'){let g=[];try{g=(m.guides||[]).map(previewGuide);}catch(err){g=m.guides||[];}postMessage({type:'previewGuides',id:m.id,guides:g});return;}
  if(m.type==='run'){const t0=Date.now();
    const cw=colorIn;try{const r=process(m.params);postMessage({type:'done',id:m.id,rect:r.rect,photo:r.photo,axes:r.axes,junctions:r.junctions,pts:r.pts,offs:r.offs,hw:r.hw,stats:r.stats,rot:r.rot,fill:r.fill,fcurve:r.fcurve,ms:Date.now()-t0},[r.pts.buffer,r.offs.buffer,r.hw.buffer]);}
    catch(err){colorIn=cw;postMessage({type:'error',id:m.id,message:String(err&&err.message||err)});}}};
