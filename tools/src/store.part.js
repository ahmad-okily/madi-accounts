// ---------- db (Supabase + offline cache) ----------
const COLS=["products","parties","invoices","vouchers"];
const CFG=window.MADI_CONFIG||{};
const Store={sb:null,user:null,idb:null,pending:0,online:navigator.onLine,syncing:false,lastSync:"",channel:null};
function idbOpen(){return new Promise((res,rej)=>{const r=indexedDB.open("madi-accounts",1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore("docs");d.createObjectStore("outbox",{autoIncrement:true});d.createObjectStore("meta")};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function idbTx(store,mode,fn){return new Promise((res,rej)=>{const t=Store.idb.transaction(store,mode);const s=t.objectStore(store);let out;try{out=fn(s)}catch(e){rej(e)}t.oncomplete=()=>res(out&&out.result!==undefined?out.result:out);t.onerror=()=>rej(t.error)})}
const idbGetAll=(store)=>new Promise((res,rej)=>{const out=[];const t=Store.idb.transaction(store,"readonly");const c=t.objectStore(store).openCursor();c.onsuccess=()=>{const cur=c.result;if(cur){out.push({key:cur.key,value:cur.value});cur.continue()}else res(out)};c.onerror=()=>rej(c.error)});
function applyDoc(col,id,data,deleted){
  if(col==="config"){ if(id==="settings"&&!deleted&&data) S.settings={...S.settings,...data}; return; }
  if(!COLS.includes(col)) return;
  const arr=S[col]; const i=arr.findIndex(x=>x.id===id);
  if(deleted){ if(i>=0) arr.splice(i,1); return; }
  const d={...data,id}; if(i>=0) arr[i]=d; else arr.push(d);
}
async function loadLocal(){
  for(const {value:v} of await idbGetAll("docs")) applyDoc(v.col,v.id,v.data,v.deleted);
  Store.lastSync=(await idbTx("meta","readonly",s=>s.get("lastSync")))||"";
  Store.pending=(await idbGetAll("outbox")).length;
  COLS.forEach(c=>S.ready[c]=true);
}
let rerenderT; function softRender(){clearTimeout(rerenderT);rerenderT=setTimeout(()=>{ if(!$("#scrim")) render(); else renderNav(); },120)}
async function save(col,obj){
  if(!S.canWrite){toast("ما عندك صلاحية تعديل.");return false}
  const id=obj.id||uid(); const body={...obj,id,updatedAt:new Date().toISOString()};
  applyDoc(col,id,body,false);
  await idbTx("docs","readwrite",s=>s.put({col,id,data:body,deleted:false},col+"/"+id));
  await idbTx("outbox","readwrite",s=>s.add({col,id,data:body,deleted:false}));
  Store.pending++; softRender(); push(); return true;
}
async function remove(col,id){
  applyDoc(col,id,null,true);
  await idbTx("docs","readwrite",s=>s.put({col,id,data:{},deleted:true},col+"/"+id));
  await idbTx("outbox","readwrite",s=>s.add({col,id,data:{},deleted:true}));
  Store.pending++; softRender(); push(); return true;
}
async function push(){
  if(!Store.sb||!Store.user||!navigator.onLine||Store.pushing) return;
  Store.pushing=true;
  try{
    for(;;){
      const items=(await idbGetAll("outbox")).slice(0,200); if(!items.length) break;
      const latest=new Map(); for(const it of items) latest.set(it.value.col+"/"+it.value.id,it.value);
      const rows=[...latest.values()].map(v=>({collection:v.col,id:v.id,data:v.data,deleted:v.deleted}));
      const {error}=await Store.sb.from("docs").upsert(rows,{onConflict:"collection,id"});
      if(error) throw error;
      await idbTx("outbox","readwrite",s=>{for(const it of items) s.delete(it.key)});
      Store.pending=(await idbGetAll("outbox")).length;
    }
  }catch(e){ console.warn("push failed",e); if(e&&(e.code==="42501"||/row-level security|permission/i.test(e.message||""))){S.canWrite=false;toast("السيرفر رفض الحفظ. تأكد إنك عامل تسجيل دخول.")} }
  Store.pushing=false; softRender();
}
async function pull(){
  if(!Store.sb||!Store.user||!navigator.onLine) return;
  Store.syncing=true; softRender();
  try{
    let from=Store.lastSync||"1970-01-01T00:00:00Z", got;
    do{
      const {data,error}=await Store.sb.from("docs").select("collection,id,data,deleted,updated_at").gt("updated_at",from).order("updated_at",{ascending:true}).limit(1000);
      if(error) throw error; got=data||[];
      if(got.length){
        await idbTx("docs","readwrite",s=>{for(const r of got) s.put({col:r.collection,id:r.id,data:r.data,deleted:r.deleted},r.collection+"/"+r.id)});
        for(const r of got) applyDoc(r.collection,r.id,r.data,r.deleted);
        from=got[got.length-1].updated_at; Store.lastSync=from; await idbTx("meta","readwrite",s=>s.put(from,"lastSync"));
      }
    }while(got.length===1000);
  }catch(e){ console.warn("pull failed",e); }
  Store.syncing=false; softRender();
}
function subscribeLive(){
  if(Store.channel||!Store.sb) return;
  Store.channel=Store.sb.channel("docs-live").on("postgres_changes",{event:"*",schema:"public",table:"docs"},async(p)=>{
    const r=p.new; if(!r||!r.collection) return;
    await idbTx("docs","readwrite",s=>s.put({col:r.collection,id:r.id,data:r.data,deleted:r.deleted},r.collection+"/"+r.id));
    applyDoc(r.collection,r.id,r.data,r.deleted);
    if(r.updated_at>Store.lastSync){Store.lastSync=r.updated_at;idbTx("meta","readwrite",s=>s.put(r.updated_at,"lastSync"))}
    softRender();
  }).subscribe();
}
async function syncNow(){ await push(); await pull(); }
window.addEventListener("online",()=>{Store.online=true;syncNow();softRender()});
window.addEventListener("offline",()=>{Store.online=false;softRender()});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible") syncNow()});
function handleErr(e){ toast("صار خطأ. جرّب مرة تانية."); console.warn(e); }
function syncBadge(){
  if(!navigator.onLine) return `<span class="pill warn">بلا إنترنت${Store.pending?` · ${Store.pending} بانتظار الرفع`:""}</span>`;
  if(Store.pending) return `<span class="pill warn">عم يرفع ${Store.pending}…</span>`;
  if(Store.syncing) return `<span class="pill mute">عم يحدّث…</span>`;
  return `<span class="pill good">محفوظ أونلاين</span>`;
}
// ---------- files ----------
function downloadFile(name,content,mime){
  const blob=content instanceof Blob?content:new Blob([content],{type:mime||"text/plain;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
function printHtml(html){
  const f=document.createElement("iframe");f.style.cssText="position:fixed;width:0;height:0;border:0;left:-9999px";document.body.appendChild(f);
  f.onload=()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch(e){downloadFile("print.html",html,"text/html")}setTimeout(()=>f.remove(),60000)};
  f.srcdoc=html;
}
