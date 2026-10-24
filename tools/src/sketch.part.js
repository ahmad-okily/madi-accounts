// ---------- SKETCHES (approximate dimensioned drawings) ----------
let LOGO_DATA="";
(async()=>{try{const b=await (await fetch("icons/logo-word.jpg")).blob();LOGO_DATA=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(b)})}catch(e){}})();
const SK_KINDS={table:"طاولة / مجلى ستانلس",cabinet:"خزانة ستانلس (أبواب)",hood:"شفاط (هود)",wall_shelf:"رف حيط",layout:"مخطط مطبخ (من فوق)"};
function skDefaults(){return {kind:"table",title:"طاولة ستانلس مع جرن",customer:"",length:300,depth:80,height:90,backsplash:10,undershelf:1,legs:6,doors:0,sinks:[{width:50,depth:40,bowlDepth:30}],parts:[],material:"ستانلس ستيل 304",notes:[]}}
function skNorm(sp){
  const d=skDefaults(); const s={...d,...(sp||{})}; const n=(v,def,min,max)=>{v=+v;if(!isFinite(v)||v<=0)v=def;return Math.max(min,Math.min(max,v))};
  s.kind=SK_KINDS[s.kind]?s.kind:"table";
  s.length=n(s.length,300,10,2000); s.depth=n(s.depth,80,5,1000); s.height=n(s.height,s.kind==="hood"?60:s.kind==="wall_shelf"?40:90,3,400);
  s.backsplash=Math.max(0,Math.min(100,+s.backsplash||0)); s.undershelf=Math.max(0,Math.min(4,Math.round(+s.undershelf||0)));
  s.doors=Math.max(0,Math.min(12,Math.round(+s.doors||0)));
  let legs=Math.round(+s.legs||0); if(!legs) legs=s.length>200?6:4; s.legs=Math.max(4,Math.min(12,legs));
  s.sinks=(Array.isArray(s.sinks)?s.sinks:[]).slice(0,6).map(k=>({width:n(k.width,50,10,s.length),depth:n(k.depth,40,10,s.depth),bowlDepth:n(k.bowlDepth,30,5,80),x:k.x===""||k.x==null||isNaN(+k.x)?null:Math.max(0,+k.x)}));
  s.parts=(Array.isArray(s.parts)?s.parts:[]).slice(0,40).map(p=>({label:String(p.label||""),x:+p.x||0,y:+p.y||0,w:n(p.w,50,1,s.length),d:n(p.d,50,1,s.depth),shape:p.shape==="circle"?"circle":"rect"}));
  s.notes=(Array.isArray(s.notes)?s.notes:String(s.notes||"").split(/\n/)).map(x=>String(x).trim()).filter(Boolean).slice(0,6);
  s.title=String(s.title||SK_KINDS[s.kind]); s.customer=String(s.customer||""); s.material=String(s.material||"");
  // place sinks with no position: spread evenly
  const free=s.sinks.filter(k=>k.x==null);
  if(free.length){ const used=s.sinks.filter(k=>k.x!=null).reduce((a,k)=>a+k.width,0); const tw=free.reduce((a,k)=>a+k.width,0);
    const gap=Math.max(0,(s.length-used-tw)/(free.length+1)); let x=gap; for(const k of free){k.x=Math.round(x);x+=k.width+gap;} }
  for(const k of s.sinks){ if(k.x+k.width>s.length) k.x=Math.max(0,s.length-k.width); }
  s.sinks.sort((a,b)=>a.x-b.x);
  return s;
}
const skx=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const skn=v=>String(Math.round(v*10)/10);
// dimension line: horizontal (x1..x2 at y) or vertical (y1..y2 at x)
function skDimH(x1,x2,y,label,ext1,ext2){
  return `<g class="dim"><line x1="${x1}" y1="${ext1??y}" x2="${x1}" y2="${y+6}"/><line x1="${x2}" y1="${ext2??y}" x2="${x2}" y2="${y+6}"/>
  <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" marker-start="url(#ar)" marker-end="url(#ar)"/>
  ${x2-x1>34?`<rect x="${(x1+x2)/2-26}" y="${y-13}" width="52" height="20" fill="#fff"/><text x="${(x1+x2)/2}" y="${y+3}" text-anchor="middle">${skx(label)}</text>`:`<text x="${(x1+x2)/2}" y="${y-8}" text-anchor="middle">${skx(label)}</text>`}</g>`;
}
function skDimV(y1,y2,x,label,ext){
  return `<g class="dim"><line x1="${ext??x}" y1="${y1}" x2="${x+6}" y2="${y1}"/><line x1="${ext??x}" y1="${y2}" x2="${x+6}" y2="${y2}"/>
  <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" marker-start="url(#ar)" marker-end="url(#ar)"/>
  <rect x="${x-24}" y="${(y1+y2)/2-11}" width="48" height="20" fill="#fff"/><text x="${x}" y="${(y1+y2)/2+5}" text-anchor="middle">${skx(label)}</text></g>`;
}
function sketchSVG(spec){
  const s=skNorm(spec); const W=1400, M=120; const st=S.settings||{};
  const L=s.length, D=s.depth, H=s.height, B=s.kind==="table"||s.kind==="cabinet"?s.backsplash:0;
  const twoViews=s.kind!=="layout";
  const sc=Math.min((W-2*M-60)/L, (twoViews?380:760)/D, twoViews?430/(H+B+(s.kind==="hood"?0:0)):99);
  const w=L*sc, x0=(W-w)/2;
  let y=150; let g="";
  // header
  g+=`<rect x="0" y="0" width="${W}" height="118" fill="#0c0c0c"/>`;
  g+=LOGO_DATA?`<image href="${LOGO_DATA}" x="36" y="22" height="74" width="230" preserveAspectRatio="xMinYMid meet"/>`:`<text x="40" y="72" fill="#fff" font-size="34" font-weight="700" direction="ltr">MADI</text>`;
  g+=`<text x="${W-40}" y="54" fill="#fff" font-size="30" font-weight="700" text-anchor="start" direction="rtl">${skx(s.title)}</text>`;
  g+=`<text x="${W-40}" y="92" fill="#c9c9c9" font-size="19" text-anchor="start" direction="rtl">${skx([s.customer?("للزبون: "+s.customer):"",new Date().toLocaleDateString("en-GB"),"المقاسات بالسنتيمتر"].filter(Boolean).join("   ·   "))}</text>`;
  const label=(t,yy)=>`<text x="${W-M+40}" y="${yy}" font-size="20" font-weight="700" fill="#555" text-anchor="start" direction="rtl">${t}</text>`;
  // ---------- TOP VIEW ----------
  y+=46; g+=label(s.kind==="layout"?"المخطط من فوق":"منظر من فوق",y-14);
  const ty=y+40; const dh=D*sc;
  if(s.kind!=="layout"&&s.sinks.length){ // chain dims above
    let pts=[0]; for(const k of s.sinks){pts.push(k.x,k.x+k.width)} pts.push(L); pts=[...new Set(pts.map(v=>Math.round(v*10)/10))].sort((a,b)=>a-b);
    for(let i=0;i<pts.length-1;i++) if(pts[i+1]-pts[i]>0.4) g+=skDimH(x0+pts[i]*sc,x0+pts[i+1]*sc,ty-22,skn(pts[i+1]-pts[i]),ty,ty);
  }
  g+=`<rect x="${x0}" y="${ty}" width="${w}" height="${dh}" fill="url(#steel)" stroke="#222" stroke-width="2.5" rx="2"/>`;
  if(B>0&&s.kind!=="layout"){ g+=`<rect x="${x0}" y="${ty}" width="${w}" height="${Math.max(6,3*sc)}" fill="#b9c2ca" stroke="#222" stroke-width="1.5"/>`; }
  if(s.kind==="table"||s.kind==="cabinet"){
    for(const k of s.sinks){ const sx=x0+k.x*sc, sw=k.width*sc, sd=k.depth*sc, sy=ty+Math.max((dh-sd)/2,B>0?3*sc+4:4);
      g+=`<rect x="${sx}" y="${sy}" width="${sw}" height="${sd}" rx="${Math.min(14,sw/6)}" fill="url(#bowl)" stroke="#222" stroke-width="2"/>`;
      g+=`<circle cx="${sx+sw/2}" cy="${sy+sd/2}" r="${Math.max(5,3.5*sc)}" fill="#fff" stroke="#333" stroke-width="1.5"/><circle cx="${sx+sw/2}" cy="${sy+sd/2}" r="${Math.max(2,1.2*sc)}" fill="#333"/>`;
      if(sy-ty>16) g+=`<circle cx="${sx+sw/2}" cy="${(ty+(B>0?3*sc:0)+sy)/2}" r="5" fill="#fff" stroke="#333" stroke-width="1.5"/>`;
      g+=`<text x="${sx+sw/2}" y="${sy+sd/2+(sd>70?34:-12)}" text-anchor="middle" font-size="17" font-weight="700" fill="#1d3a57" direction="ltr">${skn(k.width)}×${skn(k.depth)}</text>`;
    }
  }
  if(s.kind==="hood"){ const n=Math.max(1,Math.round(L/50)), fw=(w-24)/n; for(let i=0;i<n;i++){ g+=`<rect x="${x0+12+i*fw+4}" y="${ty+dh*0.25}" width="${fw-8}" height="${dh*0.5}" fill="url(#mesh)" stroke="#444"/>`; }
    g+=`<circle cx="${x0+w/2}" cy="${ty+dh*0.12+8}" r="${Math.min(30,dh*0.1)}" fill="#fff" stroke="#222" stroke-width="2"/>`; }
  if(s.kind==="layout"){ for(const p of s.parts){ const px=x0+p.x*sc, py=ty+p.y*sc, pw=p.w*sc, pd=p.d*sc;
      g+=p.shape==="circle"?`<ellipse cx="${px+pw/2}" cy="${py+pd/2}" rx="${pw/2}" ry="${pd/2}" fill="#f7f9fb" stroke="#222" stroke-width="2"/>`:`<rect x="${px}" y="${py}" width="${pw}" height="${pd}" fill="#f7f9fb" stroke="#222" stroke-width="2"/>`;
      g+=`<text x="${px+pw/2}" y="${py+pd/2-2}" text-anchor="middle" font-size="16" font-weight="700" direction="rtl">${skx(p.label)}</text><text x="${px+pw/2}" y="${py+pd/2+18}" text-anchor="middle" font-size="14" fill="#555" direction="ltr">${skn(p.w)}×${skn(p.d)}</text>`; } }
  g+=skDimH(x0,x0+w,ty+dh+34,skn(L),ty+dh,ty+dh);
  g+=skDimV(ty,ty+dh,x0+w+40,skn(D),x0+w);
  y=ty+dh+70;
  // ---------- FRONT VIEW ----------
  if(twoViews){
    y+=40; g+=label("منظر من قدّام",y);
    const fy=y+30+B*sc; const floor=fy+H*sc; const top=fy; const th=Math.max(5,4*sc);
    if(s.kind==="hood"){
      const sl=Math.min(H*0.45,25)*sc;
      g+=`<path d="M${x0} ${top} H${x0+w} V${floor-sl} L${x0+w-sl*0.6} ${floor} H${x0+sl*0.6} L${x0} ${floor-sl} Z" fill="url(#steel)" stroke="#222" stroke-width="2.5"/>`;
      g+=`<rect x="${x0+w/2-30}" y="${top-40}" width="60" height="40" fill="#e9edf1" stroke="#222" stroke-width="2"/><text x="${x0+w/2}" y="${top-50}" text-anchor="middle" font-size="15" fill="#555" direction="rtl">مخرج الشفط</text>`;
    } else if(s.kind==="wall_shelf"){
      const n=Math.max(1,s.undershelf||1); for(let i=0;i<n;i++){ const yy=top+(H*sc)*(n===1?0.5:i/(n-1)); g+=`<rect x="${x0}" y="${yy-th/2}" width="${w}" height="${th}" fill="url(#steel)" stroke="#222" stroke-width="2"/>`; }
      g+=`<rect x="${x0+w*0.1}" y="${top}" width="${Math.max(4,1.5*sc)}" height="${H*sc}" fill="#999"/><rect x="${x0+w*0.9}" y="${top}" width="${Math.max(4,1.5*sc)}" height="${H*sc}" fill="#999"/>`;
    } else {
      if(B>0) g+=`<rect x="${x0}" y="${top-B*sc}" width="${w}" height="${B*sc}" fill="#dfe5ea" stroke="#222" stroke-width="2"/>`;
      g+=`<rect x="${x0}" y="${top}" width="${w}" height="${th}" fill="url(#steel)" stroke="#222" stroke-width="2.5"/>`;
      // legs
      const nf=Math.max(2,Math.round(s.legs/2)); const lw=Math.max(5,4*sc);
      for(let i=0;i<nf;i++){ const lx=x0+3*sc+(w-6*sc-lw)*(i/(nf-1)); g+=`<rect x="${lx}" y="${top+th}" width="${lw}" height="${floor-top-th-6}" fill="#cfd6dc" stroke="#222" stroke-width="1.5"/><rect x="${lx-3}" y="${floor-8}" width="${lw+6}" height="8" fill="#555"/>`; }
      if(s.kind==="cabinet"&&s.doors){ const dy=top+th+4, dhh=floor-14*sc-dy, dw=(w-6*sc)/s.doors;
        for(let i=0;i<s.doors;i++){ const dx=x0+3*sc+i*dw; g+=`<rect x="${dx+3}" y="${dy}" width="${dw-6}" height="${dhh}" fill="#eef2f5" stroke="#222" stroke-width="2"/><rect x="${i%2?dx+12:dx+dw-20}" y="${dy+dhh*0.15}" width="6" height="${Math.min(60,dhh*0.3)}" rx="3" fill="#666"/>`; }
        g+=`<rect x="${x0+3*sc}" y="${floor-14*sc}" width="${w-6*sc}" height="${Math.max(4,2*sc)}" fill="#cfd6dc" stroke="#222"/>`;
      } else for(let i=0;i<s.undershelf;i++){ const sy=floor-(18+i*((H-30)/Math.max(1,s.undershelf)))*sc; g+=`<rect x="${x0+3*sc}" y="${sy}" width="${w-6*sc}" height="${Math.max(4,2.5*sc)}" fill="#dde3e8" stroke="#222" stroke-width="1.5"/>`; }
      for(const k of s.sinks){ const sx=x0+k.x*sc; g+=`<rect x="${sx}" y="${top+th}" width="${k.width*sc}" height="${k.bowlDepth*sc}" fill="none" stroke="#1d3a57" stroke-width="2" stroke-dasharray="8 6"/><text x="${sx+k.width*sc/2}" y="${top+th+k.bowlDepth*sc/2+6}" text-anchor="middle" font-size="15" fill="#1d3a57" direction="rtl">عمق ${skn(k.bowlDepth)}</text>`; }
    }
    g+=`<line x1="${x0-60}" y1="${floor}" x2="${x0+w+60}" y2="${floor}" stroke="#888" stroke-width="2"/>`;
    g+=skDimH(x0,x0+w,floor+40,skn(L),floor,floor);
    g+=skDimV(top,floor,x0-50,skn(H),x0);
    if(B>0&&s.kind!=="hood"&&s.kind!=="wall_shelf") g+=skDimV(top-B*sc,top,x0+w+40,skn(B),x0+w);
    y=floor+80;
  }
  // ---------- notes ----------
  const notes=[s.material?`المادة: ${s.material}`:"",...(s.kind==="table"&&s.undershelf?[`رف تحتاني: ${s.undershelf}`]:[]),...(s.kind!=="layout"&&s.kind!=="hood"&&s.kind!=="wall_shelf"?[`إجرين: ${s.legs} مع رجلين قابلة للتعديل`]:[]),...s.notes].filter(Boolean);
  y+=10; for(const t of notes){ g+=`<text x="${W-M+40}" y="${y}" font-size="19" text-anchor="start" direction="rtl">• ${skx(t)}</text>`; y+=30; }
  y+=16;
  g+=`<rect x="0" y="${y}" width="${W}" height="64" fill="#f2f2f2"/><text x="${W-40}" y="${y+40}" font-size="17" fill="#555" text-anchor="start" direction="rtl">رسمة تقريبية للتوضيح. المقاسات النهائية بتتأكد بعد الكشف.</text>`;
  g+=`<text x="40" y="${y+40}" font-size="17" fill="#333" direction="ltr">${skx([st.company||"MADI Kitchen Equipment",st.phone,st.website].filter(Boolean).join("  ·  "))}</text>`;
  const Hh=Math.ceil(y+64);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" font-family="Tahoma, Arial, sans-serif" font-size="18" fill="#111">
<defs><marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9 z" fill="#c0392b"/></marker>
<linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".5" stop-color="#dfe4e8"/><stop offset="1" stop-color="#eef1f4"/></linearGradient>
<linearGradient id="bowl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3ccd4"/><stop offset="1" stop-color="#e7ecf0"/></linearGradient>
<pattern id="mesh" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8 L8 0" stroke="#999" stroke-width="1"/></pattern>
<style>.dim line{stroke:#c0392b;stroke-width:1.4}.dim text{fill:#c0392b;font-size:17px;font-weight:700;direction:ltr}</style></defs>
<rect width="100%" height="100%" fill="#fff"/>${g}</svg>`;
}
async function sketchPNG(spec){
  const svg=sketchSVG(spec); const m=svg.match(/^<svg[^>]*? width="(\d+)" height="(\d+)"/); const w=+m[1], h=+m[2];
  const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));
  try{ const img=new Image(); img.src=url; await img.decode();
    const c=document.createElement("canvas"); c.width=w; c.height=h; const x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,w,h); x.drawImage(img,0,0,w,h);
    return await new Promise(r=>c.toBlob(r,"image/png")); } finally { URL.revokeObjectURL(url); }
}
async function shareBlob(blob,name,text){
  const file=new File([blob],name,{type:blob.type});
  if(navigator.canShare&&navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file],title:name,text:text||""}); return; }catch(e){ if(e&&e.name==="AbortError") return; } }
  downloadFile(name,blob); toast("نزل الملف. ابعتو للزبون من واتساب.");
}
const skName=s=>"MADI-"+String(skNorm(s).title).replace(/[^\p{L}\p{N}]+/gu,"-").slice(0,40)+".png";
async function sketchShare(spec){ try{ shareBlob(await sketchPNG(spec),skName(spec)); }catch(e){ toast("ما زبط تحويل الرسمة لصورة"); } }
async function sketchDownload(spec){ try{ downloadFile(skName(spec),await sketchPNG(spec)); }catch(e){ toast("ما زبط تحويل الرسمة لصورة"); } }

// ---------- SKETCH VIEW ----------
const SK={spec:null,id:null,busy:false,desc:""};
function vSketch(){
  if(!SK.spec) SK.spec=skDefaults();
  const s=SK.spec; const list=(S.sketches||[]).slice().sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
  const num=(k,l,v)=>`<label class="f"><span>${l}</span><input type="number" step="any" min="0" class="num" data-sk="${k}" value="${v??""}"></label>`;
  return `<div class="head"><div><h1>الرسومات</h1><p class="sub">اكتب وصف الشغلة والمساعد بيرسمها بالمقاسات، أو عبّي المقاسات بإيدك. بعدين ابعتها للزبون صورة.</p></div>
   <div class="row"><button class="btn" id="sknew">رسمة جديدة</button></div></div>
  <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px">
   <label class="f"><span>الوصف (بالعربي متل ما الزبون حكاه)</span><textarea id="skdesc" rows="2" placeholder="مثلا: طاولة 3 متر بـ 80 عرض، فيها جرن 50 ب 40 عالشمال، ظهر 10 سم ورف تحت">${esc(SK.desc)}</textarea></label>
   <div class="row"><button class="btn pri" id="skai" ${SK.busy?"disabled":""}>${SK.busy?"عم يرسم…":"ارسم بالمساعد"}</button><span class="muted" style="font-size:13px">بعد الرسمة فيك تعدّل أي رقم تحت.</span></div>
  </div>
  <div class="sk-grid">
   <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:12px">
    <div class="fgrid">
     <label class="f"><span>النوع</span><select data-sk="kind">${Object.entries(SK_KINDS).map(([k,l])=>`<option value="${k}" ${s.kind===k?"selected":""}>${l}</option>`).join("")}</select></label>
     <label class="f"><span>العنوان</span><input type="text" data-sk="title" value="${esc(s.title)}"></label>
     <label class="f"><span>الزبون</span><input type="text" data-sk="customer" value="${esc(s.customer||"")}"></label>
     ${num("length","الطول (سم)",s.length)}${num("depth","العرض / العمق (سم)",s.depth)}${num("height",s.kind==="hood"?"ارتفاع الشفاط (سم)":"الارتفاع (سم)",s.height)}
     ${s.kind==="table"||s.kind==="cabinet"?num("backsplash","الظهر (سم، 0 بلا)",s.backsplash):""}
     ${s.kind==="table"||s.kind==="wall_shelf"?num("undershelf",s.kind==="wall_shelf"?"عدد الرفوف":"رفوف تحت",s.undershelf):""}
     ${s.kind==="table"||s.kind==="cabinet"?num("legs","عدد الإجرين",s.legs):""}
     ${s.kind==="cabinet"?num("doors","عدد الأبواب",s.doors):""}
     <label class="f"><span>المادة</span><input type="text" data-sk="material" value="${esc(s.material||"")}"></label>
    </div>
    ${s.kind==="table"||s.kind==="cabinet"?`<div><b style="font-size:14px">الجران</b>
     ${(s.sinks||[]).map((k,i)=>`<div class="row" style="flex-wrap:nowrap;margin-top:6px;gap:6px">
       <input type="number" class="num" step="any" data-sks="${i}" data-k="width" value="${k.width??""}" placeholder="طول" title="طول الجرن" style="width:25%">
       <input type="number" class="num" step="any" data-sks="${i}" data-k="depth" value="${k.depth??""}" placeholder="عرض" title="عرض الجرن" style="width:25%">
       <input type="number" class="num" step="any" data-sks="${i}" data-k="bowlDepth" value="${k.bowlDepth??""}" placeholder="عمق" title="عمق الجرن" style="width:22%">
       <input type="number" class="num" step="any" data-sks="${i}" data-k="x" value="${k.x??""}" placeholder="بعد عن الشمال" title="بعد الجرن عن طرف الطاولة الشمال (فاضي = بالنص)" style="width:28%">
       <button class="x" data-skdel="${i}" aria-label="احذف الجرن">×</button></div>`).join("")}
     <div class="muted" style="font-size:12px;margin-top:4px">طول × عرض × عمق، وبعدو عن طرف الطاولة الشمال (خليه فاضي ليتوزّع لحالو)</div>
     <button class="btn sm" id="skaddsink" style="margin-top:6px">+ جرن</button></div>`:""}
    <label class="f"><span>ملاحظات (كل سطر لحال)</span><textarea data-sk="notes" rows="3">${esc((s.notes||[]).join("\n"))}</textarea></label>
    <div class="row"><button class="btn pri" id="sksave" ${S.canWrite?"":"disabled"}>حفظ</button><button class="btn" id="skshare">شارك صورة</button><button class="btn" id="skdl">نزّل PNG</button></div>
   </div>
   <div class="card sk-prev" id="skprev">${sketchSVG(s)}</div>
  </div>
  ${list.length?`<div class="card"><div class="ch"><h2>رسومات محفوظة</h2></div><div class="scroll"><table><tbody>${list.map(k=>`<tr class="click" data-skopen="${k.id}"><td>${esc(k.title||"")}</td><td class="muted">${esc(k.customer||"")}</td><td class="num muted">${esc(String(k.updatedAt||"").slice(0,10))}</td><td class="del"><button class="x" data-skrm="${k.id}" aria-label="احذف">×</button></td></tr>`).join("")}</tbody></table></div></div>`:""}`;
}
function skReadForm(){
  const s=SK.spec;
  document.querySelectorAll("[data-sk]").forEach(el=>{const k=el.dataset.sk; if(k==="notes") s.notes=el.value.split("\n"); else if(el.type==="number") s[k]=el.value===""?"":+el.value; else s[k]=el.value;});
  document.querySelectorAll("[data-sks]").forEach(el=>{const k=s.sinks[+el.dataset.sks]; if(k) k[el.dataset.k]=el.value===""?null:+el.value;});
}
function bindSketch(){
  if(!$("#skprev")) return;
  const upd=()=>{skReadForm(); $("#skprev").innerHTML=sketchSVG(SK.spec);};
  document.querySelectorAll("[data-sk],[data-sks]").forEach(el=>{el.oninput=upd; if(el.dataset.sk==="kind") el.onchange=()=>{skReadForm();render()};});
  $("#skdesc").oninput=e=>{SK.desc=e.target.value};
  $("#skaddsink")&&($("#skaddsink").onclick=()=>{skReadForm();SK.spec.sinks.push({width:50,depth:40,bowlDepth:30,x:null});render()});
  document.querySelectorAll("[data-skdel]").forEach(b=>b.onclick=()=>{skReadForm();SK.spec.sinks.splice(+b.dataset.skdel,1);render()});
  $("#sknew").onclick=()=>{SK.spec=skDefaults();SK.id=null;SK.desc="";render()};
  $("#skshare").onclick=()=>{skReadForm();sketchShare(SK.spec)};
  $("#skdl").onclick=()=>{skReadForm();sketchDownload(SK.spec)};
  $("#sksave").onclick=async()=>{skReadForm(); const s=skNorm(SK.spec); SK.id=SK.id||uid();
    if(await save("sketches",{id:SK.id,title:s.title,customer:s.customer,spec:SK.spec})) toast("انحفظت الرسمة");};
  $("#skai").onclick=async()=>{ const d=$("#skdesc").value.trim(); if(!d){toast("اكتب وصف أول");return}
    SK.busy=true; render();
    try{ const spec=await aiSketch(d); SK.spec=spec; SK.id=null; toast("جاهزة. راجع المقاسات."); }
    catch(e){ toast(aiErrMsg(e)); }
    SK.busy=false; render(); };
  document.querySelectorAll("[data-skopen]").forEach(r=>r.onclick=e=>{ if(e.target.closest("[data-skrm]")) return; const k=(S.sketches||[]).find(x=>x.id===r.dataset.skopen); if(k){SK.spec=JSON.parse(JSON.stringify(k.spec||skDefaults()));SK.id=k.id;render();window.scrollTo(0,0)} });
  document.querySelectorAll("[data-skrm]").forEach(b=>b.onclick=async e=>{e.stopPropagation(); if(await remove("sketches",b.dataset.skrm)) toast("انحذفت الرسمة")});
}
