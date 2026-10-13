
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { valid: false, reason: "Please upload a receipt." },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          valid: false,
          reason: "The receipt must be non-empty and 5 MB or smaller.",
        },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const receiptHash = createHash("sha256")
      .update(bytes)
      .digest("hex");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { valid: false, reason: "Receipt checking is unavailable." },
        { status: 503 }
      );
    }

    const db = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await db
      .from("orders")
      .select("id")
      .eq("receipt_hash", receiptHash)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Receipt duplicate lookup failed:", error.message);

      return NextResponse.json(
        { valid: false, reason: "Could not check the receipt right now." },
        { status: 503 }
      );
    }

    if (data) {
      return NextResponse.json(
        {
          valid: false,
          reason: "This receipt file has already been used.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      valid: true,
      receiptHash,
      reason: "Receipt accepted for manual payment confirmation.",
    });
  } catch (error) {
    console.error(
      "Receipt check failed:",
      error instanceof Error ? error.message : error
    );

    return NextResponse.json(
      { valid: false, reason: "Could not check the receipt right now." },
      { status: 500 }
    );
  }
}
