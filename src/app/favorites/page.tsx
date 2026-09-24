"use client";
import Link from "next/link";
import { Heart, ArrowRight, Trash2 } from "lucide-react";
import { Page } from "@/components/Shell";
import ProductCard from "@/components/ProductCard";
import { useCatalog, useFavorites } from "@/components/Providers";

export default function Favorites(){
 const {products}=useCatalog();
 const {favoriteIds,clearFavorites}=useFavorites();
 const favorites=products.filter(p=>favoriteIds.includes(p.id));
 return <Page><main className="favorites-page">
   <div className="favorites-head"><div><span className="eyebrow">YOUR AMORE</span><h1>Favorites</h1><p>{favorites.length ? `${favorites.length} saved ${favorites.length===1?"item":"items"}` : "Save dishes you want to find quickly later."}</p></div>{favorites.length>0&&<button className="favorite-clear" onClick={clearFavorites}><Trash2 size={15}/> Clear all</button>}</div>
   {favorites.length ? <div className="product-grid">{favorites.map(p=><ProductCard key={p.id} product={p}/>)}</div> : <div className="favorites-empty"><div className="favorites-empty-icon"><Heart size={30}/></div><h2>No favorites yet</h2><p>Tap the heart on any food to save it here.</p><Link href="/menu" className="primary-cta">Explore Menu <ArrowRight size={17}/></Link></div>}
 </main></Page>
}
