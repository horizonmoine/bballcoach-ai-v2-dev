import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "BballCoach AI",
  description:
    "Coaching basket-ball avec IA et tracking biomécanique en temps réel. Analyse de tir, posture et mécanique propulsée par Gemini.",
  manifest: "/manifest.json",
  openGraph: {
    title: "BballCoach AI",
    description: "Ton coach basket IA personnel — analyse biomécanique en temps réel.",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BballCoach AI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className="bg-neutral-950 text-white selection:bg-orange-500 selection:text-white overscroll-none">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
