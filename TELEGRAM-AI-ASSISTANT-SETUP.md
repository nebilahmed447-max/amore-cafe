# Amore Cafe AI Telegram Assistant

This project includes a chat-based Telegram assistant for customers. Customers can ask menu questions, browse categories, add items to a cart, check out by chat, and track an order using the order number plus the phone number used for that order. AI answers use OpenAI when configured; ordering, prices, and tracking are handled by server-side logic and Supabase rather than trusting AI output.

## Configure safely

1. Back up the live Supabase database.
2. In Supabase SQL Editor, run `supabase/telegram-ai-assistant.sql`. This adds Telegram metadata columns and a private session table; it does not drop existing tables.
3. In Vercel → Project → Settings → Environment Variables, add these server-side variables:
   - `TELEGRAM_BOT_TOKEN` — token from `@BotFather`
   - `TELEGRAM_WEBHOOK_SECRET` — long random secret
   - `SUPABASE_URL` — your Supabase project URL (not `/rest/v1`)
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key; NEVER prefix with `NEXT_PUBLIC_`, never put it in frontend code, and never commit it to GitHub
   - `NEXT_PUBLIC_SITE_URL` — `https://www.amore-cafe.com`
   - `OPENAI_API_KEY` — optional, enables AI-generated natural-language menu answers
   - `OPENAI_MODEL` — optional, defaults to `gpt-4o-mini`
4. Redeploy the project after setting variables.
5. Set Telegram webhook. Replace TOKEN and SECRET with actual values; URL-encode SECRET if needed:

   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://www.amore-cafe.com/api/telegram/webhook&secret_token=<SECRET>`

6. Open the bot in Telegram and send `/start`.

## Customer chat commands

- `/start` — welcome and actions
- `/menu` or `show menu` — browse categories
- `order` — start an order
- `cart` — review cart
- `checkout` — place the order through chat
- `/track` or `track order` — enter order number, then verify using the order phone number
- Customers can also ask natural-language questions about the menu. Without `OPENAI_API_KEY`, menu ordering and tracking still work, but open-ended AI answers fall back to help text.

## Important behavior and limitations

- The assistant creates orders in the same `public.orders` table used by the website. New Telegram orders are marked `source='telegram'`.
- Order status is only revealed after the order ID and phone number both match.
- Chat-based delivery currently stores the customer's address and sets delivery fee to zero for the initial order; staff must confirm/apply any delivery fee before fulfilling. It does not calculate route distance in Telegram.
- Chat-based checkout does not collect payment receipts. For payment methods that require a receipt, staff should verify payment through the cafe's normal process before preparing the order.
- AI is optional and is not allowed to invent menu prices or claim an order is placed. Only the checkout handler creates an order.
- Use staging/test orders first. Confirm Supabase service-role environment variables are correct and keep the service-role key private.
