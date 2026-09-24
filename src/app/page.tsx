"use client";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { Page } from "@/components/Shell";
import { useCatalog } from "@/components/Providers";
import { ArrowRight, ChevronRight, Search, MapPin, Clock3 } from "lucide-react";
import { useState } from "react";

const categories=[
 ["All","https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?w=500&q=80"],
 ["Burgers","https://res.cloudinary.com/dzni6h38z/image/upload/w_500,q_auto,f_auto,c_limit/amore/products/food/amore-special-burger"],
 ["Pizzas","https://res.cloudinary.com/dzni6h38z/image/upload/w_500,q_auto,f_auto,c_limit/amore/products/food/amore-special-pizza"],
 ["Chicken","https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=500&q=80"],
 ["Sandwiches","https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&q=80"],
 ["Wraps","https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=500&q=80"],
 ["Pasta & Salads","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80"],
 ["Fasting","https://images.unsplash.com/photo-1547592180-85f173990554?w=500&q=80"],
 ["Fish","https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80"],
 ["Hot Drinks","https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&q=80"],
 ["Iced Coffee","https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&q=80"],
 ["Juices & Mojitos","https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&q=80"],
 ["Milkshakes","https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&q=80"],
 ["Cakes & Pastries","https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&q=80"],
 ["Bottled","https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=500&q=80"]
];

export default function Home(){
 const [q,setQ]=useState("");
 const {products}=useCatalog();
 const featured=products.filter(p=>p.available).slice(0,6);
 const specials=products.filter(p=>p.available).slice(0,3);
 return <Page>
  <main>
   <section className="hero">
    <div className="hero-copy">
      <span className="eyebrow">WELCOME TO AMORE</span>
      <h1>Made with <i>amore</i>.</h1>
      <p>Six of the plates and glasses our regulars come back for, from the grill, the bakery counter and the juice bar.</p>
      <Link href="/menu" className="primary-cta">Explore the Menu <ArrowRight size={17}/></Link>
    </div>
    <div className="hero-art">
      <div className="hero-glow"/>
      <img src="https://res.cloudinary.com/dzni6h38z/image/upload/w_1000,q_auto,f_auto,c_limit/amore/products/food/amore-special-burger" alt="Amore Special Burger"/>
      <div className="hero-caption"><span>AMORE SPECIAL</span><strong>Amore Special Burger</strong><p>Our house signature</p></div>
    </div>
   </section>

   <section className="menu-section">
    <div className="section-head"><div><span className="eyebrow">WELCOME TO AMORE</span><h2>What's on the menu?</h2></div></div>
    <div className="search-box"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder='Try “something spicy under 300 Birr”'/></div>
    <div className="category-row">
      {categories.map(([name,img])=><Link href={name==="All"?"/menu":`/menu?category=${encodeURIComponent(name)}`} key={name} className="category-chip"><img src={img} alt=""/><span>{name}</span></Link>)}
    </div>
   </section>

   <section className="content-section">
    <div className="section-head"><div><span className="eyebrow">POPULAR PICKS</span><h2>Popular picks</h2></div><Link href="/menu" className="view-all">View All <ChevronRight size={16}/></Link></div>
    <div className="product-grid">{featured.map(p=><ProductCard key={p.id} product={p}/>)}</div>
   </section>

   <section className="special-section">
    <div className="special-copy"><span>TODAY ONLY</span><h2>Today's specials</h2><p>Chef-selected favorites, freshly prepared and available while supplies last.</p><Link href="/offers">View All <ChevronRight size={16}/></Link></div>
    <div className="special-grid">{specials.map(p=><ProductCard key={p.id} product={p} compact special/>)}</div>
   </section>

   <section className="offer-banner"><div><span>EXCLUSIVE OFFER</span><h2>UP TO <b>25% OFF</b></h2><p>Visit Amore to enjoy this exclusive offer.</p></div><Link href="/offers">See the offer <ArrowRight size={17}/></Link></section>

   <section className="experience">
    <div className="experience-copy"><span className="eyebrow">THE AMORE EXPERIENCE 🤍</span><h2>Small kitchen,<br/><i>big care.</i></h2>
      <div className="experience-points"><div><b>Market-fresh daily</b><p>Produce picked each morning, prepped in small batches through the day.</p></div><div><b>Ready in minutes</b><p>Freshly prepared and brought warm to your table.</p></div><div><b>Made with amore</b><p>Every plate is finished by hand — spices, sauces and a little care.</p></div></div>
    </div>
    <div className="experience-photo"><img src="https://images.unsplash.com/photo-1547592180-85f173990554?w=1000&q=85" alt="Plant-based fasting platter"/><span>FASTING EXPERIENCE</span></div>
   </section>

   <section className="fasting-section"><div><span className="eyebrow">FASTING EXPERIENCE</span><h2>Fully plant-based,<br/>every day.</h2><p>A dedicated fasting menu with no dairy, egg or meat — shiro, beyaynetu, fish dishes, vegetable wraps and fresh juices, cooked on separate pans.</p><div className="pill-row"><span>Dairy free</span><span>Separate prep</span><span>All day</span></div><Link href="/menu?category=Fasting" className="primary-cta">Browse fasting dishes <ArrowRight size={17}/></Link></div></section>

   <section className="recommend"><div className="section-head"><div><span className="eyebrow">FOR YOU</span><h2>Recommended today</h2></div><Link href="/menu" className="view-all">View All <ChevronRight size={16}/></Link></div><div className="recommend-row">{products.filter(p=>p.available).slice(3,7).map(p=><ProductCard key={p.id} product={p} compact/>)}</div></section>

   <section className="inside"><div className="section-head"><div><span className="eyebrow">INSIDE AMORE</span><h2>@amore.cafe</h2></div></div><div className="gallery-grid">{["photo-1509042239860-f550ce710b93","photo-1547592166-23ac45744acd","photo-1525351484163-7529414344d8","photo-1626700051175-6818013e1d4f","photo-1567620905732-2d1ec7ab7445","photo-1515003197210-e0cd71810b5f"].map((x,i)=><img key={x} src={`https://images.unsplash.com/${x}?auto=format&fit=crop&q=78&w=700`} alt={`Amore gallery ${i+1}`}/>)}</div></section>

   <section className="visit"><div><span className="eyebrow">FIND US</span><h2>Visit us today</h2><p>3PPP+MR2, Kombolcha, Ethiopia</p><p>Mon–Sun 7:00–22:00</p><a href="https://www.google.com/maps/search/?api=1&query=Amore+Cafe+Kombolcha" target="_blank">Get directions <ArrowRight size={16}/></a></div><div className="visit-map"><MapPin size={28}/><strong>Amore Cafe</strong><span>Kombolcha, Ethiopia</span></div></section>

   <section className="newsletter"><span className="eyebrow">STAY IN THE LOOP</span><h2>New dishes, fasting specials<br/>and weekend offers.</h2><div><input placeholder="Email address"/><button>Subscribe</button></div></section>
  </main>
 </Page>
}
