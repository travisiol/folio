import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, Literata } from "next/font/google";
import { Footer, Navbar } from "@/components/Chrome";
import { Providers } from "@/components/Providers";
import { ConnectHost } from "@/components/wallet/ConnectButton";
import { site } from "@/config/site";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const literata = Literata({ subsets: ["latin"], variable: "--font-literata", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-plex-mono", display: "swap" });

const TITLE = `${site.name} — ${site.hook}`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: TITLE, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: { title: TITLE, description: site.description, siteName: site.name, type: "website" },
};

export const viewport: Viewport = { themeColor: "#141411", colorScheme: "dark", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${literata.variable} ${plexMono.variable}`}>
      <body className="min-h-svh">
        <Providers>
          <Navbar />
          <main>{children}</main>
          <Footer />
          <ConnectHost />
        </Providers>
      </body>
    </html>
  );
}
