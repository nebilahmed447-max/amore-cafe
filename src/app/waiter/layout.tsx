import type { Metadata, Viewport } from "next";
export const metadata: Metadata = {
  title: "Amore Waiter",
  description: "Amore Cafe waiter and service staff panel",
  manifest: "/waiter-manifest.json",
  applicationName: "Amore Waiter",
  appleWebApp: { capable: true, title: "Amore Waiter", statusBarStyle: "default" },
  icons: { icon: "/waiter-icon-192.png", apple: "/waiter-apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#b36b22", width: "device-width", initialScale: 1 };
export default function WaiterLayout({ children }: { children: React.ReactNode }) { return children; }
