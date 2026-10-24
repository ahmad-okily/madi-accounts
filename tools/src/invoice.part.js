// ---------- INVOICE: print / PDF / share (canvas pages, no external library) ----------
const IV={W:1654,H:2339,M:120};
const hasAr=t=>/[؀-ۿ]/.test(String(t||""));
function ivText(x,t,X,Y,font,color,align){ x.font=font; x.fillStyle=color||"#111"; x.textAlign=align||"left"; x.direction=hasAr(t)?"rtl":"ltr"; x.fillText(String(t??""),X,Y); }
function ivWrap(x,t,maxW,font){ x.font=font; const out=[]; for(const para of String(t||"").split("\n")){ let line=""; for(const w of para.split(/\s+/)){ const tst=line?line+" "+w:w; if(x.measureText(tst).width>maxW&&line){out.push(line);line=w}else line=tst; } out.push(line); } return out.filter((l,i,a)=>l||a.length===1); }
const ivMoney=v=>(Math.round((+v||0)*100)/100).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const ivDate=d=>{const [y,m,dd]=String(d||"").split("-");return dd?`${dd}/${m}/${y}`:String(d||"")};
let LOGO_IMG=null;
async function ivLogo(){ if(LOGO_IMG) return LOGO_IMG; try{ const i=new Image(); i.src="icons/logo-word.jpg"; await i.decode(); LOGO_IMG=i; }catch(e){} return LOGO_IMG; }
function ivLineInfo(l){
  const p=l.pid&&prodById(l.pid); const v=p&&l.vi!=null&&(p.variants||[])[l.vi];
  const title=(p&&p.nameEn)?p.nameEn:(l.base||l.name||"");
  const det=[v?v.label:"", p&&p.nameEn?(l.base||p.nameAr):"", l.det||""].filter(Boolean).join(" · ");
  return {title,det};
}
async function invoicePages(inv){
  const st=S.settings, p=partyById(inv.partyId)||{}, logo=await ivLogo();
  const {W,H,M}=IV; const pages=[]; let c,x,y;
  const docTitle={sale:"INVOICE",purchase:"PURCHASE INVOICE",quote:"QUOTATION"}[inv.type]||"INVOICE";
  const noTxt="#"+(String(inv.no||"").replace(/^\D+-?/,"")||inv.no);
  const cols={desc:M, qty:W-M-640, price:W-M-330, amt:W-M}; // qty/price/amount are right-aligned anchors
  const newPage=(first)=>{
    c=document.createElement("canvas"); c.width=W; c.height=H; x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,W,H); pages.push(c);
    y=M;
    if(logo){ const lh=110, lw=logo.naturalWidth*lh/logo.naturalHeight; x.drawImage(logo,M,y-10,Math.min(lw,420),lh); }
    ivText(x,docTitle,W-M,y+40,"700 64px Helvetica, Arial, sans-serif","#111","right");
    ivText(x,noTxt,W-M,y+92,"400 30px Helvetica, Arial, sans-serif","#666","right");
    y+=140;
    ivText(x,st.company||"Madi Kitchen Equipment",M,y,"700 40px Helvetica, Arial, sans-serif");
    ivText(x,"Issued "+ivDate(inv.date),W-M,y,"400 28px Helvetica, Arial, sans-serif","#444","right");
    y+=40; x.fillStyle="#111"; x.fillRect(M,y,W-2*M,4); y+=70;
    if(first){
      const half=(W-2*M)/2;
      ivText(x,"FROM",M,y,"700 24px Helvetica, Arial, sans-serif","#888"); ivText(x,inv.type==="purchase"?"SUPPLIER":"BILL TO",M+half,y,"700 24px Helvetica, Arial, sans-serif","#888");
      y+=46;
      const from=[st.company||"Madi Kitchen Equipment",st.phone,st.address,st.website].filter(Boolean);
      const to=[p.name||(inv.type==="purchase"?"—":"Cash customer"),p.phone,p.address].filter(Boolean);
      for(let i=0;i<Math.max(from.length,to.length);i++){ const f=i===0?"700 30px Helvetica, Arial, sans-serif":"400 28px Helvetica, Arial, sans-serif";
        if(from[i]) ivText(x,from[i],M,y,f,i?"#444":"#111"); if(to[i]) ivText(x,to[i],M+half,y,f,i?"#444":"#111"); y+=42; }
      y+=40;
    }
    // table head
    x.fillStyle="#f1f1f1"; x.fillRect(M,y,W-2*M,64);
    const hf="700 24px Helvetica, Arial, sans-serif";
    ivText(x,"DESCRIPTION",cols.desc+20,y+42,hf,"#555"); ivText(x,"QTY",cols.qty,y+42,hf,"#555","right");
    ivText(x,"PRICE USD",cols.price,y+42,hf,"#555","right"); ivText(x,"AMOUNT USD",cols.amt-20,y+42,hf,"#555","right");
    y+=64;
  };
  newPage(true);
  const descW=cols.qty-cols.desc-140;
  for(const l of inv.lines||[]){
    const {title,det}=ivLineInfo(l);
    const tl=ivWrap(x,title,descW,"700 30px Helvetica, Arial, sans-serif"), dl=det?ivWrap(x,det,descW,"400 25px Helvetica, Arial, sans-serif"):[];
    const rh=30+tl.length*40+dl.length*34+24;
    if(y+rh>H-M-260){ newPage(false); }
    let yy=y+46;
    tl.forEach((t,i)=>ivText(x,t,cols.desc+20,yy+i*40,"700 30px Helvetica, Arial, sans-serif"));
    yy+=tl.length*40-6; dl.forEach((t,i)=>ivText(x,t,cols.desc+20,yy+i*34,"400 25px Helvetica, Arial, sans-serif","#888"));
    const nf="400 30px Helvetica, Arial, sans-serif";
    ivText(x,fmt(l.qty),cols.qty,y+46,nf,"#111","right"); ivText(x,ivMoney(l.price),cols.price,y+46,nf,"#111","right"); ivText(x,ivMoney((+l.qty||0)*(+l.price||0)),cols.amt-20,y+46,nf,"#111","right");
    y+=rh; x.fillStyle="#e3e3e3"; x.fillRect(M,y-2,W-2*M,2);
  }
  // totals
  const total=invTotal(inv), sub=r2(total+(+inv.discount||0));
  if(y>H-M-420) newPage(false);
  y+=20; const lab=cols.price-160;
  const trow=(l,v,big,color)=>{ ivText(x,l,lab,y+40,(big?"700 34px":"400 28px")+" Helvetica, Arial, sans-serif",color||"#444","right"); ivText(x,v,cols.amt-20,y+40,(big?"700 34px":"400 28px")+" Helvetica, Arial, sans-serif",color||"#111","right"); y+=big?64:50; };
  if(+inv.discount){ trow("Subtotal","$"+ivMoney(sub)); trow("Discount","-$"+ivMoney(inv.discount)); }
  x.fillStyle="#111"; x.fillRect(lab-260,y+6,cols.amt-lab+260,3); y+=10;
  trow("Total","$"+ivMoney(total),true);
  if(inv.type==="sale"&&(+inv.paid||0)>0){ trow("Paid","$"+ivMoney(inv.paid)); const due=r2(total-(+inv.paid||0)); trow("Balance due","$"+ivMoney(due),false,due>0.009?"#b42318":"#111"); }
  ivText(x,"≈ "+fmt(Math.round(total*rate()))+" LBP  (rate "+fmt(rate())+")",cols.amt-20,y+26,"400 22px Helvetica, Arial, sans-serif","#999","right"); y+=50;
  // notes
  const notes=[inv.notes,st.invoiceNotes].filter(x=>String(x||"").trim()).join("\n");
  if(notes){
    const nl=ivWrap(x,notes,W-2*M,"400 27px Helvetica, Arial, sans-serif");
    if(y+90+nl.length*40>H-M-60) newPage(false);
    y+=50; ivText(x,"NOTES & PAYMENTS INSTRUCTIONS",M,y,"700 26px Helvetica, Arial, sans-serif","#555"); y+=48;
    nl.forEach(t=>{ ivText(x,t,hasAr(t)?W-M:M,y,"400 27px Helvetica, Arial, sans-serif","#333",hasAr(t)?"right":"left"); y+=40; });
  }
  // footer on every page
  pages.forEach((pc,i)=>{ const g=pc.getContext("2d"); g.fillStyle="#e3e3e3"; g.fillRect(M,H-M+10,W-2*M,2);
    ivText(g,[st.company||"Madi Kitchen Equipment",st.phone,st.website].filter(Boolean).join("   ·   "),M,H-M+56,"400 24px Helvetica, Arial, sans-serif","#888");
    if(pages.length>1) ivText(g,`Page ${i+1} of ${pages.length}`,W-M,H-M+56,"400 24px Helvetica, Arial, sans-serif","#888","right"); });
  return pages;
}
// minimal PDF writer: one full-page JPEG per page
async function pagesToPDF(pages){
  const enc=new TextEncoder(); const parts=[]; let len=0; const offs=[];
  const add=b=>{ if(typeof b==="string") b=enc.encode(b); parts.push(b); len+=b.length; };
  const imgs=[]; for(const c of pages){ const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",0.9)); imgs.push(new Uint8Array(await blob.arrayBuffer())); }
  const n=pages.length, PW=595.28, PH=841.89;
  add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const obj=(i,body)=>{ offs[i]=len; add(`${i} 0 obj\n`); if(Array.isArray(body)) body.forEach(add); else add(body); add("\nendobj\n"); };
  obj(1,"<< /Type /Catalog /Pages 2 0 R >>");
  obj(2,`<< /Type /Pages /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(" ")}] /Count ${n} >>`);
  pages.forEach((c,i)=>{ const p=3+i*3, cs=p+1, im=p+2;
    obj(p,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${cs} 0 R >>`);
    const content=`q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    obj(cs,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    obj(im,[`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgs[i].length} >>\nstream\n`,imgs[i],"\nendstream"]);
  });
  const total=3+n*3; const xref=len;
  add(`xref\n0 ${total}\n0000000000 65535 f \n`+Array.from({length:total-1},(_,i)=>String(offs[i+1]).padStart(10,"0")+" 00000 n \n").join(""));
  add(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts,{type:"application/pdf"});
}
const invFileName=inv=>`MADI-${({sale:"Invoice",purchase:"Purchase",quote:"Quotation"})[inv.type]||"Invoice"}-${String(inv.no||"").replace(/[^\w-]+/g,"")}.pdf`;
async function exportInvoice(inv,mode){
  mode=mode||"print";
  try{
    const pages=await invoicePages(inv);
    if(mode==="print"){
      const imgs=pages.map(c=>`<img src="${c.toDataURL("image/jpeg",0.92)}">`).join("");
      printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.no)}</title><style>@page{size:A4;margin:0}html,body{margin:0}img{display:block;width:210mm;height:297mm;page-break-after:always}img:last-child{page-break-after:auto}</style></head><body>${imgs}</body></html>`);
      return;
    }
    const pdf=await pagesToPDF(pages);
    if(mode==="share"){ const p=partyById(inv.partyId)||{}; await shareBlob(pdf,invFileName(inv),`${S.settings.company||"MADI"} · ${inv.no}`); }
    else downloadFile(invFileName(inv),pdf);
  }catch(e){ console.error(e); toast("ما زبط تجهيز الفاتورة"); }
}
