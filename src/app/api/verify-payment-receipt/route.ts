import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 10;

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function jsonError(reason: string, status: number) {
  return NextResponse.json({ valid: false, reason }, { status });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return jsonError("Please attach your payment receipt.", 400);
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return jsonError("The receipt must be non-empty and 5 MB or smaller.", 400);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceKey) {
      return jsonError("Duplicate receipt checking is not configured.", 503);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const receiptHash = createHash("sha256").update(bytes).digest("hex");

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: duplicate, error } = await supabase
      .from("orders")
      .select("id")
      .eq("receipt_hash", receiptHash)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Duplicate receipt lookup failed:", error.message);
      return jsonError("Could not check for duplicate receipts. Please try again.", 503);
    }

    if (duplicate) {
      return jsonError(
        "This exact receipt file has already been used for another order.",
        422
      );
    }

    return NextResponse.json({
      valid: true,
      receiptHash,
      reason:
        "No exact duplicate file was found. This check does not verify that payment was successful.",
    });
  } catch (error) {
    console.error(
      "Duplicate receipt check failed:",
      error instanceof Error ? error.message : error
    );
    return jsonError("Unable to check this receipt right now. Please try again.", 500);
  }
}
