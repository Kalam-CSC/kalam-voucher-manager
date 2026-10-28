import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import kalamLogo from "./assets/kalam-csc-logo.png";
import amazonLogo from "./assets/brands/amazon.svg";
import flipkartLogo from "./assets/brands/flipkart.png";
import phonepeLogo from "./assets/brands/phonepe.png";
import bigbasketLogo from "./assets/brands/bigbasket.png";
import pizzaHutLogo from "./assets/brands/pizza-hut.png";
import pantaloonsLogo from "./assets/brands/pantaloons.png";
import paytmLogo from "./assets/brands/paytm.png";

const DEFAULT_BRANDS = ["AMAZON","FLIPKART","PHONEPE","BIGBASKET","PIZZA HUT","PANTALOONS","PAYTM","OTHER"];
const BRAND_LOGOS = {AMAZON:amazonLogo,FLIPKART:flipkartLogo,PHONEPE:phonepeLogo,BIGBASKET:bigbasketLogo,"PIZZA HUT":pizzaHutLogo,PANTALOONS:pantaloonsLogo,PAYTM:paytmLogo};

const demo = [
 {id:"1",brand:"AMAZON",code:"ABCD-EFGH-1234",pin:"4587",amount:1000,expiry:"2026-12-31",note:"Rohit Sharma",status:"Available",created_at:"2026-09-29T09:00:00",used_at:null},
 {id:"2",brand:"FLIPKART",code:"FKRT-9876-4321",pin:"9921",amount:500,expiry:"2027-01-31",note:"Gift",status:"Available",created_at:"2026-09-28T09:00:00",used_at:null},
 {id:"3",brand:"GOOGLE PLAY",code:"GPLY-5566-7788",pin:"3344",amount:500,expiry:"2026-09-20",note:"Self Use",status:"Expired",created_at:"2026-09-27T09:00:00",used_at:null}
];

function fmtDate(v){
 if(!v) return "-";
 if(/^\d{4}-\d{2}-\d{2}$/.test(v)){const [y,m,d]=v.split("-");return `${d}-${m}-${y}`;}
 const d=new Date(v); if(Number.isNaN(d.getTime())) return v;
 return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}
function validISODate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const [y,m,d]=v.split("-").map(Number);const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;}
function daysUntilExpiry(v){const date=String(v||"").slice(0,10);if(!validISODate(date))return null;const [year,month,day]=date.split("-").map(Number);const today=new Date();const todayUtc=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());return (Date.UTC(year,month-1,day)-todayUtc)/86400000;}
function fmtDateTime(v){ if(!v) return "-"; const d=new Date(v); if(Number.isNaN(d.getTime())) return v; let h=d.getHours(); const ap=h>=12?"PM":"AM"; h=h%12||12; return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()} ${h}:${String(d.getMinutes()).padStart(2,"0")} ${ap}`; }
function isExpired(v){ return v.expiry && v.expiry < new Date().toISOString().slice(0,10) && v.status==="Available"; }
function maskCode(c){ if(!c) return "—"; return c.length<=4 ? "••••" : "••••-••••-"+c.slice(-4); }

export default function App(){
 const [session,setSession]=useState(null);
 const [loading,setLoading]=useState(true);
 const [loginMode,setLoginMode]=useState("login");
 const [resetMode,setResetMode]=useState(new URLSearchParams(window.location.search).get("reset")==="1");
 const [newPassword,setNewPassword]=useState("");
 const [confirmPassword,setConfirmPassword]=useState("");
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [message,setMessage]=useState("");
 const [vouchers,setVouchers]=useState([]);
 const [brands,setBrands]=useState(DEFAULT_BRANDS);
 const [search,setSearch]=useState("");
 const [status,setStatus]=useState("All");
 const [brandFilter,setBrandFilter]=useState("All");
 const [sortOrder,setSortOrder]=useState("newest");
 const [tab,setTab]=useState("dashboard");
 const [modal,setModal]=useState(null);
 const [form,setForm]=useState({brand:"AMAZON",code:"",pin:"",amount:"",expiry:"",note:""});
 const [saveError,setSaveError]=useState("");
 const [saving,setSaving]=useState(false);
 const [securityPin,setSecurityPin]=useState(localStorage.getItem("kalam_security_pin")||"2580");
 const [verify,setVerify]=useState(null);
 const [showSecret,setShowSecret]=useState({});
 const [newBrand,setNewBrand]=useState("");
 const [editingBrand,setEditingBrand]=useState(null);

 useEffect(()=>{
   if(!supabase){setLoading(false);return;}
   supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});
   const {data:listener}=supabase.auth.onAuthStateChange((event,s)=>{setSession(s); if(event==="PASSWORD_RECOVERY"){setResetMode(true);setMessage("Naya password set karein.");}});
   return ()=>listener.subscription.unsubscribe();
 },[]);

 useEffect(()=>{
   if(!Object.values(showSecret).some(Boolean))return;
   const hideSecrets=()=>setShowSecret({});
   document.addEventListener("pointerdown",hideSecrets);
   return ()=>document.removeEventListener("pointerdown",hideSecrets);
 },[showSecret]);

 useEffect(()=>{ if(session) loadData(); },[session]);

 async function loadData(){
   if(!supabase){setVouchers(demo);return;}
   try{
     const [vr,br]=await Promise.all([
       supabase.from("vouchers").select("*").order("created_at",{ascending:false}),
       supabase.from("brands").select("*").eq("active",true).order("sort_order",{ascending:true})
     ]);
     const errors=[vr.error,br.error].filter(Boolean);
     if(errors.length) setMessage(`Data load failed: ${errors.map(error=>error.message).join("; ")}`);
     if(!vr.error) setVouchers(vr.data||[]);
     if(!br.error && br.data?.length) setBrands(br.data.map(x=>x.name));
   }catch(error){
     setMessage(`Data load failed: ${error instanceof Error ? error.message : String(error)}`);
   }
 }

 async function auth(){
   setMessage("");
   if(!supabase){setMessage("Supabase environment variables abhi set nahi hain. Demo mode me login bypass nahi kiya gaya.");return;}
   if(loginMode==="forgot"){
     if(!email){setMessage("Registered email enter karein.");return;}
     const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/?reset=1`});
     setMessage(error?.message || "Password reset link email par bhej diya gaya.");
     return;
   }
   if(loginMode==="signup"){
     const {error}=await supabase.auth.signUp({email,password});
     setMessage(error?.message || "Account created. Email verification required ho sakti hai.");
     return;
   }
   const {error}=await supabase.auth.signInWithPassword({email,password});
   setMessage(error?.message || "Login successful.");
 }
 async function logout(){ if(supabase) await supabase.auth.signOut(); }
 async function updatePassword(){
   setMessage("");
   if(newPassword.length<8){setMessage("Password kam se kam 8 characters ka rakhein.");return;}
   if(newPassword!==confirmPassword){setMessage("Dono password match nahi karte.");return;}
   if(!supabase){setMessage("Supabase configuration missing hai.");return;}
   const {error}=await supabase.auth.updateUser({password:newPassword});
   if(error){setMessage(error.message);return;}
   setMessage("Password update ho gaya. Ab naye password se login karein.");
   setResetMode(false);setNewPassword("");setConfirmPassword("");
   window.history.replaceState({}, document.title, window.location.pathname);
   await supabase.auth.signOut();
 }

 function openAdd(){ setSaveError("");setForm({brand:brands[0]||"OTHER",code:"",pin:"",amount:"",expiry:"",note:""});setModal({type:"voucher",edit:null}); }
 function openEdit(v){setSaveError("");setForm({brand:v.brand,code:v.code||"",pin:v.pin||"",amount:v.amount??"",expiry:v.expiry?String(v.expiry).slice(0,10):"",note:v.note||""});setModal({type:"voucher",edit:v});}
 async function saveVoucher(){
   const code=String(form.code||"").trim(); const pin=String(form.pin||"").trim(); const amount=String(form.amount||"").trim(); const expiry=String(form.expiry||"").trim();
   if(!code){alert("Voucher Code zaroori hai.");return;}
   if(pin && !/^\d+$/.test(pin)){alert("PIN me sirf digits allowed hain.");return;}
   if(amount && !/^\d+$/.test(amount)){alert("Amount me sirf digits allowed hain.");return;}
   if(expiry && !validISODate(expiry)){alert("Sahi expiry date select karein.");return;}
   const payload={brand:form.brand,code,pin:pin||null,amount:Number(amount||0),expiry:expiry||null,note:form.note||null};
   setSaveError("");
   setSaving(true);
   try{
     if(supabase){
       if(modal.edit){
         const {data,error}=await supabase.from("vouchers").update(payload).eq("id",modal.edit.id).select().single();
         if(error){setSaveError(`Entry save nahi hui: ${error.message}`);return;}
         setVouchers(x=>x.map(v=>v.id===modal.edit.id?data:v));
       }else{
         const {data,error}=await supabase.from("vouchers").insert({...payload,status:"Available"}).select().single();
         if(error){setSaveError(`Entry save nahi hui: ${error.message}`);return;}
         setVouchers(x=>[data,...x]);
       }
     }else{
       if(modal.edit)setVouchers(x=>x.map(v=>v.id===modal.edit.id?{...v,...payload}:v));
       else setVouchers(x=>[{id:crypto.randomUUID(),...payload,status:"Available",created_at:new Date().toISOString(),used_at:null},...x]);
     }
     setModal(null);
   }catch(error){
     setSaveError(`Entry save nahi hui: ${error instanceof Error ? error.message : String(error)}`);
   }finally{
     setSaving(false);
   }
 }
 async function markUsed(v){
   if(!confirm("Kya ye voucher use ho chuka hai?"))return;
   const patch={status:"Used",used_at:new Date().toISOString()};
   if(supabase){const {data,error}=await supabase.from("vouchers").update(patch).eq("id",v.id).select().single();if(error){setMessage(error.message);return}setVouchers(x=>x.map(a=>a.id===v.id?data:a));}
   else setVouchers(x=>x.map(a=>a.id===v.id?{...a,...patch}:a));
 }
 async function markAvailable(v){
   const patch={status:"Available",used_at:null};
   if(supabase){const {data,error}=await supabase.from("vouchers").update(patch).eq("id",v.id).select().single();if(error){setMessage(error.message);return}setVouchers(x=>x.map(a=>a.id===v.id?data:a));}
   else setVouchers(x=>x.map(a=>a.id===v.id?{...a,...patch}:a));
 }
 async function deleteVoucher(v){
   if(!confirm("Voucher permanently delete karein?"))return;
   if(supabase){const {error}=await supabase.from("vouchers").delete().eq("id",v.id);if(error){setMessage(error.message);return}}
   setVouchers(x=>x.filter(a=>a.id!==v.id));
 }
 function reveal(v,field){
   if(v[field]==null || v[field]==="")return;
   setVerify({type:"reveal",v,field});
 }
 function requestAction(v,action){
   setVerify({type:"action",v,action});
 }
 async function verifySecurityPin(){
   const entered=document.getElementById("securityVerify")?.value||"";
   if(entered!==securityPin){alert("Wrong Security PIN");return;}
   const request=verify;
   setVerify(null);
   if(request.type==="reveal"){
     setShowSecret(x=>({...x,[request.v.id+request.field]:true}));
     return;
   }
   if(request.action==="edit")openEdit(request.v);
   if(request.action==="delete")await deleteVoucher(request.v);
   if(request.action==="markUsed")await markUsed(request.v);
   if(request.action==="markAvailable")await markAvailable(request.v);
 }
 async function saveSecurityPin(){
   if(!/^\d{4}$/.test(securityPin)){alert("Security PIN exactly 4 digit hona chahiye.");return}
   localStorage.setItem("kalam_security_pin",securityPin);alert("Security PIN saved.");
 }
 async function addBrand(){
   const name=newBrand.trim().toUpperCase(); if(!name)return;
   if(supabase){const {error}=await supabase.from("brands").insert({name,sort_order:brands.length,active:true});if(error){alert(error.message);return}}
   setBrands(x=>[...x,name]);setNewBrand("");
 }
 async function renameBrand(oldName){
   const name=prompt("New brand name:",oldName)?.trim().toUpperCase();if(!name||name===oldName)return;
   if(supabase){const {error}=await supabase.from("brands").update({name}).eq("name",oldName);if(error){alert(error.message);return}}
   setBrands(x=>x.map(b=>b===oldName?name:b));setVouchers(x=>x.map(v=>v.brand===oldName?{...v,brand:name}:v));
 }
 const current=useMemo(()=>vouchers.map(v=>isExpired(v)?{...v,status:"Expired"}:v),[vouchers]);
 const filtered=current.filter(v=>(status==="All"||v.status===status)&&(brandFilter==="All"||v.brand===brandFilter)&&(`${v.brand} ${v.code||""} ${v.pin||""} ${v.note||""}`).toLowerCase().includes(search.toLowerCase()));
 const sorted=[...filtered].sort((a,b)=>sortOrder==="oldest"?new Date(a.created_at)-new Date(b.created_at):sortOrder==="amount"?Number(b.amount||0)-Number(a.amount||0):new Date(b.created_at)-new Date(a.created_at));
 const counts=brands.map(b=>{const a=current.filter(v=>v.brand===b&&v.status==="Available");return {b,count:a.length,value:a.reduce((s,v)=>s+Number(v.amount||0),0),expiring:a.some(v=>{const days=daysUntilExpiry(v.expiry);return days!==null&&days>=0&&days<=30})}});
 const totalAmount=current.reduce((sum,v)=>sum+Number(v.amount||0),0);
 if(loading)return <div className="center">Loading…</div>;
 if(resetMode) return <div className="login"><div className="loginBox"><h1>KALAM VOUCHER MANAGER</h1><p>Set New Password</p><label>New Password<input type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 8 characters"/></label><label>Confirm Password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repeat new password"/></label><button className="primary" onClick={updatePassword}>Update Password</button>{message&&<div className="notice">{message}</div>}</div></div>;
 if(!session && supabase)return <Login {...{loginMode,setLoginMode,email,setEmail,password,setPassword,auth,message}}/>;

 return <div className="app">
   <header className="appHeader"><div className="headerLogo"><img src={kalamLogo} alt="Kalam CSC Center logo"/></div><div className="headerTitle"><h1><span>KALAM VOUCHER</span><span>MANAGER</span></h1><p>Secure voucher storage</p></div><div className="headerActions"><button onClick={()=>setTab(tab==="settings"?"dashboard":"settings")}>{tab==="settings"?"▦ Dashboard":"⚙ Settings"}</button><button className="primary" onClick={openAdd}>＋ Add Voucher</button>{supabase&&<button onClick={logout}>Logout</button>}</div></header>
   {message&&<div className="notice">{message}</div>}
   {tab==="settings"?<Settings brands={brands} newBrand={newBrand} setNewBrand={setNewBrand} addBrand={addBrand} renameBrand={renameBrand} securityPin={securityPin} setSecurityPin={setSecurityPin} saveSecurityPin={saveSecurityPin} email={session?.user?.email||""} onForgot={()=>setLoginMode("forgot")}/>:<>
   <section className="brandGrid">{counts.map((c,index)=><button className={`brandCard brandCard-${index%8}`} key={c.b} onClick={()=>{setBrandFilter(c.b);window.scrollTo({top:350,behavior:"smooth"})}}><BrandLogo brand={c.b} className="brandIcon"/><span className="brandInfo"><strong>{c.b}</strong><span>{c.count} Available</span><b>₹{c.value.toLocaleString("en-IN")}</b></span><span className="brandTotal">▣</span>{c.expiring&&<span className="expiryDot" role="img" aria-label={`${c.b} has a voucher expiring within 30 days`} title="Voucher expiring within 30 days"/>}</button>)}</section>
   <section className="panel voucherPanel"><div className="voucherListHeader"><h2><span className="listIcon">▤</span>Voucher List</h2><div className="totals"><span>Total Vouchers: <b>{current.length}</b></span><i/><span>Total Amount: <b>₹{totalAmount.toLocaleString("en-IN")}</b></span></div></div><div className="filters"><input type="search" name="voucher-search" autoComplete="off" placeholder="⌕  Search brand, code, note, PIN…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={brandFilter} onChange={e=>setBrandFilter(e.target.value)}><option value="All">All Brands</option>{brands.map(b=><option key={b}>{b}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="All">All Status</option><option>Available</option><option>Used</option><option>Expired</option></select><select value={sortOrder} onChange={e=>setSortOrder(e.target.value)}><option value="newest">▦ Newest First</option><option value="oldest">Oldest First</option><option value="amount">Amount: High to Low</option></select></div>
   <div className="tableWrap"><table><thead><tr><th>#</th><th>Brand</th><th>Voucher Code</th><th>PIN</th><th>Amount</th><th>Expiry Date</th><th>Note</th><th>Status</th><th>Used Date/Time</th><th>Action</th></tr></thead><tbody>{sorted.map((v,index)=><VoucherRow key={v.id} v={v} index={index+1} revealed={showSecret} reveal={reveal} requestAction={requestAction}/>)}</tbody></table>{!sorted.length&&<div className="emptyList">No vouchers match your filters.</div>}</div></section>
   </>}
   {modal?.type==="voucher"&&<VoucherModal form={form} setForm={setForm} close={()=>{setSaveError("");setModal(null);}} save={saveVoucher} edit={!!modal.edit} brands={brands} error={saveError} saving={saving}/>}
   {verify&&<div className="overlay"><div className="modal"><h3>Security PIN</h3><p>{verify.type==="reveal"?"Voucher secret dekhne ke liye":"Is action ko continue karne ke liye"} 4-digit Security PIN enter karein.</p><input autoFocus type="password" name="security-verification-pin" autoComplete="new-password" inputMode="numeric" maxLength="4" id="securityVerify" placeholder="••••"/><div className="modalActions"><button onClick={()=>setVerify(null)}>Cancel</button><button className="primary" onClick={verifySecurityPin}>Verify</button></div></div></div>}
 </div>
}

function BrandLogo({brand,className}){const logo=BRAND_LOGOS[brand];return <span className={`${className} brandLogo${brand==="OTHER"?" otherLogo":""}`} aria-label={`${brand} logo`}>{logo?<img src={logo} alt=""/>:<span className="otherDots"><i/><i/><i/><i/></span>}</span>}
function Login(p){return <div className="login"><div className="loginBox"><h1>KALAM VOUCHER MANAGER</h1><p>Secure Login</p>{p.loginMode==="forgot"?<><input placeholder="Registered Email" value={p.email} onChange={e=>p.setEmail(e.target.value)}/><button className="primary" onClick={p.auth}>Send Reset Link</button><button onClick={()=>p.setLoginMode("login")}>Back to Login</button></>:<><input type="email" placeholder="Email" value={p.email} onChange={e=>p.setEmail(e.target.value)}/><input type="password" placeholder="Password" value={p.password} onChange={e=>p.setPassword(e.target.value)}/><button className="primary" onClick={p.auth}>Login</button><button onClick={()=>p.setLoginMode("forgot")}>Forgot Password?</button></>}{p.message&&<div className="notice">{p.message}</div>}</div></div>}
function VoucherRow({v,index,revealed,reveal,requestAction}){
 const light=v.status==="Used"?"usedRow":v.status==="Expired"?"expiredRow":"";
 const daysLeft=daysUntilExpiry(v.expiry);
 return <tr className={light}><td className="rowNumber">{index}</td><td><div className="tableBrand"><BrandLogo brand={v.brand} className="tableBrandIcon"/><b>{v.brand}</b></div></td><td><b className="voucherCode">{revealed[v.id+"code"]?v.code:maskCode(v.code)}</b><div className="tiny">{fmtDate(v.created_at)}</div>{v.code&&<button className="eye" onClick={()=>reveal(v,"code")}>👁</button>}</td><td>{v.pin?<><span className="secret">{revealed[v.id+"pin"]?v.pin:"••••"}</span><button className="eye" onClick={()=>reveal(v,"pin")}>👁</button></>:<span className="muted">—</span>}</td><td className="amountCell">₹{Number(v.amount||0).toLocaleString("en-IN")}</td><td><span className="expiryCell"><span className="expiryTag">{fmtDate(v.expiry)}</span>{daysLeft!==null&&daysLeft<0&&<span className="expiryAlert expired">Expired</span>}{daysLeft!==null&&daysLeft>=0&&daysLeft<=30&&<span className="expiryAlert">{daysLeft===0?"Expires Today":`${daysLeft} ${daysLeft===1?"Day":"Days"} Left`}</span>}</span></td><td>{v.note||"—"}</td><td><span className={"badge "+v.status.toLowerCase()}><i/> {v.status}</span></td><td>{fmtDateTime(v.used_at)}</td><td className="actions">{v.status==="Available"&&<button className="green" onClick={()=>requestAction(v,"markUsed")}>✓ Used</button>}{v.status==="Used"&&<button onClick={()=>requestAction(v,"markAvailable")}>↩ Available</button>}<button className="blue" onClick={()=>requestAction(v,"edit")}>✏ Edit</button><button className="red" onClick={()=>requestAction(v,"delete")}>▤</button></td></tr>
}
function VoucherModal({form,setForm,close,save,edit,brands,error,saving}){
 const F=(k,props={})=>{const {digitsOnly,...inputProps}=props;return <input value={form[k]} {...inputProps} onChange={e=>setForm({...form,[k]:digitsOnly?e.target.value.replace(/\D/g,""):e.target.value})}/>};
 return <div className="overlay"><div className="modal large"><h2>{edit?"Edit Voucher":"Add Voucher"}</h2>
 <label>Brand<select value={form.brand} onChange={e=>setForm({...form,brand:e.target.value})}>{brands.map(b=><option key={b}>{b}</option>)}</select></label>
 <label>Voucher Code <span className="required">* Required</span>{F("code",{placeholder:"Voucher Code"})}</label>
 <label>Voucher PIN <span>(Optional • digits only)</span>{F("pin",{placeholder:"Optional PIN",inputMode:"numeric",pattern:"[0-9]*",maxLength:20,digitsOnly:true})}</label>
 <label>Amount <span>(digits only)</span>{F("amount",{placeholder:"Amount",inputMode:"numeric",pattern:"[0-9]*",digitsOnly:true})}</label>
 <label>Expiry Date{F("expiry",{type:"date"})}</label>
 <label>Note{F("note",{placeholder:"Optional note"})}</label>
 {error&&<div className="notice" role="alert">{error}</div>}
 <div className="modalActions"><button onClick={close} disabled={saving}>Cancel</button><button className="primary" onClick={save} disabled={saving}>{saving?"Saving…":"Save"}</button></div></div></div>}
function Settings({brands,newBrand,setNewBrand,addBrand,renameBrand,securityPin,setSecurityPin,saveSecurityPin,email,onForgot}){return <section className="settings panel"><h2>⚙ Settings</h2><div className="settingBox"><h3>Security PIN</h3><p>4-digit PIN used to reveal voucher Code/PIN.</p><input type="password" maxLength="4" value={securityPin} onChange={e=>setSecurityPin(e.target.value.replace(/\D/g,"").slice(0,4))}/><button className="primary" onClick={saveSecurityPin}>Save Security PIN</button></div><div className="settingBox"><h3>Recovery</h3><p>Registered email: <b>{email||"Supabase account email"}</b></p><button onClick={onForgot}>Forgot Password / Reset</button></div><div className="settingBox"><h3>Manage Brands</h3><div className="brandAdd"><input placeholder="New brand name" value={newBrand} onChange={e=>setNewBrand(e.target.value)}/><button className="primary" onClick={addBrand}>＋ Add Brand</button></div>{brands.map(b=><div className="brandManage" key={b}><span>{b}</span><button className="blue" onClick={()=>renameBrand(b)}>✏ Rename</button></div>)}</div></section>}
