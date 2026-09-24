"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { Page } from "@/components/Shell";
import { useCatalog } from "@/components/Providers";
export default function MenuPage(){
 const sp=useSearchParams(); const initial=sp.get("category")||"All"; const [cat,setCat]=useState(initial); const [q,setQ]=useState("");
 const {products}=useCatalog();
 const categories=["All", ...Array.from(new Set(products.map(p=>p.category)))];
 const shown=useMemo(()=>products.filter(p=>(cat==="All"||p.category===cat)&&(`${p.name} ${p.amharic}`.toLowerCase().includes(q.toLowerCase()))),[products,cat,q]);
 return <Page><main className="menu-page"><div className="menu-title"><span className="eyebrow">AMORE MENU</span><h1>What's on the menu?</h1><p>From our grill to the bakery counter — made fresh with amore.</p></div><div className="search-box menu-search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder='Try “something spicy under 300 Birr”'/></div><div className="category-row menu-categories">{categories.map(c=><button key={c} onClick={()=>setCat(c)} className={`category-chip ${cat===c?"selected":""}`}><span>{c}</span></button>)}</div><div className="product-grid">{shown.map(p=><ProductCard key={p.id} product={p}/>)}</div>{!shown.length&&<div className="empty">No menu items found.</div>}</main></Page>
}
