"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Heart, ArrowLeft, Plus, Minus, Star, Clock3 } from "lucide-react";
import { Page } from "@/components/Shell";
import { useCart, useCatalog, useFavorites } from "@/components/Providers";
export default function ProductPage(){
 const {id}=useParams<{id:string}>(); const {products}=useCatalog(); const p=products.find(x=>x.id===id); const {add}=useCart(); const {isFavorite,toggleFavorite}=useFavorites(); const [qty,setQty]=useState(1);
 if(!p)return <Page><main className="empty">Product not found</main></Page>;
 const addQty=()=>{for(let i=0;i<qty;i++)add(p)};
 return <Page><main className="detail-page"><Link href="/menu" className="back-link"><ArrowLeft size={16}/> Back to menu</Link><div className="detail-hero"><div className="detail-image"><img src={p.image} alt={p.name}/></div><div className="detail-copy"><span className="eyebrow">{p.category.toUpperCase()}</span><h1>{p.name}</h1><p className="amharic">{p.amharic}</p><p className="detail-desc">{p.description}</p><div className="detail-meta"><span><Clock3 size={16}/>{p.prepTime || 0} Mins</span><span>720 Cal</span><span><Star size={16} fill="currentColor"/>4.6(0.5K+)</span></div><button onClick={()=>toggleFavorite(p.id)} className={`favorite ${isFavorite(p.id)?"saved":""}`}><Heart size={18} fill={isFavorite(p.id)?"currentColor":"none"}/> {isFavorite(p.id)?"Saved":"Save to Favorites"}</button><div className="buy-row"><strong>{p.price.toLocaleString()} <small>ETB</small></strong><div className="qty"><button onClick={()=>setQty(Math.max(1,qty-1))}><Minus size={15}/></button><b>{qty}</b><button onClick={()=>setQty(qty+1)}><Plus size={15}/></button></div><button onClick={addQty} className="primary-cta">Add to cart <Plus size={17}/></button></div></div></div>
 <section className="detail-section"><span className="eyebrow">INGREDIENTS</span><h2>What our kitchen uses</h2><div className="ingredient-row">{["Tomato","Fresh Basil","Mint","Lemon","Berbere & Chili","Avocado"].map(x=><div key={x}><span>●</span><small>{x}</small></div>)}</div></section>
 <section className="steps"><span className="eyebrow">HOW WE MAKE IT</span><h2>Made fresh, made to order.</h2><div className="step-grid">{["Prepped fresh each morning","Seasoned with house spices","Cooked to order","Plated and served"].map((x,i)=><div key={x}><b>0{i+1}</b><h3>{x}</h3></div>)}</div></section>
 <section className="reviews"><span className="eyebrow">RATINGS & REVIEWS</span><div className="rating-big"><strong>4.6</strong><span>★★★★★</span><p>183 people rated {p.name}</p></div><button className="review-btn">Write a review</button></section>
 </main></Page>
}
