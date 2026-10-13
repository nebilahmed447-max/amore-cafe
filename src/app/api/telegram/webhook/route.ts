import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Product = { id:string; name:string; name_am?:string|null; description?:string|null; description_am?:string|null; category:string; price:number; available?:boolean; takeaway_pack_fee?:number|null; prep_time?:number|null };
type CartLine = { id:string; name:string; name_am?:string; price:number; quantity:number; category:string; takeawayPackFee:number; prepTime:number };
type Session = { chat_id:string; state:string; data:any; updated_at?:string };
const token = () => process.env.TELEGRAM_BOT_TOKEN || "";
const telegramApi = (method:string) => `https://api.telegram.org/bot${token()}/${method}`;
async function tg(method:string, body:any) {
  const r = await fetch(telegramApi(method), {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
  const data = await r.json().catch(()=>({}));
  if (!r.ok || !data.ok) console.error("Telegram API error", method, data);
  return data;
}
async function send(chatId:number|string, text:string, keyboard?:any) {
  return tg("sendMessage", {chat_id:chatId,text,reply_markup:keyboard,parse_mode:"HTML",disable_web_page_preview:true});
}
function dbConfig(){ return {url:(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/,""), key:process.env.SUPABASE_SERVICE_ROLE_KEY || ""}; }
async function db(path:string, init:RequestInit={}) {
  const {url,key}=dbConfig();
  if(!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the deployment environment.");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("authorization", `Bearer ${key}`);
  headers.set("content-type", "application/json");
  const r=await fetch(`${url}/rest/v1/${path}`,{...init,headers,cache:"no-store"});
  const text=await r.text();
  if(!r.ok) throw new Error(`Supabase request failed (${r.status}): ${text.slice(0,300)}`);
  return text ? JSON.parse(text) : null;
}
async function getSession(chatId:string):Promise<Session>{
  const rows=await db(`telegram_sessions?chat_id=eq.${encodeURIComponent(chatId)}&select=*&limit=1`);
  return rows?.[0] || {chat_id:chatId,state:"idle",data:{cart:[]}};
}
async function putSession(s:Session){
  await db("telegram_sessions?on_conflict=chat_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({...s,updated_at:new Date().toISOString()})});
}
async function products():Promise<Product[]>{return await db("foods?select=id,name,name_am,description,description_am,category,price,available,takeaway_pack_fee,prep_time&available=eq.true&order=category.asc,name.asc") || [];}
function money(n:number){return `${Math.round(n).toLocaleString("en-US")} ETB`;}
function clean(s:string){return s.replace(/[<>]/g,"").slice(0,500);}
function mainKeyboard(){return {inline_keyboard:[[{text:"🍽️ Order food",callback_data:"menu"},{text:"🧾 Track order",callback_data:"track"}],[{text:"📋 View menu",callback_data:"menu"},{text:"👨‍🍳 Talk to Amore AI",callback_data:"ask"}],[{text:"🌐 Website",url:(process.env.NEXT_PUBLIC_SITE_URL||"https://www.amore-cafe.com").replace(/\/$/,"")}]]};}
function cartText(cart:CartLine[]){if(!cart.length)return "Your cart is empty.";let total=0;const lines=cart.map(x=>{total+=x.price*x.quantity;return `• ${clean(x.name)} × ${x.quantity} — ${money(x.price*x.quantity)}`;});return `<b>Your cart</b>\n${lines.join("\n")}\n\nFood subtotal: <b>${money(total)}</b>`;}
async function showMenu(chatId:number|string, category?:string){
  const all=await products();
  if(!all.length){await send(chatId,"I couldn't load the menu right now. Please try again in a moment.",mainKeyboard());return;}
  const categories=[...new Set(all.map(p=>p.category))];
  if(!category){await send(chatId,"🍽️ <b>Welcome to Amore Cafe!</b>\nChoose a category to see available food and drinks.",{inline_keyboard:[...categories.map(c=>[{text:c,callback_data:`cat:${c}`}]),[{text:"🛒 View cart",callback_data:"cart"},{text:"🏠 Main menu",callback_data:"home"}]]});return;}
  const list=all.filter(p=>p.category===category).slice(0,30);
  await send(chatId,`<b>${clean(category)}</b>\nTap an item to add it to your cart.`,{inline_keyboard:[...list.map(p=>[{text:`${p.name} — ${money(Number(p.price))}`,callback_data:`add:${p.id}`}]),[{text:"⬅️ Categories",callback_data:"menu"},{text:"🛒 View cart",callback_data:"cart"}]]});
}
async function callAI(message:string, menu:Product[], history:any[]=[]):Promise<string|null>{
  const key=process.env.OPENAI_API_KEY;if(!key)return null;
  try{
    const compact=menu.slice(0,100).map(p=>({name:p.name,amharic:p.name_am,category:p.category,price:p.price,description:p.description}));
    const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{authorization:`Bearer ${key}`,"content-type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4o-mini",temperature:0.4,max_tokens:350,messages:[{role:"system",content:`You are Amore Cafe's friendly ordering assistant in Kombolcha, Ethiopia. Reply in the language the customer uses (English or Amharic). Be concise and helpful. Prices are in ETB. Use only this menu data for claims about products/prices: ${JSON.stringify(compact)}. Do not claim an order was placed or tracked unless the system confirms it. For placing orders, tell customers to tap Order food and use the chat buttons. For tracking, ask them to tap Track order and provide order ID and phone number. Never ask for bank PIN, passwords, or card details. Mention cafe staff can help if needed.`},...history.slice(-4),{role:"user",content:message}]})});
    const d=await r.json();return d?.choices?.[0]?.message?.content?.trim()||null;
  }catch(e){console.error("AI assistant failed",e);return null;}
}
async function handleText(chatId:number|string, from:any, text:string){
  const sid=String(chatId);let s=await getSession(sid);s.data=s.data||{};s.data.cart=Array.isArray(s.data.cart)?s.data.cart:[];
  const t=text.trim();const low=t.toLowerCase();
  if(/^\/(start|help)(\s|$)/i.test(t)||low==="home"){
    s.state="idle";await putSession(s);await send(chatId,"<b>Selam! Welcome to Amore Cafe ☕</b>\n\nI'm your AI cafe assistant. You can chat with me about our menu, place an order, or track an existing order.\n\nChoose an action below or just ask me a question.",mainKeyboard());return;
  }
  if(/^\/(order|menu)/i.test(t)||["order","order food","menu","show menu","start order"].includes(low)){s.state="ordering";await putSession(s);await showMenu(chatId);return;}
  if(/^\/(track|status)/i.test(t)||/\b(track|tracking|check|where is).{0,25}\b(order|my order|status)\b/i.test(low)){s.state="track_id";s.data.track={};await putSession(s);await send(chatId,"🧾 Please send your <b>order number</b> (example: <code>AM-12345678</code>).",{inline_keyboard:[[{text:"Cancel",callback_data:"home"}]]});return;}
  if(s.state==="track_id"){
    const id=t.toUpperCase().replace(/[^A-Z0-9-]/g,"");if(id.length<4){await send(chatId,"Please send the order number shown after checkout, for example <code>AM-12345678</code>.");return;}
    s.data.track={id};s.state="track_phone";await putSession(s);await send(chatId,"For privacy, please send the <b>phone number used for this order</b> to verify it.");return;
  }
  if(s.state==="track_phone"){
    const id=s.data.track?.id;const phone=t.replace(/[^+0-9]/g,"");
    const rows=await db(`orders?id=eq.${encodeURIComponent(id)}&phone=eq.${encodeURIComponent(phone)}&select=id,status,total,created_at,order_type&limit=1`);
    if(!rows?.length){await send(chatId,"I couldn't find an order matching that order number and phone. Please check both and try again, or contact cafe staff.",{inline_keyboard:[[{text:"Try again",callback_data:"track"},{text:"Main menu",callback_data:"home"}]]});return;}
    const o=rows[0];s.state="idle";await putSession(s);await send(chatId,`<b>Order ${clean(o.id)}</b>\nStatus: <b>${clean(o.status)}</b>\nTotal: <b>${money(Number(o.total))}</b>\nType: ${clean(o.order_type)}\nPlaced: ${new Date(o.created_at).toLocaleString("en-ET",{timeZone:"Africa/Addis_Ababa"})}\n\n${statusHelp(o.status)}`,mainKeyboard());return;
  }
  if(s.state==="checkout_name"){s.data.name=clean(t);s.state="checkout_phone";await putSession(s);await send(chatId,"Thanks! What phone number should we use for this order?");return;}
  if(s.state==="checkout_phone"){
    const phone=t.replace(/[^+0-9]/g,"");if(phone.replace(/\D/g,"").length<9){await send(chatId,"Please enter a valid phone number (at least 9 digits). Try again.");return;}
    s.data.phone=phone;s.state="checkout_type";await putSession(s);await send(chatId,"Would you like delivery or pickup?",{inline_keyboard:[[{text:"🛵 Delivery",callback_data:"type:delivery"},{text:"🏃 Pickup",callback_data:"type:pickup"}],[{text:"Cancel",callback_data:"home"}]]});return;
  }
  if(s.state==="checkout_address"){s.data.address=clean(t);s.state="checkout_payment";await putSession(s);await send(chatId,"Choose your payment method:",{inline_keyboard:[[{text:"Cash",callback_data:"pay:Cash"},{text:"CBE",callback_data:"pay:CBE"}],[{text:"BOA",callback_data:"pay:BOA"},{text:"Tele Birr",callback_data:"pay:Tele Birr"}]]});return;}
  if(s.state==="track_phone"){return;}
  if(s.state==="checkout_notes"){s.data.notes=clean(t);await putSession(s);await confirmOrder(chatId,s);return;}
  if(["cart","my cart","show cart"].includes(low)){await send(chatId,cartText(s.data.cart),{inline_keyboard:[[{text:"➕ Add more",callback_data:"menu"},{text:"✅ Checkout",callback_data:"checkout"}],[{text:"🧹 Clear cart",callback_data:"clearcart"}]]});return;}
  if(/\b(clear|empty|remove)\b.*\bcart\b/i.test(low)){s.data.cart=[];await putSession(s);await send(chatId,"Your cart is now empty.",mainKeyboard());return;}
  if(/\b(checkout|place order|buy|i want to order)\b/i.test(low)){if(!s.data.cart.length){await showMenu(chatId);return;}await startCheckout(chatId,s);return;}
  // Natural-language menu discovery: exact product-name matches add items; otherwise ask AI.
  const all=await products();const match=all.find(p=>low.includes(p.name.toLowerCase())||(p.name_am&&t.includes(p.name_am)));
  if(match && /\b(add|want|order|one|two|please)\b/i.test(low)){
    const existing=s.data.cart.find((x:CartLine)=>x.id===match.id);if(existing)existing.quantity+=1;else s.data.cart.push(toCart(match,1));await putSession(s);await send(chatId,`Added <b>${clean(match.name)}</b> to your cart.\n\n${cartText(s.data.cart)}`,{inline_keyboard:[[{text:"➕ Keep shopping",callback_data:"menu"},{text:"🛒 View cart",callback_data:"cart"}],[{text:"✅ Checkout",callback_data:"checkout"}]]});return;
  }
  if(/\b(hi|hello|selam|hey)\b/i.test(low)){await send(chatId,"Selam! 😊 I can help you choose food, place an order, or track an order. What would you like to do?",mainKeyboard());return;}
  const answer=await callAI(t,all,s.data.history||[]);
  if(answer){s.data.history=[...(s.data.history||[]),{role:"user",content:t},{role:"assistant",content:answer}].slice(-8);await putSession(s);await send(chatId,clean(answer),mainKeyboard());}
  else await send(chatId,"I can help with our menu, ordering, and tracking. Tap one of the options below. For example, type <b>show menu</b> or <b>track order</b>.",mainKeyboard());
}
function toCart(p:Product,quantity:number):CartLine{return {id:p.id,name:p.name,name_am:p.name_am||"",price:Number(p.price),quantity,category:p.category,takeawayPackFee:Number(p.takeaway_pack_fee||0),prepTime:Number(p.prep_time||12)};}
function statusHelp(status:string){switch(status){case"Pending":return"Your order was received and is waiting for cafe confirmation.";case"Confirmed":return"The cafe has confirmed your order.";case"Preparing":return"Your food is being prepared.";case"Ready":return"Your order is ready for pickup or delivery.";case"Completed":return"Your order is complete. Thank you for choosing Amore!";case"Cancelled":return"This order was cancelled. Please contact cafe staff if you need help.";default:return"Please contact cafe staff if you need assistance.";}}
async function startCheckout(chatId:number|string,s:Session){s.state="checkout_name";await putSession(s);await send(chatId,`<b>Checkout</b>\n${cartText(s.data.cart)}\n\nWhat name should be on the order?`,{inline_keyboard:[[{text:"Cancel",callback_data:"home"}]]});}
async function confirmOrder(chatId:number|string,s:Session){
  const d=s.data;const cart:CartLine[]=d.cart||[];if(!cart.length){s.state="idle";await putSession(s);await send(chatId,"Your cart is empty.",mainKeyboard());return;}
  const ids=[...new Set(cart.map(x=>x.id))];const fresh:Product[]=await db(`foods?id=in.(${ids.map(encodeURIComponent).join(",")})&available=eq.true&select=id,name,name_am,category,price,takeaway_pack_fee,prep_time`);
  const items:CartLine[]=cart.map(old=>{const p=fresh.find(x=>x.id===old.id);if(!p)throw new Error(`Sorry, ${old.name} is no longer available. Please update your cart.`);return toCart(p,Math.min(20,Math.max(1,Number(old.quantity)||1)));});
  const subtotal=items.reduce((n,x)=>n+x.price*x.quantity,0);const orderId=`AM-${Date.now().toString().slice(-8)}`;
  const row={id:orderId,customer_name:d.name,phone:d.phone,order_type:d.type||"pickup",delivery_zone:null,delivery_fee:0,delivery_distance_km:null,delivery_lat:null,delivery_lng:null,address:d.type==="delivery"?(d.address||""):"",table_number:"",items,subtotal,total:subtotal,status:"Pending",notes:d.notes||"Telegram chat order",payment:d.payment||"Cash",receipt_url:null,telegram_chat_id:String(chatId),source:"telegram",created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  await db("orders",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(row)});
  s.state="idle";s.data={cart:[],history:[]};await putSession(s);
  await send(chatId,`🎉 <b>Your order has been placed!</b>\n\nOrder number: <code>${orderId}</code>\nName: ${clean(d.name)}\nItems: ${items.map(x=>`${clean(x.name)} × ${x.quantity}`).join(", ")}\nFood subtotal: <b>${money(subtotal)}</b>\nPayment: ${clean(d.payment||"Cash")}\nStatus: <b>Pending</b>\n\nSave your order number. You can track it anytime using <b>Track order</b> and your phone number. Delivery fee, if applicable, may need confirmation by cafe staff.`,mainKeyboard());
}
async function callback(chatId:number|string, from:any, data:string){
  let s=await getSession(String(chatId));s.data=s.data||{};s.data.cart=Array.isArray(s.data.cart)?s.data.cart:[];
  if(data==="home"){s.state="idle";await putSession(s);await send(chatId,"What can I help you with today?",mainKeyboard());return;}
  if(data==="menu"){s.state="ordering";await putSession(s);await showMenu(chatId);return;}
  if(data.startsWith("cat:")){await showMenu(chatId,data.slice(4));return;}
  if(data.startsWith("add:")){const id=data.slice(4);const p=(await products()).find(x=>x.id===id);if(!p){await send(chatId,"Sorry, that item is no longer available.");return;}const old=s.data.cart.find((x:CartLine)=>x.id===id);if(old)old.quantity=Math.min(20,old.quantity+1);else s.data.cart.push(toCart(p,1));await putSession(s);await send(chatId,`Added <b>${clean(p.name)}</b> to your cart.\n\n${cartText(s.data.cart)}`,{inline_keyboard:[[{text:"➕ Add more",callback_data:`cat:${p.category}`},{text:"🛒 View cart",callback_data:"cart"}],[{text:"✅ Checkout",callback_data:"checkout"}]]});return;}
  if(data==="cart"){await send(chatId,cartText(s.data.cart),{inline_keyboard:[[{text:"➕ Add more",callback_data:"menu"},{text:"✅ Checkout",callback_data:"checkout"}],[{text:"🧹 Clear cart",callback_data:"clearcart"},{text:"🏠 Home",callback_data:"home"}]]});return;}
  if(data==="clearcart"){s.data.cart=[];await putSession(s);await send(chatId,"Cart cleared.",mainKeyboard());return;}
  if(data==="checkout"){if(!s.data.cart.length){await send(chatId,"Your cart is empty. Please choose something first.",{inline_keyboard:[[{text:"🍽️ Browse menu",callback_data:"menu"}]]});return;}await startCheckout(chatId,s);return;}
  if(data==="track"){s.state="track_id";s.data.track={};await putSession(s);await send(chatId,"Send your <b>order number</b> (example: <code>AM-12345678</code>).",{inline_keyboard:[[{text:"Cancel",callback_data:"home"}]]});return;}
  if(data==="ask"){await send(chatId,"Ask me anything about our food, prices, or ordering. You can also type <b>show menu</b> or <b>track order</b>.",mainKeyboard());return;}
  if(data.startsWith("type:")){s.data.type=data.slice(5);if(s.data.type==="delivery"){s.state="checkout_address";await putSession(s);await send(chatId,"Please send your delivery address or a clear nearby landmark in Kombolcha. The cafe may contact you to confirm the delivery fee.");}else{s.state="checkout_payment";await putSession(s);await send(chatId,"Choose your payment method:",{inline_keyboard:[[{text:"Cash",callback_data:"pay:Cash"},{text:"CBE",callback_data:"pay:CBE"}],[{text:"BOA",callback_data:"pay:BOA"},{text:"Tele Birr",callback_data:"pay:Tele Birr"}]]});}return;}
  if(data.startsWith("pay:")){s.data.payment=data.slice(4);s.state="checkout_notes";await putSession(s);await send(chatId,"Any special instructions? Type them now, or type <b>no</b> if none.");return;}
}
export async function GET(){return NextResponse.json({ok:true,service:"Amore Cafe AI Telegram assistant"});}
export async function POST(req:NextRequest){
  const expected=process.env.TELEGRAM_WEBHOOK_SECRET;
  if(expected&&req.headers.get("x-telegram-bot-api-secret-token")!==expected)return NextResponse.json({ok:false},{status:401});
  if(!token())return NextResponse.json({ok:false,error:"Telegram bot is not configured"},{status:503});
  try{
    const update=await req.json();
    if(update?.callback_query){const q=update.callback_query;await tg("answerCallbackQuery",{callback_query_id:q.id});const chatId=q.message?.chat?.id;if(chatId&&q.data)await callback(chatId,q.from,q.data);return NextResponse.json({ok:true});}
    const message=update?.message;const chatId=message?.chat?.id;const text=String(message?.text||"").trim();if(!chatId)return NextResponse.json({ok:true});
    if(message?.photo){await send(chatId,"I received your photo. For payment receipt verification, please follow the cafe's current checkout instructions or contact staff.",mainKeyboard());return NextResponse.json({ok:true});}
    if(!text)return NextResponse.json({ok:true});
    try{await handleText(chatId,message.from,text);}catch(e){console.error("Telegram assistant handling error",e);await send(chatId,"Sorry, I couldn't complete that step. Your message wasn't enough to confirm an order. Please try again or contact Amore Cafe staff.",mainKeyboard());}
    return NextResponse.json({ok:true});
  }catch(error){console.error("Telegram webhook error",error);return NextResponse.json({ok:false},{status:500});}
}
