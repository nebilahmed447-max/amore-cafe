"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Page } from "@/components/Shell";
import { supabase } from "@/supabase";

type OrderStatus = "Pending" | "Confirmed" | "Preparing" | "Ready" | "Completed" | "Cancelled";

const statuses: OrderStatus[] = [
  "Pending",
  "Confirmed",
  "Preparing",
  "Ready",
  "Completed",
  "Cancelled",
];

function statusDescription(status: OrderStatus) {
  switch (status) {
    case "Pending":
      return "Your order has been received and is waiting for confirmation.";
    case "Confirmed":
      return "Amore Cafe has confirmed your order.";
    case "Preparing":
      return "Your food is being prepared with amore.";
    case "Ready":
      return "Your order is ready for pickup or delivery.";
    case "Completed":
      return "Your order has been completed. Thank you for choosing Amore!";
    case "Cancelled":
      return "This order has been cancelled. Please contact Amore Cafe if you need help.";
  }
}

export default function Success() {
  const params = useSearchParams();
  const initialId = params.get("id") || "";
  const [orderId, setOrderId] = useState(initialId);
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(initialId));
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const checkStatus = useCallback(async (id = orderId) => {
    const cleanId = id.trim();
    if (!cleanId) {
      setError("Enter your order number to check the status.");
      return;
    }

    setChecking(true);
    setError("");

    const { data, error: rpcError } = await supabase.rpc("get_order_status", {
      p_order_id: cleanId,
    });

    if (rpcError) {
      console.error("Order status check failed:", rpcError);
      setError("We could not check this order right now. Please try again.");
      setChecking(false);
      setLoading(false);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      setStatus(null);
      setTotal(null);
      setCreatedAt(null);
      setError("Order not found. Please check your order number.");
      setChecking(false);
      setLoading(false);
      return;
    }

    setStatus(row.status as OrderStatus);
    setTotal(Number(row.total || 0));
    setCreatedAt(row.created_at || null);
    setChecking(false);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    const savedId = initialId || window.localStorage.getItem("amore-last-order-id") || "";
    if (!initialId && savedId) setOrderId(savedId);
    if (savedId) checkStatus(savedId);
  }, [initialId, checkStatus]);

  useEffect(() => {
    if (!orderId || !status || status === "Completed" || status === "Cancelled") return;
    const timer = window.setInterval(() => checkStatus(orderId), 15000);
    return () => window.clearInterval(timer);
  }, [orderId, status, checkStatus]);

  const currentIndex = useMemo(
    () => (status ? statuses.indexOf(status) : -1),
    [status]
  );

  return (
    <Page>
      <main className="mx-auto max-w-3xl px-5 py-16 lg:px-8">
        <section className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--brand-green-soft)] text-[var(--brand-green)] text-2xl font-black">
            ✓
          </div>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[.2em] text-[var(--brand-green)]">
            AMORE CAFE
          </p>
          <h1 className="mt-2 text-5xl font-black tracking-[-.06em]">Order received.</h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-neutral-500">
            Your order has been sent to Amore Cafe. You can check its status below at any time.
          </p>
        </section>

        <section className="mt-10 rounded-[28px] border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[0_20px_60px_rgba(32,104,92,.06)] sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.18em] text-[var(--brand-green)]">
                Check order status
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Track your order</h2>
            </div>
            {orderId && (
              <div className="text-left sm:text-right">
                <span className="block text-[8px] font-black uppercase tracking-[.15em] text-neutral-400">Order number</span>
                <strong className="text-sm">{orderId}</strong>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Enter order number e.g. AM-12345678"
              className="h-12 flex-1 rounded-full border border-[var(--line)] bg-[#fffdf8] px-4 text-sm outline-none focus:border-[#9ec5bd]"
            />
            <button
              type="button"
              onClick={() => checkStatus()}
              disabled={checking}
              className="h-12 rounded-full bg-[var(--brand-green)] px-6 text-sm font-black text-white disabled:opacity-60"
            >
              {checking ? "Checking..." : "Check status"}
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-2xl bg-[#fff3ee] px-4 py-3 text-xs font-semibold text-[#9b5d49]">
              {error}
            </p>
          )}

          {loading && !error && (
            <div className="mt-8 text-center text-sm text-neutral-400">Checking your order...</div>
          )}

          {!loading && status && !error && (
            <div className="mt-8">
              <div className="rounded-2xl bg-[var(--brand-green-soft)] p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-[.15em] text-[var(--brand-green)]">Current status</span>
                    <h3 className="mt-1 text-2xl font-black tracking-[-.04em]">{status}</h3>
                  </div>
                  {total !== null && <strong className="text-lg">{total.toLocaleString()} ETB</strong>}
                </div>
                <p className="mt-3 text-xs leading-6 text-[#58716a]">{statusDescription(status)}</p>
                {createdAt && (
                  <p className="mt-2 text-[9px] text-[#71857f]">
                    Placed {new Date(createdAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="mt-7">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[.16em] text-neutral-400">Order progress</span>
                  <button type="button" onClick={() => checkStatus()} disabled={checking} className="text-[9px] font-black text-[var(--brand-green)] disabled:opacity-50">
                    Refresh
                  </button>
                </div>

                <div className="grid gap-2">
                  {statuses.map((item, index) => {
                    const active = item === status;
                    const done = status !== "Cancelled" && currentIndex >= index;
                    const cancelled = status === "Cancelled" && item === "Cancelled";
                    return (
                      <div
                        key={item}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                          active || cancelled
                            ? "border-[#b8d5ce] bg-[var(--brand-green-soft)]"
                            : "border-[var(--line)] bg-[#fffdf8]"
                        }`}
                      >
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black ${done || cancelled ? "bg-[var(--brand-green)] text-white" : "bg-[#eee9e3] text-neutral-400"}`}>
                          {done || cancelled ? "✓" : index + 1}
                        </span>
                        <span className={`text-sm font-black ${active || cancelled ? "text-[var(--brand-green-dark)]" : "text-neutral-500"}`}>
                          {item}
                        </span>
                        {active && <span className="ml-auto text-[8px] font-black uppercase tracking-[.12em] text-[var(--brand-green)]">Current</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="mt-7 flex justify-center">
          <Link href="/menu" className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-6 py-3 text-sm font-black">
            Order more
          </Link>
        </div>
      </main>
    </Page>
  );
}
