import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-family-base",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sentiment Event Insights",
  description:
    "Understand how communities feel about policies, infrastructure, and public events through sentiment and emotion analytics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body>
        <div className="app-shell">
          <Navigation />
          <main className="content-area">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
