// ---------- auth, import, boot ----------
function vLogin(){
  return `<div style="max-width:380px;margin:8vh auto 0;display:flex;flex-direction:column;gap:18px">
   <div class="brand" style="justify-content:center"><div class="mark">م</div><div><b>${esc(S.settings.companyAr||"ماضي لتجهيز المطابخ")}</b><small>نظام المحاسبة</small></div></div>
   <form id="loginf" class="card" style="padding:20px;display:flex;flex-direction:column;gap:12px">
    <h2>تسجيل الدخول</h2>
    <label class="f"><span>الإيميل</span><input type="text" id="lemail" dir="ltr" autocomplete="username" inputmode="email"></label>
    <label class="f"><span>كلمة السر</span><input type="password" id="lpass" dir="ltr" autocomplete="current-password" style="background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:7px 10px;width:100%"></label>
    <button class="btn pri" type="submit" id="lbtn" style="justify-content:center">دخول</button>
    <p class="muted" id="lmsg" style="margin:0;font-size:13px">الحسابات بيعملها صاحب البرنامج من Supabase. ما في تسجيل جديد من هون.</p>
   </form></div>`;
}
function bindLogin(){
  const f=$("#loginf"); if(!f) return;
  f.onsubmit=async e=>{e.preventDefault(); const b=$("#lbtn"); b.disabled=true; $("#lmsg").textContent="عم يفوت…";
    const {error}=await Store.sb.auth.signInWithPassword({email:$("#lemail").value.trim(),password:$("#lpass").value});
    b.disabled=false;
    if(error){ $("#lmsg").textContent=!navigator.onLine?"ما في إنترنت. أول تسجيل دخول بدو إنترنت.":/invalid/i.test(error.message)?"الإيميل أو كلمة السر غلط.":"ما زبط: "+error.message; }
  };
}
async function signOut(){
  try{await Store.sb.auth.signOut()}catch(e){}
  try{Store.idb.close(); indexedDB.deleteDatabase("madi-accounts")}catch(e){}
  location.reload();
}
async function importDocs(col,docs){
  if(!docs.length) return 0; const now=new Date().toISOString();
  await idbTx("docs","readwrite",s=>{for(const d of docs) s.put({col,id:d.id,data:{...d,updatedAt:d.updatedAt||now},deleted:false},col+"/"+d.id)});
  await idbTx("outbox","readwrite",s=>{for(const d of docs) s.add({col,id:d.id,data:{...d,updatedAt:d.updatedAt||now},deleted:false})});
  for(const d of docs) applyDoc(col,d.id,d,false);
  Store.pending=(await idbGetAll("outbox")).length; return docs.length;
}
async function importCatalog(){
  try{
    const r=await fetch("seed/catalog.json",{cache:"no-store"}); const list=await r.json();
    const fresh=list.filter(p=>!prodById(p.id));
    const n=await importDocs("products",fresh); render(); push();
    toast(n?`انزاد ${n} منتج من كتالوج العبدالله`:"الكتالوج موجود من قبل");
  }catch(e){toast("ما قدرت حمّل الكتالوج. تأكد من الإنترنت.")}
}
function importBackupFile(file){
  const rd=new FileReader();
  rd.onload=async()=>{ try{
      const d=JSON.parse(rd.result); let n=0;
      for(const c of COLS) if(Array.isArray(d[c])) n+=await importDocs(c,d[c].filter(x=>x&&x.id));
      if(d.settings) await save("config",{...d.settings,id:"settings"});
      render(); push(); toast(`انزاد ${n} سجل من النسخة الاحتياطية`);
    }catch(e){toast("الملف مش نسخة احتياطية صحيحة")} };
  rd.readAsText(file);
}
async function saveSettingsDoc(s){ S.settings={...S.settings,...s}; return save("config",{...s,id:"settings"}); }

render();
(async()=>{
  try{ Store.idb=await idbOpen(); await loadLocal(); }catch(e){ console.warn("local storage unavailable",e); COLS.forEach(c=>S.ready[c]=true); }
  if(!CFG.url||!CFG.key||!window.supabase){ S.noBackend=true; render(); return; }
  Store.sb=window.supabase.createClient(CFG.url,CFG.key,{auth:{persistSession:true,autoRefreshToken:true}});
  const {data}=await Store.sb.auth.getSession(); Store.user=data&&data.session?data.session.user:null;
  Store.sb.auth.onAuthStateChange((_ev,sess)=>{ const was=!!Store.user; Store.user=sess?sess.user:null; if(Store.user&&!was){subscribeLive();syncNow()} render(); });
  if(Store.user){ subscribeLive(); syncNow(); }
  render();
})();
if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
let installEvt=null; window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;softRender()});
