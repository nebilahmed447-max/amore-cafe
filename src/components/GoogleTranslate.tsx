"use client";
import Script from "next/script";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: any;
  }
}

export function GoogleTranslateLoader() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          { pageLanguage: "en", includedLanguages: "en,am", autoDisplay: false },
          "google_translate_element"
        );
        setReady(true);
      }
    };
    return () => { delete window.googleTranslateElementInit; };
  }, []);
  return <>
    <Script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" strategy="afterInteractive" onLoad={() => setReady(true)} />
    <div id="google_translate_element" className={`google-translate-host ${ready ? "ready" : ""}`} aria-hidden="true" />
  </>;
}

function setTranslateCookie(language: string) {
  const value = `/en/${language}`;
  document.cookie = `googtrans=${value};path=/`;
  document.cookie = `googtrans=${value};path=/;domain=${window.location.hostname}`;
}

export function LanguageButton() {
  const [language, setLanguage] = useState<"en" | "am">("en");

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )googtrans=\/en\/([^;]+)/);
    if (match?.[1] === "am") setLanguage("am");
  }, []);

  const change = (next: "en" | "am") => {
    setLanguage(next);
    setTranslateCookie(next);
    const select = document.querySelector<HTMLSelectElement>(".goog-te-combo");
    if (select) {
      select.value = next;
      select.dispatchEvent(new Event("change"));
      return;
    }
    // Google Translate may still be loading; the cookie makes the next navigation use the selected language.
    window.location.reload();
  };

  return <button className="lang-btn" aria-label={language === "en" ? "Translate to Amharic" : "Translate to English"} onClick={() => change(language === "en" ? "am" : "en")}>
    {language === "en" ? "አማ" : "EN"}
  </button>;
}
