"use client";
import Link from "next/link";
import { Heart, Search, ShoppingBag, Menu, X, Home, UtensilsCrossed, ReceiptText, MapPin, Info, Phone, Star } from "lucide-react";
import Image from "next/image";
import { LanguageButton } from "./GoogleTranslate";
import { useCart, useFavorites } from "./Providers";
import { usePathname } from "next/navigation";
import { useState } from "react";
import InstallAppButton from "./InstallAppButton";
import ThemeToggle from "./ThemeToggle";

const nav = [
  ["Foods","/menu?category=Burgers"],
  ["Drinks","/menu?category=Hot%20Drinks"],
  ["Special","/offers"],
  ["Bakery","/menu?category=Cakes%20%26%20Pastries"],
  ["Fasting","/menu?category=Fasting"]
];

export function Header(){
  const {count}=useCart();
  const {favoriteIds}=useFavorites();
  const [open,setOpen]=useState(false);
  const path=usePathname();
  const close=()=>setOpen(false);
  return <>
    <header className="amore-header">
      <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-4 sm:px-5">
        <Link href="/" className="brand brand-logo" onClick={close}><Image src="/amore-logo.png" alt="Amore Cafe" width={78} height={104} priority/><span>AMORECafe</span></Link>
        <nav className="hidden md:flex items-center gap-7">
          <Link href="/" className="nav-link">Home</Link>
          <Link href="/menu" className="nav-link">Menu</Link>
          <Link href="/offers" className="nav-link">Offers</Link>
          <Link href="/track-order" className="nav-link">Track Order</Link>
          <Link href="/gallery" className="nav-link">Gallery</Link>
          <Link href="/about" className="nav-link">About</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/menu" aria-label="Search menu" className="icon-btn header-search-btn"><Search size={19}/></Link>
          <Link href="/favorites" aria-label="Favorites" className="icon-btn hidden sm:grid favorite-header-btn"><Heart size={19} fill={favoriteIds.length?"currentColor":"none"}/>{favoriteIds.length>0&&<b>{favoriteIds.length}</b>}</Link>
          <Link href="/cart" aria-label="Cart" className="cart-btn">
            <ShoppingBag size={19}/><span>Cart</span>{count>0&&<b>{count}</b>}
          </Link>
          <InstallAppButton compact/>
          <ThemeToggle/>
          <LanguageButton/>
          <button type="button" aria-label={open?"Close menu":"Open menu"} aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="icon-btn mobile-menu-btn">{open?<X size={21}/>:<Menu size={21}/>}</button>
        </div>
      </div>
    </header>
    {open&&<div className="mobile-menu-backdrop" onClick={close}>
      <aside className="mobile-drawer" onClick={e=>e.stopPropagation()}>
        <div className="mobile-drawer-head"><div><span className="eyebrow">AMORE CAFE</span><h2>Menu</h2></div><button className="icon-btn" onClick={close} aria-label="Close menu"><X size={20}/></button></div>
        <div className="mobile-drawer-links">
          {[["Home","/",Home],["Menu","/menu",UtensilsCrossed],["Special Offers","/offers",Star],["Favorites","/favorites",Heart],["Track Order","/track-order",ReceiptText],["Gallery","/gallery",MapPin],["About","/about",Info],["Contact","/contact",Phone]].map(([label,href,Icon]:any)=><Link key={href} href={href} onClick={close} className={path===href|| (href!=="/"&&path.startsWith(href))?"active":""}><Icon size={19}/><span>{label}</span><ChevronRightSmall/></Link>)}
        </div>
        <div className="mobile-drawer-footer">
          <div className="mobile-install-row"><div className="mobile-theme-row"><span className="mobile-language-label">Appearance</span><ThemeToggle/></div><InstallAppButton/></div><div className="mobile-language-row">
            <span className="mobile-language-label">Language / ቋንቋ</span>
            <LanguageButton/>
          </div>
          <Link href="/cart" onClick={close} className="mobile-drawer-cart"><ShoppingBag size={18}/><span>View Cart</span>{count>0&&<b>{count} items</b>}</Link>
        </div>
      </aside>
    </div>}
  </>
}

function ChevronRightSmall(){return <span className="drawer-chevron">›</span>}

export function MobileNav(){
 const path=usePathname();
 return <nav className="mobile-nav">
   <Link href="/" className={path==="/"?"active":""}><Home size={18}/><small>Home</small></Link>
   <Link href="/menu" className={path.startsWith("/menu")?"active":""}><UtensilsCrossed size={18}/><small>Menu</small></Link>
   <Link href="/favorites" className={path.startsWith("/favorites")?"active":""}><Heart size={18}/><small>Favorites</small></Link>
   <Link href="/cart" className={path.startsWith("/cart")?"active":""}><ShoppingBag size={18}/><small>Cart</small></Link>
   <Link href="/track-order" className={path.startsWith("/track-order")?"active":""}><ReceiptText size={18}/><small>Track</small></Link>
 </nav>
}

export function Footer(){
 return <footer className="footer">
   <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
     <div><div className="brand footer-brand brand-logo"><Image src="/amore-logo.png" alt="Amore Cafe" width={64} height={85}/><span>AMORECafe</span></div><p className="footer-copy">Burgers, pizza, fasting dishes and freshly brewed Ethiopian coffee. A full fasting menu, every day of the week.</p></div>
     <div><h4>Explore</h4><Link href="/">Home</Link><Link href="/menu">Menu</Link><Link href="/offers">Exclusive Offers</Link><Link href="/track-order">Track Order</Link><Link href="/gallery">Gallery</Link></div>
     <div><h4>Amore</h4><Link href="/about">About us</Link><Link href="/contact">Contact</Link><Link href="/qr-order">QR codes</Link><Link href="/favorites">Favorites</Link></div>
     <div><h4>Your Amore</h4><Link href="/menu?category=Fasting">Fasting menu</Link><Link href="/qr-order">Scan at your table</Link><p className="footer-copy mt-4">3PPP+MR2, Kombolcha, Ethiopia<br/>+251986239807<br/>amorecafe83@gmail.com</p></div>
   </div>
   <div className="footer-bottom">© 2026 Amore. All rights reserved. developed by More Lines</div>
 </footer>
}
export function Page({children}:{children:React.ReactNode}){return <><Header/><div className="page-in">{children}</div><Footer/><MobileNav/></>}
