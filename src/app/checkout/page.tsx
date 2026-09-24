"use client";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/Shell";
import { saveOrder, useCart } from "@/components/Providers";
import { Order } from "@/lib/types";
import { supabase } from "@/supabase";
import DeliveryMap from "@/components/DeliveryMap";

const paymentMethods: Array<{ value: Order["payment"]; label: string; description: string }> = [
  { value: "CBE", label: "CBE", description: "Commercial Bank of Ethiopia" },
  { value: "BOA", label: "BOA", description: "Bank of Abyssinia" },
  { value: "Tele Birr", label: "Tele Birr", description: "Mobile money payment" },
  { value: "Cash", label: "Cash", description: "Pay at pickup / dine-in" },
];

const bankDetails: Partial<Record<"CBE" | "BOA", { bank: string; accountNumber: string; accountHolder: string }>> = {
  CBE: {
    bank: "Commercial Bank of Ethiopia",
    accountNumber: "1000515089897",
    accountHolder: "Wizdan Mohammed",
  },
  // Add the cafe's real BOA account number and account holder here before launch.
  BOA: {
    bank: "Bank of Abyssinia",
    accountNumber: "ADD BOA ACCOUNT NUMBER",
    accountHolder: "ADD ACCOUNT HOLDER NAME",
  },
};

const teleBirrDetails = {
  number: "094 676 4424",
  accountHolder: "Tilahun Wegaye",
};

const receiptPayments: Order["payment"][] = ["CBE", "BOA", "Tele Birr"];

const AMORE_LOCATION = { lat: 11.0866315, lng: 39.7370094 };
// Delivery fee is based on the Google driving distance between the customer's selected map pin and Amore Cafe. Distance is calculated in METERS first.
// 0–50 m = FREE, 51–600 m = 50 ETB, 601–2500 m = 100 ETB, >2500 m = 200 ETB.
const deliveryRules = [
  { value: "Free" as const, maxMeters: 50, fee: 0, label: "Free", range: "0–50 m" },
  { value: "Near" as const, maxMeters: 600, fee: 50, label: "Near", range: "51–600 m" },
  { value: "Medium" as const, maxMeters: 2500, fee: 100, label: "Medium", range: "601 m–2.5 km" },
  { value: "Far" as const, maxMeters: Infinity, fee: 200, label: "Far", range: "> 2.5 km" },
];

function getDeliveryFee(distanceMeters:number){
  if (distanceMeters <= 50) return 0;
  if (distanceMeters <= 600) return 50;
  if (distanceMeters <= 2500) return 100;
  return 200;
}

function getDeliveryRule(distanceMeters:number){
  const fee = getDeliveryFee(distanceMeters);
  return deliveryRules.find(r => r.fee === fee && distanceMeters <= r.maxMeters) || deliveryRules[3];
}

async function calculateDeliveryRoute(lat:number,lng:number){
  const response = await fetch("/api/delivery-distance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if(!response.ok || !Number.isFinite(Number(data.distanceMeters))){
    throw new Error(data.error || "We could not calculate the driving distance. Please check the delivery pin and try again.");
  }
  return {
    distanceMeters: Number(data.distanceMeters),
    zone: data.zone as NonNullable<Order["deliveryZone"]>,
    fee: Number(data.fee),
  };
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(el);
    return copied;
  } catch (error) {
    console.error("Copy failed:", error);
    return false;
  }
}

export default function Checkout(){
  const router=useRouter();
  const {items,total,clear}=useCart();
  const [form,setForm]=useState({name:"",phone:"",address:"",notes:"",orderType:"pickup" as Order["orderType"],deliveryZone:"Near" as NonNullable<Order["deliveryZone"]>,payment:"Cash" as Order["payment"]});
  const [submitting,setSubmitting]=useState(false);
  const [copied,setCopied]=useState(false);
  const [receipt,setReceipt]=useState<File|null>(null);
  const [receiptError,setReceiptError]=useState("");
  const [location,setLocation]=useState<{lat:number;lng:number;distanceMeters:number;zone:NonNullable<Order["deliveryZone"]>;fee:number}|null>(null);
  const [locating,setLocating]=useState(false);
  const [locationError,setLocationError]=useState("");
  const routeRequestRef=useRef(0);

  async function handleDeliveryPinChange(pin:{lat:number;lng:number}){
    const requestId=++routeRequestRef.current;
    setLocating(true);
    setLocationError("");
    setLocation({lat:pin.lat,lng:pin.lng,distanceMeters:-1,zone:"Near",fee:0});
    try {
      const route=await calculateDeliveryRoute(pin.lat,pin.lng);
      if(requestId!==routeRequestRef.current)return;
      setLocation({lat:pin.lat,lng:pin.lng,distanceMeters:route.distanceMeters,zone:route.zone,fee:route.fee});
      setForm(prev=>({...prev,deliveryZone:route.zone}));
    } catch(error) {
      if(requestId!==routeRequestRef.current)return;
      console.error("Delivery route calculation failed",error);
      setLocation(null);
      setLocationError(error instanceof Error ? error.message : "We could not calculate the driving distance. Please check the delivery pin and try again.");
    } finally {
      if(requestId===routeRequestRef.current)setLocating(false);
    }
  }

  async function submit(e:FormEvent){
    e.preventDefault();
    if(!items.length || submitting)return;
    const normalizedPhone=form.phone.trim();
    if(!/^\+?\d{10,12}$/.test(normalizedPhone)){
      alert("Phone number must contain 10–12 digits and may start with +.");
      return;
    }
    if(!form.address.trim()){
      alert(form.orderType === "delivery" ? "Please enter your delivery address." : "Please enter your table number or pickup note.");
      return;
    }
    if(form.orderType === "delivery" && form.payment === "Cash"){
      alert("Cash payment is not available for delivery orders. Please choose CBE, BOA, or Tele Birr.");
      return;
    }
    if(receiptPayments.includes(form.payment) && !receipt){
      setReceiptError("Payment receipt is required for this payment method.");
      return;
    }
    if(form.orderType === "delivery" && (!location || location.distanceMeters < 0)){alert("Please choose your delivery location on the map and wait for the delivery fee to be calculated.");return;}
    setReceiptError("");
    setSubmitting(true);

    let finalLocation = location;
    let finalRule: ReturnType<typeof getDeliveryRule> | null = null;

    if(form.orderType === "delivery") {
      try {
        // Recalculate at checkout so the submitted order uses a fresh driving distance from the server.
        if(!finalLocation || finalLocation.distanceMeters < 0) throw new Error("Please choose your delivery location on the map first.");
        const route = await calculateDeliveryRoute(finalLocation.lat, finalLocation.lng);
        finalLocation = { ...finalLocation, distanceMeters: route.distanceMeters, zone: route.zone, fee: route.fee };
        setLocation(finalLocation);
        finalRule = getDeliveryRule(route.distanceMeters);
        setForm(prev=>({...prev,deliveryZone:route.zone}));
      } catch(error) {
        setSubmitting(false);
        setLocationError(error instanceof Error ? error.message : "We could not calculate your delivery distance. Please check the delivery pin and try again.");
        
        return;
      }
    }

    const deliveryFee = form.orderType === "delivery" && finalRule ? finalRule.fee : 0;
    const order:Order={id:`AM-${Date.now().toString().slice(-8)}`,createdAt:new Date().toISOString(),customer:{name:form.name.trim(),phone:normalizedPhone,address:form.address.trim(),notes:form.notes.trim()},items,orderType:form.orderType,deliveryZone:form.orderType === "delivery" && finalRule ? finalRule.value : undefined,deliveryFee,deliveryDistanceKm:form.orderType === "delivery" && finalLocation ? finalLocation.distanceMeters / 1000 : undefined,deliveryLat:form.orderType === "delivery" ? finalLocation?.lat : undefined,deliveryLng:form.orderType === "delivery" ? finalLocation?.lng : undefined,total:total+deliveryFee,status:"Pending",payment:form.payment};
    let uploadedPath:string|undefined;
    try {
      if(receipt && receiptPayments.includes(form.payment)){
        const safeName=receipt.name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-");
        const requestId = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        uploadedPath=`${order.id}/${requestId}-${safeName}`;
        const {error:uploadError}=await supabase.storage.from("payment-receipts").upload(uploadedPath,receipt,{contentType:receipt.type||undefined,upsert:false});
        if(uploadError) throw new Error(`Receipt upload failed: ${uploadError.message}`);
        order.receiptUrl=uploadedPath;
      }
      await saveOrder(order);
      localStorage.setItem("amore-last-order-id", order.id);
      clear();
      router.push(`/order-success?id=${order.id}`);
    } catch (error) {
      console.error(error);
      if(uploadedPath){ try { await supabase.storage.from("payment-receipts").remove([uploadedPath]); } catch {} }
      alert(error instanceof Error ? error.message : "We could not place your order. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <Page><main className="checkout-page mx-auto max-w-4xl px-5 py-14 lg:px-8">
    <span className="text-[10px] font-black uppercase tracking-[.2em] text-[var(--brand-green)]">AMORE CAFE</span>
    <h1 className="mt-2 text-5xl font-black tracking-[-.05em]">Checkout</h1>
    <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-500">Complete your details below. Your order will be sent directly to Amore Cafe.</p>
    <form onSubmit={submit} className="mt-10 grid gap-6 rounded-3xl bg-white p-6 shadow-soft md:grid-cols-2">
      <label className="font-bold">Full name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-2 h-12 w-full rounded-xl border p-3 font-normal outline-none"/></label>
      <label className="font-bold">Phone<input required type="tel" inputMode="tel" autoComplete="tel" maxLength={13} pattern="\+?[0-9]{10,12}" value={form.phone} onChange={e=>{const raw=e.target.value.replace(/[^0-9+]/g,"");const clean=raw.startsWith("+")?"+"+raw.slice(1).replace(/\+/g,""):raw.replace(/\+/g,"");setForm({...form,phone:clean.slice(0,13)})}} placeholder="0912345678 or +251912345678" title="10–12 digits, optionally starting with +" className="mt-2 h-12 w-full rounded-xl border p-3 font-normal outline-none"/><span className="mt-1 block text-xs font-normal text-neutral-500">10–12 digits, optionally starting with +.</span></label>
      <fieldset className="md:col-span-2">
        <legend className="font-bold">Order type</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className={`cursor-pointer rounded-2xl border p-4 transition ${form.orderType==="delivery"?"border-[var(--brand-green)] bg-[var(--brand-green-soft)]":"border-neutral-200 bg-white hover:border-neutral-300"}`}>
            <input type="radio" name="orderType" value="delivery" checked={form.orderType==="delivery"} onChange={()=>{setForm({...form,orderType:"delivery",payment:form.payment==="Cash"?"CBE":form.payment});setLocation(null);setLocationError("")}} className="sr-only"/>
            <span className="flex items-center justify-between gap-3"><strong className="text-sm">🚚 Delivery</strong><span className={`h-3 w-3 rounded-full border ${form.orderType==="delivery"?"border-[var(--brand-green)] bg-[var(--brand-green)]":"border-neutral-300"}`}/></span>
            <small className="mt-1 block text-[10px] leading-4 text-neutral-500">Delivered to your address. Cash payment is not available.</small>
          </label>
          <label className={`cursor-pointer rounded-2xl border p-4 transition ${form.orderType==="pickup"?"border-[var(--brand-green)] bg-[var(--brand-green-soft)]":"border-neutral-200 bg-white hover:border-neutral-300"}`}>
            <input type="radio" name="orderType" value="pickup" checked={form.orderType==="pickup"} onChange={()=>{setForm({...form,orderType:"pickup"});setLocation(null);setLocationError("")}} className="sr-only"/>
            <span className="flex items-center justify-between gap-3"><strong className="text-sm">🪑 Pickup / Dine-in</strong><span className={`h-3 w-3 rounded-full border ${form.orderType==="pickup"?"border-[var(--brand-green)] bg-[var(--brand-green)]":"border-neutral-300"}`}/></span>
            <small className="mt-1 block text-[10px] leading-4 text-neutral-500">Pickup at the cafe or dine in at your table.</small>
          </label>
        </div>
      </fieldset>
      <label className="font-bold md:col-span-2">{form.orderType === "delivery" ? "Delivery address" : "Table number / pickup note"}<span className="ml-1 text-xs font-normal text-red-500">*</span><input required value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder={form.orderType === "delivery" ? "Enter your delivery address" : "Enter table number or pickup note"} className="mt-2 h-12 w-full rounded-xl border p-3 font-normal outline-none"/><span className="mt-1 block text-xs font-normal text-neutral-500">Required.</span></label>
      {form.orderType === "delivery" && <fieldset className="md:col-span-2">
        <legend className="font-bold">Delivery location & fee</legend>
        <div className="mt-3 rounded-3xl border border-[var(--brand-green)]/20 bg-[var(--brand-green-soft)] p-4 sm:p-5">
          <div>
            <p className="text-sm font-black">📍 Choose your delivery location</p>
            <p className="mt-1 text-xs leading-5 text-neutral-600">Tap your location on the map or drag the pin. You do not choose the delivery fee — it is calculated from the driving route between your pin and Amore Cafe.</p>
          </div>
          <div className="mt-4">
            <DeliveryMap value={location ? {lat:location.lat,lng:location.lng} : null} onChange={handleDeliveryPinChange} onAddressChange={(address)=>setForm(prev=>prev.address.trim() ? prev : {...prev,address})}/>
          </div>
          {locating && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold text-neutral-700">Calculating driving distance…</p>}
          {location && location.distanceMeters >= 0 && <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4"><span className="block text-[10px] font-black uppercase tracking-wider text-neutral-400">Driving distance</span><strong className="mt-1 block text-xl">{location.distanceMeters < 1000 ? `${Math.round(location.distanceMeters)} m` : `${(location.distanceMeters / 1000).toFixed(2)} km`}</strong><small className="mt-1 block text-[10px] text-neutral-500">Amore Cafe → selected map location</small></div>
            <div className="rounded-2xl bg-white p-4"><span className="block text-[10px] font-black uppercase tracking-wider text-neutral-400">Delivery zone</span><strong className="mt-1 block text-xl">{getDeliveryRule(location.distanceMeters).label}</strong></div>
            <div className="rounded-2xl bg-white p-4"><span className="block text-[10px] font-black uppercase tracking-wider text-neutral-400">Delivery fee</span><strong className="mt-1 block text-xl">{location.fee===0?"FREE":`${location.fee} ETB`}</strong></div>
          </div>}
          {!location && !locationError && <div className="mt-4 grid gap-2 sm:grid-cols-4">{deliveryRules.map(r=><div key={r.value} className="rounded-2xl bg-white p-3"><strong className="text-sm">{r.label}</strong><span className="ml-2 text-sm font-black">{r.fee===0?"FREE":`${r.fee} ETB`}</span><small className="mt-1 block text-[10px] text-neutral-500">{r.range}</small></div>)}</div>}
          {locationError&&<p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{locationError}</p>}
        </div>
      </fieldset>}
      <label className="font-bold md:col-span-2">Order notes<span className="ml-1 text-xs font-normal text-neutral-400">(optional)</span><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Extra instructions, allergies, preferences, etc." className="mt-2 min-h-24 w-full rounded-xl border p-3 font-normal outline-none"/></label>
      <fieldset className="md:col-span-2">
        <legend className="font-bold">Payment method</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {paymentMethods.filter(method=>form.orderType === "delivery" ? method.value !== "Cash" : true).map(method=><label key={method.value} className={`cursor-pointer rounded-2xl border p-4 transition ${form.payment===method.value?"border-[var(--brand-green)] bg-[var(--brand-green-soft)]":"border-neutral-200 bg-white hover:border-neutral-300"}`}>
            <input type="radio" name="payment" value={method.value} checked={form.payment===method.value} onChange={()=>setForm({...form,payment:method.value})} className="sr-only"/>
            <span className="flex items-center justify-between gap-3"><strong className="text-sm">{method.label}</strong><span className={`h-3 w-3 rounded-full border ${form.payment===method.value?"border-[var(--brand-green)] bg-[var(--brand-green)]":"border-neutral-300"}`}/></span>
            <small className="mt-1 block text-[10px] leading-4 text-neutral-500">{method.description}</small>
          </label>)}
        </div>
        {(() => {
          const selectedBank = form.payment === "CBE" || form.payment === "BOA" ? bankDetails[form.payment] : undefined;
          return selectedBank ? (
          <div className="mt-4 rounded-3xl border border-[var(--brand-green)]/15 bg-[var(--brand-green-soft)] p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm">🏦</div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[var(--brand-green)]">Bank transfer</p>
                <h3 className="text-base font-black">{selectedBank.bank}</h3>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="block text-xs text-neutral-500">Account Number</span>
                  <strong className="mt-1 block break-all text-xl tracking-wide text-neutral-900">{selectedBank.accountNumber}</strong>
                </div>
                <button type="button" onClick={async()=>{const ok=await copyToClipboard(selectedBank.accountNumber);if(ok){setCopied(true);setTimeout(()=>setCopied(false),1800)}}} className="shrink-0 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700">{copied ? "✓ Copied" : "Copy"}</button>
              </div>
            </div>
            <div className="mt-3 border-t border-[var(--brand-green)]/15 pt-3 text-sm">
              <span className="text-neutral-500">Account holder:</span> <strong>{selectedBank.accountHolder}</strong>
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-600">Transfer the exact order total (including delivery fee, if applicable) to this account, then keep your transfer confirmation. Amore Cafe will verify the payment before processing the order.</p>
          </div>
          ) : null;
        })()}
        {form.payment === "Tele Birr" && (
          <div className="mt-4 rounded-3xl border border-[var(--brand-green)]/15 bg-[var(--brand-green-soft)] p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm">📱</div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[var(--brand-green)]">Tele Birr</p>
                <h3 className="text-base font-black">Tele Birr Payment</h3>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="block text-xs text-neutral-500">Tele Birr Number</span>
                  <strong className="mt-1 block break-all text-xl tracking-wide text-neutral-900">{teleBirrDetails.number}</strong>
                </div>
                <button type="button" onClick={async()=>{const text=teleBirrDetails.number.replace(/\s/g,"");const ok=await copyToClipboard(text);if(ok){setCopied(true);setTimeout(()=>setCopied(false),1800)}}} className="shrink-0 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700">{copied ? "✓ Copied" : "Copy"}</button>
              </div>
            </div>
            <div className="mt-3 border-t border-[var(--brand-green)]/15 pt-3 text-sm">
              <span className="text-neutral-500">Account holder:</span> <strong>{teleBirrDetails.accountHolder}</strong>
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-600">Send the exact order total (including delivery fee, if applicable) to this Tele Birr number, then attach your payment receipt below. Amore Cafe will verify the payment before processing the order.</p>
          </div>
        )}

        {receiptPayments.includes(form.payment) && (
          <div className="mt-4 rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-green-soft)] text-lg">📎</div>
              <div>
                <p className="text-sm font-black">Payment receipt <span className="text-red-500">*</span></p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">After paying, attach a screenshot or PDF of your payment receipt.</p>
              </div>
            </div>
            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center transition hover:border-[var(--brand-green)] hover:bg-[var(--brand-green-soft)]">
              <input type="file" accept="image/*,application/pdf" className="sr-only" required={!receipt} onChange={e=>{const file=e.target.files?.[0]||null;setReceiptError("");if(file && file.size>5*1024*1024){setReceipt(null);setReceiptError("Receipt must be 5 MB or smaller.");e.currentTarget.value="";return;}setReceipt(file)}}/>
              <span className="rounded-xl bg-white px-4 py-2 text-sm font-bold shadow-sm">{receipt ? "Change receipt" : "Choose receipt"}</span>
              <span className="mt-2 max-w-full truncate text-xs text-neutral-500">{receipt ? receipt.name : "JPG, PNG, WEBP or PDF · Max 5 MB"}</span>
            </label>
            {receipt && <button type="button" onClick={()=>setReceipt(null)} className="mt-2 text-xs font-bold text-red-600">Remove receipt</button>}
            {receiptError && <p className="mt-2 text-xs font-bold text-red-600">{receiptError}</p>}
          </div>
        )}
        <p className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-[10px] leading-5 text-neutral-500">For bank transfers, verify the account details above before sending money. Amore Cafe will confirm the payment and receipt before processing your order.</p>
      </fieldset>
      <div className="md:col-span-2 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><strong>{total.toLocaleString()} ETB</strong></div>
          {form.orderType === "delivery" && <div className="flex justify-between"><span>Delivery fee ({location?getDeliveryRule(location.distanceMeters).label:"—"})</span><strong>{(location?getDeliveryFee(location.distanceMeters):0).toLocaleString()} ETB</strong></div>}
          <div className="flex items-end justify-between border-t pt-3"><span className="text-xs text-neutral-500">Order total</span><strong className="text-2xl">{(total + (form.orderType === "delivery" && location ? getDeliveryFee(location.distanceMeters) : 0)).toLocaleString()} ETB</strong></div>
        </div>
        <button type="submit" disabled={submitting || !items.length} className="rounded-full bg-black px-7 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting?"Placing order…":"Place order"}</button>
      </div>
    </form>
  </main></Page>
}