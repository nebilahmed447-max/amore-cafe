import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { GoogleTranslateLoader } from "@/components/GoogleTranslate";
export const metadata:Metadata={title:"Amore Cafe | Made with amore",description:"Amore Cafe — Kombolcha"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><GoogleTranslateLoader/><Providers>{children}</Providers></body></html>}
