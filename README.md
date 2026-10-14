# Amore Cafe — Fast Duplicate Receipt Check

## Included
- `src/app/api/verify-payment-receipt/route.ts`: minimal Next.js API route that computes a SHA-256 hash and checks whether that exact file hash already exists in `orders.receipt_hash`.

## Install
1. Copy this file into the matching path in your Amore Cafe project, replacing the existing route.
2. Keep these Vercel environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Confirm your Supabase `orders` table has a `receipt_hash` column.
4. Run `npm run build`, then deploy.

## Important
This endpoint only checks for an exact duplicate file. It does not inspect receipt content, validate the amount or payment method, or prove that funds were received. A renamed or edited copy can have a different hash. Staff must confirm payment in the actual bank/mobile-money account.

This ZIP contains the updated API route and these instructions, not the entire Amore Cafe application repository.
