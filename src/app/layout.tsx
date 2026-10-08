import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { GoogleTranslateLoader } from "@/components/GoogleTranslate";
export const metadata:Metadata={
 title:"Amore Cafe | Made with amore",
 description:"Amore Cafe — Kombolcha",
 manifest:"/manifest.json",
 applicationName:"Amore Cafe",
 appleWebApp:{capable:true,title:"Amore Cafe",statusBarStyle:"default"},
 icons:{icon:"/icons/icon-192.png",apple:"/icons/apple-touch-icon.png"}
};
export const viewport:Viewport={themeColor:"#20685c",width:"device-width",initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><script dangerouslySetInnerHTML={{__html:`(()=>{try{document.documentElement.dataset.theme=localStorage.getItem("amore-theme")==="dark"?"dark":"light"}catch{document.documentElement.dataset.theme="light"}})()`}}/><GoogleTranslateLoader/><script dangerouslySetInnerHTML={{__html:`if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));}`}}/><Providers>{children}</Providers></body></html>}
