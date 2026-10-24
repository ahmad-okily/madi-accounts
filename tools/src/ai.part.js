// ---------- AI: drawing tool + server call ----------
const SKETCH_SCHEMA={type:"object",properties:{
  kind:{type:"string",enum:["table","cabinet","hood","wall_shelf","layout"],description:"table = طاولة أو مجلى ستانلس (مع أو بلا جران)، cabinet = خزانة بأبواب، hood = شفاط، wall_shelf = رف حيط، layout = مخطط مطبخ من فوق لأي شي تاني"},
  title:{type:"string",description:"عنوان قصير بالعربي، مثلا: طاولة ستانلس 300 مع جرن"},
  customer:{type:"string"},
  length:{type:"number",description:"الطول بالسنتيمتر (3 متر = 300)"},
  depth:{type:"number",description:"العرض أو العمق من قدّام لورا بالسنتيمتر"},
  height:{type:"number",description:"الارتفاع بالسنتيمتر. الطاولات عادة 85-90 إذا ما انذكر"},
  backsplash:{type:"number",description:"ارتفاع الظهر بالسنتيمتر، 0 إذا بلا ظهر. افتراضي 10 للمجالي"},
  undershelf:{type:"integer",description:"عدد الرفوف تحت (أو عدد رفوف رف الحيط)"},
  legs:{type:"integer",description:"عدد الإجرين. 4 للأقصر من 2 متر، 6 للأطول"},
  doors:{type:"integer",description:"عدد الأبواب للخزانة"},
  sinks:{type:"array",items:{type:"object",properties:{width:{type:"number",description:"طول الجرن على طول الطاولة"},depth:{type:"number",description:"عرض الجرن من قدّام لورا"},bowlDepth:{type:"number",description:"عمق الجرن لتحت، افتراضي 30"},x:{type:"number",description:"بعد الجرن عن طرف الطاولة الشمال. اتركه إذا الزبون ما حدد"}},required:["width","depth"]}},
  parts:{type:"array",description:"للـ layout بس: قطع من فوق. x,y من الزاوية الشمال الورا",items:{type:"object",properties:{label:{type:"string"},x:{type:"number"},y:{type:"number"},w:{type:"number"},d:{type:"number"},shape:{type:"string",enum:["rect","circle"]}},required:["label","x","y","w","d"]}},
  material:{type:"string",description:"افتراضي: ستانلس ستيل 304"},
  notes:{type:"array",items:{type:"string"},description:"ملاحظات قصيرة بالعربي بتنطبع عالرسمة (حنفية، فتحة تصريف، عجلات...)"}
},required:["kind","title","length","depth"]};
AI_TOOLS.push({name:"draw_sketch",description:"بيعمل رسمة تقريبية بالمقاسات (منظر من فوق ومنظر من قدّام) لطاولة، مجلى، خزانة، شفاط، رف، أو مخطط مطبخ، لتنبعت للزبون صورة. استعملها كل ما حدا طلب رسمة أو وصف قطعة بمقاسات. حوّل المتر لسنتيمتر.",
  inputSchema:SKETCH_SCHEMA, execute:(i)=>{ AI.sketch=skNorm(i); AI.setStatus("عم ارسم"); return {ok:true,shown_to_user:true,length:AI.sketch.length,depth:AI.sketch.depth,sinks:AI.sketch.sinks.map(k=>`${k.width}×${k.depth} على بعد ${k.x} من الشمال`)}; }});
const toolDefs=list=>list.map(t=>({name:t.name,description:t.description,input_schema:t.inputSchema||{type:"object",properties:{}}}));
function aiErrMsg(e){
  const m=String((e&&e.message)||e||"");
  if(m==="offline") return "المساعد بدو إنترنت. جرّب لما يرجع النت.";
  if(m==="no_backend") return "المساعد بيشتغل بس لما التطبيق يكون موصول بـ Supabase.";
  if(m==="no_key") return "لازم تحط مفتاح Anthropic بـ Supabase أول (شوف ملف AI-SETUP بالـ GitHub).";
  if(m==="no_function") return "لازم تنشر دالة المساعد (ai) على Supabase أول.";
  if(m==="not_signed_in") return "لازم تعمل تسجيل دخول من جديد.";
  if(/credit|billing|balance/i.test(m)) return "الرصيد بحساب Anthropic خلص. اشحن من console.anthropic.com.";
  if(/authentication|api.key|x-api-key/i.test(m)) return "مفتاح Anthropic غلط. حطّو من جديد بـ Supabase.";
  if(/overloaded|rate/i.test(m)) return "الخدمة مضغوطة هلق. جرّب بعد دقيقة.";
  if(m==="aborted") return "";
  return "صار خطأ بالمساعد: "+m.slice(0,140);
}
async function aiCall(body){
  if(!navigator.onLine) throw new Error("offline");
  if(!Store.sb) throw new Error("no_backend");
  const {data,error}=await Store.sb.functions.invoke("ai",{body});
  if(error){ let info=null; try{ info=await error.context.json(); }catch(_){}
    const st=error.context&&error.context.status;
    if(st===404&&!(info&&info.error)) throw new Error("no_function");
    if(info&&info.error) throw new Error(typeof info.error==="string"?info.error:(info.error.message||info.error.type||"error"));
    throw new Error(error.message||"error"); }
  if(data&&data.type==="error") throw new Error((data.error&&data.error.message)||"error");
  return data;
}
// runs the tool loop locally: the model asks for a tool, the app runs it on its own data and sends the result back
async function aiRun(system,history,tools,opts){
  opts=opts||{}; const msgs=history.slice(); let text="";
  for(let step=0;step<10;step++){
    if(AI.cancel) throw new Error("aborted");
    const res=await aiCall({system,messages:msgs,tools:tools?toolDefs(tools):undefined,tool_choice:opts.tool_choice,max_tokens:opts.max_tokens||2500});
    const blocks=res.content||[]; msgs.push({role:"assistant",content:blocks});
    const t=blocks.filter(b=>b.type==="text").map(b=>b.text).join("\n").trim(); if(t) text=t;
    const uses=blocks.filter(b=>b.type==="tool_use");
    if(res.stop_reason!=="tool_use"||!uses.length) break;
    const results=[];
    for(const u of uses){ const tool=(tools||[]).find(x=>x.name===u.name); let out, err=false;
      try{ out=tool?await tool.execute(u.input||{}):{error:"unknown tool"}; }catch(e){ out={error:String(e.message||e)}; err=true; }
      results.push({type:"tool_result",tool_use_id:u.id,content:JSON.stringify(out).slice(0,30000),is_error:err||undefined}); }
    if(opts.stopAfterTool) return {text,msgs};
    msgs.push({role:"user",content:results});
  }
  return {text,msgs};
}
async function aiSketch(desc){
  AI.sketch=null; AI.cancel=false;
  const tool=AI_TOOLS.find(t=>t.name==="draw_sketch");
  await aiRun(`إنت رسّام فني بشركة ${S.settings.companyAr||"ماضي"} لمعدات المطابخ الستانلس بلبنان. حوّل وصف الزبون لمقاسات بالسنتيمتر واستعمل draw_sketch. إذا شي مش محدد، استعمل المقاسات المعتادة بالمطابخ التجارية (ارتفاع 90، ظهر 10، رف تحت واحد، عمق جرن 30).`,
    [{role:"user",content:desc}],[tool],{tool_choice:{type:"tool",name:"draw_sketch"},stopAfterTool:true,max_tokens:1500});
  if(!AI.sketch) throw new Error("ما طلعت رسمة");
  return AI.sketch;
}

// ---------- AI ASSISTANT VIEW ----------
AI.setStatus=s=>{AI.status=s;const el=$("#aistatus");if(el)el.textContent=s;};
function aiRules2(){ return aiRules()+`
- لطلب رسمة (طاولة، مجلى، جرن، خزانة، شفاط، رف، مخطط): استعمل draw_sketch بالسنتيمتر. الرسمة بتطلع للمستخدم لحالها، إنت بس قول بسطر شو رسمت وإذا في شي افترضتو (متل الارتفاع).
- إذا طلب عرض سعر مع الرسمة، حضّر كمان prepare_invoice من نوع quote.`; }
function vAI(){
  const chips=[["ارسملي طاولة 3 متر ب 80 عرض، فيها جرن 50 ب 40، ظهر 10 ورف تحت","رسمة مجلى"],["فاتورة لأبو علي، براد طاولة 140 وغريل 75، دفع 500 والباقي دين","فاتورة من جملة"],["مين عليه ديون أكتر من 1000$؟","مين عليه ديون"],["قديش ربحنا هالشهر؟ وشو أكتر شي انباع؟","أرباح الشهر"],["زبون عندو محل حلويات صغير بدو براد كيك، شو بتنصحو؟ واكتبلي رسالة واتساب","سؤال زبون"]];
  const warn=!Store.sb?`<div class="banner">المساعد بدو التطبيق يكون موصول بـ Supabase.</div>`:!navigator.onLine?`<div class="banner">ما في إنترنت. المساعد بيرجع يشتغل لما يرجع النت.</div>`:"";
  return `<div class="head"><div><h1>المساعد الذكي</h1><p class="sub">اكتب طلبك بالعربي: رسمة، فاتورة، سؤال عن الحسابات، أو سؤال زبون. ما بيحفظ شي إلا بعد ما توافق.</p></div>
   <div class="row"><button class="btn" id="aisum" ${AI.busy?"disabled":""}>ملخص اليوم</button><button class="btn sm" id="ainew" ${AI.busy||!AI.msgs.length?"disabled":""}>محادثة جديدة</button></div></div>${warn}
  <div class="card" style="display:flex;flex-direction:column;min-height:420px">
   <div id="aimsgs" style="flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:auto;max-height:64vh">
    ${AI.msgs.length?AI.msgs.map(aiBubble).join(""):`<div class="empty" style="padding:24px 8px"><b>جرّب واحد من هول</b><div class="row" style="justify-content:center;margin-top:10px">${chips.map(([q,l])=>`<button class="btn sm" data-aiq="${esc(q)}">${l}</button>`).join("")}</div></div>`}
    ${AI.busy?`<div class="muted" id="aistatus" style="font-size:13px">${esc(AI.status||"عم فكّر…")}</div>`:""}
   </div>
   <form id="aiform" style="display:flex;gap:8px;padding:12px;border-top:1px solid var(--line)">
    <textarea id="aiin" rows="2" placeholder="مثلا: ارسملي مجلى جرنين 2 متر ب 70، وعملي عرض سعر لمطعم الشيف" style="flex:1;min-height:44px" ${AI.busy?"disabled":""}></textarea>
    ${AI.busy?`<button class="btn" type="button" id="aistop">وقّف</button>`:`<button class="btn pri" type="submit">إرسال</button>`}
   </form></div>`;
}
const waPart=t=>{const m=String(t||"").match(/---\s*\n([\s\S]+?)\n\s*---/);return m?m[1].trim():""};
function aiBubble(m,i){
  const me=m.role==="user";
  return `<div style="align-self:${me?"flex-start":"flex-end"};max-width:min(720px,94%);background:${me?"var(--accent-soft)":"var(--sunk)"};border-radius:10px;padding:10px 14px;line-height:1.7"><div style="white-space:pre-wrap">${esc(m.text)}</div>
   ${m.sketch?`<div class="sk-prev" style="margin-top:8px;background:#fff;border-radius:8px;overflow:hidden">${sketchSVG(m.sketch)}</div><div class="row" style="margin-top:6px"><button class="btn pri sm" data-aiskshare="${i}">شارك الرسمة</button><button class="btn sm" data-aiskdl="${i}">نزّل PNG</button><button class="btn sm" data-aiskedit="${i}">عدّل المقاسات</button></div>`:""}
   ${m.draft?`<div style="margin-top:8px"><button class="btn pri sm" data-aidraft="${i}">افتح الفاتورة لراجعها</button></div>`:""}
   ${!me&&m.text?`<div class="row" style="margin-top:6px"><button class="btn sm" data-aicopy="${i}">نسخ</button>${waPart(m.text)?`<button class="btn sm" data-aiwa="${i}">ابعت واتساب</button>`:""}</div>`:""}</div>`;
}
async function aiSend(text,isSummary){
  if(AI.busy||!text.trim()) return;
  AI.busy=true; AI.cancel=false; AI.status="عم فكّر…"; AI.draft=null; AI.sketch=null;
  AI.msgs.push({role:"user",text}); const idx=AI.msgs.push({role:"assistant",text:""})-1;
  render(); scrollAI();
  try{
    let res;
    if(isSummary) res=await aiRun(aiSummaryPrompt(),[{role:"user",content:"ملخص اليوم"}],null,{max_tokens:1200});
    else { const hist=[...AI.turns,{role:"user",content:text}]; res=await aiRun(aiRules2(),hist,AI_TOOLS);
      AI.turns.push({role:"user",content:text},{role:"assistant",content:res.text||"تم."}); if(AI.turns.length>16) AI.turns=AI.turns.slice(-16); }
    AI.msgs[idx].text=res.text||(AI.sketch?"هيدي الرسمة:":"");
    if(AI.draft) AI.msgs[idx].draft=AI.draft;
    if(AI.sketch) AI.msgs[idx].sketch=AI.sketch;
  }catch(e){ const m=aiErrMsg(e); if(m) AI.msgs[idx].text=m; else AI.msgs.splice(idx,1); }
  AI.busy=false; AI.status=""; render(); scrollAI();
  if(AI.msgs[idx]&&AI.msgs[idx].draft&&!AI.msgs[idx].sketch) openInvoice(null,AI.msgs[idx].draft.type,AI.msgs[idx].draft);
}
function scrollAI(){const el=$("#aimsgs");if(el)el.scrollTop=el.scrollHeight}
function aiSummaryPrompt(){
  const t=today(); const sales=S.invoices.filter(i=>live(i)&&i.type==="sale"&&i.date===t);
  const rec=S.vouchers.filter(v=>v.date===t);
  const data={date:t,salesToday:sales.map(i=>({no:i.no,party:(partyById(i.partyId)||{}).name||"نقدي",total:invTotal(i),paid:+i.paid||0,items:(i.lines||[]).map(l=>`${l.qty}× ${l.name}`).join("، ")})),
    cashMovesToday:rec.map(v=>({kind:v.kind,usd:v.usd,party:(partyById(v.partyId)||{}).name,category:v.category})),cashBalance:cashBalance(t),
    month:reportData(monthStart(),t),topDebtors:partiesWithBalance("customer",0.01).slice(0,8),weOwe:partiesWithBalance("supplier",0.01).slice(0,5),lowStock:lowStock()};
  return aiRules()+`\n\nاكتب ملخص اليوم للمدير بـ 6 إلى 10 أسطر قصيرة: شو انباع اليوم، الصندوق، أرباح الشهر لهلق، مين لازم نلاحق بالدفع (الأكبر أول)، ولمين علينا، وشو لازم ينطلب للمخزون. إذا ما في حركة اليوم قولها بصراحة. خلّص بخطوة وحدة مقترحة لبكرا.\n\nالبيانات:\n`+JSON.stringify(data);
}
function bindAI(){
  const f=$("#aiform"); if(!f) return;
  f.onsubmit=e=>{e.preventDefault();aiSend($("#aiin").value)};
  $("#aiin").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();aiSend($("#aiin").value)}};
  $("#aistop")&&($("#aistop").onclick=()=>{AI.cancel=true;AI.setStatus("عم وقّف…")});
  $("#aisum")&&($("#aisum").onclick=()=>aiSend("ملخص اليوم",true));
  $("#ainew")&&($("#ainew").onclick=()=>{AI.msgs=[];AI.turns=[];render()});
  document.querySelectorAll("[data-aiq]").forEach(b=>b.onclick=()=>{$("#aiin").value=b.dataset.aiq;$("#aiin").focus()});
  document.querySelectorAll("[data-aidraft]").forEach(b=>b.onclick=()=>{const m=AI.msgs[+b.dataset.aidraft];if(m&&m.draft)openInvoice(null,m.draft.type,m.draft)});
  document.querySelectorAll("[data-aicopy]").forEach(b=>b.onclick=async()=>{const m=AI.msgs[+b.dataset.aicopy];try{await navigator.clipboard.writeText(m.text);toast("انتسخ")}catch(e){toast("ما زبط النسخ، حدّد النص وانسخو")}});
  document.querySelectorAll("[data-aiwa]").forEach(b=>b.onclick=()=>{const m=AI.msgs[+b.dataset.aiwa];window.open("https://wa.me/?text="+encodeURIComponent(waPart(m.text)),"_blank")});
  document.querySelectorAll("[data-aiskshare]").forEach(b=>b.onclick=()=>sketchShare(AI.msgs[+b.dataset.aiskshare].sketch));
  document.querySelectorAll("[data-aiskdl]").forEach(b=>b.onclick=()=>sketchDownload(AI.msgs[+b.dataset.aiskdl].sketch));
  document.querySelectorAll("[data-aiskedit]").forEach(b=>b.onclick=()=>{SK.spec=JSON.parse(JSON.stringify(AI.msgs[+b.dataset.aiskedit].sketch));SK.id=null;go("sketch")});
  if(!AI.busy) $("#aiin").focus();
}
