# Amore Cafe Telegram ordering + staff panels

## Included
- Telegram webhook at `/api/telegram/webhook`; supports `/start`, `/order`, `/menu`, `/help` and opens the existing menu in Telegram as a Mini App button. The existing checkout creates orders in the same Supabase database.
- Delivery panel: `https://www.amore-cafe.com/delivery`
- Waiter panel: `https://www.amore-cafe.com/waiter`
- Staff access is checked against `staff_profiles`; delivery staff see delivery orders, waiter staff see non-delivery orders, managers can see all.

## 1. Apply the database migration
1. Back up the live Supabase database.
2. Open Supabase Dashboard → SQL Editor.
3. Run `supabase/staff-panels-telegram.sql`.
4. Create each staff member in Supabase Authentication → Users (email/password).
5. Copy the user's UUID and add a staff profile from SQL Editor. Example:

```sql
insert into public.staff_profiles(user_id, display_name, role, active)
values ('AUTH_USER_UUID_HERE', 'Cafe Manager', 'manager', true);
```

Use `delivery` or `waiter` for the corresponding role. Create the first manager profile directly in SQL Editor. Do not use a public signup form for staff.

## 2. Configure Telegram
1. In Telegram, open `@BotFather` and run `/newbot`.
2. Copy the bot token. Do not share it in chat or commit it to GitHub.
3. In Vercel → Project → Settings → Environment Variables, add:
   - `TELEGRAM_BOT_TOKEN` = token from BotFather
   - `TELEGRAM_WEBHOOK_SECRET` = a long random secret (letters/numbers)
   - `NEXT_PUBLIC_SITE_URL` = `https://www.amore-cafe.com`
4. Redeploy the Vercel project.
5. Set the webhook by opening this URL in a browser, replacing `<TOKEN>` and `<SECRET>` with the actual values (URL-encode the secret if needed):

```text
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://www.amore-cafe.com/api/telegram/webhook&secret_token=<SECRET>
```

The response should contain `"ok":true`. Keep the token private. If a token was ever exposed, revoke it with BotFather and replace it in Vercel.
6. Open the bot and send `/start`; tap **Open Amore Menu & Order**.

## Important limitations / launch checklist
- This first version launches the existing Amore ordering website inside Telegram; the customer completes the same menu and checkout flow. It does not collect payment inside Telegram itself.
- Telegram payment-provider setup is separate; keep the cafe's current payment options unless you intentionally configure a supported provider.
- The panels authenticate with Supabase email/password. Run the migration and assign roles before staff use them. The migration replaces the broad authenticated order policies, so assign a `manager` profile to the existing admin account or it will no longer be able to read/manage orders.
- Confirm the current orders schema and RLS in Supabase before running the migration. Back up production first.
- Test on a staging deployment with test staff accounts before using in production.
