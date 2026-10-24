// ---------- AI ASSISTANT ----------
const AI={turns:[],busy:false,ctl:null,msgs:[],status:"",draft:null};
const normAr=s=>String(s||"").toLowerCase().replace(/[ً-ْـ]/g,"").replace(/[أإآا]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/ؤ/g,"و").replace(/ئ/g,"ي");
const SYN={"براد":["ثلاجه","fridge","refrigerator"],"ثلاجه":["براد"],"فريزر":["freezer"],"غريل":["griddle","grill","شوايه"],"شوايه":["grill","غريل"],"قلايه":["fryer"],"فرن":["oven"],"عجانه":["mixer","خفاقه"],"سخان":["warmer"],"عصاره":["juicer"],"كيك":["cake"],"طاوله":["table"],"غاز":["gas","burner"]};
function searchProducts(q,limit=12){
  const toks=normAr(q).split(/[\s،,]+/).filter(t=>t.length>1);
  const scored=S.products.map(p=>{
    const hay=normAr([p.nameAr,p.nameEn,p.cat,p.brand,p.code,(p.variants||[]).map(v=>v.label).join(" ")].join(" "));
    let s=0; for(const t of toks){ if(hay.includes(t)) s+=2; else if((SYN[t]||[]).some(x=>hay.includes(normAr(x)))) s+=1.5; else if(/^\d+$/.test(t)&&hay.includes(t)) s+=1; }
    return [s,p];
  }).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]).slice(0,limit);
  return scored.map(([s,p])=>({code:p.code||p.id,id:p.id,name:p.nameAr,nameEn:p.nameEn,category:p.cat,brand:p.brand,price:+p.price||0,cost:+p.cost||0,stock:stock(p.id),
    sizes:(p.variants||[]).map(v=>({label:v.label,price:+v.price||0})),specs:String(p.notes||"").slice(0,220)}));
}
function findParty(name,type){
  const n=normAr(name).trim(); if(!n) return null;
  const list=S.parties.filter(p=>!type||p.type===type);
  return list.find(p=>normAr(p.name)===n)||list.find(p=>normAr(p.name).includes(n)||n.includes(normAr(p.name)))||null;
}
function partiesWithBalance(type,min){
  return S.parties.filter(p=>p.type===type).map(p=>({name:p.name,phone:p.phone||"",balance:partyBal(p.id),lastInvoice:(S.invoices.filter(i=>i.partyId===p.id&&live(i)&&i.type!=="quote").map(i=>i.date).sort().pop())||null}))
    .filter(x=>x.balance>=(+min||0.01)).sort((a,b)=>b.balance-a.balance).slice(0,40);
}
function reportData(from,to){
  const p=pnl(from,to); const top={};
  for(const inv of S.invoices) if(live(inv)&&inv.type==="sale"&&inv.date>=from&&inv.date<=to) for(const l of inv.lines||[]){const k=l.name;top[k]=top[k]||{qty:0,sales:0,profit:0};top[k].qty+=+l.qty||0;top[k].sales+=(+l.qty||0)*(+l.price||0);top[k].profit+=(+l.qty||0)*((+l.price||0)-(+l.cost||0))}
  const cnt=S.invoices.filter(i=>live(i)&&i.type==="sale"&&i.date>=from&&i.date<=to).length;
  return {from,to,salesInvoices:cnt,sales:p.sales,costOfGoods:p.cogs,grossProfit:p.gross,expenses:p.exp,otherIncome:p.inc,netProfit:p.net,expensesByCategory:p.byCat,
    topProducts:Object.entries(top).sort((a,b)=>b[1].sales-a[1].sales).slice(0,10).map(([n,o])=>({name:n,qty:o.qty,sales:r2(o.sales),profit:r2(o.profit)})),
    note:p.cogs===0&&p.sales>0?"سعر الكلفة مش معبّى لكتير منتجات، فالربح ممكن يطلع أعلى من الحقيقي":undefined};
}
function invoicesList(from,to,type,partyName){
  const pid=partyName?(findParty(partyName)||{}).id:null;
  return S.invoices.filter(i=>(!type||i.type===type)&&(!from||i.date>=from)&&(!to||i.date<=to)&&(!partyName||i.partyId===pid))
    .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,40)
    .map(i=>({no:i.no,date:i.date,type:i.type,party:(partyById(i.partyId)||{}).name||"نقدي",total:invTotal(i),paid:+i.paid||0,status:i.status==="cancelled"?"ملغاة":"",items:(i.lines||[]).map(l=>`${l.qty}× ${l.name}`).join("، ")}));
}
function lowStock(){ return S.products.filter(p=>(+p.minQty||0)>0&&stock(p.id)<=(+p.minQty||0)).map(p=>({name:p.nameAr,stock:stock(p.id),min:+p.minQty})); }

const AI_TOOLS=[
 {name:"search_products",description:"يدوّر بكتالوج المنتجات بالاسم أو النوع أو المقاس (عربي أو إنجليزي). بيرجّع لحد 12 منتج مع الكود، الأسعار، المقاسات وأسعارها، والكمية الموجودة. استعملو قبل ما تذكر أي منتج أو سعر.",
  inputSchema:{type:"object",properties:{query:{type:"string",description:"كلمات البحث، مثلا: براد طاولة 140"}},required:["query"]},
  execute:(i)=>{AI.setStatus("عم دوّر بالمنتجات: "+String(i.query||""));return searchProducts(String(i.query||""))}},
 {name:"party_balances",description:"بيرجّع الزباين (customer) أو الموردين (supplier) يلي رصيدن أكبر من حد معيّن، مع آخر فاتورة. الرصيد الموجب للزبون = دين عليه لإلنا؛ للمورد = علينا إلو.",
  inputSchema:{type:"object",properties:{type:{type:"string",enum:["customer","supplier"]},min:{type:"number",description:"أقل رصيد بالدولار، افتراضي 0.01"}},required:["type"]},
  execute:(i)=>{AI.setStatus("عم شوف الأرصدة");return partiesWithBalance(i.type==="supplier"?"supplier":"customer",+i.min||0.01)}},
 {name:"profit_report",description:"تقرير أرباح وخسائر بين تاريخين (YYYY-MM-DD): المبيعات، الكلفة، الربح الإجمالي، المصاريف حسب البند، صافي الربح، وأكتر 10 منتجات مبيعة.",
  inputSchema:{type:"object",properties:{from:{type:"string"},to:{type:"string"}},required:["from","to"]},
  execute:(i)=>{AI.setStatus("عم احسب التقرير");return reportData(String(i.from),String(i.to))}},
 {name:"list_invoices",description:"لائحة فواتير (sale بيع، purchase شراء، quote عرض سعر) بفترة معيّنة أو لزبون معيّن، لحد 40 فاتورة.",
  inputSchema:{type:"object",properties:{from:{type:"string"},to:{type:"string"},type:{type:"string",enum:["sale","purchase","quote"]},party:{type:"string"}}},
  execute:(i)=>{AI.setStatus("عم جيب الفواتير");return invoicesList(i.from?String(i.from):"",i.to?String(i.to):"",i.type?String(i.type):"",i.party?String(i.party):"")}},
 {name:"cash_and_stock",description:"رصيد الصندوق هلق، والمنتجات يلي قرّبت تخلص.",
  execute:()=>({cash:cashBalance(today()),lowStock:lowStock()})},
 {name:"prepare_invoice",description:"بيحضّر مسودة فاتورة (ما بتنحفظ) وبيفتحها للمستخدم ليراجعها ويحفظها بنفسو. لازم تكون عملت search_products قبل وتستعمل الكود الصحيح. إذا المنتج إلو مقاسات، حط size بنفس اسم المقاس. price اختياري (إذا ما انذكر بينحط سعر المقاس). إذا ما في منتج مطابق بالكتالوج، استعمل name بدل code (خدمة أو منتج مش موجود).",
  inputSchema:{type:"object",properties:{type:{type:"string",enum:["sale","purchase","quote"]},party:{type:"string",description:"اسم الزبون أو المورد"},
    lines:{type:"array",items:{type:"object",properties:{code:{type:"string"},name:{type:"string"},size:{type:"string"},qty:{type:"number"},price:{type:"number"}}}},
    paid:{type:"number"},discount:{type:"number"},notes:{type:"string"}},required:["type","lines"]},
  execute:(i)=>buildDraft(i)}
];
function buildDraft(i){
  const type=["sale","purchase","quote"].includes(i.type)?i.type:"sale"; const isPur=type==="purchase";
  const party=i.party?findParty(String(i.party),isPur?"supplier":"customer"):null;
  const lines=[]; const issues=[];
  for(const l of (Array.isArray(i.lines)?i.lines:[])){
    const p=l.code?S.products.find(x=>x.code===String(l.code)||x.id===String(l.code)):null;
    const qty=+l.qty||1;
    if(p){ let vi, v; if((p.variants||[]).length){ const sz=normAr(l.size||""); vi=p.variants.findIndex(x=>normAr(x.label)===sz); if(vi<0&&sz) vi=p.variants.findIndex(x=>normAr(x.label).includes(sz)||sz.includes(normAr(x.label))); if(vi<0){vi=0; if(l.size) issues.push(`ما لقيت مقاس "${l.size}" لـ ${p.nameAr}، حطيت أول مقاس`);} v=p.variants[vi]; }
      const def=isPur?(+p.cost||0):(v?+v.price:(+p.price||0));
      lines.push({pid:p.id,base:p.nameAr,name:v?p.nameAr+" — "+v.label:p.nameAr,vi,qty,price:l.price!=null&&!isNaN(+l.price)?+l.price:def,cost:+p.cost||0}); }
    else { lines.push({pid:"",name:String(l.name||l.code||"بند"),qty,price:+l.price||0,cost:0}); if(l.code) issues.push(`الكود ${l.code} مش موجود، حطيتو كسطر حر`); }
  }
  if(!lines.length) throw new Error("ما في أسطر بالفاتورة");
  const total=r2(lines.reduce((a,l)=>a+l.qty*l.price,0)-(+i.discount||0));
  AI.draft={type,partyId:party?party.id:"",partyName:i.party?String(i.party):"",newParty:!!(i.party&&!party),lines,paid:Math.min(+i.paid||0,total),discount:+i.discount||0,notes:String(i.notes||"")};
  AI.setStatus("حضّرت مسودة الفاتورة");
  return {ok:true,total,party:party?party.name:(i.party?`"${i.party}" مش موجود بالزباين، المستخدم لازم يزيدو`:"زبون نقدي"),lines:lines.map(l=>`${l.qty}× ${l.name} @ $${l.price}`),issues};
}
function aiRules(){
  const cats=[...new Set(S.products.map(p=>p.cat).filter(Boolean))].join("، ");
  return `إنت المساعد المحاسبي لشركة ${S.settings.companyAr||"ماضي"} (${S.settings.company||"MADI Kitchen Equipment"}) بلبنان: معدات مطابخ ومطاعم، تركيب، صيانة، وبيع جديد ومستعمل.
اليوم ${today()}. سعر صرف الدولار ${fmt(rate())} ل.ل. كل الحسابات بالدولار.
فئات المنتجات: ${cats}.
عدد المنتجات ${S.products.length}، الزباين ${S.parties.filter(p=>p.type==="customer").length}، الموردين ${S.parties.filter(p=>p.type==="supplier").length}، الفواتير ${S.invoices.length}.

قواعد:
- احكي باللهجة اللبنانية، جمل قصيرة وواضحة. استعمل أرقام إنجليزية للأسعار ($).
- كل رقم أو سعر أو اسم منتج لازم يجي من الأدوات. ما تخترع ولا رقم. إذا الأداة ما رجّعت شي، قول هيك.
- أسعار المنتجات هي أسعار الكتالوج (أغلبها من كتالوج العبدالله). إذا سعر الكلفة صفر، نبّه إنو الربح تقريبي.
- لطلب فاتورة أو عرض سعر: دوّر على كل منتج بـ search_products، اختار الأقرب والمقاس المطلوب، وبعدين prepare_invoice. "الباقي دين" يعني paid أقل من المجموع. بعد ما تحضّرها، قول للمستخدم بسطرين شو حطيت، وإنها مفتوحة قدامو ليراجعها ويكبس حفظ. ما تقول إنها انحفظت.
- إذا في أكتر من منتج ممكن يطابق وما في طريقة تعرف، اسأل سؤال قصير بدل ما تخمّن.
- لأسئلة الزباين: اقترح 2-4 منتجات من الكتالوج بس، مع المقاس والسعر وليش بتناسب، وبعدين اكتب رسالة واتساب قصيرة ولطيفة جاهزة للنسخ بين سطرين ---.
- للأسئلة عن الأرقام: جاوب مباشرة بالرقم، وبعدين تفصيل صغير إذا لازم.
- ما فيك تحفظ أو تحذف شي. بس تحضّر مسودة فاتورة.`;
}
