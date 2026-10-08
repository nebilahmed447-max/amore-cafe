"use client";
import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

export default function InstallAppButton({compact=false}:{compact?:boolean}){
 const [prompt,setPrompt]=useState<any>(null);
 const [installed,setInstalled]=useState(false);
 useEffect(()=>{
   const standalone=window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone===true;
   setInstalled(standalone);
   const onBeforeInstall=(e:any)=>{e.preventDefault();setPrompt(e)};
   window.addEventListener("beforeinstallprompt",onBeforeInstall);
   return()=>window.removeEventListener("beforeinstallprompt",onBeforeInstall);
 },[]);
 if(installed) return null;
 const install=async()=>{
   if(prompt){ await prompt.prompt(); await prompt.userChoice; setPrompt(null); return; }
   alert("To install Amore Cafe: on iPhone/iPad use Share → Add to Home Screen. On Android or supported desktop browsers, use the browser menu → Install app / Add to Home screen.");
 };
 return <button type="button" onClick={install} className={compact?"install-btn compact":"install-btn"}><Download size={compact?16:17}/><span>{compact?"Install":"Install Amore App"}</span></button>;
}
