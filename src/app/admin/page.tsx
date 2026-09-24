"use client";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, BellOff, Check, Download, ExternalLink, LogOut, Plus, RefreshCw, Save, Search, Trash2, Upload, X } from "lucide-react";
import { getOrders, seedProductsIfEmpty, updateOrderStatus, useCatalog } from "@/components/Providers";
import { Order, Product } from "@/lib/types";
import { parseCSV, productsToCSV } from "@/lib/catalog";
import { supabase } from "@/supabase";

const seedCategories=["Burgers","Pizzas","Chicken","Sandwiches","Wraps","Pasta & Salads","Fasting","Fish","Hot Drinks","Iced Coffee","Juices & Mojitos","Milkshakes","Cakes & Pastries","Bottled"];
const blank:Product={id:"",name:"",amharic:"",category:"Burgers",price:0,image:"",description:"",prepTime:10,popular:false,fasting:false,available:true};
type Tab="overview"|"foods"|"orders";
type OrderView="new"|"active"|"history";

function Logo(){return <Link href="/" className="admin-logo"><Image src="/amore-logo.png" alt="Amore Cafe" width={45} height={60}/><span>AMORE<span>Cafe</span></span></Link>}

export default function Admin(){
 const {products,replaceProducts,refreshCatalog}=useCatalog();
 const [orders,setOrders]=useState<Order[]>([]);
 const [authed,setAuthed]=useState(false);
 const [checking,setChecking]=useState(true);
 const [email,setEmail]=useState(""); const [pass,setPass]=useState("");
 const [busy,setBusy]=useState(false);
 const [tab,setTab]=useState<Tab>("overview"); const [orderView,setOrderView]=useState<OrderView>("new"); const [ordersOpen,setOrdersOpen]=useState(false); const [editing,setEditing]=useState<Product|null>(null); const [q,setQ]=useState("");
 const [sheetUrl,setSheetUrl]=useState(""); const [syncing,setSyncing]=useState(false); const [message,setMessage]=useState("");
 const [soundEnabled,setSoundEnabled]=useState(false);
 const [historySearch,setHistorySearch]=useState("");
 const [historyRange,setHistoryRange]=useState<"all"|"today"|"7"|"30"|"90">("all");
 const [newOrderAlert,setNewOrderAlert]=useState<Order|null>(null);
 const knownOrderIds=useRef<Set<string>>(new Set());
 const initializedOrders=useRef(false);
 const audioContext=useRef<AudioContext|null>(null);

 const playOrderSound = () => {
   try {
     const audio = new Audio("/notification.wav");
     audio.volume = 1;
     audio.currentTime = 0;
     void audio.play().catch(()=>{
       // Fallback for browsers that block the audio element.
       const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
       if(!AudioCtx) return;
       const ctx = audioContext.current || new AudioCtx();
       audioContext.current = ctx;
       if (ctx.state === "suspended") void ctx.resume();
       const now = ctx.currentTime;
       [0,0.18,0.36].forEach((offset,index)=>{
         const osc=ctx.createOscillator(); const gain=ctx.createGain();
         osc.type="sine"; osc.frequency.setValueAtTime(index===1?784:index===2?988:659,now+offset);
         gain.gain.setValueAtTime(0.0001,now+offset);
         gain.gain.exponentialRampToValueAtTime(0.65,now+offset+0.02);
         gain.gain.exponentialRampToValueAtTime(0.0001,now+offset+0.20);
         osc.connect(gain); gain.connect(ctx.destination);
         osc.start(now+offset); osc.stop(now+offset+0.22);
       });
     });
   } catch (error) { console.warn("Notification sound unavailable", error); }
 };

 const enableOrderAlerts = async () => {
   try {
     const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
     if (!AudioCtx) throw new Error("Audio is not supported");
     const ctx = audioContext.current || new AudioCtx();
     audioContext.current = ctx;
     await ctx.resume();
     setSoundEnabled(true);
     playOrderSound();
   } catch (error) {
     console.error(error);
     setMessage("Could not enable order sound");
     setTimeout(()=>setMessage(""),2200);
   }
 };

 const loadOrders = async (announceNew = false) => {
   try {
     const remote=await getOrders();
     const incomingNew = remote.find(o => !knownOrderIds.current.has(o.id) && o.status === "Pending");
     if (announceNew && initializedOrders.current && incomingNew) {
       setNewOrderAlert(incomingNew);
       if (soundEnabled) playOrderSound();
       else if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([180, 100, 180]);
     }
     remote.forEach(o => knownOrderIds.current.add(o.id));
     initializedOrders.current = true;
     setOrders(remote);
   } catch (error) {
     console.error(error);
     try {
       const local=JSON.parse(localStorage.getItem("amore-orders")||"[]");
       local.forEach((o:Order) => knownOrderIds.current.add(o.id));
       setOrders(local);
     } catch { setOrders([]); }
   }
 };

 useEffect(()=>{
   let mounted=true;
   async function init(){
     const {data:{session}}=await supabase.auth.getSession();
     if(!mounted) return;
     if(session){
       setAuthed(true);
       try { await seedProductsIfEmpty(); await refreshCatalog(); } catch(error){ console.error("Menu sync failed",error); }
       await loadOrders();
     }
     setChecking(false);
   }
   init();
   const {data:{subscription}}=supabase.auth.onAuthStateChange(async (_event,session)=>{
     if(!mounted)return;
     setAuthed(Boolean(session));
     if(session){
       try { await seedProductsIfEmpty(); await refreshCatalog(); } catch(error){ console.error("Menu sync failed",error); }
       await loadOrders();
     }
   });
   setSheetUrl(localStorage.getItem("amore-sheet-csv")||process.env.NEXT_PUBLIC_MENU_CSV_URL||"");
   return()=>{mounted=false;subscription.unsubscribe()};
 },[]);

 useEffect(()=>{
   if(!authed) return;
   const channel=supabase.channel("amore-admin-orders")
     .on("postgres_changes", { event:"INSERT", schema:"public", table:"orders" }, async payload=>{
       const row=payload.new as { id?:string; status?:string };
       if(!row.id || knownOrderIds.current.has(row.id)) return;
       await loadOrders(true);
     })
     .subscribe((status)=>{
       if(status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn("Order realtime channel unavailable; polling fallback is active.");
     });
   const poll=window.setInterval(()=>loadOrders(true),10000);
   return()=>{ window.clearInterval(poll); void supabase.removeChannel(channel); };
 },[authed, soundEnabled]);

 const categories=useMemo(()=>Array.from(new Set([...seedCategories,...products.map(p=>p.category)])),[products]);
 const filtered=useMemo(()=>products.filter(p=>`${p.name} ${p.amharic} ${p.category}`.toLowerCase().includes(q.toLowerCase())),[products,q]);
 const revenue=useMemo(()=>orders.filter(o=>o.status!=="Cancelled").reduce((s,o)=>s+o.total,0),[orders]);
 const historyOrders=useMemo(()=>{
   const term=historySearch.trim().toLowerCase();
   const cutoff=historyRange==="all"?0:Date.now()-({today:1,7:7,30:30,90:90}[historyRange as "today"|"7"|"30"|"90"]||0)*86400000;
   return orders.filter(o=>{
     if(!["Completed","Cancelled"].includes(o.status)) return false;
     if(cutoff && new Date(o.createdAt).getTime()<cutoff) return false;
     if(term && !`${o.id} ${o.customer.name} ${o.customer.phone}`.toLowerCase().includes(term)) return false;
     return true;
   });
 },[orders,historySearch,historyRange]);

 async function deleteHistory(ids:string[]){
   if(!ids.length)return;
   const label=ids.length===1?"this order":`${ids.length} orders`;
   if(!confirm(`Delete ${label} permanently from order history? This cannot be undone.`))return;
   setBusy(true);
   try{
     const targets=orders.filter(o=>ids.includes(o.id));
     const receiptPaths=targets.map(o=>o.receiptUrl).filter(Boolean) as string[];
     if(receiptPaths.length) await supabase.storage.from("payment-receipts").remove(receiptPaths);
     const {error}=await supabase.from("orders").delete().in("id",ids);
     if(error)throw error;
     const remaining=orders.filter(o=>!ids.includes(o.id));
     setOrders(remaining);
     localStorage.setItem("amore-orders",JSON.stringify(remaining));
     ids.forEach(id=>knownOrderIds.current.delete(id));
     setMessage(`${ids.length} history ${ids.length===1?"order":"orders"} deleted`);
   }catch(error){console.error(error);setMessage("Could not delete order history. Run the updated Supabase SQL first.");}
   finally{setBusy(false);setTimeout(()=>setMessage(""),3000);}
 }

 async function login(e:FormEvent){
   e.preventDefault();
   setBusy(true);
   const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password:pass});
   setBusy(false);
   if(error){alert(error.message);return;}
   setPass("");
 }

 async function logout(){await supabase.auth.signOut();setAuthed(false);setOrders([]);}
 async function refresh(){setBusy(true);try{await refreshCatalog();await loadOrders();setMessage("Updated");}catch{setMessage("Refresh failed")}finally{setBusy(false);setTimeout(()=>setMessage(""),1800)}}

 async function saveFood(e:FormEvent){
   e.preventDefault();
   if(!editing?.name.trim())return;
   setBusy(true);
   const item={...editing,id:editing.id.trim()||editing.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")};
   try{
     const {error}=await supabase.from("foods").upsert({id:item.id,name:item.name,name_am:item.amharic,description:item.description,description_am:"",price:item.price,category:item.category,image_url:item.image,prep_time:item.prepTime,calories:0,rating:5,available:item.available,popular:Boolean(item.popular),fasting:Boolean(item.fasting),featured:false,updated_at:new Date().toISOString()});
     if(error)throw error;
     await refreshCatalog();
     setEditing(null);setMessage("Food saved");
   }catch(error){console.error(error);setMessage("Could not save food")}
   finally{setBusy(false);setTimeout(()=>setMessage(""),1800)}
 }

 async function removeFood(id:string){
   if(!confirm("Delete this menu item?"))return;
   setBusy(true);
   try{const {error}=await supabase.from("foods").delete().eq("id",id);if(error)throw error;await refreshCatalog();setMessage("Food deleted")}catch(error){console.error(error);setMessage("Could not delete food")}finally{setBusy(false);setTimeout(()=>setMessage(""),1800)}
 }
 async function toggleAvailable(p:Product){
   try{const {error}=await supabase.from("foods").update({available:!p.available,updated_at:new Date().toISOString()}).eq("id",p.id);if(error)throw error;await refreshCatalog()}catch(error){console.error(error);setMessage("Could not update availability");setTimeout(()=>setMessage(""),1800)}
 }
 function exportCSV(){const blob=new Blob([productsToCSV(products)],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="amore-menu.csv";a.click();URL.revokeObjectURL(a.href)}
 async function importCSVText(text:string){const parsed=parseCSV(text);if(!parsed.length){setMessage("No valid food rows found");return}setBusy(true);try{await replaceProducts(parsed);setMessage(`${parsed.length} foods published`)}catch(error){console.error(error);setMessage("Import failed")}finally{setBusy(false);setTimeout(()=>setMessage(""),2200)}}
 async function importSheet(){if(!sheetUrl)return;setSyncing(true);try{const res=await fetch(sheetUrl);if(!res.ok)throw new Error();const text=await res.text();await importCSVText(text);localStorage.setItem("amore-sheet-csv",sheetUrl)}catch{setMessage("Could not read the Google Sheets CSV link")}finally{setSyncing(false)}}
 function importFile(file:File){const reader=new FileReader();reader.onload=()=>importCSVText(String(reader.result||""));reader.readAsText(file)}

 if(checking)return <main className="admin-login"><div className="admin-login-card"><Logo/><span className="admin-eyebrow">AMORE CAFE ADMIN</span><h1>Checking access…</h1><p>Connecting securely to Amore Cafe.</p></div></main>;
 if(!authed)return <main className="admin-login"><form onSubmit={login} className="admin-login-card"><Logo/><span className="admin-eyebrow">AMORE CAFE ADMIN</span><h1>Welcome back.</h1><p>Sign in with your authorized Amore Cafe admin account.</p><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="username" required/><input value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" type="password" autoComplete="current-password" required/><button className="admin-primary" disabled={busy}>{busy?<RefreshCw className="spin" size={16}/>:null}{busy?"Signing in…":"Sign in"}</button><Link href="/">← Customer website</Link></form></main>;
 return <main className="admin-shell">
  <aside className="admin-sidebar"><Logo/><div className="admin-nav"><button onClick={()=>{setTab("overview");setOrdersOpen(false)}} className={tab==="overview"?"active":""}>Overview</button><button onClick={()=>{setTab("foods");setOrdersOpen(false)}} className={tab==="foods"?"active":""}>Food menu <span>{products.length}</span></button><div className={`admin-orders-nav ${ordersOpen?"open":""}`}><button onClick={()=>{setOrdersOpen(v=>!v);setTab("orders")}} className={tab==="orders"?"active":""}>Orders <span>{orders.filter(o=>o.status==="Pending").length}</span><b className="orders-chevron">⌄</b></button>{ordersOpen&&<div className="admin-orders-subnav"><button onClick={()=>{setTab("orders");setOrderView("new")}} className={tab==="orders"&&orderView==="new"?"active":""}>New orders <span>{orders.filter(o=>o.status==="Pending").length}</span></button><button onClick={()=>{setTab("orders");setOrderView("active")}} className={tab==="orders"&&orderView==="active"?"active":""}>Active orders <span>{orders.filter(o=>["Confirmed","Preparing","Ready"].includes(o.status)).length}</span></button><button onClick={()=>{setTab("orders");setOrderView("history")}} className={tab==="orders"&&orderView==="history"?"active":""}>Order history <span>{orders.filter(o=>["Completed","Cancelled"].includes(o.status)).length}</span></button></div>}</div></div><div className="admin-side-bottom"><Link href="/"><ExternalLink size={15}/> View website</Link><button onClick={logout}><LogOut size={15}/> Logout</button></div></aside>
  <section className="admin-main">
   <header className="admin-top"><div><span className="admin-eyebrow">{tab.toUpperCase()}</span><h1>{tab==="overview"?"Good day, Amore.":tab==="foods"?"Food menu":"Orders"}</h1></div><div className="admin-top-actions">{message&&<span className="admin-message"><Check size={14}/>{message}</span>}<button className={`admin-alert-toggle ${soundEnabled?"enabled":""}`} onClick={soundEnabled?()=>setSoundEnabled(false):enableOrderAlerts} title={soundEnabled?"Disable order sound":"Enable order sound"}>{soundEnabled?<Bell size={15}/>:<BellOff size={15}/>} {soundEnabled?"Sound on":"Enable alerts"}</button>{tab==="foods"&&<button className="admin-primary small" onClick={()=>setEditing({...blank,id:""})}><Plus size={16}/> Add food</button>}<button className="admin-icon" onClick={refresh} title="Refresh" disabled={busy}><RefreshCw className={busy?"spin":""} size={17}/></button></div></header>
   {tab==="overview"&&<><div className="admin-stat-grid"><div><span>Menu items</span><strong>{products.length}</strong><small>{products.filter(p=>p.available).length} available today</small></div><div><span>Orders</span><strong>{orders.length}</strong><small>{orders.filter(o=>o.status==="Pending").length} pending</small></div><div><span>Revenue</span><strong>{revenue.toLocaleString()} <em>ETB</em></strong><small>excluding cancelled orders</small></div></div><div className="admin-panel"><div className="panel-head"><div><span className="admin-eyebrow">QUICK ACCESS</span><h2>Manage Amore</h2></div></div><div className="quick-grid"><button onClick={()=>setTab("foods")}><span>01</span><b>Food menu</b><small>Add, edit prices, images, categories and availability.</small></button><button onClick={()=>setTab("orders")}><span>02</span><b>Orders</b><small>Review customer orders and update their status.</small></button><button onClick={()=>setTab("foods")}><span>03</span><b>Google Sheets</b><small>Export the menu, edit it in Sheets, then import it back.</small></button></div></div><div className="admin-panel"><div className="panel-head"><div><span className="admin-eyebrow">LATEST</span><h2>Recent orders</h2></div><button className="admin-text-btn" onClick={()=>setTab("orders")}>View all →</button></div>{orders.slice(0,5).map(o=><OrderRow key={o.id} order={o} onUpdate={async(status)=>{try{await updateOrderStatus(o.id,status);await loadOrders()}catch{setMessage("Could not update order")}}}/>)}{!orders.length&&<div className="admin-empty">No orders yet.</div>}</div></>}
   {tab==="foods"&&<><div className="food-tools"><div className="admin-search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search food..."/></div><button className="admin-secondary" onClick={exportCSV}><Download size={16}/> Export CSV</button><label className="admin-secondary"><Upload size={16}/> Import CSV<input type="file" accept=".csv,text/csv" hidden onChange={e=>{const f=e.target.files?.[0];if(f)importFile(f)}}/></label></div><div className="admin-sheet"><div><span className="admin-eyebrow">GOOGLE SHEETS</span><h2>Easy menu editing</h2><p>Publish your Google Sheet as CSV, paste the link here, and import the menu. The same columns can also be edited directly in this dashboard.</p></div><div className="sheet-row"><input value={sheetUrl} onChange={e=>setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/.../export?format=csv"/><button className="admin-primary" disabled={syncing} onClick={importSheet}>{syncing?<RefreshCw className="spin" size={16}/>:<Download size={16}/>} Import from Sheet</button></div><small>Columns: id, name, amharic, category, price, image, description, prep_time, popular, fasting, available</small></div><div className="food-list">{filtered.map(p=><div className="food-row" key={p.id}><img src={p.image||"/amore-logo.png"} alt=""/><div className="food-row-main"><b>{p.name}</b><span>{p.amharic}</span><small>{p.category} · {p.price.toLocaleString()} ETB · {p.prepTime || 0} min</small></div><span className={`availability ${p.available?"on":"off"}`}>{p.available?"Available":"Unavailable"}</span><button className="row-btn" onClick={()=>toggleAvailable(p)}>{p.available?"Hide":"Show"}</button><button className="row-btn" onClick={()=>setEditing({...p})}>Edit</button><button className="row-delete" onClick={()=>removeFood(p.id)} aria-label="Delete"><Trash2 size={16}/></button></div>)}{!filtered.length&&<div className="admin-empty">No matching foods.</div>}</div></>}
   {tab==="orders"&&<div className="orders-page">
     {orderView==="new"&&<div className="admin-panel new-orders-panel"><div className="panel-head"><div><span className="admin-eyebrow">ACTION REQUIRED</span><h2>New orders <span className="order-count">{orders.filter(o=>o.status==="Pending").length}</span></h2></div><span className="new-orders-live"><i/> LIVE</span></div>{orders.filter(o=>o.status==="Pending").map(o=><OrderRow key={o.id} order={o} isNew onUpdate={async(status)=>{try{await updateOrderStatus(o.id,status);await loadOrders()}catch{setMessage("Could not update order")}}}/>)}{!orders.some(o=>o.status==="Pending")&&<div className="admin-empty">No new orders. New customer orders will appear here automatically.</div>}</div>}
     {orderView==="active"&&<div className="admin-panel active-orders-panel"><div className="panel-head"><div><span className="admin-eyebrow">IN PROGRESS</span><h2>Active orders <span className="order-count">{orders.filter(o=>["Confirmed","Preparing","Ready"].includes(o.status)).length}</span></h2><small className="admin-panel-subtitle">Orders stay here until they are Completed or Cancelled.</small></div></div>{["Confirmed","Preparing","Ready"].map(status=><div className="order-status-group" key={status}><div className="order-group-head"><h3>{status}</h3><span className="order-count muted">{orders.filter(o=>o.status===status).length}</span></div>{orders.filter(o=>o.status===status).map(o=><OrderRow key={o.id} order={o} onUpdate={async(nextStatus)=>{try{await updateOrderStatus(o.id,nextStatus);await loadOrders()}catch{setMessage("Could not update order")}}}/>)}{!orders.some(o=>o.status===status)&&<div className="admin-empty compact">No {status.toLowerCase()} orders.</div>}</div>)}</div>}
     {orderView==="history"&&<div className="admin-panel previous-orders-panel"><div className="panel-head"><div><span className="admin-eyebrow">ORDER HISTORY</span><h2>Order history</h2><small className="admin-panel-subtitle">Search, filter, organize, or remove old completed/cancelled orders.</small></div><div className="history-counts"><span className="history-count completed"><b>{orders.filter(o=>o.status==="Completed").length}</b> Completed</span><span className="history-count cancelled"><b>{orders.filter(o=>o.status==="Cancelled").length}</b> Cancelled</span></div></div><div className="history-tools"><input value={historySearch} onChange={e=>setHistorySearch(e.target.value)} placeholder="Search order ID, customer or phone…"/><select value={historyRange} onChange={e=>setHistoryRange(e.target.value as typeof historyRange)}><option value="all">All dates</option><option value="today">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select><button className="admin-secondary" disabled={!historyOrders.length||busy} onClick={()=>deleteHistory(historyOrders.map(o=>o.id))}><Trash2 size={15}/> Delete filtered ({historyOrders.length})</button></div><div className="order-status-group history-group completed-group"><div className="order-group-head"><h3>Completed</h3><span className="order-count completed-count">{historyOrders.filter(o=>o.status==="Completed").length}</span></div>{historyOrders.filter(o=>o.status==="Completed").map(o=><OrderRow key={o.id} order={o} onUpdate={async(status)=>{try{await updateOrderStatus(o.id,status);await loadOrders()}catch{setMessage("Could not update order")}}}/>)}{!historyOrders.some(o=>o.status==="Completed")&&<div className="admin-empty compact">No matching completed orders.</div>}</div><div className="order-status-group history-group cancelled-group"><div className="order-group-head"><h3>Cancelled</h3><span className="order-count cancelled-count">{historyOrders.filter(o=>o.status==="Cancelled").length}</span></div>{historyOrders.filter(o=>o.status==="Cancelled").map(o=><OrderRow key={o.id} order={o} onUpdate={async(status)=>{try{await updateOrderStatus(o.id,status);await loadOrders()}catch{setMessage("Could not update order")}}}/>)}{!historyOrders.some(o=>o.status==="Cancelled")&&<div className="admin-empty compact">No matching cancelled orders.</div>}</div></div>}
   </div>}
  </section>
  {newOrderAlert&&<div className="admin-new-toast" role="alert"><strong>🔔 New order received</strong><div style={{marginTop:4,fontSize:10,opacity:.9}}>{newOrderAlert.id} · {newOrderAlert.customer.name} · {newOrderAlert.total.toLocaleString()} ETB</div><button className="admin-text-btn" style={{color:"#fff",padding:"8px 0 0"}} onClick={()=>{setNewOrderAlert(null);setTab("orders")}}>Open new orders →</button></div>}
  {editing&&<div className="admin-modal-backdrop"><form className="admin-modal" onSubmit={saveFood}><div className="modal-head"><div><span className="admin-eyebrow">FOOD ITEM</span><h2>{products.some(p=>p.id===editing.id)?"Edit food":"Add food"}</h2></div><button type="button" className="admin-icon" onClick={()=>setEditing(null)}><X size={18}/></button></div><div className="food-form-grid"><label>Name<input required value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></label><label>Amharic name<input value={editing.amharic} onChange={e=>setEditing({...editing,amharic:e.target.value})}/></label><label>Category<select value={editing.category} onChange={e=>setEditing({...editing,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Price (ETB)<input required type="number" min="0" value={editing.price} onChange={e=>setEditing({...editing,price:Number(e.target.value)})}/></label><label className="full">Image URL<input value={editing.image} onChange={e=>setEditing({...editing,image:e.target.value})}/></label><label>Prep time (minutes)<input required type="number" min="1" value={editing.prepTime} onChange={e=>setEditing({...editing,prepTime:Number(e.target.value)})}/></label><label className="full">Description<textarea value={editing.description} onChange={e=>setEditing({...editing,description:e.target.value})}/></label><label className="check"><input type="checkbox" checked={editing.available} onChange={e=>setEditing({...editing,available:e.target.checked})}/> Available</label><label className="check"><input type="checkbox" checked={!!editing.popular} onChange={e=>setEditing({...editing,popular:e.target.checked})}/> Popular</label><label className="check"><input type="checkbox" checked={!!editing.fasting} onChange={e=>setEditing({...editing,fasting:e.target.checked})}/> Fasting</label></div><div className="modal-actions"><button type="button" className="admin-secondary" onClick={()=>setEditing(null)}>Cancel</button><button className="admin-primary" disabled={busy}><Save size={16}/> {busy?"Saving…":"Save food"}</button></div></form></div>}
 </main>
}

function OrderRow({order,onUpdate,isNew=false}:{order:Order;onUpdate:(s:Order["status"])=>void;isNew?:boolean}){
  const locationNote = order.customer.address?.trim();
  const [receiptUrl,setReceiptUrl]=useState<string>("");
  const [receiptLoading,setReceiptLoading]=useState(false);

  useEffect(()=>{
    let active=true;
    async function loadReceipt(){
      if(!order.receiptUrl)return;
      setReceiptLoading(true);
      const {data,error}=await supabase.storage.from("payment-receipts").createSignedUrl(order.receiptUrl,3600);
      if(active && !error && data?.signedUrl) setReceiptUrl(data.signedUrl);
      if(active) setReceiptLoading(false);
    }
    loadReceipt();
    return()=>{active=false};
  },[order.receiptUrl]);

  return <div className={`order-row ${isNew?"order-row-new":""}`}>
    <div className="order-customer">
      <b>{order.id}</b>
      <p>{order.customer.name} · {order.customer.phone}</p>
      <small>{new Date(order.createdAt).toLocaleString()}</small>
      <div className="order-location">
        <span>{order.orderType === "delivery" ? "Delivery address" : "Table number / pickup note"}</span>
        <strong>{locationNote || "No address or pickup note provided"}</strong>
      </div>
      <div className="order-meta-grid">
        <div><span>Order notes</span><strong>{order.customer.notes?.trim() || "No order notes"}</strong></div>
        <div><span>Order type</span><strong>{order.orderType === "delivery" ? `🚚 Delivery · ${order.deliveryZone || ""}` : "🪑 Pickup / Dine-in"}</strong></div><div><span>Payment</span><strong>{order.payment}</strong></div><div><span>Delivery fee</span><strong>{order.deliveryFee.toLocaleString()} ETB</strong></div>{order.orderType === "delivery" && order.deliveryDistanceKm != null && <div><span>Distance</span><strong>{order.deliveryDistanceKm.toFixed(1)} km · {order.deliveryZone || "—"}</strong></div>}
        <div className={order.receiptUrl ? "receipt-status attached" : "receipt-status missing"}>
          <span>Payment receipt</span>
          {order.receiptUrl ? (
            receiptLoading ? <strong>Loading receipt…</strong> : receiptUrl ? <a href={receiptUrl} target="_blank" rel="noreferrer" className="admin-text-btn">✓ Attached · View receipt ↗</a> : <strong>Attached · unavailable</strong>
          ) : <strong>Not attached</strong>}
        </div>
      </div>
    </div>
    <div className="order-items">{order.items.map(i=><span key={i.id}>{i.quantity} × {i.name}</span>)}</div>
    <strong>{order.total.toLocaleString()} ETB</strong>
    <select value={order.status} onChange={e=>onUpdate(e.target.value as Order["status"])}>{["Pending","Confirmed","Preparing","Ready","Completed","Cancelled"].map(s=><option key={s}>{s}</option>)}</select>
  </div>
}
