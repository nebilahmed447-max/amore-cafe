import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const expectedAmount = Number(form.get("expectedAmount"));
    const paymentMethod = String(form.get("paymentMethod") || "");
    if (!(file instanceof File)) return NextResponse.json({ valid: false, reason: "Please attach a payment receipt image." }, { status: 400 });
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) return NextResponse.json({ valid: false, reason: "Choose your delivery location and calculate the final order total first." }, { status: 400 });
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return NextResponse.json({ valid: false, reason: "Upload a JPG, PNG, or WEBP screenshot of the payment receipt. Other file types are not accepted." }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ valid: false, reason: "Receipt images must be 5 MB or smaller." }, { status: 400 });

    const openAiKey = process.env.OPENAI_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!openAiKey) return NextResponse.json({ valid: false, reason: "Receipt checking is not configured yet. Add OPENAI_API_KEY in Vercel." }, { status: 503 });
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ valid: false, reason: "Duplicate-receipt checking is not configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel." }, { status: 503 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const receiptHash = createHash("sha256").update(bytes).digest("hex");
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: duplicate, error: duplicateError } = await db.from("orders").select("id").eq("receipt_hash", receiptHash).limit(1).maybeSingle();
    if (duplicateError) return NextResponse.json({ valid: false, reason: "Receipt verification database is not ready. Run supabase/payment-receipt-verification.sql in Supabase first." }, { status: 503 });
    if (duplicate) return NextResponse.json({ valid: false, reason: "This exact receipt image has already been used for another order. Please upload the receipt for your own payment." }, { status: 422 });

    const base64 = bytes.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You screen Ethiopian mobile/bank transfer receipt screenshots for a restaurant checkout. Inspect only visible evidence; never assume missing details. Return JSON keys: is_payment_receipt (boolean), payment_successful (boolean), amount_etb (number or null), payment_method (string or null), confidence (number 0..1), reason (short string). Reject menus, galleries, selfies, unrelated photos, payment requests, failed/pending transactions, cropped images with no meaningful proof, and receipts whose transaction status is not clearly successful. Do not claim a screenshot is authentic; you cannot verify the bank network. Read the amount actually transferred, not account balance or fee. If ambiguous, set false and explain." },
          { role: "user", content: [ { type: "text", text: `Check this payment receipt for an Amore Cafe order. Required amount: exactly ${expectedAmount} ETB. Expected payment method: ${paymentMethod}. Accept only a clearly successful transaction and amount within 1 ETB of the required amount. The receipt method must reasonably match the expected method. Return the required JSON.` }, { type: "image_url", image_url: { url: dataUrl, detail: "high" } } ] }
        ]
      })
    });
    const aiJson = await aiResponse.json().catch(() => ({}));
    if (!aiResponse.ok) {
      // Log the provider status and safe error payload so Vercel Runtime Logs
      // reveal the cause without exposing the API key or uploaded receipt.
      const providerMessage = String(aiJson?.error?.message || "No provider error message returned.");
      console.error("OpenAI receipt verification failed", {
        status: aiResponse.status,
        code: aiJson?.error?.code || null,
        type: aiJson?.error?.type || null,
        message: providerMessage.slice(0, 500),
      });

      const reason = aiResponse.status === 401 || aiResponse.status === 403
        ? "Receipt verification API authentication failed. Check the OPENAI_API_KEY in Vercel and redeploy."
        : aiResponse.status === 429
          ? "Receipt verification API quota or rate limit reached. Check OpenAI API billing and usage limits."
          : aiResponse.status === 400
            ? "Receipt verification sent a request the AI service rejected. Check OPENAI_MODEL and the receipt image format."
            : "The receipt checker could not complete the AI check. Please try again or contact staff.";
      return NextResponse.json({ valid: false, reason }, { status: 502 });
    }
    const content = aiJson.choices?.[0]?.message?.content;
    let parsed: any;
    try { parsed = JSON.parse(content || "{}"); } catch { parsed = {}; }
    const amount = Number(parsed.amount_etb);
    const amountMatches = Number.isFinite(amount) && Math.abs(amount - expectedAmount) <= 1;
    const seenMethod = String(parsed.payment_method || "").toLowerCase();
    const expectedMethod = paymentMethod.toLowerCase();
    const methodMatches = expectedMethod === "cbe"
      ? /\bcbe\b|commercial bank of ethiopia/.test(seenMethod)
      : expectedMethod === "boa"
        ? /\bboa\b|bank of abyssinia|abyssinia/.test(seenMethod)
        : expectedMethod === "tele birr"
          ? /tele\s*birr|telebirr/.test(seenMethod)
          : false;
    const valid = parsed.is_payment_receipt === true && parsed.payment_successful === true && amountMatches && methodMatches && Number(parsed.confidence) >= 0.65;
    const reason = valid
      ? `Receipt image looks like a successful ${paymentMethod} payment for ${amount} ETB. Final confirmation is still done by Amore Cafe.`
      : !parsed.is_payment_receipt
        ? "This does not look like a payment receipt. Upload the bank or mobile-money transaction confirmation."
        : parsed.payment_successful !== true
          ? "The transaction is not clearly marked successful. Upload the completed payment receipt."
          : !amountMatches
            ? `The receipt amount does not match the required ${expectedAmount} ETB total.`
            : !methodMatches
              ? `The payment method could not be confirmed as ${paymentMethod}. Upload the correct payment receipt.`
              : String(parsed.reason || "This image did not pass the receipt checks.");
    return NextResponse.json({ valid, receiptHash, amountEtb: Number.isFinite(amount) ? amount : null, confidence: Number(parsed.confidence || 0), reason });
  } catch (error) {
    console.error("Payment receipt check failed", error);
    return NextResponse.json({ valid: false, reason: "Could not check this image. Please try a clearer receipt screenshot." }, { status: 500 });
  }
}
