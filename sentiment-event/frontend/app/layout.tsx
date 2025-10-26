'use client';

import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import BlueberryFarm from "@/components/BlueberryFarm";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-family-base",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const maxScroll = 800;
      const progress = Math.min(scrollY / maxScroll, 1);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <html lang="en" className={nunito.variable}>
      <body>
        <div className="app-shell">
          <BlueberryFarm />
          <div 
            style={{
              opacity: isHomePage ? scrollProgress : 1,
              transition: 'opacity 0.3s ease',
              pointerEvents: (isHomePage && scrollProgress < 0.3) ? 'none' : 'auto',
            }}
          >
            <Navigation />
          </div>
          <main className="content-area">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
