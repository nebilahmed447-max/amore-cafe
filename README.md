# Amore Cafe V32 — Automatic Geographic Delivery Zones

V32 removes Google Maps and OSRM routing. Delivery pricing is determined locally from the customer's GPS coordinate using the Haversine geographic distance from Amore Cafe. No API key, billing, or external routing service is required.

Pricing:
- 0–50 m: FREE
- 51–600 m: 50 ETB (Near)
- 601 m–2.5 km: 100 ETB (Medium)
- >2.5 km: 200 ETB (Far)

The browser's reported GPS accuracy is shown as information and does not block calculation.


## Latest updates: waiter/delivery history, receipt screening, and dark mode

- `/waiter` and `/delivery` share the same responsive staff UI and include Active orders and Order history tabs.
- Waiters see only assigned table numbers. The `/admin` → **Staff & Tables** screen can create staff accounts, add unlimited table numbers, assign/reassign tables, and deactivate staff. Run `supabase/staff-panels-telegram.sql` and then `supabase/staff-management.sql` once. Configure `SUPABASE_SERVICE_ROLE_KEY` as a server-only Vercel variable. Follow `WAITER-TABLE-ASSIGNMENTS.md` for setup.
- Receipt images are screened before checkout for receipt-like content, successful status, payment method, expected ETB amount, and exact duplicate image hash. Run `supabase/payment-receipt-verification.sql` first. Configure `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
- Receipt screening is a first-pass filter, not proof that a transfer reached the cafe's account. Staff must verify the actual transaction before preparing the order. Cropped/edited duplicates may evade exact-file hash detection.
- Checkout and staff panel surfaces now use dark-mode-aware colors. The delivery GPS button reports a clear instruction when location services are unavailable, with a shorter wait for the error message.
