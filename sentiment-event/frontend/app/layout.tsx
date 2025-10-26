import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import OrbitalBackground from "@/components/OrbitalBackground";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-family-base",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "blueberri Product Pulse",
  description:
    "Understand how customers across the globe feel about your products and feature launches with sentiment and emotion analytics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body>
        <div className="app-shell">
          <OrbitalBackground />
          <Navigation />
          <main className="content-area">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
