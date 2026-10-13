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
  "image/tiff", "image/x-tiff", "image/x-ms-bmp", "application/pdf", "application/x-pdf", "application/octet-stream",
]);

function detectFileType(bytes: Buffer): "pdf" | "image" | null {
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
  const paymentTerms = [
    "telebirr", "tele birr", "commercial bank of ethiopia", "cbe", "bank of abyssinia", "boa",
    "transaction", "payment", "transfer", "receipt", "successful", "completed", "reference number",
    "transaction id", "debit", "credited", "amount", "birr", "etb", "ብር", "ክፍያ", "ተሳክቷል",
  ];
  const hits = paymentTerms.filter((term) => normalized.includes(term)).length;
  return hits >= 2 && normalized.length >= 20;
}

async function readPdfText(bytes: Buffer): Promise<string> {
  // PDF.js needs these canvas globals when it encounters certain PDF graphics/fonts in Node.
  const globals = globalThis as typeof globalThis & {
    DOMMatrix?: typeof DOMMatrix;
    ImageData?: typeof ImageData;
    Path2D?: typeof Path2D;
  };
  globals.DOMMatrix ??= DOMMatrix;
  globals.ImageData ??= ImageData;
  globals.Path2D ??= Path2D;

  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  try {
    const pageTexts: string[] = [];
    // Receipts are normally one page; limit processing to the first 3 pages.
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 3); pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map((item: any) => typeof item.str === "string" ? item.str : "").join(" "));
    }
    const embeddedText = pageTexts.join(" ");
    if (looksLikePaymentReceipt(embeddedText)) return embeddedText;

    // Scanned PDFs have no selectable text, so OCR the first two pages as images.
    const worker = await createWorker("eng");
    try {
      const scannedPageTexts: string[] = [];
      for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 2); pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext("2d");
        await page.render({ canvasContext: context as any, viewport }).promise;
        const result = await worker.recognize(canvas.toBuffer("image/png"));
        scannedPageTexts.push(result.data.text || "");
      }
      return `${embeddedText} ${scannedPageTexts.join(" ")}`;
    } finally {
      await worker.terminate();
    }
  } finally {
    await pdf.destroy();
  }
}

async function readImageText(bytes: Buffer): Promise<string> {
  // Normalize JPG/PNG/WEBP/GIF/BMP/TIFF to PNG before OCR.
  const png = await sharp(bytes, { animated: false, limitInputPixels: 25_000_000 }).rotate().png().toBuffer();
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(png);
    return result.data.text || "";
  } finally {
    await worker.terminate();
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const expectedAmount = Number(form.get("expectedAmount"));
    const paymentMethod = String(form.get("paymentMethod") || "");

    if (!(file instanceof File)) {
      return NextResponse.json({ valid: false, reason: "Please attach your payment receipt as a JPG, PNG, WEBP, GIF, BMP, TIFF, or PDF file." }, { status: 400 });
    }
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return NextResponse.json({ valid: false, reason: "Choose your delivery location and calculate the final order total first." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ valid: false, reason: "Receipt files must be non-empty and 5 MB or smaller." }, { status: 400 });
    }
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ valid: false, reason: "Unsupported file format. Upload JPG, PNG, WEBP, GIF, BMP, TIFF, or PDF." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const detectedType = detectFileType(bytes);
    if (!detectedType || (detectedType === "pdf" && !file.type.includes("pdf") && file.type !== "application/octet-stream" && file.type !== "") || (detectedType === "image" && !file.type.startsWith("image/") && file.type !== "application/octet-stream" && file.type !== "")) {
      return NextResponse.json({ valid: false, reason: "The file content does not match a supported receipt format. Please upload the original receipt file." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ valid: false, reason: "Duplicate-receipt checking is not configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel." }, { status: 503 });
    }

    // Exact duplicate check is independent of the file format and requires no paid API.
    const receiptHash = createHash("sha256").update(bytes).digest("hex");
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: duplicate, error: duplicateError } = await db
      .from("orders")
      .select("id")
      .eq("receipt_hash", receiptHash)
      .limit(1)
      .maybeSingle();
    if (duplicateError) {
      console.error("Receipt duplicate lookup failed", duplicateError.message);
      return NextResponse.json({ valid: false, reason: "Receipt duplicate checking is not ready. Run supabase/payment-receipt-verification.sql in Supabase first." }, { status: 503 });
    }
    if (duplicate) {
      return NextResponse.json({ valid: false, reason: "This exact receipt file has already been used for another order. Please upload the receipt for your own payment." }, { status: 422 });
    }

    let extractedText = "";
    try {
      extractedText = detectedType === "pdf" ? await readPdfText(bytes) : await readImageText(bytes);
    } catch (error) {
      console.error("Receipt text screening failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ valid: false, reason: detectedType === "pdf"
        ? "We could not read this PDF. Try a standard PDF or upload a clear JPG/PNG screenshot of the receipt."
        : "We could not read this image. Please upload a clearer JPG or PNG receipt." }, { status: 422 });
    }

    if (!looksLikePaymentReceipt(extractedText)) {
      return NextResponse.json({
        valid: false,
        reason: detectedType === "pdf" && extractedText.trim().length < 10
          ? "This PDF has no readable receipt text. If it is a scanned PDF, upload a clear JPG or PNG screenshot instead."
          : "This file does not contain enough recognizable bank or mobile-money payment details. Upload the actual transaction receipt, not an unrelated photo or document.",
      }, { status: 422 });
    }

    // OCR only screens for receipt-like content. Staff must still confirm the transaction in the actual account.
    return NextResponse.json({
      valid: true,
      receiptHash,
      amountEtb: null,
      confidence: 0,
      reason: `The file looks like a payment receipt and has not been used before. Staff will manually confirm the ${paymentMethod} payment and amount before processing your order.`,
    });
  } catch (error) {
    console.error("Payment receipt check failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ valid: false, reason: "Could not check this receipt. Please try another supported file or contact staff." }, { status: 500 });
  }
}
