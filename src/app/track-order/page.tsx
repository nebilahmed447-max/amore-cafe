"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Page } from "@/components/Shell";
import { supabase } from "@/supabase";

type OrderStatus = "Pending" | "Confirmed" | "Preparing" | "Ready" | "Completed" | "Cancelled";
const statuses: OrderStatus[] = ["Pending", "Confirmed", "Preparing", "Ready", "Completed", "Cancelled"];

function description(status: OrderStatus) {
  return ({
    Pending: "Your order has been received and is waiting for confirmation.",
    Confirmed: "Amore Cafe has confirmed your order.",
    Preparing: "Your food is being prepared with amore.",
    Ready: "Your order is ready for pickup or delivery.",
    Completed: "Your order has been completed. Thank you for choosing Amore!",
    Cancelled: "This order has been cancelled. Please contact Amore Cafe if you need help.",
  })[status];
}

export default function TrackOrder() {
  const [orderId, setOrderId] = useState("");
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const checkStatus = useCallback(async (id: string) => {
    const cleanId = id.trim();
    if (!cleanId) { setError("Enter your order number to check the status."); return; }
    setChecking(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("get_order_status", { p_order_id: cleanId });
    if (rpcError) { console.error("Order status check failed:", rpcError); setError("We could not check this order right now. Please try again."); setChecking(false); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) { setStatus(null); setTotal(null); setCreatedAt(null); setError("Order not found. Please check your order number."); setChecking(false); return; }
    localStorage.setItem("amore-last-order-id", cleanId);
    setOrderId(cleanId); setStatus(row.status as OrderStatus); setTotal(Number(row.total || 0)); setCreatedAt(row.created_at || null); setChecking(false);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("amore-last-order-id") || "";
    if (saved) {
      setOrderId(saved);
      checkStatus(saved);
    }
  }, [checkStatus]);

  useEffect(() => {
    if (!orderId || !status || status === "Completed" || status === "Cancelled") return;
    const timer = window.setInterval(() => checkStatus(orderId), 15000);
    return () => window.clearInterval(timer);
  }, [orderId, status, checkStatus]);

  const currentIndex = useMemo(() => status ? statuses.indexOf(status) : -1, [status]);

  return <Page>
    <main className="mx-auto max-w-3xl px-5 py-16 lg:px-8">
      <section className="text-center">
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-[var(--brand-green)]">AMORE CAFE</p>
        <h1 className="mt-3 text-5xl font-black tracking-[-.06em]">Track your order.</h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-neutral-500">Enter your order number anytime to see the latest status, even after you close the website.</p>
      </section>

      <section className="mt-10 rounded-[28px] border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[0_20px_60px_rgba(32,104,92,.06)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[9px] font-black uppercase tracking-[.18em] text-[var(--brand-green)]">Check order status</p><h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Where is my order?</h2></div>
          {orderId && <div className="text-left sm:text-right"><span className="block text-[8px] font-black uppercase tracking-[.15em] text-neutral-400">Order number</span><strong className="text-sm">{orderId}</strong></div>}
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <input
              value={orderId}
              onChange={e => {
                setOrderId(e.target.value);
                setError("");
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && orderId.trim()) checkStatus(orderId);
              }}
              placeholder="Enter order number e.g. AM-12345678"
              aria-label="Order number"
              className="h-12 w-full rounded-full border border-[var(--line)] bg-[#fffdf8] px-4 pr-12 text-sm outline-none focus:border-[#9ec5bd]"
            />
            {orderId && (
              <button
                type="button"
                onClick={() => {
                  setOrderId("");
                  setStatus(null);
                  setTotal(null);
                  setCreatedAt(null);
                  setError("");
                }}
                aria-label="Clear order number"
                title="Clear order number"
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                ×
              </button>
            )}
          </div>
          <button type="button" onClick={() => checkStatus(orderId)} disabled={checking || !orderId.trim()} className="h-12 rounded-full bg-[var(--brand-green)] px-6 text-sm font-black text-white disabled:opacity-60">{checking ? "Checking..." : "Check status"}</button>
        </div>
        {error && <p className="mt-4 rounded-2xl bg-[#fff3ee] px-4 py-3 text-xs font-semibold text-[#9b5d49]">{error}</p>}

        {status && !error && <div className="mt-8">
          <div className="rounded-2xl bg-[var(--brand-green-soft)] p-5">
            <div className="flex items-center justify-between gap-3"><div><span className="text-[8px] font-black uppercase tracking-[.15em] text-[var(--brand-green-dark)]">Current status</span><h3 className="mt-1 text-2xl font-black">{status}</h3></div><span className="grid h-12 w-12 place-items-center rounded-full bg-white text-[var(--brand-green)] text-xl font-black">{status === "Cancelled" ? "×" : status === "Completed" ? "✓" : "•"}</span></div>
            <p className="mt-2 text-xs leading-6 text-neutral-600">{description(status)}</p>
          </div>
          {status !== "Cancelled" && <div className="mt-6 grid grid-cols-6 gap-1">{statuses.map((s, i) => <div key={s} className="text-center"><div className={`mx-auto h-3 w-3 rounded-full border-2 ${i <= currentIndex && currentIndex >= 0 ? "border-[var(--brand-green)] bg-[var(--brand-green)]" : "border-neutral-300 bg-white"}`}/><span className={`mt-2 block text-[7px] font-black uppercase tracking-wide ${i <= currentIndex ? "text-[var(--brand-green-dark)]" : "text-neutral-400"}`}>{s}</span></div>)}</div>}
          {total !== null && <div className="mt-7 flex items-center justify-between border-t border-[var(--line)] pt-5"><div><span className="block text-[8px] font-black uppercase tracking-[.15em] text-neutral-400">Order total</span><strong className="text-xl">{total.toLocaleString()} ETB</strong></div>{createdAt && <span className="text-[10px] text-neutral-400">{new Date(createdAt).toLocaleString()}</span>}</div>}
        </div>}
      </section>

      <div className="mt-7 text-center"><Link href="/menu" className="inline-flex rounded-full border border-[var(--line)] bg-[var(--paper)] px-6 py-3 text-xs font-black">Order more</Link></div>
    </main>
  </Page>
}
