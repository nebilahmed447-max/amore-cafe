import type { Metadata, Viewport } from "next";
export const metadata: Metadata = {
  title: "Amore Delivery",
  description: "Amore Cafe delivery staff panel",
  manifest: "/delivery-manifest.json",
  applicationName: "Amore Delivery",
  appleWebApp: { capable: true, title: "Amore Delivery", statusBarStyle: "default" },
  icons: { icon: "/delivery-icon-192.png", apple: "/delivery-apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#167c68", width: "device-width", initialScale: 1 };
export default function DeliveryLayout({ children }: { children: React.ReactNode }) { return children; }
