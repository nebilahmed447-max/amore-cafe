import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp",
  "image/tiff", "image/x-tiff", "image/x-ms-bmp", "application/pdf",
  "application/x-pdf", "application/octet-stream",
]);

type ReceiptType = "pdf" | "image";

function detectFileType(bytes: Buffer): ReceiptType | null {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image";
  if (bytes.subarray(0, 3).toString("ascii") === "GIF") return "image";
  if (bytes.subarray(0, 2).toString("ascii") === "BM") return "image";
  if (bytes.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) || bytes.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))) return "image";
  return null;
}

function looksLikePaymentReceipt(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const terms = ["transaction", "payment", "transfer", "receipt", "reference", "debit", "credited", "amount", "birr", "etb", "ብር", "ክፍያ", "ተሳክቷል", "telebirr", "tele birr", "commercial bank of ethiopia", "bank of abyssinia"];
  return terms.filter((term) => normalized.includes(term)).length >= 2 && normalized.length >= 20;
}

async function readPdfText(bytes: Buffer): Promise<string> {
  const globals = globalThis as typeof globalThis & { DOMMatrix?: typeof DOMMatrix; ImageData?: typeof ImageData; Path2D?: typeof Path2D };
  globals.DOMMatrix ??= DOMMatrix;
  globals.ImageData ??= ImageData;
  globals.Path2D ??= Path2D;
  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 3); pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => typeof item.str === "string" ? item.str : "").join(" "));
    }
    const embedded = pages.join(" ");
    if (looksLikePaymentReceipt(embedded)) return embedded;
    const worker = await createWorker("eng");
    try {
      const scanned: string[] = [];
      for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 2); pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({ canvasContext: canvas.getContext("2d") as any, viewport }).promise;
        scanned.push((await worker.recognize(canvas.toBuffer("image/png"))).data.text || "");
      }
      return `${embedded} ${scanned.join(" ")}`;
    } finally { await worker.terminate(); }
  } finally { await pdf.destroy(); }
}

async function readImageText(bytes: Buffer): Promise<string> {
  const png = await sharp(bytes, { animated: false, limitInputPixels: 25_000_000 }).rotate().png().toBuffer();
  const worker = await createWorker("eng");
  try { return (await worker.recognize(png)).data.text || ""; }
  finally { await worker.terminate(); }
}

function paymentMethodMatches(text: string, method: string): boolean {
  const t = text.toLowerCase().replace(/\s+/g, " ");
  switch (method.trim().toLowerCase()) {
    case "cbe": return /\bcbe\b|commercial bank of ethiopia|የኢትዮጵያ ንግድ ባንክ/.test(t);
    case "boa": return /\bboa\b|bank of abyssinia|abyssinia|የአቢሲኒያ ባንክ/.test(t);
    case "tele birr": return /tele\s*birr|telebirr|ቴሌ ብር/.test(t);
    default: return false;
  }
}

function transactionStatus(text: string): "success" | "failed" | "unclear" {
  const t = text.toLowerCase().replace(/\s+/g, " ");
  const failed = /\b(failed|failure|declined|rejected|cancelled|canceled|unsuccessful|pending|processing|not successful|insufficient funds)\b|አልተሳካ|አልተፈጸመ|በመጠባበቅ/.test(t);
  if (failed) return "failed";
  const success = /\b(successful|success|completed|complete|paid|payment successful|transaction successful|transfer successful)\b|ተሳክቷል|ተሳክቶ|ተጠናቋል|ተከፍሏል/.test(t);
  return success ? "success" : "unclear";
}

function extractTransferredAmount(text: string, expectedAmount: number): number | null {
  const lines = text.split(/[\r\n]+/).map((line) => line.trim()).filter(Boolean);
  const candidates: Array<{ value: number; score: number }> = [];
  const contextPattern = /amount|total|paid|transfer|transferred|debit|payment|birr|\betb\b|\bbr\b|ብር|ክፍያ|የተላከ|የክፍያ/iu;
  const excludedPattern = /balance|available|fee|charge|account|phone|mobile|reference|transaction\s*(?:id|no|number)|\b(?:id|no|number)\b/i;
  for (const line of lines) {
    if (!contextPattern.test(line) || excludedPattern.test(line)) continue;
    const matches = line.match(/[0-9][0-9,]*(?:\.[0-9]{1,2})?/g) || [];
    for (const raw of matches) {
      const value = Number(raw.replace(/,/g, ""));
      if (!Number.isFinite(value) || value <= 0 || value > Math.max(expectedAmount * 3, expectedAmount + 5000)) continue;
      const nearExpected = Math.abs(value - expectedAmount) <= 1 ? 100 : Math.abs(value - expectedAmount) <= Math.max(10, expectedAmount * 0.05) ? 20 : 0;
      const currencyMark = /birr|\betb\b|ብር/iu.test(line) ? 20 : 0;
      const amountWord = /amount|total|paid|transferred|debit|የተላከ/iu.test(line) ? 20 : 0;
      candidates.push({ value, score: nearExpected + currencyMark + amountWord });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.value ?? null;
}

function jsonError(reason: string, status: number) {
  return NextResponse.json({ valid: false, reason }, { status });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const expectedAmount = Number(form.get("expectedAmount"));
    const paymentMethod = String(form.get("paymentMethod") || "").trim();

    if (!(file instanceof File)) return jsonError("Please attach your payment receipt.", 400);
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) return jsonError("The final order total is missing. Recalculate the order total and try again.", 400);
    if (!["CBE", "BOA", "Tele Birr"].includes(paymentMethod)) return jsonError("Select CBE, BOA, or Tele Birr and upload that payment receipt. Cash orders do not need a receipt.", 400);
    if (file.size === 0 || file.size > MAX_FILE_SIZE) return jsonError("Receipt files must be non-empty and 5 MB or smaller.", 400);
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) return jsonError("Unsupported format. Upload JPG, PNG, WEBP, GIF, BMP, TIFF, or PDF.", 400);

    const bytes = Buffer.from(await file.arrayBuffer());
    const detectedType = detectFileType(bytes);
    if (!detectedType) return jsonError("This file is not a supported image or PDF receipt. Upload the original receipt file.", 400);
    if (detectedType === "pdf" && file.type && !file.type.includes("pdf") && file.type !== "application/octet-stream") return jsonError("The file extension and file content do not match. Upload the original receipt.", 400);
    if (detectedType === "image" && file.type && !file.type.startsWith("image/") && file.type !== "application/octet-stream") return jsonError("The file extension and file content do not match. Upload the original receipt.", 400);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!supabaseUrl || !serviceKey) return jsonError("Receipt screening is not configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy.", 503);

    const receiptHash = createHash("sha256").update(bytes).digest("hex");
    let extractedText = "";
    try {
      extractedText = detectedType === "pdf" ? await readPdfText(bytes) : await readImageText(bytes);
    } catch (error) {
      console.error("Receipt OCR failed:", error instanceof Error ? error.message : error);
      return jsonError("We could not read this receipt. Try a clear JPG/PNG screenshot or a standard PDF.", 422);
    }

    if (!looksLikePaymentReceipt(extractedText)) return jsonError("This file does not contain enough recognizable bank or mobile-money receipt details. Upload the actual transaction confirmation.", 422);

    const status = transactionStatus(extractedText);
    if (status === "failed") return jsonError("The receipt appears to show a failed, pending, or cancelled transaction. Upload a completed successful payment receipt.", 422);
    if (status !== "success") return jsonError("We could not find a clear successful/completed transaction status on this receipt. Upload a clearer receipt; staff can also verify it manually.", 422);

    const detectedAmount = extractTransferredAmount(extractedText, expectedAmount);
    if (detectedAmount === null) return jsonError("We could not confidently read the transferred amount. Upload a clearer receipt showing the amount paid.", 422);
    if (Math.abs(detectedAmount - expectedAmount) > 1) return jsonError(`Receipt amount ${detectedAmount} ETB does not match the required total of ${expectedAmount} ETB.`, 422);

    if (!paymentMethodMatches(extractedText, paymentMethod)) return jsonError(`We could not confirm ${paymentMethod} from the receipt text. Upload the receipt for the selected payment method or ask staff to verify it manually.`, 422);

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: duplicate, error: duplicateError } = await db.from("orders").select("id").eq("receipt_hash", receiptHash).limit(1).maybeSingle();
    if (duplicateError) {
      console.error("Receipt duplicate lookup failed:", duplicateError.message);
      return jsonError("Receipt duplicate checking is not ready. Run supabase/payment-receipt-verification.sql in Supabase first.", 503);
    }
    if (duplicate) return jsonError("This exact receipt file has already been used for another order.", 422);

    return NextResponse.json({
      valid: true,
      receiptHash,
      amountEtb: detectedAmount,
      confidence: 0.75,
      reason: `Receipt screening passed: successful transaction text, ${detectedAmount} ETB amount, ${paymentMethod} method, and no exact duplicate found. Staff must still confirm funds in the actual account; OCR cannot prove a screenshot is authentic.`,
    });
  } catch (error) {
    console.error("Payment receipt verification failed:", error instanceof Error ? error.message : error);
    return jsonError("Could not verify this receipt right now. Please try a clearer receipt or contact staff.", 500);
  }
}
