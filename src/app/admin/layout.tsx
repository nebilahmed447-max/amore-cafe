import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Amore Cafe Admin",
  description: "Amore Cafe management dashboard",
  manifest: "/admin-manifest.json",
  applicationName: "Amore Cafe Admin",
  appleWebApp: { capable: true, title: "Amore Admin", statusBarStyle: "default" },
  icons: { icon: "/admin-icon-192.png", apple: "/admin-apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#303846", width: "device-width", initialScale: 1 };
export default function AdminLayout({ children }: { children: React.ReactNode }) { return children; }
