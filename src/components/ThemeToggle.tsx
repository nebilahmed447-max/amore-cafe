"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle(){
  const [dark,setDark]=useState(false);
  useEffect(()=>{
    const saved=localStorage.getItem("amore-theme");
    const isDark=saved === "dark";
    document.documentElement.dataset.theme=isDark?"dark":"light";
    setDark(isDark);
  },[]);
  const toggle=()=>{
    const next=!dark;
    localStorage.setItem("amore-theme",next?"dark":"light");
    document.documentElement.dataset.theme=next?"dark":"light";
    setDark(next);
  };
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={dark?"Switch to light mode":"Switch to dark mode"} title={dark?"Light mode":"Dark mode"}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>;
}
