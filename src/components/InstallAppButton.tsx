"use client";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type Props = { compact?: boolean; appName?: string };
export default function InstallAppButton({ compact = false, appName = "Amore Cafe" }: Props) {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    setInstalled(standalone);
    const onBeforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);
  if (installed) return null;
  const install = async () => {
    if (prompt) {
      await (prompt as any).prompt();
      await (prompt as any).userChoice;
      setPrompt(null);
      return;
    }
    alert(`To install ${appName}: on iPhone/iPad open this page in Safari, tap Share, then Add to Home Screen. On Android or supported desktop browsers, open the browser menu and choose Install app / Add to Home screen.`);
  };
  return <button type="button" onClick={install} className={compact ? "install-btn compact" : "install-btn"}>
    <Download size={compact ? 16 : 17} /><span>{compact ? "Install" : `Install ${appName}`}</span>
  </button>;
}
