import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { createWorker, type Worker } from "tesseract.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/x-tiff",
  "image/x-ms-bmp",
  "application/pdf",
  "application/x-pdf",
  "application/octet-stream",
]);

/**
 * Reuse one OCR worker across requests handled by the same warm serverless
 * instance. The worker is deliberately not terminated after each receipt.
 */
let ocrWorkerPromise: Promise<Worker> | null = null;

async function getOcrWorker(): Promise<Worker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker("eng").catch((error) => {
      // Allow a later request to retry if worker initialization fails.
      ocrWorkerPromise = null;
      throw error;
    });
  }

  return ocrWorkerPromise;
}

function detectFileType(bytes: Buffer): "pdf" | "image" | null {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image";
  }

  if (
    bytes.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    return "image";
  }

  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image";
  }

  if (bytes.subarray(0, 3).toString("ascii") === "GIF") return "image";
  if (bytes.subarray(0, 2).toString("ascii") === "BM") return "image";

  if (
    bytes.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) ||
    bytes.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))
  ) {
    return "image";
  }

  return null;
}

/**
 * This is a permissive OCR content screen, not payment verification.
 * OCR can miss or misread words, so this function should not reject a receipt
 * solely because a bank name or one keyword was not recognized.
 */
function looksLikePaymentReceipt(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();

  if (normalized.length < 10) return false;

  const strongTerms = [
    "telebirr",
    "tele birr",
    "commercial bank of ethiopia",
    "bank of abyssinia",
    "transaction id",
    "transaction number",
    "reference number",
    "payment successful",
    "transfer successful",
    "ተሳክቷል",
    "ክፍያ",
  ];

  const supportingTerms = [
    "transaction",
    "payment",
    "transfer",
    "receipt",
    "successful",
    "completed",
    "debit",
    "credited",
    "amount",
    "birr",
    "etb",
    "ብር",
  ];

  const hasStrongTerm = strongTerms.some((term) => normalized.includes(term));
  const supportingHits = supportingTerms.filter((term) =>
    normalized.includes(term)
  ).length;

  return hasStrongTerm || supportingHits >= 2;
}

async function readPdfText(bytes: Buffer): Promise<string> {
  // PDF.js needs canvas globals when it encounters certain graphics/fonts.
  const globals = globalThis as any;
  globals.DOMMatrix ??= DOMMatrix;
  globals.ImageData ??= ImageData;
  globals.Path2D ??= Path2D;

  const pdf = await getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  }).promise;

  try {
    const pageTexts: string[] = [];

    // Most receipts are one page. Limit extraction to three pages.
    for (
      let pageNumber = 1;
      pageNumber <= Math.min(pdf.numPages, 3);
      pageNumber++
    ) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      pageTexts.push(
        content.items
          .map((item: unknown) => {
            if (
              item &&
              typeof item === "object" &&
              "str" in item &&
              typeof item.str === "string"
            ) {
              return item.str;
            }
            return "";
          })
          .join(" ")
      );
    }

    const embeddedText = pageTexts.join(" ");

    // Skip the expensive PDF-to-image OCR when selectable text is sufficient.
    if (looksLikePaymentReceipt(embeddedText)) return embeddedText;

    // Scanned PDFs need OCR. Only inspect the first two pages.
    const worker = await getOcrWorker();
    const scannedPageTexts: string[] = [];

    for (
      let pageNumber = 1;
      pageNumber <= Math.min(pdf.numPages, 2);
      pageNumber++
    ) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height)
      );
      const context = canvas.getContext("2d");

      await page.render({
        canvasContext: context as never,
        viewport,
      }).promise;

      const result = await worker.recognize(canvas.toBuffer("image/png"));
      scannedPageTexts.push(result.data.text || "");
    }

    return `${embeddedText} ${scannedPageTexts.join(" ")}`;
  } finally {
    await pdf.destroy();
  }
}

async function readImageText(bytes: Buffer): Promise<string> {
  // Normalize supported images and cap decoded pixels to limit memory use.
  const png = await sharp(bytes, {
    animated: false,
    limitInputPixels: 25_000_000,
  })
    .rotate()
    .resize({
      width: 2200,
      height: 2200,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  const worker = await getOcrWorker();
  const result = await worker.recognize(png);
  return result.data.text || "";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const expectedAmount = Number(form.get("expectedAmount"));
    const paymentMethod = String(form.get("paymentMethod") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          valid: false,
          reason:
            "Please attach your payment receipt as a JPG, PNG, WEBP, GIF, BMP, TIFF, or PDF file.",
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return NextResponse.json(
        {
          valid: false,
          reason:
            "Choose your delivery location and calculate the final order total first.",
        },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          valid: false,
          reason: "Receipt files must be non-empty and 5 MB or smaller.",
        },
        { status: 400 }
      );
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          valid: false,
          reason:
            "Unsupported file format. Upload JPG, PNG, WEBP, GIF, BMP, TIFF, or PDF.",
        },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const detectedType = detectFileType(bytes);

    const mimeMatchesDetectedType =
      (detectedType === "pdf" &&
        (file.type.toLowerCase().includes("pdf") ||
          file.type === "application/octet-stream" ||
          file.type === "")) ||
      (detectedType === "image" &&
        (file.type.startsWith("image/") ||
          file.type === "application/octet-stream" ||
          file.type === ""));

    if (!detectedType || !mimeMatchesDetectedType) {
      return NextResponse.json(
        {
          valid: false,
          reason:
            "The file content does not match a supported receipt format. Please upload the original receipt file.",
        },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceKey) {
      console.error("Receipt verification is missing Supabase server configuration.");
      return NextResponse.json(
        {
          valid: false,
          reason:
            "Receipt checking is temporarily unavailable. Please try again or contact staff.",
        },
        { status: 503 }
      );
    }

    const receiptHash = createHash("sha256").update(bytes).digest("hex");
    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: duplicate, error: duplicateError } = await db
      .from("orders")
      .select("id")
      .eq("receipt_hash", receiptHash)
      .limit(1)
      .maybeSingle();

    if (duplicateError) {
      console.error("Receipt duplicate lookup failed:", duplicateError.message);
      return NextResponse.json(
        {
          valid: false,
          reason:
            "Receipt checking is not configured correctly. Please contact staff.",
        },
        { status: 503 }
      );
    }

    if (duplicate) {
      return NextResponse.json(
        {
          valid: false,
          reason:
            "This exact receipt file has already been used for another order. Please upload the receipt for your own payment.",
        },
        { status: 422 }
      );
    }

    let extractedText = "";

    try {
      extractedText =
        detectedType === "pdf"
          ? await readPdfText(bytes)
          : await readImageText(bytes);
    } catch (error) {
      console.error(
        "Receipt text screening failed:",
        error instanceof Error ? error.message : error
      );

      return NextResponse.json(
        {
          valid: false,
          reason:
            "We could not read this receipt file. Please try a clear JPG/PNG screenshot, or contact staff for manual verification.",
        },
        { status: 422 }
      );
    }

    if (!looksLikePaymentReceipt(extractedText)) {
      return NextResponse.json(
        {
          valid: false,
          reason:
            "We could not recognize enough payment details in this file. Your receipt may still be genuine—please upload a clearer screenshot or contact staff for manual verification.",
        },
        { status: 422 }
      );
    }

    // Important: OCR only checks whether the file resembles a receipt.
    // It does not confirm the amount or prove that funds reached the account.
    return NextResponse.json({
      valid: true,
      receiptHash,
      amountEtb: null,
      confidence: 0,
      reason: `Receipt file received. Staff must confirm the ${paymentMethod || "payment"} transaction and amount in the actual account before the order is treated as paid.`,
    });
  } catch (error) {
    console.error(
      "Payment receipt check failed:",
      error instanceof Error ? error.message : error
    );

    return NextResponse.json(
      {
        valid: false,
        reason:
          "Could not check this receipt right now. Please try again or contact staff.",
      },
      { status: 500 }
    );
  }
}
