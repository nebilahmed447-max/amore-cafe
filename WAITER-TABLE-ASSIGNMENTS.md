# Amore Cafe — dynamic staff and table management

The admin dashboard now has a **Staff & Tables** section. After the one-time database setup below, use that screen to add any number of dining tables, create waiter/delivery accounts, assign tables, reassign tables, or deactivate staff. You do not need to edit SQL for each new staff member or table.

## One-time setup

1. Back up your Supabase project.
2. In Supabase → SQL Editor, run `supabase/staff-panels-telegram.sql` if you have not already run it.
3. Then run `supabase/staff-management.sql` once. It creates the table registry and imports table numbers already assigned to waiters or present on existing orders.
4. In Vercel → Project → Settings → Environment Variables, make sure `SUPABASE_SERVICE_ROLE_KEY` is set to the project's **service role** key. Never prefix this key with `NEXT_PUBLIC_`. The app also needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. Confirm the account you use to access the admin dashboard has an active `staff_profiles` row with `role = 'manager'`. This manager role is the permission that protects staff-management actions. If you need to set it up for the first time, find the admin account UUID under Supabase → Authentication → Users, then run this one-time statement (replace the UUID and name):

   ```sql
   INSERT INTO public.staff_profiles (user_id, display_name, role, active, assigned_tables)
   VALUES ('YOUR_ADMIN_AUTH_UUID', 'Cafe Manager', 'manager', true, '{}')
   ON CONFLICT (user_id) DO UPDATE
   SET display_name = EXCLUDED.display_name, role = 'manager', active = true;
   ```

6. Redeploy the project.

Do not rerun `supabase/schema.sql` on a live database; it can drop business data.

## Manage tables and staff from the admin panel

1. Sign in to `/admin` with the manager account.
2. Open **Staff & Tables**.
3. Under **Tables**, enter any positive table number and optional display name, then choose **Add table**. There is no fixed limit of 18 tables or three waiters.
4. Under **Add staff account**, enter the staff name, email and a password of at least 8 characters. Choose **Waiter** or **Delivery staff**. For waiters, tick the tables assigned to that person, then create the account.
5. Under **Staff and assignments**, you can change the display name, role, active status and table assignments, then save.
6. To remove a table, use its trash icon. A table must first be unassigned from active waiters. The app prevents the same table from being assigned to two active waiters.

The staff account is created in Supabase Auth as email-confirmed. Share the initial password securely and have the staff member change it after first sign-in. Delivery staff see delivery orders. Waiters see orders for their assigned tables. Managers retain access to all orders.

## Customer order table number

For a dine-in order, the customer must enter a table number such as `1` or `Table 1` in the checkout table/address field. Orders with no table number will not appear in a waiter's assigned-table queue.

## Payment receipt screening

Run `supabase/payment-receipt-verification.sql` as well if you use receipt verification. Set `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel, then redeploy. Receipt screening checks the expected amount, payment method, successful status, unrelated photos and exact duplicate image files before order submission. Only JPG, PNG and WEBP images up to 5 MB are accepted.

**Important limit:** image screening cannot prove a screenshot is genuine or guarantee that the transfer reached the cafe account. Staff must still verify the transfer in the actual bank/mobile-money account before preparing the order. Never fulfill an order based only on the AI check.
