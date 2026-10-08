import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Amore Cafe Admin",
  description: "Amore Cafe management dashboard",
  manifest: "/admin-manifest.json",
  appleWebApp: { capable: true, title: "Amore Admin", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#20685c",
  width: "device-width",
  initialScale: 1,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
