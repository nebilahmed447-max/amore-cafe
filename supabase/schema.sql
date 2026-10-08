-- AMORE CAFE — PRODUCTION SUPABASE SETUP
-- Run this file once in Supabase SQL Editor for a fresh setup.
-- It recreates the foods/orders tables and seeds the current Amore menu.
-- IMPORTANT: If you already have real production data, back it up before rerunning.

create extension if not exists pgcrypto;

drop table if exists public.orders cascade;
drop table if exists public.foods cascade;

create table public.foods (
  id text primary key,
  name text not null,
  name_am text,
  description text,
  description_am text,
  price numeric not null default 0,
  category text not null,
  image_url text,
  prep_time integer default 12,
  takeaway_pack_fee numeric not null default 0,
  calories integer default 0,
  rating numeric default 5,
  available boolean default true,
  popular boolean default false,
  fasting boolean default false,
  featured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.orders (
  id text primary key,
  customer_name text not null,
  phone text not null,
  order_type text not null default 'pickup',
  delivery_zone text,
  delivery_fee numeric not null default 0,
  delivery_distance_km numeric,
  delivery_lat double precision,
  delivery_lng double precision,
  address text,
  table_number text,
  items jsonb not null,
  subtotal numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'Pending',
  notes text,
  payment text not null default 'Cash',
  receipt_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Initial Amore menu. You can edit/delete these from /admin after login.
insert into public.foods (id,name,name_am,category,price,image_url,description,popular,fasting,available) values
('burger-special','Amore Special Burger','አሞር ስፔሻል በርገር','Burgers',450,'https://res.cloudinary.com/dzni6h38z/image/upload/w_900,q_auto,f_auto,c_limit/amore/products/food/amore-special-burger','Signature beef burger with cheese, fresh vegetables and Amore sauce.',true,false,true),
('beef-burger','Beef Burger','የበሬ ስጋ በርገር','Burgers',350,'https://images.unsplash.com/photo-1550547660-d9450f859349?w=1000&q=85','Juicy grilled beef patty with fresh vegetables and house sauce.',true,false,true),
('cheese-burger','Cheese Burger','ቺዝ በርገር','Burgers',390,'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=1000&q=85','Classic beef burger finished with melted cheese.',false,false,true),
('chicken-burger','Chicken Burger','የዶሮ በርገር','Chicken',380,'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=1000&q=85','Crispy chicken, lettuce, tomato and creamy sauce.',true,false,true),
('fasting-burger','Fasting Burger','የፆም በርገር','Fasting',280,'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=1000&q=85','Plant-based burger with fresh vegetables and vegan sauce.',false,true,true),
('special-pizza','Amore Special Pizza','አሞር ስፔሻል ፒዛ','Pizzas',550,'https://res.cloudinary.com/dzni6h38z/image/upload/w_900,q_auto,f_auto,c_limit/amore/products/food/amore-special-pizza','Loaded signature pizza with generous toppings and cheese.',true,false,true),
('beef-pizza','Beef Pizza','የበሬ ፒዛ','Pizzas',460,'https://images.unsplash.com/photo-1579751626657-72bc17010498?w=1000&q=85','Beef, cheese, tomato sauce and fresh toppings.',false,false,true),
('veggie-pizza','Fasting Veggie Pizza','የፆም አትክልት ፒዛ','Fasting',420,'https://images.unsplash.com/photo-1579751626657-72bc17010498?w=1000&q=85','Vegetable pizza prepared without dairy.',false,true,true),
('chicken-wrap','Chicken Wrap','የዶሮ ራፕ','Wraps',300,'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=1000&q=85','Seasoned chicken, fresh salad and house sauce in a soft wrap.',false,false,true),
('pasta','Creamy Chicken Pasta','ክሬሚ ቺክን ፓስታ','Pasta & Salads',420,'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=1000&q=85','Pasta with tender chicken and rich creamy sauce.',false,false,true),
('salad','Fresh Garden Salad','ፍሬሽ ጋርደን ሳላድ','Pasta & Salads',250,'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1000&q=85','Crisp seasonal vegetables with a light dressing.',false,true,true),
('fish','Crispy Fish','ክሪስፒ ዓሳ','Fish',480,'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=1000&q=85','Crispy fish served with fresh sides.',false,false,true),
('coffee','Ethiopian Coffee','የኢትዮጵያ ቡና','Hot Drinks',120,'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1000&q=85','Freshly roasted Ethiopian coffee.',false,false,true),
('iced','Iced Coffee','አይስድ ቡና','Iced Coffee',180,'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=1000&q=85','Chilled coffee served over ice.',false,false,true),
('juice','Fresh Mango Juice','የማንጎ ጭማቂ','Juices & Mojitos',150,'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=1000&q=85','Freshly blended mango juice.',false,false,true),
('shake','Chocolate Milkshake','ቸኮሌት ሚልክሼክ','Milkshakes',220,'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=1000&q=85','Thick chocolate milkshake.',false,false,true),
('cake','Chocolate Cake','ቸኮሌት ኬክ','Cakes & Pastries',220,'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1000&q=85','Rich chocolate cake slice.',false,false,true),
('water','Bottled Water','ውሃ','Bottled',40,'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=1000&q=85','Chilled bottled water.',false,false,true);

alter table public.foods enable row level security;
alter table public.orders enable row level security;

-- Public customer access.
create policy "Anyone can view foods"
on public.foods for select to anon, authenticated using (true);

create policy "Anyone can create orders"
on public.orders for insert to anon, authenticated with check (true);

-- Admin access. Keep Supabase Auth sign-ups disabled so only manually created
-- staff accounts can authenticate. The app's /admin page requires a valid session.
create policy "Authenticated users can add foods"
on public.foods for insert to authenticated with check (true);

create policy "Authenticated users can update foods"
on public.foods for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete foods"
on public.foods for delete to authenticated using (true);

create policy "Authenticated users can view orders"
on public.orders for select to authenticated using (true);

create policy "Authenticated users can update orders"
on public.orders for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete orders"
on public.orders for delete to authenticated using (true);


-- Private payment receipt storage. Customers upload; authenticated admins can view.
insert into storage.buckets (id, name, public) values ('payment-receipts', 'payment-receipts', false) on conflict (id) do update set public = false;
drop policy if exists "Anyone can upload payment receipts" on storage.objects;
create policy "Anyone can upload payment receipts" on storage.objects for insert to anon, authenticated with check (bucket_id = 'payment-receipts');
drop policy if exists "Authenticated users can view payment receipts" on storage.objects;
create policy "Authenticated users can view payment receipts" on storage.objects for select to authenticated using (bucket_id = 'payment-receipts');
drop policy if exists "Authenticated users can delete payment receipts" on storage.objects;
create policy "Authenticated users can delete payment receipts" on storage.objects for delete to authenticated using (bucket_id = 'payment-receipts');
