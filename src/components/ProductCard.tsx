"use client";
import Link from "next/link";
import { Plus, Star, Clock3, Heart } from "lucide-react";
import { Product } from "@/lib/types";
import { useCart, useFavorites } from "./Providers";
export default function ProductCard({product,compact=false,special=false}:{product:Product;compact?:boolean;special?:boolean}){
 const {add}=useCart();
 const {isFavorite,toggleFavorite}=useFavorites();
 const fav=isFavorite(product.id);
 return <article className={`product-card ${compact?"compact":""} ${!product.available?"is-unavailable":""}`}>
   <div className="product-photo">
     <Link href={`/menu/${product.id}`} aria-label={`View ${product.name}`} className="product-photo-link">
       <img src={product.image} alt={product.name} loading="lazy"/>
       {(product.popular||special)&&<span className="product-badge">{special?"CHEF'S PICK":"POPULAR"}</span>}
       {product.fasting&&<span className="fasting-badge">FASTING</span>}
     </Link>
     <button type="button" aria-label={fav?"Remove from favorites":"Add to favorites"} onClick={()=>toggleFavorite(product.id)} className={`card-favorite ${fav?"saved":""}`}><Heart size={17} fill={fav?"currentColor":"none"}/></button>
   </div>
   <div className="product-info">
     <div className="flex items-start justify-between gap-3">
       <Link href={`/menu/${product.id}`} className="min-w-0"><h3>{product.name}</h3><p>{product.amharic}</p></Link>
       <span className="product-price">{product.price}<small> ETB</small></span>
     </div>
     {!compact&&<p className="product-desc">{product.description}</p>}
     <div className="product-meta"><span><Star size={13} fill="currentColor"/>4.6 <em>(0.5K+)</em></span><span><Clock3 size={13}/>{product.prepTime || 0} min</span></div>
     <button onClick={()=>add(product)} disabled={!product.available} className="add-btn"><Plus size={17}/> {product.available ? "Add" : "Unavailable"}</button>
   </div>
 </article>
}
