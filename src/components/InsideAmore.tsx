"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/supabase";

const fallback = [
  "photo-1509042239860-f550ce710b93",
  "photo-1547592166-23ac45744acd",
  "photo-1525351484163-7529414344d8",
  "photo-1626700051175-6818013e1d4f",
  "photo-1567620905732-2d1ec7ab7445",
  "photo-1515003197210-e0cd71810b5f",
];

export default function InsideAmore(){
 const [photos,setPhotos]=useState<string[]>([]);
 useEffect(()=>{
   let active=true;
   supabase.from("inside_amore_photos").select("image_url").order("created_at",{ascending:false}).then(({data})=>{
     if(active && data?.length) setPhotos(data.map(row=>String(row.image_url)));
   },()=>{});
   return()=>{active=false};
 },[]);
 const images=photos.length?photos:fallback.map(x=>`https://images.unsplash.com/${x}?auto=format&fit=crop&q=78&w=900`);
 return <section className="inside">
   <div className="section-head"><div><span className="eyebrow">INSIDE AMORE</span><h2>@amore_cafe</h2></div></div>
   <div className="gallery-grid">{images.map((src,i)=><img key={`${src}-${i}`} src={src} alt={`Amore Cafe inside ${i+1}`} loading="lazy"/>)}</div>
 </section>;
}
