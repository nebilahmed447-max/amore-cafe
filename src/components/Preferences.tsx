"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";

export type Language = "en" | "am";
type Theme = "light" | "dark";

type PreferencesValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const PreferencesContext = createContext<PreferencesValue | null>(null);

const translations: Record<string, string> = {
  "Home":"መነሻ", "Menu":"ምናሌ", "Offers":"ቅናሾች", "Track Order":"ትዕዛዝ ይከታተሉ", "Gallery":"ፎቶዎች", "About":"ስለ እኛ", "Contact":"ያግኙን", "Favorites":"የተወደዱ", "Cart":"ጋሪ", "View Cart":"ጋሪውን ይመልከቱ",
  "Special Offers":"ልዩ ቅናሾች", "QR codes":"QR ኮዶች", "Fasting menu":"የጾም ምናሌ", "Scan at your table":"በጠረጴዛዎ ላይ ስካን ያድርጉ",
  "Explore":"ያስሱ", "Exclusive Offers":"ልዩ ቅናሾች", "About us":"ስለ እኛ", "Your Amore":"የእርስዎ Amore",
  "WELCOME TO AMORE":"ወደ AMORE እንኳን በደህና መጡ", "Made with amore.":"በአሞሬ የተሰራ።", "What's on the menu?":"ምናሌው ላይ ምን አለ?", "Popular picks":"ተወዳጅ ምርጫዎች", "View All":"ሁሉንም ይመልከቱ",
  "Today's specials":"የዛሬ ልዩ ምግቦች", "Chef-selected favorites, freshly prepared and available while supplies last.":"በሼፉ የተመረጡ ተወዳጅ ምግቦች፣ ትኩስ ተዘጋጅተው እስካሉ ድረስ።",
  "See the offer":"ቅናሹን ይመልከቱ", "Visit Amore to enjoy this exclusive offer.":"ይህን ልዩ ቅናሽ ለመደሰት Amoreን ይጎብኙ።",
  "THE AMORE EXPERIENCE 🤍":"የAMORE ተሞክሮ 🤍", "Small kitchen,":"ትንሽ ኩሽና፣", "big care.":"ትልቅ እንክብካቤ።",
  "Market-fresh daily":"በየቀኑ ትኩስ ምርቶች", "Produce picked each morning, prepped in small batches through the day.":"በየጠዋቱ የሚመረጡ ትኩስ ምርቶች፣ በቀኑ በትንንሽ ዙሮች ይዘጋጃሉ።",
  "Ready in minutes":"በደቂቃዎች ዝግጁ", "Freshly prepared and brought warm to your table.":"ትኩስ ተዘጋጅተው ሞቅ ብለው ወደ ጠረጴዛዎ ይመጣሉ።",
  "Made with amore":"በአሞሬ የተሰራ", "Every plate is finished by hand — spices, sauces and a little care.":"እያንዳንዱ ምግብ በእጅ በቅመማ ቅመም፣ በሶስ እና በትንሽ እንክብካቤ ይጠናቀቃል።",
  "FASTING EXPERIENCE":"የጾም ተሞክሮ", "Fully plant-based,":"ሙሉ በሙሉ ከእፅዋት፣", "every day.":"በየቀኑ።",
  "A dedicated fasting menu with no dairy, egg or meat — shiro, beyaynetu, fish dishes, vegetable wraps and fresh juices, cooked on separate pans.":"የጾም ምናሌ፣ ወተት፣ እንቁላል ወይም ስጋ ሳይኖረው — ሽሮ፣ በያይነቱ፣ የዓሳ ምግቦች፣ የአትክልት ራፕ እና ትኩስ ጭማቂዎች፣ በተለየ መጥበሻ የሚዘጋጁ።",
  "Dairy free":"ወተት የለውም", "Separate prep":"በተለየ ዝግጅት", "All day":"ቀኑን ሙሉ", "Browse fasting dishes":"የጾም ምግቦችን ይመልከቱ",
  "Recommended today":"የዛሬ ምርጫ", "Visit us today":"ዛሬ ይጎብኙን", "Get directions":"አቅጣጫ ይመልከቱ", "STAY IN THE LOOP":"ወቅታዊ መረጃ ያግኙ", "New dishes, fasting specials":"አዲስ ምግቦች፣ የጾም ልዩ ምግቦች", "and weekend offers.":"እና የሳምንቱ መጨረሻ ቅናሾች።", "Subscribe":"ይመዝገቡ",
  "Burgers":"በርገር", "Pizzas":"ፒዛ", "Chicken":"ዶሮ", "Sandwiches":"ሳንድዊች", "Wraps":"ራፕ", "Pasta & Salads":"ፓስታ እና ሰላጣ", "Fasting":"ጾም", "Fish":"ዓሳ", "Hot Drinks":"ትኩስ መጠጦች", "Iced Coffee":"ቀዝቃዛ ቡና", "Juices & Mojitos":"ጭማቂ እና ሞጂቶ", "Milkshakes":"ሚልክሼክ", "Cakes & Pastries":"ኬክ እና ፓስትሪ", "Bottled":"በጠርሙስ",
  "Cart is empty.":"ጋሪው ባዶ ነው።", "Your cart is empty.":"ጋሪዎ ባዶ ነው።", "Browse menu":"ምናሌውን ይመልከቱ", "Summary":"ማጠቃለያ", "Subtotal":"ንዑስ ድምር", "Total":"ጠቅላላ", "Checkout":"ክፍያ መፈጸሚያ",
  "Order received.":"ትዕዛዝዎ ደርሷል።", "Track your order":"ትዕዛዝዎን ይከታተሉ", "Order number":"የትዕዛዝ ቁጥር", "Current status":"የአሁኑ ሁኔታ", "Order progress":"የትዕዛዝ ሂደት", "Order more":"ተጨማሪ ይዘዙ",
  "Gallery":"ፎቶ ማዕከል", "YOUR AMORE":"የእርስዎ AMORE", "AMORE CAFE ADMIN":"AMORE CAFE አስተዳደር", "Checking access…":"መዳረሻ በመፈተሽ ላይ…", "Connecting securely to Amore Cafe.":"ከ Amore Cafe ጋር በደህና በመገናኘት ላይ።", "Welcome back.":"እንኳን ደህና መጡ።", "Food menu":"የምግብ ምናሌ", "Homepage Photos":"የመነሻ ገጽ ፎቶዎች", "Inside Amore":"Inside Amore", "Orders":"ትዕዛዞች", "Overview":"አጠቃላይ እይታ", "Recent orders":"የቅርብ ጊዜ ትዕዛዞች", "No orders yet.":"እስካሁን ትዕዛዝ የለም።", "Search food...":"ምግብ ይፈልጉ...", "No favorites yet":"እስካሁን የተወደደ የለም", "Explore Menu":"ምናሌውን ያስሱ",
};

const reverseTranslations = Object.fromEntries(Object.entries(translations).map(([en,am])=>[am,en]));

function translateTree(root: HTMLElement, language: Language){
  const map = language === "am" ? translations : reverseTranslations;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  nodes.forEach(textNode => {
    const value = textNode.nodeValue || "";
    const trimmed = value.trim();
    if (!trimmed || !map[trimmed]) return;
    textNode.nodeValue = value.replace(trimmed, map[trimmed]);
  });
  root.querySelectorAll<HTMLElement>("input,textarea").forEach(el=>{
    const attr = el.getAttribute("placeholder");
    if(attr && map[attr]) el.setAttribute("placeholder", map[attr]);
  });
}

export function PreferencesProvider({children}:{children:React.ReactNode}){
  const [language,setLanguage] = useState<Language>("en");
  const [theme,setTheme] = useState<Theme>("light");
  useEffect(()=>{
    const savedLanguage = localStorage.getItem("amore-language") as Language | null;
    const savedTheme = localStorage.getItem("amore-theme") as Theme | null;
    if(savedLanguage === "am" || savedLanguage === "en") setLanguage(savedLanguage);
    if(savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
  },[]);
  useEffect(()=>{
    localStorage.setItem("amore-language",language);
    document.documentElement.lang = language;
    const run = () => translateTree(document.body, language);
    run();
    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(run);
    });
    observer.observe(document.body, {childList:true, subtree:true});
    return () => observer.disconnect();
  },[language]);
  useEffect(()=>{
    localStorage.setItem("amore-theme",theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  },[theme]);
  const value = useMemo(()=>({language,setLanguage,theme,setTheme}),[language,theme]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(){ const value=useContext(PreferencesContext); if(!value) throw new Error("usePreferences must be inside PreferencesProvider"); return value; }

export function LanguageButton(){
  const {language,setLanguage}=usePreferences();
  return <button className="lang-btn" aria-label={language === "en" ? "Amharic" : "English"} title={language === "en" ? "Amharic" : "English"} onClick={()=>setLanguage(language === "en" ? "am" : "en")}>{language === "en" ? "አማ" : "EN"}</button>;
}

export function ThemeButton(){
  const {theme,setTheme}=usePreferences();
  const dark=theme === "dark";
  return <button className="theme-btn icon-btn" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Night mode"} onClick={()=>setTheme(dark ? "light" : "dark")}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>;
}
