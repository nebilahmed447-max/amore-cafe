"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CartItem, Order, Product } from "@/lib/types";
import { products as seedProducts } from "@/lib/products";
import { CATALOG_KEY, parseCSV, saveCatalog } from "@/lib/catalog";
import { supabase } from "@/supabase";

type CartContextValue = {
  items: CartItem[];
  add: (product: Product) => void;
  remove: (id: string) => void;
  update: (id: string, quantity: number) => void;
  clear: () => void;
  total: number;
  count: number;
};
const CartContext = createContext<CartContextValue | null>(null);

type FavoritesContextValue = {
  favoriteIds: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  clearFavorites: () => void;
};
const FavoritesContext = createContext<FavoritesContextValue | null>(null);

type CatalogContextValue = {
  products: Product[];
  loading: boolean;
  refreshCatalog: () => Promise<void>;
  replaceProducts: (next: Product[]) => Promise<void>;
};
const CatalogContext = createContext<CatalogContextValue | null>(null);

function rowToProduct(row: any): Product {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    amharic: String(row.name_am || row.amharic || ""),
    category: String(row.category || "Burgers"),
    price: Number(row.price || 0),
    image: String(row.image_url || row.image || ""),
    description: String(row.description || ""),
    prepTime: Number(row.prep_time ?? row.prepTime ?? 0),
    takeawayPackFee: Number(row.takeaway_pack_fee ?? row.takeawayPackFee ?? 0),
    popular: Boolean(row.popular),
    fasting: Boolean(row.fasting),
    available: row.available !== false,
  };
}

function productToRow(p: Product) {
  return {
    id: p.id,
    name: p.name,
    name_am: p.amharic || "",
    description: p.description || "",
    description_am: "",
    price: p.price,
    category: p.category,
    image_url: p.image || "",
    prep_time: p.prepTime,
    takeaway_pack_fee: Number(p.takeawayPackFee || 0),
    calories: 0,
    rating: 5,
    available: p.available !== false,
    popular: Boolean(p.popular),
    fasting: Boolean(p.fasting),
    featured: false,
  };
}

export async function fetchRemoteProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("foods")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToProduct);
}

export async function seedProductsIfEmpty(): Promise<Product[]> {
  const { data, error } = await supabase.from("foods").select("id").limit(1);
  if (error) throw error;
  if (data && data.length > 0) return fetchRemoteProducts();

  const rows = seedProducts.map(productToRow);
  const { data: inserted, error: insertError } = await supabase
    .from("foods")
    .insert(rows)
    .select("*");
  if (insertError) throw insertError;
  return (inserted || []).map(rowToProduct);
}

export function Providers({children}:{children:React.ReactNode}) {
  const [items,setItems] = useState<CartItem[]>([]);
  const [catalog,setCatalog] = useState<Product[]>(seedProducts);
  const [loading,setLoading] = useState(true);
  const [favoriteIds,setFavoriteIds] = useState<string[]>([]);

  const refreshCatalog = async () => {
    try {
      const remote = await fetchRemoteProducts();
      if (remote.length) {
        setCatalog(remote);
        saveCatalog(remote);
      }
    } catch (error) {
      console.warn("Could not load Supabase menu; using local fallback.", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{
    const raw=localStorage.getItem("amore-cart");
    if(raw) try { setItems(JSON.parse(raw)); } catch {}
    const favRaw=localStorage.getItem("amore-favorites");
    if(favRaw) try { const parsed=JSON.parse(favRaw); if(Array.isArray(parsed)) setFavoriteIds(parsed.map(String)); } catch {}

    const saved=localStorage.getItem(CATALOG_KEY);
    if(saved){
      try { const parsed=JSON.parse(saved); if(Array.isArray(parsed)) setCatalog(parsed); } catch {}
    }

    refreshCatalog();

    const onStorage=()=>{
      const next=localStorage.getItem(CATALOG_KEY);
      if(next) try { const parsed=JSON.parse(next); if(Array.isArray(parsed)) setCatalog(parsed); } catch {}
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("amore-catalog-updated", onStorage);

    const sheetUrl = process.env.NEXT_PUBLIC_MENU_CSV_URL;
    if(sheetUrl && !saved){
      fetch(sheetUrl).then(r=>r.text()).then(csv=>{
        const parsed=parseCSV(csv);
        if(parsed.length){ setCatalog(parsed); saveCatalog(parsed); }
      }).catch(()=>{});
    }
    return ()=>{
      window.removeEventListener("storage",onStorage);
      window.removeEventListener("amore-catalog-updated",onStorage);
    };
  },[]);

  useEffect(()=>{ localStorage.setItem("amore-cart",JSON.stringify(items)); },[items]);
  useEffect(()=>{ localStorage.setItem("amore-favorites",JSON.stringify(favoriteIds)); },[favoriteIds]);

  const replaceProducts = async (next: Product[]) => {
    setCatalog(next);
    saveCatalog(next);

    const { error: deleteError } = await supabase
      .from("foods")
      .delete()
      .neq("id", "__never_match__");
    if (deleteError) throw deleteError;

    const rows = next.map(productToRow);
    if (rows.length) {
      const { error: insertError } = await supabase.from("foods").insert(rows);
      if (insertError) throw insertError;
    }
  };

  const cart = useMemo(()=>({
    items,
    add:(p:Product)=>setItems(xs=>{const old=xs.find(x=>x.id===p.id); return old?xs.map(x=>x.id===p.id?{...x,quantity:x.quantity+1}:x):[...xs,{...p,quantity:1}]}),
    remove:(id:string)=>setItems(xs=>xs.filter(x=>x.id!==id)),
    update:(id:string,quantity:number)=>setItems(xs=>quantity<=0?xs.filter(x=>x.id!==id):xs.map(x=>x.id===id?{...x,quantity}:x)),
    clear:()=>setItems([]),
    total:items.reduce((s,x)=>s+x.price*x.quantity,0),
    count:items.reduce((s,x)=>s+x.quantity,0)
  }),[items]);
  const catalogValue = useMemo(()=>({products:catalog,loading,refreshCatalog,replaceProducts}),[catalog,loading]);
  const favorites = useMemo(()=>({
    favoriteIds,
    isFavorite:(id:string)=>favoriteIds.includes(id),
    toggleFavorite:(id:string)=>setFavoriteIds(xs=>xs.includes(id)?xs.filter(x=>x!==id):[...xs,id]),
    clearFavorites:()=>setFavoriteIds([]),
  }),[favoriteIds]);
  return <CatalogContext.Provider value={catalogValue}><FavoritesContext.Provider value={favorites}><CartContext.Provider value={cart}>{children}</CartContext.Provider></FavoritesContext.Provider></CatalogContext.Provider>
}
export function useCart(){const c=useContext(CartContext); if(!c) throw new Error("useCart must be inside Providers"); return c;}
export function useCatalog(){const c=useContext(CatalogContext); if(!c) throw new Error("useCatalog must be inside Providers"); return c;}
export function useFavorites(){const c=useContext(FavoritesContext); if(!c) throw new Error("useFavorites must be inside Providers"); return c;}

function orderToRow(order: Order) {
  return {
    id: order.id,
    customer_name: order.customer.name,
    phone: order.customer.phone,
    order_type: order.orderType,
    delivery_zone: order.deliveryZone || null,
    delivery_fee: order.deliveryFee || 0,
    delivery_distance_km: order.deliveryDistanceKm ?? null,
    delivery_lat: order.deliveryLat ?? null,
    delivery_lng: order.deliveryLng ?? null,
    address: order.customer.address || "",
    table_number: "",
    items: order.items,
    subtotal: Math.max(0, order.total - (order.deliveryFee || 0)),
    total: order.total,
    status: order.status,
    notes: order.customer.notes || "",
    payment: order.payment,
    receipt_url: order.receiptUrl || null,
    created_at: order.createdAt,
  };
}

function rowToOrder(row: any): Order {
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    customer: {
      name: String(row.customer_name || ""),
      phone: String(row.phone || ""),
      address: String(row.address || ""),
      notes: String(row.notes || ""),
    },
    items: Array.isArray(row.items) ? row.items : [],
    orderType: row.order_type === "delivery" ? "delivery" : "pickup",
    deliveryZone: row.delivery_zone === "Free" || row.delivery_zone === "Near" || row.delivery_zone === "Medium" || row.delivery_zone === "Far" ? row.delivery_zone : undefined,
    deliveryFee: Number(row.delivery_fee || 0),
    deliveryDistanceKm: row.delivery_distance_km == null ? undefined : Number(row.delivery_distance_km),
    deliveryLat: row.delivery_lat == null ? undefined : Number(row.delivery_lat),
    deliveryLng: row.delivery_lng == null ? undefined : Number(row.delivery_lng),
    total: Number(row.total || 0),
    status: row.status as Order["status"],
    payment: (row.payment || "Cash") as Order["payment"],
    receiptUrl: row.receipt_url ? String(row.receipt_url) : undefined,
  };
}

export async function saveOrder(order:Order) {
  const { error } = await supabase.from("orders").insert(orderToRow(order));
  if (error) {
    console.error("Supabase order insert failed:", error);
    throw new Error(error.message || "Could not save order");
  }

  // Keep a local copy only after the online order is successfully saved.
  try {
    const raw = localStorage.getItem("amore-orders") || "[]";
    const orders:Order[] = JSON.parse(raw);
    localStorage.setItem("amore-orders", JSON.stringify([order, ...orders]));
  } catch {
    localStorage.setItem("amore-orders", JSON.stringify([order]));
  }
}

export async function getOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const orders = (data || []).map(rowToOrder);
  localStorage.setItem("amore-orders",JSON.stringify(orders));
  return orders;
}

export async function updateOrderStatus(id:string,status:Order["status"]) {
  const { error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  const orders:Order[]=JSON.parse(localStorage.getItem("amore-orders")||"[]");
  localStorage.setItem("amore-orders",JSON.stringify(orders.map(o=>o.id===id?{...o,status}:o)));
}
